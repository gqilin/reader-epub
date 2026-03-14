# 主题 API

xml-ebook 提供丰富的主题定制能力，支持运行时动态切换。

## 设置完整主题

```typescript
renderer.setTheme({
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  color: '#333',
  backgroundColor: '#f5e6c8',
  lineHeight: 2,
  paragraphSpacing: 16,
  letterSpacing: '0.5px',
  textAlign: 'justify',
  padding: 24,
  linkColor: '#1a73e8',
  imageOpacity: 0.9,
});
```

## 局部更新

只修改部分属性，其他保持不变：

```typescript
renderer.updateTheme({
  fontSize: 20,
  lineHeight: 2.5,
});
```

## 便捷方法

```typescript
renderer.setFontSize(18);
renderer.setFontFamily('Georgia, serif');
renderer.setColor('#333');
renderer.setBackgroundColor('#1a1a1a');
renderer.setLineHeight(2);
renderer.setParagraphSpacing(16);
renderer.setLetterSpacing('0.5px');
renderer.setTextAlign('justify');
```

## 获取当前主题

```typescript
const theme = renderer.getTheme();
console.log(theme.fontSize); // 18
```

## 注入自定义 CSS

```typescript
renderer.injectCSS(`
  p { text-indent: 2em; }
  img { max-width: 100%; }
`);
```

## ReaderTheme 完整属性

| 属性 | 类型 | 说明 | 默认值 |
|---|---|---|---|
| `fontFamily` | `string` | 字体族 | — |
| `fontSize` | `number` | 字号（px） | — |
| `fontWeight` | `number \| string` | 字重 | — |
| `color` | `string` | 文字颜色 | — |
| `backgroundColor` | `string` | 背景色 | — |
| `lineHeight` | `number \| string` | 行高 | — |
| `paragraphSpacing` | `number` | 段间距（px） | — |
| `letterSpacing` | `number \| string` | 字间距 | — |
| `textAlign` | `'left' \| 'right' \| 'center' \| 'justify'` | 对齐方式 | — |
| `padding` | `number \| { top, right, bottom, left }` | 内边距 | `24px 16px` |
| `linkColor` | `string` | 链接颜色 | — |
| `imageOpacity` | `number` | 图片透明度（0~1） | — |
