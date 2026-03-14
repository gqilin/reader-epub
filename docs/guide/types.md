# 类型参考

以下类型均从 `xml-ebook` 包导出，可用于 TypeScript 类型标注。

## 导入方式

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
} from 'xml-ebook';
```

## 类型分类

### EPUB 结构类型

| 类型 | 说明 |
|---|---|
| `EpubBook` | EPUB 书籍完整数据 |
| `EpubMetadata` | 书籍元数据（书名、作者等） |
| `ManifestItem` | 资源清单项 |
| `SpineItem` | 阅读顺序项 |
| `GuideReference` | 导航引用 |
| `Author` | 作者信息 |
| `TocItem` | 目录项（支持嵌套） |
| `TocSource` | 目录来源（`'ncx' \| 'nav'`） |

### 渲染器类型

| 类型 | 说明 |
|---|---|
| `RendererOptions` | 创建渲染器的配置选项 |
| `PaginationInfo` | 分页信息（页码、进度等） |
| `ViewportRect` | 视口矩形坐标 |
| `ReaderTheme` | 主题配置（字体、颜色等） |

### 标注类型

| 类型 | 说明 |
|---|---|
| `Annotation` | 标注联合类型 |
| `AnnotationType` | 标注类型枚举 |
| `AnnotationBase` | 标注基础接口 |
| `HighlightAnnotation` | 高亮标注 |
| `UnderlineAnnotation` | 下划线标注 |
| `UnderlineStyle` | 下划线样式 |
| `NoteAnnotation` | 笔记标注 |
| `DrawingAnnotation` | 手绘标注 |
| `DrawingPath` | 手绘路径数据 |
| `TextAnchor` | 文本锚点（CFI 范围 + 文本内容） |
| `HighlightColor` | 高亮颜色 |
| `AnnotationStore` | 标注存储结构 |

### 事件类型

| 类型 | 说明 |
|---|---|
| `EpubReaderEvents` | EpubReader 事件映射 |
| `RendererEvents` | 渲染器事件映射 |
| `AnnotationEvents` | 标注事件映射 |
| `SelectionToolbarPosition` | 选择工具栏定位信息 |

### 其他类型

| 类型 | 说明 |
|---|---|
| `IEpubArchive` | 归档接口（自定义加载实现） |
| `ChapterSvgGroup` | 章节 SVG 分组 |
| `Disposable` | 可销毁资源接口 |
