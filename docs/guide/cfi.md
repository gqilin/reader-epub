# CFI 引擎

EPUB CFI（Canonical Fragment Identifier）引擎可独立使用，用于精确定位文本位置。

## 导入

```typescript
import {
  parseCfi,
  spineIndexToCfiStep,
  cfiStepToSpineIndex,
  generateCfi,
  generateCfiRange,
  resolveCfi,
  cfiRangeToRange,
} from 'xml-ebook';
```

## 解析 CFI 字符串

```typescript
const cfi = parseCfi('epubcfi(/6/8!/4/2/1:12)');
```

## spine 索引互转

```typescript
const step = spineIndexToCfiStep(3);        // 3 → 8
const index = cfiStepToSpineIndex(8);       // 8 → 3
```

## 从 DOM Range 生成 CFI

```typescript
const cfiStr = generateCfi(range, spineIndex, rootElement);
const cfiRange = generateCfiRange(range, spineIndex, rootElement);
// cfiRange = { start: 'epubcfi(...)', end: 'epubcfi(...)' }
```

## 从 CFI 解析回 DOM 位置

```typescript
const result = resolveCfi('epubcfi(/6/8!/4/2/1:12)', rootElement);
// result = { node: TextNode, offset: 12 }
```

## 从 CFI 范围恢复 DOM Range

```typescript
const domRange = cfiRangeToRange(startCfi, endCfi, rootElement);
```
