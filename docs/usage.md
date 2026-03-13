# EPUB Reader 使用文档

## 简介

一个纯 TypeScript 的浏览器端 EPUB 解析和标注库，不依赖任何框架，可在 Vue、React、原生 JS 中使用。

**核心能力：**

- 解析 EPUB 文件，获取元数据、目录、章节内容
- Shadow DOM 渲染，支持分页和滚动两种阅读模式
- SVG 标注系统：高亮、下划线、笔记、手绘
- 主题 API：字体、字号、颜色、行高、段间距等
- 标注持久化：JSON 导入/导出

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
// const reader = await EpubReader.fromUrl(url);       // URL
// const reader = await EpubReader.fromArrayBuffer(buf); // ArrayBuffer

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

支持三种加载方式：

```typescript
// 文件选择器
const reader = await EpubReader.fromFile(file);

// 远程 URL
const reader = await EpubReader.fromUrl('https://example.com/book.epub');

// ArrayBuffer（如从 IndexedDB 读取）
const reader = await EpubReader.fromArrayBuffer(buffer);
```

## 元数据

```typescript
const meta = reader.metadata;

meta.title         // 书名
meta.creators      // 作者列表 [{ name, role?, fileAs? }]
meta.language      // 语言
meta.identifier    // 唯一标识（ISBN 等）
meta.publisher     // 出版社
meta.publishDate   // 出版日期
meta.description   // 简介
meta.subjects      // 分类标签
meta.coverImageId  // 封面图 manifest ID

// 获取封面图
const coverBlob = await reader.getCoverImage();
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
}

// 跳转到目录项
await renderer.goToTocItem(toc[3]);
```

## 渲染器

### 创建

```typescript
const renderer = await reader.createRenderer({
  container: document.getElementById('viewer'), // 容器元素
  mode: 'paginated',    // 阅读模式
  columnGap: 40,        // 分页模式下的列间距（px）
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

| 属性 | 类型 | 说明 |
|---|---|---|
| `fontFamily` | `string` | 字体族 |
| `fontSize` | `number` | 字号（px） |
| `fontWeight` | `number \| string` | 字重 |
| `color` | `string` | 文字颜色 |
| `backgroundColor` | `string` | 背景色 |
| `lineHeight` | `number \| string` | 行高 |
| `paragraphSpacing` | `number` | 段间距（px） |
| `letterSpacing` | `number \| string` | 字间距 |
| `textAlign` | `'left' \| 'right' \| 'center' \| 'justify'` | 对齐方式 |
| `padding` | `number \| { top, right, bottom, left }` | 内边距 |
| `linkColor` | `string` | 链接颜色 |
| `imageOpacity` | `number` | 图片透明度（0~1） |

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
```

### 高亮

```typescript
// 用户选中文本后调用
const highlight = annotations.highlightSelection('yellow');
// 颜色: 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | { custom: '#ff0000' }
// 可选第二个参数透明度: annotations.highlightSelection('blue', 0.5)
```

### 下划线

```typescript
const underline = annotations.underlineSelection({
  color: '#e74c3c',
  strokeWidth: 2,
  style: 'solid',  // 'solid' | 'dashed' | 'wavy' | 'strikethrough'
});
```

### 笔记

```typescript
const note = annotations.addNoteToSelection('这是笔记内容');

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
}

// 高亮
interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  anchor: { startCfi, endCfi, textContent };
  color: HighlightColor;
  opacity: number;
}

// 下划线
interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  anchor: { startCfi, endCfi, textContent };
  color: string;
  strokeWidth: number;
  style: 'solid' | 'dashed' | 'wavy' | 'strikethrough';
}

// 笔记
interface NoteAnnotation extends AnnotationBase {
  type: 'note';
  anchor: { startCfi, endCfi, textContent };
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
```

## 事件

### 渲染器事件

```typescript
renderer.on('renderer:ready', () => { ... });
renderer.on('renderer:displayed', ({ spineIndex }) => { ... });
renderer.on('renderer:paginated', (info: PaginationInfo) => { ... });
renderer.on('renderer:resized', ({ width, height }) => { ... });
renderer.on('renderer:selection', ({ text, range, cfiRange }) => { ... });
renderer.on('renderer:click', ({ event }) => { ... });
renderer.on('renderer:error', ({ error }) => { ... });
```

### 标注事件

```typescript
annotations.on('annotation:created', ({ annotation }) => { ... });
annotations.on('annotation:updated', ({ annotation }) => { ... });
annotations.on('annotation:removed', ({ id }) => { ... });
annotations.on('annotation:selected', ({ annotation, event }) => { ... });
annotations.on('annotation:hover', ({ annotation, event }) => { ... });
annotations.on('annotation:drawing:end', ({ annotation }) => { ... });
annotations.on('annotations:imported', ({ count }) => { ... });
annotations.on('annotations:cleared', () => { ... });
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

// 监听文本选择
renderer.on('renderer:selection', ({ text }) => {
  console.log('Selected:', text);
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

// 清理
window.onbeforeunload = () => {
  renderer.destroy();
  reader.destroy();
};
```
