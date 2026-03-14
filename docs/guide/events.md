# 事件系统

xml-ebook 的所有事件发射器（`reader`、`renderer`、`annotations`）均支持类型安全的事件监听。

## 事件方法

```typescript
emitter.on(event, handler)              // 持续监听
emitter.once(event, handler)            // 单次监听
emitter.off(event, handler)             // 取消监听
emitter.removeAllListeners()            // 移除所有监听器
```

## EpubReader 事件

```typescript
reader.on('book:ready', ({ metadata }) => {
  console.log('书籍加载完成:', metadata.title);
});

reader.on('book:error', ({ error }) => {
  console.error('加载出错:', error);
});
```

| 事件 | 载荷 | 说明 |
|---|---|---|
| `book:ready` | `{ metadata: EpubMetadata }` | 书籍解析完成 |
| `book:error` | `{ error: Error }` | 解析出错 |

## 渲染器事件

```typescript
renderer.on('renderer:ready', () => { ... });
renderer.on('renderer:displayed', ({ spineIndex }) => { ... });
renderer.on('renderer:paginated', (info: PaginationInfo) => { ... });
renderer.on('renderer:resized', ({ width, height }) => { ... });
renderer.on('renderer:selection', ({ text, range, cfiRange }) => { ... });
renderer.on('renderer:click', ({ event }) => { ... });
```

| 事件 | 载荷 | 说明 |
|---|---|---|
| `renderer:ready` | `undefined` | 渲染器初始化完成 |
| `renderer:displayed` | `{ spineIndex: number }` | 章节内容渲染完成 |
| `renderer:paginated` | `PaginationInfo` | 分页信息更新 |
| `renderer:resized` | `{ width, height }` | 容器大小变化 |
| `renderer:selection` | `{ text, range, cfiRange }` | 文本选中（基础事件） |
| `renderer:selection-toolbar` | `{ visible, position, text, cfiRange }` | 选择工具栏定位 |
| `renderer:click` | `{ event: MouseEvent }` | 内容区域点击 |
| `renderer:link-click` | `{ href, isExternal, event }` | 链接点击 |

### 选择工具栏事件

当用户选中文本后触发，包含定位信息，适合用于弹出工具栏：

```typescript
renderer.on('renderer:selection-toolbar', ({ visible, position, text, cfiRange }) => {
  if (visible && position) {
    showToolbar(position.x, position.y);
    console.log('选中文本:', text);
    console.log('CFI 范围:', cfiRange.start, '~', cfiRange.end);
  } else {
    hideToolbar();
  }
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

### 链接点击事件

```typescript
renderer.on('renderer:link-click', ({ href, isExternal, event }) => {
  console.log(`链接点击: ${href}, 外部链接: ${isExternal}`);
});
```

## 标注事件

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

| 事件 | 载荷 | 说明 |
|---|---|---|
| `annotation:created` | `{ annotation }` | 标注创建 |
| `annotation:updated` | `{ annotation }` | 标注更新 |
| `annotation:removed` | `{ id }` | 标注删除 |
| `annotation:selected` | `{ annotation, event }` | 标注被点击 |
| `annotation:hover` | `{ annotation \| null, event }` | 标注悬停 |
| `annotation:drawing:start` | `undefined` | 手绘开始 |
| `annotation:drawing:end` | `{ annotation }` | 手绘结束 |
| `annotations:imported` | `{ count }` | 标注导入完成 |
| `annotations:cleared` | `undefined` | 标注全部清除 |
