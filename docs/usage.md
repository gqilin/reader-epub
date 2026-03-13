# EPUB Reader 使用文档

## 简介

一个纯 TypeScript 的浏览器端 EPUB 解析和标注库，不依赖任何框架，可在 Vue、React、原生 JS 中使用。

**核心能力：**

- 解析 EPUB 文件，获取元数据、目录、章节内容
- Shadow DOM 渲染，支持分页和滚动两种阅读模式
- SVG 标注系统：高亮、下划线、笔记、手绘
- 主题 API：字体、字号、颜色、行高、段间距等
- 标注持久化：JSON 导入/导出
- 远程 EPUB 加载：支持打包和解包两种远程格式
- EPUB CFI 引擎：精确文本定位，可独立使用

## 安装

```bash
npm install epub-reader
```

JSZip 作为 peerDependency，需要同时安装：

```bash
npm install jszip
```

## 快速开始

```typescript
import { EpubReader } from 'epub-reader';

// 1. 加载 EPUB 文件
const reader = await EpubReader.fromFile(file);       // File API
// const reader = await EpubReader.fromUrl(url);       // URL（打包 .epub）
// const reader = await EpubReader.fromRemoteUrl(url); // 远程解包 EPUB
// const reader = await EpubReader.fromArrayBuffer(buf); // ArrayBuffer
// const reader = await EpubReader.fromArchive(archive); // 自定义 Archive 实现

// 2. 获取书籍信息
console.log(reader.metadata.title);
console.log(reader.metadata.creators);
console.log(reader.toc);

// 3. 创建渲染器
const renderer = await reader.createRenderer({
  container: document.getElementById('viewer'),
  mode: 'paginated',   // 'paginated' | 'scrolled'
  columnGap: 40,
  theme: {
    fontSize: 16,
    lineHeight: 1.8,
    color: '#333',
    backgroundColor: '#fff',
  },
});

// 4. 显示第一章
await renderer.display(0);

// 5. 翻页
await renderer.next();
await renderer.prev();
```

## 加载 EPUB

支持五种加载方式：

```typescript
// 文件选择器
const reader = await EpubReader.fromFile(file);

// 远程 URL（打包的 .epub 文件）
const reader = await EpubReader.fromUrl('https://example.com/book.epub');

// 支持传入 fetchOptions 自定义请求（如认证头）
const reader = await EpubReader.fromUrl('https://example.com/book.epub', {
  headers: { Authorization: 'Bearer token' },
});

// 远程解包 EPUB（目录结构形式，传入 container.xml 或 .opf 入口 URL）
const reader = await EpubReader.fromRemoteUrl(
  'https://example.com/book/META-INF/container.xml',
  { headers: { Authorization: 'Bearer token' } } // fetchOptions 可选
);

// ArrayBuffer（如从 IndexedDB 读取）
const reader = await EpubReader.fromArrayBuffer(buffer);
```

### 远程解包 EPUB 说明

`fromRemoteUrl` 适用于服务端已将 EPUB 解压为目录结构的场景。传入 `container.xml` 或 `.opf` 文件的 URL，库会自动推导其他资源路径并按需拉取。底层使用 `RemoteArchive` 类通过 HTTP 逐个加载所需文件，无需一次性下载整个 EPUB。

`fromUrl` 也支持自动检测：当 URL 以 `container.xml` 或 `.opf` 结尾时，会自动切换为远程解包模式。

### 自定义 Archive（加密章节、自定义 API 等）

`fromArchive` 允许传入自定义的 `IEpubArchive` 实现，适用于以下场景：

- 章节内容需要通过后端 API 获取并解密
- 需要自定义鉴权、缓存、重试等逻辑
- 对接非标准存储（WebDAV、IndexedDB、Service Worker 等）

```typescript
import { EpubReader, type IEpubArchive } from 'epub-reader';

// 实现自定义 Archive
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
    // 非章节文件（container.xml、OPF、CSS 等）直接获取
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

// 使用
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

SDK 内部的全部 EPUB 解析（container.xml → OPF → spine → TOC）和渲染逻辑不变，调用方只需实现「文件怎么读」的策略。

## 元数据

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

// 获取封面图
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

```typescript
const toc = reader.toc;

