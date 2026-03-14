# 架构概览

## 目录结构

```
xml-ebook/
├── src/
│   ├── index.ts                    公共 API 导出
│   ├── core/                       EPUB 解析核心
│   │   ├── epub-parser.ts          解析总调度（EpubReader 类）
│   │   ├── epub-archive.ts         JSZip 包装层（本地 EPUB）
│   │   ├── remote-archive.ts       远程解包 EPUB 加载（HTTP 逐文件拉取）
│   │   ├── container-parser.ts     META-INF/container.xml 解析
│   │   ├── opf-parser.ts           .opf 元数据/manifest/spine 解析
│   │   ├── ncx-parser.ts           EPUB 2 NCX 目录解析
│   │   ├── nav-parser.ts           EPUB 3 导航文档解析
│   │   ├── spine-resolver.ts       Spine 项 → 文件路径映射
│   │   ├── resource-resolver.ts    资源路径解析 + Blob URL 管理
│   │   └── xml-utils.ts            DOMParser 工具函数
│   ├── renderer/                   内容渲染
│   │   ├── content-renderer.ts     渲染总调度（Shadow DOM）
│   │   ├── style-injector.ts       CSS 注入 + 主题系统
│   │   ├── image-resolver.ts       图片 → Blob URL 替换
│   │   └── pagination.ts           CSS 多列分页
│   ├── cfi/                        EPUB CFI 引擎
│   │   ├── cfi-parser.ts           CFI 字符串 → 结构化对象
│   │   ├── cfi-generator.ts        DOM Range → CFI 字符串
│   │   ├── cfi-resolver.ts         CFI 字符串 → DOM Range
│   │   └── cfi-types.ts            CFI 类型定义
│   ├── annotations/                SVG 标注系统
│   │   ├── annotation-manager.ts   标注 CRUD + 章节生命周期
│   │   ├── annotation-layer.ts     SVG 叠加层 + 按章节分组管理
│   │   ├── highlight-renderer.ts   高亮渲染（SVG rect）
│   │   ├── underline-renderer.ts   下划线渲染（SVG line/path）
│   │   ├── note-renderer.ts        笔记标记渲染（SVG circle + HTML 弹框）
│   │   ├── drawing-renderer.ts     手绘渲染（SVG path + RDP 简化）
│   │   ├── text-selection-handler.ts  文本选择 → Range → CFI
│   │   ├── interaction-handler.ts  点击/悬停/模式切换
│   │   └── annotation-serializer.ts  JSON 序列化/反序列化
│   ├── events/
│   │   ├── event-emitter.ts        类型安全的 TypedEventEmitter
│   │   └── event-types.ts          所有事件载荷类型定义
│   └── types/                      类型定义
│       ├── epub.ts                 EPUB 结构类型
│       ├── toc.ts                  目录类型
│       ├── annotation.ts           标注类型体系
│       ├── renderer.ts             渲染器选项 + 主题类型
│       ├── archive.ts              归档接口（IEpubArchive）
│       └── common.ts               通用类型（Disposable）
├── examples/vanilla/               原生 JS 使用示例
├── rollup.config.ts                构建配置
└── tsconfig.json                   TypeScript 配置
```

## 设计原则

1. **零框架依赖** — 纯 TypeScript + DOM API，任何前端环境可用
2. **数据与渲染分离** — 标注数据（CFI）独立于 DOM 生命周期，支持持久化
3. **样式隔离** — Shadow DOM 隔离书籍样式，不污染宿主页面
4. **分层架构** — 解析、渲染、标注三层解耦，可独立使用
5. **多源加载** — 统一的 `IEpubArchive` 接口抽象本地和远程两种加载方式

## 分层架构图

```
┌─────────────────────────────────────────────────┐
│                 应用层（调用方）                    │
├─────────────────────────────────────────────────┤
│  EpubReader        标注 API         事件系统       │
├─────────┬──────────┬───────────┬────────────────┤
│  解析层  │  渲染层   │  标注层    │   CFI 引擎      │
│  core/  │ renderer/│annotations/│    cfi/        │
├─────────┴──────────┴───────────┴────────────────┤
│            IEpubArchive 归档抽象层                  │
├─────────────────────────────────────────────────┤
│         JSZip / HTTP fetch / 自定义实现            │
└─────────────────────────────────────────────────┘
```
