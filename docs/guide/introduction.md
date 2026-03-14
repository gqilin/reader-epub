# 简介

xml-ebook 是一个纯 TypeScript 的浏览器端 EPUB 解析和标注库，不依赖任何框架，可在 Vue、React、原生 JS 中使用。

## 核心能力

- **EPUB 解析** — 解析 EPUB 文件，获取元数据、目录、章节内容
- **Shadow DOM 渲染** — 支持分页和滚动两种阅读模式，分页模式支持双栏（Spread）显示
- **SVG 标注系统** — 高亮、下划线、笔记、手绘
- **主题 API** — 字体、字号、颜色、行高、段间距等
- **标注持久化** — JSON 导入/导出
- **远程 EPUB 加载** — 支持打包和解包两种远程格式
- **EPUB CFI 引擎** — 精确文本定位，可独立使用

## 安装

```bash
npm install xml-ebook
```

JSZip 作为 peerDependency，需要同时安装：

```bash
npm install jszip
```

## 下一步

前往 [快速开始](/guide/getting-started) 了解如何在项目中使用 xml-ebook。
