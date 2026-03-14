# xml-ebook

纯浏览器端 EPUB 解析、渲染与标注库。基于 Shadow DOM 隔离样式，CSS 多栏布局实现翻页，SVG 覆盖层实现高亮/下划线/笔记/手绘标注。

## 特性

- EPUB 解析 — 解包 OPF、提取 spine/TOC/metadata，支持本地文件与远程 URL
- 双模式渲染 — 翻页（paginated）/ 滚动（scrolled），运行时可切换并保持阅读位置
- 双栏 Spread — 翻页模式下支持双栏并排阅读
- 标注系统 — 高亮、下划线、笔记气泡、自由手绘，基于 EPUB CFI 锚定
- 主题 — 字体/字号/行高/背景色/间距等全部可动态调整
- 导入导出 — 标注数据 JSON 序列化，可持久化到 localStorage 或后端
- 零依赖渲染 — 唯一 peerDependency 为 `jszip`（用于解压 EPUB）

## 项目结构

```
src/
├── core/           # EPUB 解析、资源解析、远程加载
├── renderer/       # 内容渲染、分页器、样式注入
├── annotations/    # 标注管理、高亮/下划线/笔记/手绘渲染
├── cfi/            # EPUB CFI 解析、生成、定位
├── events/         # 类型安全的事件系统
├── types/          # TypeScript 类型定义
└── index.ts        # 公开 API 导出

examples/
├── vanilla/        # 原生 TS + Vite 示例
└── vue3/           # Vue 3 + Element Plus 示例
```

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 开发

```bash
# 安装依赖
pnpm install

# 监听模式构建（修改 src 后自动重新打包）
pnpm dev

# 启动原生示例（Vite dev server，自动打开浏览器）
pnpm example

# 启动 Vue 3 示例
cd examples/vue3 && pnpm install  # 首次需要安装
pnpm example:vue3
```

开发时建议开两个终端：一个跑 `pnpm dev` 监听库源码变更，一个跑 `pnpm example` 或 `pnpm example:vue3` 预览效果。

## 调试

- 原生示例：`pnpm example` 启动后在浏览器中打开 DevTools 即可断点调试，源码会通过 sourcemap 映射到 `src/` 目录
- Vue 3 示例：`pnpm example:vue3` 启动后同理，Vue DevTools 也可用
- 类型检查：`pnpm typecheck` 单独运行 TypeScript 类型校验，不产出文件

## 构建

```bash
pnpm build
```

输出到 `dist/` 目录：

| 文件 | 格式 | 用途 |
|------|------|------|
| `xml-ebook.esm.js` | ESM | 现代打包工具 (Vite/Webpack/Rollup) |
| `xml-ebook.cjs.js` | CJS | Node.js / CommonJS 环境 |
| `xml-ebook.umd.js` | UMD | `<script>` 标签直接引入，全局变量 `XmlEbook` |
| `xml-ebook.d.ts` | TypeScript 声明 | 类型提示 |

## 发布

```bash
# 1. 确保构建通过
pnpm build

# 2. 确保类型无误
pnpm typecheck

# 3. 更新 package.json 中的 version
pnpm version patch   # 或 minor / major

# 4. 发布到 npm
pnpm publish
```

`package.json` 中 `files` 字段仅包含 `dist/`，发布时不会携带源码和示例。

## 基本用法

```typescript
import JSZip from 'jszip';
import { EpubReader } from 'xml-ebook';

// 加载 EPUB 文件
const zip = await JSZip.loadAsync(epubArrayBuffer);
const reader = await EpubReader.load(zip);

// 创建渲染器
const renderer = await reader.createRenderer({
  container: document.getElementById('viewer')!,
  mode: 'paginated',       // 或 'scrolled'
  spread: true,             // 双栏模式
  theme: { fontSize: 16, lineHeight: 1.8 },
});

// 显示第一章
await renderer.display(0);

// 翻页
await renderer.next();
await renderer.prev();

// 切换阅读模式（保持当前位置）
await renderer.setMode('scrolled');

// 初始化标注
const annotations = await renderer.initAnnotations();
```

## License

MIT
