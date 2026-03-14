# 标注系统

xml-ebook 提供完整的 SVG 标注系统，支持高亮、下划线、笔记和手绘四种标注类型。

## 初始化

```typescript
const annotations = await renderer.initAnnotations();
```

## 交互模式

```typescript
annotations.setMode('select');  // 文本选择模式（默认）
annotations.setMode('draw');    // 手绘模式
annotations.setMode('view');    // 只读查看模式

// 获取当前模式
const currentMode = annotations.mode; // 'select' | 'draw' | 'view'
```

## 高亮

用户选中文本后调用：

```typescript
const highlight = annotations.highlightSelection('yellow');
// 颜色: 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | { custom: '#ff0000' }
// 可选第二个参数透明度: annotations.highlightSelection('blue', 0.5)
// 默认透明度为 0.35
```

## 下划线

```typescript
const underline = annotations.underlineSelection({
  color: '#e74c3c',      // 默认 '#e74c3c'
  strokeWidth: 2,
  style: 'solid',  // 'solid' | 'dashed' | 'wavy' | 'strikethrough'
});
```

## 笔记

```typescript
const note = annotations.addNoteToSelection('这是笔记内容');
// 默认笔记颜色为 '#f39c12'

// 修改笔记内容
annotations.updateNoteContent(note.id, '更新后的内容');
```

## 手绘

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

## 查询

```typescript
// 获取单个标注
const a = annotations.getAnnotation(id);

// 获取所有标注
const all = annotations.getAllAnnotations();

// 获取某章节的标注
const chapter3 = annotations.getAnnotationsForSpine(3);
const chapter3Alt = annotations.getAnnotationsForChapter('epub-spine-3');
```

## 删除

```typescript
annotations.removeAnnotation(id);   // 删除单个
annotations.clearAllAnnotations();   // 清除全部
```

## 刷新标注渲染

重新渲染当前章节的所有标注（如页面 resize 后）：

```typescript
annotations.refreshAnnotations();
```

## 导出/导入

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

## 标注数据结构

### 基础字段

所有标注共有的字段：

```typescript
interface AnnotationBase {
  id: string;
  type: 'highlight' | 'underline' | 'note' | 'drawing';
  createdAt: string;
  updatedAt: string;
  spineIndex: number;    // 所在章节索引
  chapterId: string;     // 章节容器 ID
  userData?: Record<string, unknown>; // 自定义用户数据
}
```

### 文本锚点

```typescript
interface TextAnchor {
  startCfi: string;
  endCfi: string;
  textContent: string;
}
```

### 高亮标注

```typescript
interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  anchor: TextAnchor;
  color: HighlightColor;
  opacity: number;
}
```

### 下划线标注

```typescript
interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  anchor: TextAnchor;
  color: string;
  strokeWidth: number;
  style: UnderlineStyle; // 'solid' | 'dashed' | 'wavy' | 'strikethrough'
}
```

### 笔记标注

```typescript
interface NoteAnnotation extends AnnotationBase {
  type: 'note';
  anchor: TextAnchor;
  content: string;
  color: string;
}
```

### 手绘标注

```typescript
interface DrawingAnnotation extends AnnotationBase {
  type: 'drawing';
  paths: DrawingPath[];
  viewportWidth: number;
  viewportHeight: number;
}
```

### 联合类型

```typescript
type Annotation = HighlightAnnotation | UnderlineAnnotation | NoteAnnotation | DrawingAnnotation;
type AnnotationType = 'highlight' | 'underline' | 'note' | 'drawing';
```

## 序列化器

`AnnotationSerializer` 提供独立的标注数据序列化/反序列化能力：

```typescript
import { AnnotationSerializer } from 'xml-ebook';

// 序列化标注数据为 AnnotationStore 对象
const store = AnnotationSerializer.serialize(bookId, annotationsMap);

// 序列化为 JSON 字符串
const json = AnnotationSerializer.toJSON(bookId, annotationsMap);

// 反序列化
const store = AnnotationSerializer.deserialize(json);
const store2 = AnnotationSerializer.fromJSON(json);
```
