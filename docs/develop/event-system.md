# 事件系统

## TypedEventEmitter

所有事件发射器（`EpubReader`、`ContentRenderer`、`AnnotationManager`）均继承自 `TypedEventEmitter`，提供类型安全的事件监听：

```typescript
emitter.on(event, handler)              // 持续监听
emitter.once(event, handler)            // 单次监听
emitter.off(event, handler)             // 取消监听
emitter.removeAllListeners()            // 移除所有监听器
```

## 事件类型定义

### EpubReaderEvents

| 事件 | 载荷 | 说明 |
|---|---|---|
| `book:ready` | `{ metadata: EpubMetadata }` | 书籍解析完成 |
| `book:error` | `{ error: Error }` | 解析出错 |

### RendererEvents

| 事件 | 载荷 | 说明 |
|---|---|---|
| `renderer:ready` | `undefined` | 渲染器初始化完成 |
| `renderer:displayed` | `{ spineIndex: number }` | 章节内容渲染完成 |
| `renderer:paginated` | `PaginationInfo` | 分页信息更新 |
| `renderer:resized` | `{ width, height }` | 容器大小变化 |
| `renderer:selection` | `{ text, range, cfiRange }` | 文本选中（基础事件） |
| `renderer:selection-toolbar` | `{ visible, position, text, cfiRange }` | 选择工具栏定位（含精确 CFI） |
| `renderer:click` | `{ event: MouseEvent }` | 内容区域点击 |
| `renderer:link-click` | `{ href, isExternal, event }` | 链接点击 |

### AnnotationEvents

| 事件 | 载荷 | 说明 |
|---|---|---|
| `annotation:created` | `{ annotation }` | 标注创建 |
| `annotation:updated` | `{ annotation }` | 标注更新 |
| `annotation:removed` | `{ id }` | 标注删除 |
| `annotation:selected` | `{ annotation, event }` | 标注被点击 |
| `annotation:hover` | `{ annotation \| null, event }` | 标注悬停（离开时 annotation 为 null） |
| `annotation:drawing:start` | `undefined` | 手绘开始 |
| `annotation:drawing:end` | `{ annotation }` | 手绘结束 |
| `annotations:imported` | `{ count }` | 标注导入完成 |
| `annotations:cleared` | `undefined` | 标注全部清除 |
