# CFI 引擎原理

## 什么是 EPUB CFI

EPUB Canonical Fragment Identifier（CFI）是 EPUB 标准中用于定位文本位置的字符串格式，类似于 DOM 的 XPath。

格式：`epubcfi(/6/{spineStep}!/{localPath}:{charOffset})`

示例：`epubcfi(/6/8!/4/2/1:12)` 表示：
- `/6` — 固定前缀（EPUB package 的 spine 元素）
- `/8` — spine 第 4 项（(3+1)*2=8，CFI 用偶数表示元素）
- `!` — 分隔符（spine 引用 vs 章节内路径）
- `/4/2/1:12` — 章节内路径：第 2 个元素的第 1 个元素的第 1 个文本节点的第 12 个字符

## CFI 索引规则

```
DOM 子节点:  [TextNode] [Element] [TextNode] [Element] [TextNode]
CFI 索引:        1         2         3         4         5

元素用偶数（2, 4, 6...），文本节点用奇数（1, 3, 5...）
```

## spine 索引与 CFI step 转换

```typescript
// 工具函数，从 index.ts 导出
spineIndexToCfiStep(index: number): number   // index * 2 + 2
cfiStepToSpineIndex(step: number): number    // (step - 2) / 2
```

## 生成流程（cfi-generator.ts）

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

导出函数：
- `generateCfi(range, spineIndex, rootElement)` — 生成单点 CFI
- `generateCfiRange(range, spineIndex, rootElement)` — 生成起止 CFI 对 `{ start, end }`

::: warning 关键设计
`rootElement` 是 `contentElement`（div.epub-body），不是 `document.body`。因为内容在 Shadow DOM 中，从 Shadow DOM 向上遍历会穿越 ShadowRoot 产生错误路径。
:::

## 解析流程（cfi-resolver.ts）

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

导出函数：
- `parseCfi(cfi)` — 解析 CFI 字符串为 `CfiExpression` 结构化对象
- `resolveCfi(cfi, rootElement)` — 解析 CFI 到 DOM 节点位置
- `cfiRangeToRange(startCfi, endCfi, rootElement)` — 从 CFI 范围恢复 DOM Range

## 类型定义（cfi-types.ts）

```typescript
interface CfiStep {
  index: number;       // CFI 步骤索引
  id?: string;         // 可选的元素 ID 断言
}

interface CfiLocalPath {
  steps: CfiStep[];
  charOffset?: number; // 字符偏移量
}

interface CfiExpression {
  spineStep: number;       // spine 步骤（偶数）
  localPath: CfiLocalPath; // 章节内路径
}
```
