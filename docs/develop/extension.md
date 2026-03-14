# 扩展指南

## 懒加载扩展

当前单章模式下，`onChapterMounted` 会自动 unmount 其他章节。实现懒加载时只需：

1. 每个章节创建独立的 `div`，设置 `id = getChapterId(spineIndex)`
2. 章节进入视口时调用 `annotations.onChapterMounted(spineIndex, element)`
3. 章节离开视口时调用 `annotations.onChapterUnmounted(spineIndex)`
4. 去掉 `onChapterMounted` 中自动 unmount 其他章节的逻辑

标注数据层无需任何改动。

## 仿真翻页扩展

推荐方案：CSS 多列分页保持不变（所有内容在 DOM 中），翻页动画用双视口裁切 + CSS 3D Transform 叠加在上面。

动画只是视觉层面的"表演"，不涉及 DOM 拆分，标注系统零改动。

## 自定义标注类型

扩展 `AnnotationType` 和 `Annotation` 联合类型，创建对应的 `Renderer`，在 `AnnotationManager` 中注册即可。

## 自定义归档实现

实现 `IEpubArchive` 接口即可对接自定义的文件加载方式，然后通过 `EpubReader.fromArchive(archive)` 创建阅读器。

典型场景：加密章节获取、自定义 API、Service Worker 缓存、WebDAV 等。

```
┌─────────────────────────────────────────┐
│  SDK 内部（不需要改动）                    │
│  container.xml → OPF → Spine → TOC      │
│  → 渲染 → 标注                           │
└──────────────┬──────────────────────────┘
               │ 所有文件读取通过
               ▼
┌─────────────────────────────────────────┐
│  IEpubArchive 接口                       │
│  readText(path)                          │
│  readBinary(path)                        │
│  readBlob(path, mimeType)                │
└─────────────────────────────────────────┘
               ▲
               │ 调用方实现
               │
┌─────────────────────────────────────────┐
│  自定义 Archive                          │
│  - 章节 .xhtml → 后端加密 API + 解密     │
│  - 其他文件 → 直接 fetch / 本地读取       │
└─────────────────────────────────────────┘
```

```typescript
import { EpubReader, type IEpubArchive } from 'xml-ebook';

class MyArchive implements IEpubArchive {
  async readText(path: string): Promise<string> {
    // 自定义获取逻辑（加密 API、缓存等）
  }
  async readBinary(path: string): Promise<ArrayBuffer> { ... }
  async readBlob(path: string, mimeType: string): Promise<Blob> { ... }
}

const reader = await EpubReader.fromArchive(new MyArchive());
```

详细用法和加密示例见 [使用文档 - 自定义 Archive](/guide/loading#自定义-archive)。

## 框架集成

### Vue 3

```typescript
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

### React

```typescript
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
