# EPUB Reader 开发文档

## 架构概览

```
epub-reader/
├── src/
│   ├── index.ts                    公共 API 导出
│   ├── core/                       EPUB 解析核心
│   │   ├── epub-parser.ts          解析总调度（EpubReader 类）
│   │   ├── epub-archive.ts         JSZip 包装层
│   │   ├── container-parser.ts     META-INF/container.xml 解析
│   │   ├── opf-parser.ts           .opf 元数据/manifest/spine 解析
│   │   ├── ncx-parser.ts           EPUB 2 NCX 目录解析
│   │   ├── nav-parser.ts           EPUB 3 导航文档解析
│   │   ├── spine-resolver.ts       Spine 项 → 文件路径映射
│   │   ├── resource-resolver.ts    资源路径解析 + Blob URL 管理
│   │   └── xml-utils.ts            DOMParser 工具函数
│   ├── renderer/                   内容渲染
│   │   ├── content-renderer.ts     渲染总调度（Shadow DOM）
│   │   ├── style-injector.ts       CSS 注入 + 主题系统
│   │   ├── image-resolver.ts       图片 → Blob URL 替换
│   │   └── pagination.ts           CSS 多列分页
│   ├── cfi/                        EPUB CFI 引擎
│   │   ├── cfi-parser.ts           CFI 字符串 → 结构化对象
│   │   ├── cfi-generator.ts        DOM Range → CFI 字符串
│   │   ├── cfi-resolver.ts         CFI 字符串 → DOM Range
│   │   └── cfi-types.ts            CFI 类型定义
│   ├── annotations/                SVG 标注系统
│   │   ├── annotation-manager.ts   标注 CRUD + 章节生命周期
│   │   ├── annotation-layer.ts     SVG 叠加层 + 按章节分组管理
│   │   ├── highlight-renderer.ts   高亮渲染（SVG rect）
│   │   ├── underline-renderer.ts   下划线渲染（SVG line/path）
│   │   ├── note-renderer.ts        笔记标记渲染（SVG circle + HTML 弹框）
│   │   ├── drawing-renderer.ts     手绘渲染（SVG path + RDP 简化）
│   │   ├── text-selection-handler.ts  文本选择 → Range → CFI
│   │   ├── interaction-handler.ts  点击/悬停/模式切换
│   │   └── annotation-serializer.ts  JSON 序列化/反序列化
│   ├── events/
│   │   ├── event-emitter.ts        类型安全的 EventEmitter
│   │   └── event-types.ts          所有事件载荷类型定义
│   └── types/                      类型定义
│       ├── epub.ts                 EPUB 结构类型
│       ├── toc.ts                  目录类型
│       ├── annotation.ts           标注类型体系
│       ├── renderer.ts             渲染器选项 + 主题类型
│       └── common.ts               通用类型
├── examples/vanilla/               原生 JS 使用示例
├── rollup.config.ts                构建配置
└── tsconfig.json                   TypeScript 配置
```

## 设计原则

1. **零框架依赖**：纯 TypeScript + DOM API，任何前端环境可用
2. **数据与渲染分离**：标注数据（CFI）独立于 DOM 生命周期，支持持久化
3. **样式隔离**：Shadow DOM 隔离书籍样式，不污染宿主页面
4. **分层架构**：解析、渲染、标注三层解耦，可独立使用

---

## 一、EPUB 解析链路

### 1.1 EPUB 文件格式

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

### 1.2 解析流程

```
EpubReader.fromFile(file)
    │
    ▼
┌─ epub-archive.ts ─────────────────────────────┐
│  JSZip 解压 ZIP，提供 readText/readBlob 接口   │
└───────────────────────────────────────────────┘
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
  可访问 metadata / toc / spine / manifest
```

### 1.3 资源解析（resource-resolver.ts）

EPUB 内的资源（图片、CSS、字体）不能直接在浏览器中通过路径引用，需要转换为 Blob URL：