// TocItem 结构
interface TocItem {
  id: string;
  label: string;         // 目录标题
  href: string;          // 章节路径
  spineIndex: number;    // 对应的 spine 索引
  children: TocItem[];   // 子目录
  playOrder?: number;    // 播放顺序（NCX 目录中可选）
}

// 跳转到目录项
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

## 渲染器

### 创建

```typescript
const renderer = await reader.createRenderer({
  container: document.getElementById('viewer'), // 容器元素
  mode: 'paginated',    // 阅读模式
  columnGap: 40,        // 分页模式下的列间距（px），默认 40
  theme: { ... },       // 初始主题
  customStyles: '',     // 自定义 CSS
});
```

### 导航

```typescript
// 显示指定章节
await renderer.display(spineIndex);

// 翻页（分页模式下翻页，最后一页自动跳下一章）
const hasNext = await renderer.next();
const hasPrev = await renderer.prev();

// 跳转到目录项
await renderer.goToTocItem(tocItem);

// 通过 EPUB CFI 跳转到精确位置（支持 paginated 和 scrolled 模式）
await renderer.goToCfi('epubcfi(/6/4!/4/2/1:0)');
```

### 阅读进度

```typescript
const info = renderer.pagination;

info.currentPage      // 当前页码（分页模式）
info.totalPages       // 总页数（当前章节）
info.spineIndex       // 当前章节索引
info.chapterProgress  // 章节进度 0~1
info.bookProgress     // 全书进度 0~1

// 监听进度变化
renderer.on('renderer:paginated', (info) => {
  console.log(`第 ${info.currentPage + 1} / ${info.totalPages} 页`);
});
```

### 渲染器属性（只读）

```typescript
renderer.spineIndex        // 当前章节索引
renderer.chapterId         // 当前章节容器 ID
renderer.mode              // 当前阅读模式 'paginated' | 'scrolled'
renderer.contentShadowRoot // Shadow DOM 根节点
renderer.contentElement    // 章节内容 DOM 元素
renderer.wrapperElement    // 外层包装 DOM 元素
renderer.annotations       // 标注管理器实例
renderer.pagination        // 分页信息
```

### 窗口重置

```typescript
// 容器大小变化后重新计算布局
renderer.resize();
```

### 选择工具栏

```typescript
// 手动关闭选择工具栏
renderer.dismissSelectionToolbar();
```

### 阅读模式切换

```typescript
// 重新创建渲染器切换模式
renderer.destroy();
const newRenderer = await reader.createRenderer({
  container: viewer,
  mode: 'scrolled',  // 切换为滚动模式
});
await newRenderer.display(0);
```

## 链接点击处理

渲染器会自动拦截 EPUB 内容中的 `<a>` 标签点击事件：

- **锚点链接**（`#id`）：自动滚动到当前章节的指定位置
- **内部跨章链接**（`chapter2.xhtml#section`）：自动导航到目标章节
- **外部链接**（`http://...`）：在新标签页打开，同时触发 `renderer:link-click` 事件

```typescript
renderer.on('renderer:link-click', ({ href, isExternal, event }) => {
  if (isExternal) {
    console.log('用户点击了外部链接:', href);
    // 可 event.preventDefault() 阻止默认行为
  }
});
```

## 主题 API

### 设置完整主题

```typescript
renderer.setTheme({
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  color: '#333',
  backgroundColor: '#f5e6c8',
  lineHeight: 2,
  paragraphSpacing: 16,
  letterSpacing: '0.5px',
  textAlign: 'justify',
  padding: 24,
  linkColor: '#1a73e8',
  imageOpacity: 0.9,
});
```

### 局部更新

```typescript
// 只修改部分属性，其他保持不变
renderer.updateTheme({
  fontSize: 20,
  lineHeight: 2.5,
});
```

### 便捷方法

```typescript
renderer.setFontSize(18);
renderer.setFontFamily('Georgia, serif');
renderer.setColor('#333');
renderer.setBackgroundColor('#1a1a1a');
renderer.setLineHeight(2);
renderer.setParagraphSpacing(16);
renderer.setLetterSpacing('0.5px');
renderer.setTextAlign('justify');
```

### 获取当前主题

```typescript
const theme = renderer.getTheme();
console.log(theme.fontSize); // 18
```

### 注入自定义 CSS

```typescript
renderer.injectCSS(`
  p { text-indent: 2em; }
  img { max-width: 100%; }
