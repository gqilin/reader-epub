# SVG 标注系统

## 为什么用 SVG 叠加层

- **分辨率无关** — 矢量图形，缩放不失真
- **不污染内容 DOM** — 标注元素在独立的 SVG 层，不修改章节 HTML
- **原生交互** — SVG 元素支持 `pointer-events`，可精确捕获点击/悬停
- **手绘自然** — SVG `<path>` 天然适合自由曲线

## 章节容器化架构

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

### 为什么要按章节分组？

为懒加载做准备。当前单章模式下，切换章节时 `unmountChapter(旧章)` → `mountChapter(新章)`，效果和之前一样。未来如果实现多章同时渲染（懒加载滚动），多个章节的标注 SVG 独立共存、互不干扰。

## 章节生命周期

```
AnnotationManager
├── chapterRoots: Map<chapterId, HTMLElement>   ← 已挂载章节的 DOM 根
├── onChapterMounted(spineIndex, rootElement)   ← 章节 DOM 可用
│   ├── 注册 rootElement
│   ├── layer.mountChapter(chapterId)           ← 创建 SVG 分组
│   └── renderChapterAnnotations()              ← 从数据恢复标注
│
├── onChapterUnmounted(spineIndex)              ← 章节 DOM 销毁
│   ├── 移除 rootElement 注册
│   └── layer.unmountChapter(chapterId)          ← 删除 SVG 分组（数据保留）
│
└── refreshAnnotations()                         ← 重新渲染当前章节标注
    └── 清除 SVG → 重新从数据恢复
```

::: info 数据层不受影响
`annotations: Map<id, Annotation>` 始终保留全部标注数据。只有 SVG 渲染元素跟随章节 DOM 的挂载/卸载。
:::

## 标注创建流程

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
    ├─ 创建 HighlightAnnotation { id, spineIndex, chapterId, anchor, ... }
    ├─ layer.getRangeRects(range)
    │   └─ range.getClientRects() → transformRect() → SVG 坐标
    ├─ highlightRenderer.render(annotation, rects, chapterGroup.highlights)
    │   └─ 为每个 rect 创建 <rect> SVG 元素
    ├─ annotations.set(id, annotation)  ← 数据存储
    └─ emit('annotation:created')       ← 通知外部
```

## 标注恢复流程

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

::: warning 关键点
CFI 解析的 `rootElement` 必须是该章节的 `contentElement`。生成和解析使用同一个根节点，路径才能正确对应。
:::

## 坐标映射

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

## 交互模式

`InteractionHandler` 管理三种模式的事件分发：

| 模式 | SVG pointer-events | 行为 |
|---|---|---|
| `select` | `none`（SVG 层透明） | 用户可选中文本，标注元素仍可点击 |
| `draw` | `all`（SVG 层捕获） | 指针事件被 SVG 层拦截，用于手绘 |
| `view` | `none` | 只读模式，仅笔记标记可点击 |

## 手绘简化算法

`DrawingRenderer` 使用 Ramer-Douglas-Peucker (RDP) 算法简化手绘路径：

```
原始采样点（数百个） → RDP 简化（tolerance=2px） → 简化路径（数十个点）
```

简化后的路径存储为 SVG path 的 `d` 属性字符串，减少数据体积，渲染更流畅。

## 标注自定义数据

`AnnotationBase` 提供 `userData?: Record<string, unknown>` 字段，允许业务层附加任意数据到标注上（如用户 ID、标签、来源等），序列化/反序列化时会自动保留。
