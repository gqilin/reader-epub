# 构建输出

## Rollup 配置

输出三种格式：

```
dist/
├── xml-ebook.esm.js      ESM（import/export）
├── xml-ebook.cjs.js      CJS（require）
├── xml-ebook.umd.js      UMD（浏览器全局变量 / AMD）
└── xml-ebook.d.ts        TypeScript 类型声明
```

构建特点：
- `jszip` 作为 external，不打包进产物
- 使用 `@rollup/plugin-terser` 压缩
- 使用 `rollup-plugin-dts` 生成合并的 `.d.ts` 声明文件

## TypeScript 配置

```json
{
  "target": "ES2020",
  "lib": ["ES2021", "DOM", "DOM.Iterable"],
  "module": "ESNext",
  "moduleResolution": "bundler",
  "strict": true
}
```

| 配置 | 说明 |
|---|---|
| `target: ES2020` | 支持 `??`、`?.`、`Promise.allSettled` 等 |
| `lib: ES2021` | 支持 `String.prototype.replaceAll` |
| `strict: true` | 严格类型检查 |