`);
```

### ReaderTheme 完整属性

| 属性 | 类型 | 说明 | 默认值 |
|---|---|---|---|
| `fontFamily` | `string` | 字体族 | — |
| `fontSize` | `number` | 字号（px） | — |
| `fontWeight` | `number \| string` | 字重 | — |
| `color` | `string` | 文字颜色 | — |
| `backgroundColor` | `string` | 背景色 | — |
| `lineHeight` | `number \| string` | 行高 | — |
| `paragraphSpacing` | `number` | 段间距（px） | — |
| `letterSpacing` | `number \| string` | 字间距 | — |
| `textAlign` | `'left' \| 'right' \| 'center' \| 'justify'` | 对齐方式 | — |
| `padding` | `number \| { top, right, bottom, left }` | 内边距 | `24px 16px` |
| `linkColor` | `string` | 链接颜色 | — |
| `imageOpacity` | `number` | 图片透明度（0~1） | — |

## 标注系统

### 初始化

```typescript
const annotations = await renderer.initAnnotations();
```

### 交互模式

```typescript
annotations.setMode('select');  // 文本选择模式（默认）
annotations.setMode('draw');    // 手绘模式
annotations.setMode('view');    // 只读查看模式

// 获取当前模式
const currentMode = annotations.mode; // 'select' | 'draw' | 'view'
```

### 高亮

```typescript
// 用户选中文本后调用
const highlight = annotations.highlightSelection('yellow');
// 颜色: 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | { custom: '#ff0000' }
// 可选第二个参数透明度: annotations.highlightSelection('blue', 0.5)
// 默认透明度为 0.35
```

### 下划线

```typescript
const underline = annotations.underlineSelection({
  color: '#e74c3c',      // 默认 '#e74c3c'
  strokeWidth: 2,
  style: 'solid',  // 'solid' | 'dashed' | 'wavy' | 'strikethrough'
});
```

### 笔记

```typescript
const note = annotations.addNoteToSelection('这是笔记内容');
// 默认笔记颜色为 '#f39c12'

// 修改笔记内容
annotations.updateNoteContent(note.id, '更新后的内容');
```

### 手绘

```typescript
annotations.setMode('draw');

// 设置画笔属性
annotations.setDrawingOptions({
  stroke: '#e74c3c',
  strokeWidth: 3,
  opacity: 0.8,
});

// 用户在页面上拖动即可绘制，松手自动保存
```

### 查询

```typescript
// 获取单个标注
const a = annotations.getAnnotation(id);

// 获取所有标注
const all = annotations.getAllAnnotations();

// 获取某章节的标注
const chapter3 = annotations.getAnnotationsForSpine(3);
const chapter3Alt = annotations.getAnnotationsForChapter('epub-spine-3');
```

### 删除

```typescript
annotations.removeAnnotation(id);   // 删除单个
annotations.clearAllAnnotations();   // 清除全部
```

### 刷新标注渲染

```typescript
// 重新渲染当前章节的所有标注（如页面 resize 后）
annotations.refreshAnnotations();
```

### 导出/导入

```typescript
// 导出为 JSON 字符串
const json = annotations.toJSON();

// 导入（合并到已有标注）
annotations.fromJSON(json, 'merge');

// 导入（替换所有标注）
annotations.fromJSON(json, 'replace');

// 结构化导出/导入
const store = annotations.exportAnnotations();
annotations.importAnnotations(store, 'merge');
```

### 标注数据结构

```typescript
// 所有标注共有字段
interface AnnotationBase {
  id: string;
  type: 'highlight' | 'underline' | 'note' | 'drawing';
  createdAt: string;
  updatedAt: string;
  spineIndex: number;    // 所在章节索引
  chapterId: string;     // 章节容器 ID
  userData?: Record<string, unknown>; // 自定义用户数据，可附加任意业务信息
}

// 文本锚点
interface TextAnchor {
  startCfi: string;
  endCfi: string;
  textContent: string;
}

// 高亮
interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  anchor: TextAnchor;
  color: HighlightColor;
  opacity: number;
}

// 下划线
interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  anchor: TextAnchor;
  color: string;
  strokeWidth: number;
  style: UnderlineStyle; // 'solid' | 'dashed' | 'wavy' | 'strikethrough'
}

// 笔记
interface NoteAnnotation extends AnnotationBase {
  type: 'note';
  anchor: TextAnchor;
  content: string;
  color: string;
}

// 手绘
interface DrawingAnnotation extends AnnotationBase {
  type: 'drawing';
  paths: DrawingPath[];
  viewportWidth: number;
  viewportHeight: number;
}

// 联合类型
type Annotation = HighlightAnnotation | UnderlineAnnotation | NoteAnnotation | DrawingAnnotation;
type AnnotationType = 'highlight' | 'underline' | 'note' | 'drawing';
```

