# EPUB 解析链路

## EPUB 文件格式

EPUB 本质是一个 ZIP 压缩包，包含固定结构：

```
book.epub (ZIP)
├── META-INF/
│   └── container.xml          → 指向 .opf 文件的位置
├── OEBPS/                     （或其他目录名）
│   ├── content.opf            → 元数据 + 资源清单 + 阅读顺序
│   ├── toc.ncx                → EPUB 2 目录（可选）
│   ├── nav.xhtml              → EPUB 3 目录（可选）
│   ├── chapter1.xhtml         → 章节内容
│   ├── chapter2.xhtml
│   ├── style.css              → 样式
│   └── images/                → 图片资源
└── mimetype                   → 固定值 "application/epub+zip"
```

## 归档抽象层（IEpubArchive）

为支持本地和远程两种加载方式，定义了统一的归档接口：

```typescript
interface IEpubArchive {
  readText(path: string): Promise<string>;
  readBlob(path: string, mimeType?: string): Promise<Blob>;
  getEntries(): string[];
}
```

两个内置实现：

| 实现 | 文件 | 场景 |
|---|---|---|
| `EpubArchive` | `epub-archive.ts` | 本地 EPUB（ZIP），使用 JSZip 解压 |
| `RemoteArchive` | `remote-archive.ts` | 远程解包 EPUB，通过 HTTP fetch 逐文件加载 |

## 解析流程

```
EpubReader.fromFile(file) / fromUrl(url) / fromRemoteUrl(url) / fromArchive(archive)
    │
    ▼
┌─ epub-archive.ts 或 remote-archive.ts ──────────┐
│  本地: JSZip 解压 ZIP，提供 readText/readBlob 接口  │
│  远程: HTTP fetch 按需加载，缓存已请求的文件       │
└───────────────────────────────────────────────────┘
    │
    ▼
┌─ container-parser.ts ─────────────────────────┐
│  解析 META-INF/container.xml                   │
│  提取 rootfile 路径（如 OEBPS/content.opf）     │
└───────────────────────────────────────────────┘
    │
    ▼
┌─ opf-parser.ts ───────────────────────────────┐
│  解析 .opf 文件，提取：                         │
│  - metadata: 书名、作者、语言、标识符等          │
│  - manifest: 所有资源清单 (id → href + mediaType)│
│  - spine: 阅读顺序 (idref 列表)                 │
│  - guide: 导航引用（可选）                       │
└───────────────────────────────────────────────┘
    │
    ├─► ncx-parser.ts   (EPUB 2: 解析 toc.ncx)
    ├─► nav-parser.ts   (EPUB 3: 解析 nav.xhtml)
    │
    ▼
┌─ spine-resolver.ts ───────────────────────────┐
│  将 spine 的 idref 映射到 manifest 的实际文件路径 │
│  生成 resolvedSpine: [{ href, mediaType, ... }] │
└───────────────────────────────────────────────┘
    │
    ▼
  EpubReader 实例就绪
  可访问 metadata / toc / spine / manifest / guide
```

## 远程 EPUB 加载

`RemoteArchive` 实现了 `IEpubArchive` 接口，用于加载服务端已解压的 EPUB 目录：

```
fromRemoteUrl('https://example.com/book/META-INF/container.xml')
    │
    ▼
┌─ RemoteArchive ──────────────────────────────────┐
│  1. 从入口 URL 推导基础路径                        │
│  2. 按需 fetch 请求各文件（container.xml → .opf 等）│
│  3. 内部缓存 Map<path, Response>，避免重复请求      │
│  4. readText(): fetch + response.text()            │
│  5. readBlob(): fetch + response.blob()            │
└──────────────────────────────────────────────────┘
```

`fromUrl()` 也支持自动检测：当 URL 以 `container.xml` 或 `.opf` 结尾时，自动切换为 `RemoteArchive` 模式。

## 资源解析

EPUB 内的资源（图片、CSS、字体）不能直接在浏览器中通过路径引用，需要转换为 Blob URL：

```
ZIP 内路径: OEBPS/images/cover.jpg
    │
    ▼ archive.readBlob()
    │
    Blob 对象
    │
    ▼ URL.createObjectURL()
    │
    blob:http://...  ← 可直接在 <img src> 中使用
```

`ResourceResolver` 维护一个 `Map<string, string>` 缓存已生成的 Blob URL，在 `destroy()` 时逐一 `revokeObjectURL` 释放内存。
