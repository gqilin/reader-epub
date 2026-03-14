import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'xml-ebook',
  description: '纯 TypeScript 浏览器端 EPUB 解析和标注库',
  lang: 'zh-CN',
  themeConfig: {
    nav: [
      { text: '使用指南', link: '/guide/introduction' },
      { text: '开发文档', link: '/develop/architecture' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '基础',
          items: [
            { text: '简介', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '加载 EPUB', link: '/guide/loading' },
          ],
        },
        {
          text: '核心功能',
          items: [
            { text: '元数据与目录', link: '/guide/metadata-toc' },
            { text: '渲染器', link: '/guide/renderer' },
            { text: '主题 API', link: '/guide/theme' },
            { text: '标注系统', link: '/guide/annotations' },
            { text: '事件系统', link: '/guide/events' },
          ],
        },
        {
          text: '进阶',
          items: [
            { text: 'CFI 引擎', link: '/guide/cfi' },
            { text: '资源与工具', link: '/guide/resources' },
            { text: '类型参考', link: '/guide/types' },
            { text: '完整示例', link: '/guide/example' },
          ],
        },
      ],
      '/develop/': [
        {
          text: '架构设计',
          items: [
            { text: '架构概览', link: '/develop/architecture' },
            { text: 'EPUB 解析链路', link: '/develop/parsing' },
            { text: '内容渲染方案', link: '/develop/rendering' },
          ],
        },
        {
          text: '核心模块',
          items: [
            { text: 'CFI 引擎原理', link: '/develop/cfi-engine' },
            { text: 'SVG 标注系统', link: '/develop/annotation-system' },
            { text: '事件系统', link: '/develop/event-system' },
          ],
        },
        {
          text: '工程化',
          items: [
            { text: '构建输出', link: '/develop/build' },
            { text: '扩展指南', link: '/develop/extension' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com' },
    ],
    outline: {
      level: [2, 3],
      label: '页面导航',
    },
    search: {
      provider: 'local',
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})
