# 资源与工具

## 资源解析器

`ResourceResolver` 管理 EPUB 内部资源的路径解析和 Blob URL 生成：

```typescript
const resources = reader.resources;

// 获取资源（返回 Blob）
const blob = await reader.getResource(manifestId);
const blob2 = await reader.getResourceByHref('images/cover.jpg');
```

## 工具函数

```typescript
import { getChapterId } from 'xml-ebook';

// 根据 spine 索引生成章节容器 ID
const id = getChapterId(0); // 'epub-spine-0'
```
