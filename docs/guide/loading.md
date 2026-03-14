# 加载 EPUB

xml-ebook 支持五种加载方式，覆盖本地文件、远程 URL、自定义源等场景。

## 文件选择器

通过浏览器 File API 加载本地文件：

```typescript
const reader = await EpubReader.fromFile(file);
```

## 远程 URL（打包 .epub）

加载完整的 `.epub` 打包文件，支持自定义请求选项（如认证头）：

```typescript
const reader = await EpubReader.fromUrl('https://example.com/book.epub');

// 带认证头
const reader = await EpubReader.fromUrl('https://example.com/book.epub', {
  headers: { Authorization: 'Bearer token' },
});
```

## 远程解包 EPUB

适用于服务端已将 EPUB 解压为目录结构的场景。传入 `container.xml` 或 `.opf` 文件的 URL，库会自动推导其他资源路径并按需拉取：

```typescript
const reader = await EpubReader.fromRemoteUrl(
  'https://example.com/book/META-INF/container.xml',
  { headers: { Authorization: 'Bearer token' } } // fetchOptions 可选
);
```

底层使用 `RemoteArchive` 类通过 HTTP 逐个加载所需文件，无需一次性下载整个 EPUB。

::: tip 自动检测
`fromUrl` 也支持自动检测：当 URL 以 `container.xml` 或 `.opf` 结尾时，会自动切换为远程解包模式。
:::

## ArrayBuffer

适用于从 IndexedDB 等来源读取的场景：

```typescript
const reader = await EpubReader.fromArrayBuffer(buffer);
```

## 自定义 Archive

`fromArchive` 允许传入自定义的 `IEpubArchive` 实现，适用于以下场景：

- 章节内容需要通过后端 API 获取并解密
- 需要自定义鉴权、缓存、重试等逻辑
- 对接非标准存储（WebDAV、IndexedDB、Service Worker 等）

### IEpubArchive 接口

```typescript
import { EpubReader, type IEpubArchive } from 'xml-ebook';

class EncryptedRemoteArchive implements IEpubArchive {
  constructor(
    private apiBase: string,
    private baseUrl: string,
    private bookId: string,
    private decryptFn: (data: ArrayBuffer) => ArrayBuffer
  ) {}

  async readText(path: string): Promise<string> {
    if (this.isChapterContent(path)) {
      // 章节内容走加密 API
      const resp = await fetch(`${this.apiBase}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: this.bookId, path }),
      });
      const encrypted = await resp.arrayBuffer();
      const decrypted = this.decryptFn(encrypted);
      return new TextDecoder().decode(decrypted);
    }
    // 非章节文件直接获取
    return (await fetch(`${this.baseUrl}/${path}`)).text();
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    if (this.isChapterContent(path)) {
      const resp = await fetch(`${this.apiBase}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: this.bookId, path }),
      });
      return this.decryptFn(await resp.arrayBuffer());
    }
    return (await fetch(`${this.baseUrl}/${path}`)).arrayBuffer();
  }

  async readBlob(path: string, mimeType: string): Promise<Blob> {
    const buffer = await this.readBinary(path);
    return new Blob([buffer], { type: mimeType });
  }

  private isChapterContent(path: string): boolean {
    return /\.(xhtml|html)$/i.test(path);
  }
}
```

### 使用示例

```typescript
const archive = new EncryptedRemoteArchive(
  'https://api.example.com',
  'https://cdn.example.com/books/123',
  'book-123',
  (encrypted) => myDecrypt(encrypted, secretKey)
);

// opfPath 可选：不传则自动通过 archive 读取 container.xml 解析
const reader = await EpubReader.fromArchive(archive);

// 或指定 OPF 路径跳过 container.xml 解析
const reader2 = await EpubReader.fromArchive(archive, 'OEBPS/content.opf');
```

::: info 说明
SDK 内部的全部 EPUB 解析（container.xml → OPF → spine → TOC）和渲染逻辑不变，调用方只需实现「文件怎么读」的策略。
:::