```
ZIP 内路径: OEBPS/images/cover.jpg
    │
    ▼ epub-archive.readBlob()
    │
    Blob 对象
    │
    ▼ URL.createObjectURL()
    │
    blob:http://...  ← 可直接在 <img src> 中使用
```

`ResourceResolver` 维护一个 `Map<string, string>` 缓存已生成的 Blob URL，在 `destroy()` 时逐一 `revokeObjectURL` 释放内存。

---

## 二、内容渲染方案

### 2.1 为什么选择 Shadow DOM

对比三种方案：

| 方案 | 样式隔离 | DOM API 可用性 | 坐标系 | 复杂度 |
|---|---|---|---|---|
| 直接插入 DOM | 无隔离，书籍 CSS 污染宿主 | 完全可用 | 统一 | 低 |
| iframe | 完全隔离 | 跨文档，Selection/Range 受限 | 需跨 frame 换算 | 高 |
| **Shadow DOM** | **隔离（shadow boundary）** | **同文档，API 完全可用** | **统一** | **中** |

选择 Shadow DOM 的核心原因：
- 样式隔离：书籍自带的 CSS 不会影响宿主页面
- 同文档：`Range.getClientRects()`、`Selection` 等 API 直接可用，不需要跨 frame 通信
- 统一坐标系：标注 SVG 和内容在同一坐标空间，无需坐标转换

### 2.2 DOM 结构

```
[用户传入的 container]
└── div.epub-reader-wrapper (position:relative, overflow:hidden/auto)
    └── #shadow-root (open)
        ├── <style>           ← 动态生成的 CSS（书籍样式 + 主题 + 分页/滚动布局）
        ├── div.epub-body     ← 章节 HTML 内容（id="epub-spine-{N}"）
        └── svg.epub-annotation-layer (position:absolute, 叠加在内容之上)
            └── g[data-chapter-id]    ← 每个章节的 SVG 分组
                ├── g.highlights      ← <rect> 高亮
                ├── g.underlines      ← <line>/<path> 下划线
                ├── g.notes           ← <circle> 笔记标记
                └── g.drawings        ← <path> 手绘
```

### 2.3 渲染流程（content-renderer.ts → display()）

```
display(spineIndex)
    │
    ├─ reader.getChapterContent(spineIndex)    读取 XHTML 原文
    │
    ├─ imageResolver.resolveImages(xhtml, href) 图片路径 → Blob URL
    │
    ├─ extractBody(xhtml)                      提取 <body> 内容，过滤 <script>
    │
    ├─ extractStyles(xhtml)                    提取 <style> 块，scopeCSS 限定作用域
    │
    ├─ styleInjector.buildContentStyles()      生成主题 CSS
    ├─ styleInjector.buildPaginationStyles()   或 buildScrolledStyles()
    │
    ├─ styleEl.textContent = css               注入 <style>
    ├─ contentEl.innerHTML = bodyHtml           注入内容
    ├─ contentEl.id = chapterId                设置章节 ID
    │
    ├─ waitForImages()                         等待图片加载完成
    │
    ├─ paginator.apply() 或 scrollTop=0        应用分页/滚动
    │
    └─ annotations.onChapterMounted()          通知标注层渲染
```

### 2.4 分页模式（pagination.ts）

使用 CSS 多列布局实现分页，不拆分 DOM：

```css
.epub-body {
  column-width: {pageWidth}px;
  column-gap: {gap}px;
  column-fill: auto;
  height: {pageHeight}px;
  overflow: hidden;
}
```

翻页通过 `transform: translateX(-pageWidth * currentPage)` 实现视口偏移。

**优势**：
- 浏览器原生排版，自动处理段落跨页
- 内容完整保留在 DOM 中，标注 CFI 始终可解析
- 性能好，浏览器自动跳过不可见区域的绘制

### 2.5 滚动模式

```css
.epub-body {
  padding: {padding}px;
}
/* wrapper: overflow-y: auto */
```

章节内容自然流式排列，wrapper 容器提供滚动条。监听 `scroll` 事件计算阅读进度。

### 2.6 主题系统（style-injector.ts）

