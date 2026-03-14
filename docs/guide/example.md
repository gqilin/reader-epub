# 完整示例

以下是一个包含加载、渲染、标注、主题切换等完整功能的示例。

```typescript
import { EpubReader } from 'xml-ebook';

const viewer = document.getElementById('viewer');

// 加载
const reader = await EpubReader.fromFile(file);

// 监听加载事件
reader.on('book:ready', ({ metadata }) => {
  console.log('已加载:', metadata.title);
});

// 渲染
const renderer = await reader.createRenderer({
  container: viewer,
  mode: 'paginated',
  theme: { fontSize: 16, lineHeight: 1.8, padding: 24 },
});

// 标注
const annotations = await renderer.initAnnotations();

// 显示第一章
await renderer.display(0);

// 监听进度
renderer.on('renderer:paginated', (info) => {
  console.log(`Progress: ${Math.round(info.bookProgress * 100)}%`);
});

// 监听文本选择（弹出工具栏）
renderer.on('renderer:selection-toolbar', ({ visible, position, text, cfiRange }) => {
  if (visible && position) {
    // 在 position.x, position.y 显示工具栏
    showToolbar(position.x, position.y, text);
  } else {
    hideToolbar();
  }
});

// 监听链接点击
renderer.on('renderer:link-click', ({ href, isExternal }) => {
  if (isExternal) {
    console.log('外部链接:', href);
  }
});

// 翻页按钮
prevBtn.onclick = () => renderer.prev();
nextBtn.onclick = () => renderer.next();

// 高亮按钮
highlightBtn.onclick = () => {
  annotations.highlightSelection('yellow');
};

// 主题切换
darkBtn.onclick = () => {
  renderer.updateTheme({
    color: '#e0e0e0',
    backgroundColor: '#1a1a1a',
  });
};

// 导出标注
exportBtn.onclick = () => {
  const json = annotations.toJSON();
  localStorage.setItem('my-annotations', json);
};

// 窗口变化时重新布局
window.onresize = () => renderer.resize();

// 清理
window.onbeforeunload = () => {
  renderer.destroy();
  reader.destroy();
};
```
