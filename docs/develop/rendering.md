# 内容渲染方案

## 为什么选择 Shadow DOM

对比三种方案：

| 方案 | 样式隔离 | DOM API 可用性 | 坐标系 | 复杂度 |
|---|---|---|---|---|
| 直接插入 DOM | 无隔离，书籍 CSS 污染宿主 | 完全可用 | 统一 | 低 |
| iframe | 完全隔离 | 跨文档，Selection/Range 受限 | 需跨 frame 换算 | 高 |
| **Shadow DOM** | **隔离（shadow boundary）** | **同文档，API 完全可用** | **统一** | **中** |

选择 Shadow DOM 的核心原因：

- **样式隔离** — 书籍自带的 CSS 不会影响宿主页面
- **同文档** — `Range.getClientRects()`、`Selection` 等 API 直接可用，不需要跨 frame 通信
- **统一坐标系** — 标注 SVG 和内容在同一坐标空间，无需坐标转换

## DOM 结构

```
[用户传入的 container]
└── div.xml-ebook-wrapper (position:relative, overflow:hidden/auto)
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

## 渲染流程

`content-renderer.ts` 的 `display()` 方法执行以下步骤：

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

## 链接点击拦截

`ContentRenderer` 在 Shadow DOM 内监听点击事件，拦截 `<a>` 标签并分类处理：

```
用户点击 <a href="...">
    │
    ▼ event listener on shadow root
    │
    ├─ href 以 '#' 开头
    │   └─ 锚点链接：在当前章节内 scrollIntoView / querySelector
    │
    ├─ href 包含 '.xhtml' / '.html'（内部链接）
    │   ├─ 通过 spine 查找目标章节索引
    │   └─ display(targetSpineIndex) + 可选 fragment 定位
    │
    └─ href 以 'http' 开头（外部链接）
        ├─ event.preventDefault()
        ├─ emit('renderer:link-click', { href, isExternal: true, event })
        └─ window.open(href, '_blank')
```

## 选择工具栏定位

当用户在分页/滚动模式下选中文本，渲染器计算选区位置并通过事件通知外部：

```
selectionchange 事件
    │
    ▼
emitSelectionToolbar()
    │
    ├─ 获取 Selection + Range
    ├─ range.getBoundingClientRect() → 选区矩形
    ├─ 计算相对于 container 的坐标
    ├─ generateCfiRange() → 精确 CFI 范围
    │
    └─ emit('renderer:selection-toolbar', {
         visible: true,
         position: { x, y, selectionRect },
         text: selectedText,
         cfiRange: { start, end }
       })

用户点击空白处 / 调用 dismissSelectionToolbar()
    │
    └─ emit('renderer:selection-toolbar', { visible: false, ... })
```

## 分页模式

使用 CSS 多列布局实现分页，不拆分 DOM：

```css
.epub-body {
  column-width: {columnWidth}px;
  column-gap: {gap}px;
  column-fill: auto;
  height: {pageHeight}px;
  overflow: hidden;
}
```

翻页通过 `transform: translateX(-pageWidth * currentPage)` 实现视口偏移。

### 单栏模式

`columnWidth = contentWidth`，每页显示一列。

### 双栏模式（Spread）

`columnWidth = (contentWidth - gap) / 2`，CSS 多列引擎在可视区域内渲染两列。

```
单栏：| ---- 一列内容 ---- |   →   translateX 移动 contentWidth+gap
双栏：| -- 左列 -- | gap | -- 右列 -- |   →   translateX 移动 contentWidth+gap（跳2列）
```

Paginator 的 `pageWidth = contentWidth + gap` 公式不变 — 每次翻页仍移动一个完整视口宽度，自动跳过两列。总页数约为单栏模式的一半。

### 优势

- 浏览器原生排版，自动处理段落跨页
- 内容完整保留在 DOM 中，标注 CFI 始终可解析
- 性能好，浏览器自动跳过不可见区域的绘制
- 双栏模式无需额外 DOM 或 JS 逻辑，仅改变 CSS column-width 值

## 滚动模式

```css
.epub-body {
  padding: {padding}px;
}
/* wrapper: overflow-y: auto */
```

章节内容自然流式排列，wrapper 容器提供滚动条。监听 `scroll` 事件计算阅读进度。

## 主题系统

`StyleInjector` 维护一个 `ReaderTheme` 对象，`buildContentStyles()` 将其转换为 CSS 规则：

| ReaderTheme 属性 | CSS 规则 |
|---|---|
| `fontSize: 18` | `:host { font-size: 18px }` |
| `fontFamily: 'Georgia'` | `:host { font-family: Georgia }` |
| `color: '#333'` | `.epub-body { color: #333 }` |
| `backgroundColor` | `:host { background-color: ... }` |
| `lineHeight: 2` | `.epub-body { line-height: 2 }` |
| `paragraphSpacing: 16` | `.epub-body p { margin-bottom: 16px }` |
| `letterSpacing` | `.epub-body { letter-spacing: ... }` |
| `textAlign: 'justify'` | `.epub-body { text-align: justify }` |
| `linkColor` | `.epub-body a { color: ... }` |
| `imageOpacity` | `.epub-body img { opacity: ... }` |
| `padding` | `.epub-body { padding: ... }` (默认 `24px 16px`) |

调用 `updateTheme()` 时，重新生成 CSS 并写入 `<style>` 元素，触发浏览器重排。分页模式下在下一帧用 `requestAnimationFrame` 重新计算分页。