`StyleInjector` 维护一个 `ReaderTheme` 对象，`buildContentStyles()` 将其转换为 CSS 规则：

```
ReaderTheme 属性        →  CSS 规则
─────────────────────────────────────────
fontSize: 18           →  :host { font-size: 18px }
fontFamily: 'Georgia'  →  :host { font-family: Georgia }
color: '#333'          →  .epub-body { color: #333 }
backgroundColor        →  :host { background-color: ... }
lineHeight: 2          →  .epub-body { line-height: 2 }
paragraphSpacing: 16   →  .epub-body p { margin-bottom: 16px }
letterSpacing           →  .epub-body { letter-spacing: ... }
textAlign: 'justify'   →  .epub-body { text-align: justify }
linkColor              →  .epub-body a { color: ... }
imageOpacity           →  .epub-body img { opacity: ... }
padding                →  .epub-body { padding: ... }
```

调用 `updateTheme()` 时，重新生成 CSS 并写入 `<style>` 元素，触发浏览器重排。分页模式下在下一帧用 `requestAnimationFrame` 重新计算分页。

---

## 三、CFI 引擎

### 3.1 什么是 EPUB CFI

EPUB Canonical Fragment Identifier（CFI）是 EPUB 标准中用于定位文本位置的字符串格式，类似于 DOM 的 XPath。

格式：`epubcfi(/6/{spineStep}!/{localPath}:{charOffset})`

示例：`epubcfi(/6/8!/4/2/1:12)` 表示：
- `/6` — 固定前缀（EPUB package 的 spine 元素）
- `/8` — spine 第 4 项（(3+1)*2=8，CFI 用偶数表示元素）
- `!` — 分隔符（spine 引用 vs 章节内路径）
- `/4/2/1:12` — 章节内路径：第 2 个元素的第 1 个元素的第 1 个文本节点的第 12 个字符

### 3.2 CFI 索引规则

```
DOM 子节点:  [TextNode] [Element] [TextNode] [Element] [TextNode]
CFI 索引:        1         2         3         4         5

元素用偶数（2, 4, 6...），文本节点用奇数（1, 3, 5...）
```

### 3.3 生成（cfi-generator.ts）

```
用户选中文本 → Range { startContainer, startOffset }
    │
    ▼
nodeToPath(textNode, offset, rootElement)
    │
    ├─ 记录 charOffset = offset
    ├─ 计算文本节点在兄弟中的奇数索引
    ├─ 向上遍历到 rootElement（contentElement），每层记录偶数索引
    │
    ▼
  拼接: "/4/2/1:12"
    │
    ▼
  "epubcfi(/6/{spineStep}!/4/2/1:12)"
```

**关键设计**：`rootElement` 是 `contentElement`（div.epub-body），不是 `document.body`。因为内容在 Shadow DOM 中，从 Shadow DOM 向上遍历会穿越 ShadowRoot 产生错误路径。

### 3.4 解析（cfi-resolver.ts）

```
"epubcfi(/6/8!/4/2/1:12)"
    │
    ▼ parseCfi()
    │
    spineStep=8, localPath=[/4, /2, /1], charOffset=12
    │
    ▼ resolveCfi(cfi, rootElement)
    │
    从 rootElement 开始向下遍历：
    /4 → 第 2 个子元素
    /2 → 第 1 个子元素
    /1 → 第 1 个文本节点
    :12 → 偏移 12
    │
    ▼
  { node: TextNode, offset: 12 }
    │
    ▼ doc.createRange()
    │
  DOM Range 对象 ← 可用于高亮渲染
```

---

## 四、SVG 标注系统

### 4.1 为什么用 SVG 叠加层

- **分辨率无关**：矢量图形，缩放不失真
- **不污染内容 DOM**：标注元素在独立的 SVG 层，不修改章节 HTML
- **原生交互**：SVG 元素支持 `pointer-events`，可精确捕获点击/悬停
- **手绘自然**：SVG `<path>` 天然适合自由曲线

### 4.2 章节容器化架构

