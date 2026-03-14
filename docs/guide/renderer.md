# 渲染器

渲染器负责将 EPUB 章节内容呈现到页面上，支持分页和滚动两种模式。

## 创建渲染器

```typescript
const renderer = await reader.createRenderer({
  container: document.getElementById('viewer'), // 容器元素
  mode: 'paginated',    // 阅读模式：'paginated' | 'scrolled'
  spread: false,        // 双栏模式（仅 paginated 生效），默认 false
  columnGap: 40,        // 分页模式下的列间距（px），默认 40
  theme: { ... },       // 初始主题
  customStyles: '',     // 自定义 CSS
});
```

## 导航

```typescript
// 显示指定章节
await renderer.display(spineIndex);

// 翻页（分页模式下翻页，最后一页自动跳下一章）
const hasNext = await renderer.next();
const hasPrev = await renderer.prev();

// 跳转到目录项
await renderer.goToTocItem(tocItem);

// 通过 EPUB CFI 跳转到精确位置
await renderer.goToCfi('epubcfi(/6/4!/4/2/1:0)');
```

## 阅读进度

```typescript
const info = renderer.pagination;

info.currentPage      // 当前页码（分页模式）
info.totalPages       // 总页数（当前章节）
info.spineIndex       // 当前章节索引
info.chapterProgress  // 章节进度 0~1
info.bookProgress     // 全书进度 0~1
```

### 监听进度变化

```typescript
renderer.on('renderer:paginated', (info) => {
  console.log(`第 ${info.currentPage + 1} / ${info.totalPages} 页`);
});
```

## 渲染器属性

以下属性均为只读：

| 属性 | 类型 | 说明 |
|---|---|---|
| `spineIndex` | `number` | 当前章节索引 |
| `chapterId` | `string` | 当前章节容器 ID |
| `mode` | `'paginated' \| 'scrolled'` | 当前阅读模式 |
| `spread` | `boolean` | 当前是否为双栏模式 |
| `contentShadowRoot` | `ShadowRoot` | Shadow DOM 根节点 |
| `contentElement` | `HTMLElement` | 章节内容 DOM 元素 |
| `wrapperElement` | `HTMLElement` | 外层包装 DOM 元素 |
| `annotations` | `AnnotationManager` | 标注管理器实例 |
| `pagination` | `PaginationInfo` | 分页信息 |

## 窗口重置

容器大小变化后重新计算布局：

```typescript
renderer.resize();
```

## 选择工具栏

手动关闭选择工具栏：

```typescript
renderer.dismissSelectionToolbar();
```

## 阅读模式切换

通过重新创建渲染器切换模式：

```typescript
renderer.destroy();
const newRenderer = await reader.createRenderer({
  container: viewer,
  mode: 'scrolled',  // 切换为滚动模式
});
await newRenderer.display(0);
```

## 双栏模式（Spread）

分页模式下可开启双栏显示，适合 PC 或大屏横屏平板。每页显示两列文本，类似翻开的纸质书：

```typescript
// 创建时启用
const renderer = await reader.createRenderer({
  container: viewer,
  mode: 'paginated',
  spread: true,
});

// 运行时切换（保持阅读进度）
await renderer.setSpread(true);   // 开启双栏
await renderer.setSpread(false);  // 关闭双栏

// 读取状态
console.log(renderer.spread);     // true | false
```

::: warning 注意
`spread` 仅在 `mode: 'paginated'` 时生效，滚动模式下无效。建议容器宽度 >= 1000px 以获得良好的双栏阅读体验。
:::

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

## 销毁

```typescript
renderer.destroy();  // 销毁渲染器（同时销毁标注管理器）
reader.destroy();    // 销毁阅读器（释放 blob URL 等资源）
```
