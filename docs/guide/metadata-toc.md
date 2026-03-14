# 元数据与目录

## 元数据

通过 `reader.metadata` 访问书籍的元数据信息：

```typescript
const meta = reader.metadata;

meta.title         // 书名
meta.creators      // 作者列表 Author[]
meta.language      // 语言
meta.identifier    // 唯一标识（ISBN 等）
meta.publisher     // 出版社
meta.publishDate   // 出版日期
meta.modifiedDate  // 修改日期
meta.description   // 简介
meta.subjects      // 分类标签
meta.rights        // 版权信息
meta.coverImageId  // 封面图 manifest ID
meta.meta          // 附加元数据 Record<string, string>
```

### 获取封面图

```typescript
const coverBlob = await reader.getCoverImage();
```

### Author 类型

```typescript
interface Author {
  name: string;
  role?: string;    // 如 'aut'（作者）、'edt'（编辑）等
  fileAs?: string;  // 排序用名称
}
```

## 目录

通过 `reader.toc` 访问书籍目录：

```typescript
const toc = reader.toc;
```

### TocItem 结构

```typescript
interface TocItem {
  id: string;
  label: string;         // 目录标题
  href: string;          // 章节路径
  spineIndex: number;    // 对应的 spine 索引
  children: TocItem[];   // 子目录
  playOrder?: number;    // 播放顺序（NCX 目录中可选）
}
```

### 跳转到目录项

```typescript
await renderer.goToTocItem(toc[3]);
```

### TocSource 类型

```typescript
type TocSource = 'ncx' | 'nav';  // 目录来源：EPUB 2 NCX 或 EPUB 3 Nav
```

## EpubReader 完整 API

```typescript
// 静态工厂方法
EpubReader.fromFile(file: File): Promise<EpubReader>
EpubReader.fromUrl(url: string, fetchOptions?: RequestInit): Promise<EpubReader>
EpubReader.fromRemoteUrl(entryUrl: string, fetchOptions?: RequestInit): Promise<EpubReader>
EpubReader.fromArrayBuffer(buffer: ArrayBuffer): Promise<EpubReader>
EpubReader.fromArchive(archive: IEpubArchive, opfPath?: string): Promise<EpubReader>

// 实例属性（只读）
reader.metadata      // EpubMetadata — 书籍元数据
reader.toc           // TocItem[] — 目录
reader.spine         // ReadonlyArray<SpineItem> — 阅读顺序
reader.resolvedSpine // ReadonlyArray<ResolvedSpineItem> — 解析后的 spine（含实际路径）
reader.manifest      // ReadonlyMap<string, ManifestItem> — 资源清单
reader.guide         // ReadonlyArray<GuideReference> — 导航引用
reader.resources     // ResourceResolver — 资源解析器实例

// 实例方法
reader.createRenderer(options: RendererOptions): Promise<ContentRenderer>
reader.getCoverImage(): Promise<Blob | null>
reader.getChapterContent(spineIndex: number): Promise<string>
reader.getResource(id: string): Promise<Blob>
reader.getResourceByHref(href: string): Promise<Blob>
reader.destroy(): void

// 事件（继承自 TypedEventEmitter）
reader.on(event, handler)
reader.once(event, handler)
reader.off(event, handler)
reader.removeAllListeners()
```