标注系统按章节管理 SVG 分组，每个章节有独立的 SVG `<g>` 容器：

```
svg.epub-annotation-layer
├── g[data-chapter-id="epub-spine-0"]     ← 第 0 章的标注
│   ├── g.highlights
│   ├── g.underlines
│   ├── g.notes
│   └── g.drawings
├── g[data-chapter-id="epub-spine-1"]     ← 第 1 章的标注
│   ├── ...
```

**为什么要按章节分组？**

为懒加载做准备。当前单章模式下，切换章节时 `unmountChapter(旧章)` → `mountChapter(新章)`，效果和之前一样。未来如果实现多章同时渲染（懒加载滚动），多个章节的标注 SVG 独立共存、互不干扰。

### 4.3 章节生命周期

```
AnnotationManager
├── chapterRoots: Map<chapterId, HTMLElement>   ← 已挂载章节的 DOM 根
├── onChapterMounted(spineIndex, rootElement)   ← 章节 DOM 可用
│   ├── 注册 rootElement
│   ├── layer.mountChapter(chapterId)           ← 创建 SVG 分组
│   └── renderChapterAnnotations()              ← 从数据恢复标注
│
└── onChapterUnmounted(spineIndex)              ← 章节 DOM 销毁
    ├── 移除 rootElement 注册
    └── layer.unmountChapter(chapterId)          ← 删除 SVG 分组（数据保留）
```

**数据层不受影响**：`annotations: Map<id, Annotation>` 始终保留全部标注数据。只有 SVG 渲染元素跟随章节 DOM 的挂载/卸载。

### 4.4 标注创建流程

```
用户选中文本 → 点击"高亮"按钮
    │
    ▼
TextSelectionHandler.getSelection()
    ├─ shadowRoot.getSelection() ?? document.getSelection()
    ├─ 校验 selection 在 contentElement 内
    ├─ generateCfiRange(range, spineIndex, contentElement)
    └─ return { text, range, cfiRange }
    │
    ▼
AnnotationManager.highlightSelection('yellow')
    ├─ 获取 chapterId = renderer.chapterId
    ├─ 获取 chapterGroup = layer.getChapterGroup(chapterId)
    ├─ 创建 HighlightAnnotation { id, spineIndex, chapterId, anchor: { startCfi, endCfi }, ... }
    ├─ layer.getRangeRects(range)
    │   └─ range.getClientRects() → transformRect() → SVG 坐标
    ├─ highlightRenderer.render(annotation, rects, chapterGroup.highlights)
    │   └─ 为每个 rect 创建 <rect> SVG 元素，设置 fill/opacity/data-annotation-id
    ├─ annotations.set(id, annotation)  ← 数据存储
    └─ emit('annotation:created')       ← 通知外部
```

### 4.5 标注恢复流程

```
切换章节 / 导入 JSON / 页面刷新 + localStorage 加载
    │
    ▼
onChapterMounted(spineIndex, rootElement)
    │
    ▼
renderChapterAnnotations(spineIndex, chapterId, rootElement, svgGroup)
    │
    ▼ 遍历该章节的所有标注
    │
    ▼ renderExistingAnnotation(annotation, rootElement, svgGroup)
    │
    ├─ cfiRangeToRange(startCfi, endCfi, rootElement)
    │   ├─ resolveCfi(startCfi, rootElement) → { node, offset }
    │   ├─ resolveCfi(endCfi, rootElement)   → { node, offset }
    │   └─ doc.createRange() → range
    │
    ├─ layer.getRangeRects(range)  → 坐标
    │
    └─ renderer.render(annotation, rects, svgGroup.highlights)
```

**关键点**：CFI 解析的 `rootElement` 必须是该章节的 `contentElement`。生成和解析使用同一个根节点，路径才能正确对应。

### 4.6 坐标映射

SVG 叠加层通过 `position:absolute` 覆盖在内容之上，坐标转换逻辑：