## 事件

### EpubReader 事件

```typescript
reader.on('book:ready', ({ metadata }) => {
  console.log('书籍加载完成:', metadata.title);
});

reader.on('book:error', ({ error }) => {
  console.error('加载出错:', error);
});
```

### 渲染器事件

```typescript
renderer.on('renderer:ready', () => { ... });
renderer.on('renderer:displayed', ({ spineIndex }) => { ... });
renderer.on('renderer:paginated', (info: PaginationInfo) => { ... });
renderer.on('renderer:resized', ({ width, height }) => { ... });
renderer.on('renderer:selection', ({ text, range, cfiRange }) => { ... });
renderer.on('renderer:click', ({ event }) => { ... });

// 选择工具栏事件 — 当用户选中文本后触发，包含定位信息，适合用于弹出工具栏
renderer.on('renderer:selection-toolbar', ({ visible, position, text, cfiRange }) => {
  if (visible && position) {
    showToolbar(position.x, position.y);
    console.log('选中文本:', text);
    console.log('CFI 范围:', cfiRange.start, '~', cfiRange.end);
  } else {
    hideToolbar();
  }
});

// 链接点击事件 — 当用户点击 EPUB 内容中的链接时触发
renderer.on('renderer:link-click', ({ href, isExternal, event }) => {
  console.log(`链接点击: ${href}, 外部链接: ${isExternal}`);
});
```

#### SelectionToolbarPosition 类型

```typescript
interface SelectionToolbarPosition {
  x: number;     // 工具栏推荐 x 坐标
  y: number;     // 工具栏推荐 y 坐标
  selectionRect: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}
```

### 标注事件

```typescript
annotations.on('annotation:created', ({ annotation }) => { ... });
annotations.on('annotation:updated', ({ annotation }) => { ... });
annotations.on('annotation:removed', ({ id }) => { ... });
annotations.on('annotation:selected', ({ annotation, event }) => { ... });
annotations.on('annotation:hover', ({ annotation, event }) => {
  // 注意：annotation 可能为 null（鼠标离开标注区域时）
});
annotations.on('annotation:drawing:start', () => { ... });
annotations.on('annotation:drawing:end', ({ annotation }) => { ... });
annotations.on('annotations:imported', ({ count }) => { ... });
annotations.on('annotations:cleared', () => { ... });
```

### 事件方法

所有事件发射器（`reader`、`renderer`、`annotations`）均支持以下方法：

```typescript
emitter.on(event, handler)              // 监听
emitter.once(event, handler)            // 单次监听
emitter.off(event, handler)             // 取消监听
emitter.removeAllListeners()            // 移除所有监听器
```

## CFI 引擎公共 API

EPUB CFI（Canonical Fragment Identifier）引擎可独立使用，用于精确定位文本位置：

```typescript
import {
  parseCfi,
  spineIndexToCfiStep,
  cfiStepToSpineIndex,
  generateCfi,
  generateCfiRange,
  resolveCfi,
  cfiRangeToRange,
} from 'epub-reader';

// 解析 CFI 字符串为结构化对象
const cfi = parseCfi('epubcfi(/6/8!/4/2/1:12)');

// spine 索引与 CFI step 互转
const step = spineIndexToCfiStep(3);        // 3 → 8
const index = cfiStepToSpineIndex(8);       // 8 → 3

// 从 DOM Range 生成 CFI
const cfiStr = generateCfi(range, spineIndex, rootElement);
const cfiRange = generateCfiRange(range, spineIndex, rootElement);
// cfiRange = { start: 'epubcfi(...)', end: 'epubcfi(...)' }

// 从 CFI 解析回 DOM 位置
const result = resolveCfi('epubcfi(/6/8!/4/2/1:12)', rootElement);
// result = { node: TextNode, offset: 12 }

// 从 CFI 范围恢复 DOM Range
const domRange = cfiRangeToRange(startCfi, endCfi, rootElement);
```

