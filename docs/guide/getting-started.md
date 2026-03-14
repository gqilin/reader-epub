# 快速开始

## 安装依赖

```bash
npm install xml-ebook jszip
```

## 基本用法

```typescript
import { EpubReader } from 'xml-ebook';

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

## 下一步

- [加载 EPUB](/guide/loading) — 了解所有支持的加载方式
- [渲染器](/guide/renderer) — 深入了解渲染器配置与导航
- [标注系统](/guide/annotations) — 学习如何使用标注功能