```
range.getClientRects()  → 视口坐标 (viewport-relative)
    │
    ▼ transformRect()
    │
    svgX = rect.x - wrapperRect.x + scrollLeft
    svgY = rect.y - wrapperRect.y + scrollTop
    │
    ▼
  SVG 叠加层坐标 (wrapper-relative)
```

因为 Shadow DOM 和宿主在同一文档中，坐标系统一，不需要跨 frame 的坐标换算。

### 4.7 交互模式

`InteractionHandler` 管理三种模式的事件分发：

| 模式 | SVG pointer-events | 行为 |
|---|---|---|
| `select` | `none`（SVG 层透明） | 用户可选中文本，标注元素仍可点击（各自设置了 `pointer-events:all`） |
| `draw` | `all`（SVG 层捕获） | 指针事件被 SVG 层拦截，用于手绘 |
| `view` | `none` | 只读模式，仅笔记标记可点击 |

### 4.8 手绘简化算法

`DrawingRenderer` 使用 Ramer-Douglas-Peucker (RDP) 算法简化手绘路径：

```
原始采样点（数百个） → RDP 简化（tolerance=2px） → 简化路径（数十个点）
```

简化后的路径存储为 SVG path 的 `d` 属性字符串，减少数据体积，渲染更流畅。

---

## 五、构建输出

### 5.1 Rollup 配置

输出三种格式：

```
dist/
├── epub-reader.esm.js      ESM（import/export）
├── epub-reader.cjs.js      CJS（require）
├── epub-reader.umd.js      UMD（浏览器全局变量 / AMD）
└── index.d.ts              TypeScript 类型声明
```

- `jszip` 作为 external，不打包进产物
- 使用 `@rollup/plugin-terser` 压缩
- 使用 `rollup-plugin-dts` 生成合并的 `.d.ts` 声明文件

### 5.2 TypeScript 配置

```json
{
  "target": "ES2020",
  "lib": ["ES2021", "DOM", "DOM.Iterable"],
  "module": "ESNext",
  "moduleResolution": "bundler",
  "strict": true
}
```

- `target: ES2020`：支持 `??`、`?.`、`Promise.allSettled` 等
- `lib: ES2021`：支持 `String.prototype.replaceAll`
- `strict: true`：严格类型检查

---

## 六、扩展指南

### 6.1 懒加载扩展

当前单章模式下，`onChapterMounted` 会自动 unmount 其他章节。实现懒加载时只需：

1. 每个章节创建独立的 `div`，设置 `id = getChapterId(spineIndex)`
2. 章节进入视口时调用 `annotations.onChapterMounted(spineIndex, element)`
3. 章节离开视口时调用 `annotations.onChapterUnmounted(spineIndex)`
4. 去掉 `onChapterMounted` 中自动 unmount 其他章节的逻辑

标注数据层无需任何改动。

### 6.2 仿真翻页扩展

推荐方案：CSS 多列分页保持不变（所有内容在 DOM 中），翻页动画用双视口裁切 + CSS 3D Transform 叠加在上面。

动画只是视觉层面的"表演"，不涉及 DOM 拆分，标注系统零改动。

### 6.3 自定义标注类型

扩展 `AnnotationType` 和 `Annotation` 联合类型，创建对应的 `Renderer`，在 `AnnotationManager` 中注册即可。

### 6.4 框架集成

```typescript
// Vue 3
const reader = shallowRef<EpubReader | null>(null);
const renderer = shallowRef<ContentRenderer | null>(null);

onMounted(async () => {
  reader.value = await EpubReader.fromFile(file);
  renderer.value = await reader.value.createRenderer({
    container: viewerRef.value,
    mode: 'paginated',
  });
  await renderer.value.display(0);
});

onUnmounted(() => {
  renderer.value?.destroy();
  reader.value?.destroy();
});
```

```typescript
// React
useEffect(() => {
  let r: EpubReader, rd: ContentRenderer;
  (async () => {
    r = await EpubReader.fromFile(file);
    rd = await r.createRenderer({ container: viewerRef.current, mode: 'paginated' });
    await rd.display(0);
  })();
  return () => { rd?.destroy(); r?.destroy(); };
}, [file]);
```