## 资源解析器

`ResourceResolver` 管理 EPUB 内部资源的路径解析和 Blob URL 生成：

```typescript
const resources = reader.resources;

// 获取资源（返回 Blob）
const blob = await reader.getResource(manifestId);
const blob2 = await reader.getResourceByHref('images/cover.jpg');
```

## 工具函数

```typescript
import { getChapterId } from 'epub-reader';

// 根据 spine 索引生成章节容器 ID
const id = getChapterId(0); // 'epub-spine-0'
```

## 序列化器

`AnnotationSerializer` 提供独立的标注数据序列化/反序列化能力：

```typescript
import { AnnotationSerializer } from 'epub-reader';

// 序列化标注数据为 AnnotationStore 对象
const store = AnnotationSerializer.serialize(bookId, annotationsMap);

// 序列化为 JSON 字符串
const json = AnnotationSerializer.toJSON(bookId, annotationsMap);

// 反序列化
const store = AnnotationSerializer.deserialize(json);
const store2 = AnnotationSerializer.fromJSON(json);
```

## 导出类型汇总

以下类型均从 `epub-reader` 包导出，可用于 TypeScript 类型标注：

```typescript
import type {
  // EPUB 结构
  EpubBook,
  EpubMetadata,
  ManifestItem,
  SpineItem,
  GuideReference,
  Author,
  TocItem,
  TocSource,

  // 渲染器
  RendererOptions,
  PaginationInfo,
  ViewportRect,
  ReaderTheme,

  // 标注
  Annotation,
  AnnotationType,
  AnnotationBase,
  HighlightAnnotation,
  UnderlineAnnotation,
  UnderlineStyle,
  NoteAnnotation,
  DrawingAnnotation,
  DrawingPath,
  TextAnchor,
  HighlightColor,
  AnnotationStore,

  // 事件
  EpubReaderEvents,
  RendererEvents,
  AnnotationEvents,
  SelectionToolbarPosition,

  // 其他
  IEpubArchive,
  ChapterSvgGroup,
  Disposable,
} from 'epub-reader';
```

## 销毁

```typescript
renderer.destroy();  // 销毁渲染器（同时销毁标注管理器）
reader.destroy();    // 销毁阅读器（释放 blob URL 等资源）
```

## 完整示例

```typescript
import { EpubReader } from 'epub-reader';

const viewer = document.getElementById('viewer');

// 加载
const reader = await EpubReader.fromFile(file);

// 监听加载事件
reader.on('book:ready', ({ metadata }) => {
  console.log('已加载:', metadata.title);
});

// 渲染
const renderer = await reader.createRenderer({
  container: viewer,
  mode: 'paginated',
  theme: { fontSize: 16, lineHeight: 1.8, padding: 24 },
});

// 标注
const annotations = await renderer.initAnnotations();

// 显示第一章
await renderer.display(0);

// 监听进度
renderer.on('renderer:paginated', (info) => {
  console.log(`Progress: ${Math.round(info.bookProgress * 100)}%`);
});

// 监听文本选择（弹出工具栏）
renderer.on('renderer:selection-toolbar', ({ visible, position, text, cfiRange }) => {
  if (visible && position) {
    // 在 position.x, position.y 显示工具栏
    showToolbar(position.x, position.y, text);
  } else {
    hideToolbar();
  }
});

// 监听链接点击
renderer.on('renderer:link-click', ({ href, isExternal }) => {
  if (isExternal) {
    console.log('外部链接:', href);
  }
});

// 翻页按钮
prevBtn.onclick = () => renderer.prev();
nextBtn.onclick = () => renderer.next();

// 高亮按钮
highlightBtn.onclick = () => {
  annotations.highlightSelection('yellow');
};

// 主题切换
darkBtn.onclick = () => {
  renderer.updateTheme({
    color: '#e0e0e0',
    backgroundColor: '#1a1a1a',
  });
};

// 导出标注
exportBtn.onclick = () => {
  const json = annotations.toJSON();
  localStorage.setItem('my-annotations', json);
};

// 窗口变化时重新布局
window.onresize = () => renderer.resize();

// 清理
window.onbeforeunload = () => {
  renderer.destroy();
  reader.destroy();
};
```
