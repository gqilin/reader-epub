import { EpubReader } from '../../src/index';
import type { ContentRenderer } from '../../src/renderer/content-renderer';
import type { AnnotationManager } from '../../src/annotations/annotation-manager';
import type { TocItem, HighlightColor, ReaderTheme, UnderlineStyle } from '../../src/index';

let reader: EpubReader | null = null;
let renderer: ContentRenderer | null = null;
let annotations: AnnotationManager | null = null;
let selectedColor: HighlightColor = 'yellow';
let useCustomHighlightColor = false;
let selectedUnderlineStyle: UnderlineStyle = 'solid';
let currentMode: 'paginated' | 'scrolled' = 'paginated';

// ── localStorage helpers ─────────────────────────────────────
const STORAGE_PREFIX = 'epub-annotations-';

function getStorageKey(): string | null {
  if (!reader) return null;
  const id = reader.metadata.identifier || reader.metadata.title || '';
  if (!id) return null;
  return STORAGE_PREFIX + id;
}

function saveAnnotationsToLocal(): void {
  const key = getStorageKey();
  if (!key || !annotations) return;
  try {
    const json = annotations.toJSON();
    localStorage.setItem(key, json);
    const count = annotations.getAllAnnotations().length;
    console.log(`[LocalStorage] Saved ${count} annotations to "${key}"`);
    updateAnnotationCount(count);
  } catch (e) {
    console.warn('[LocalStorage] Failed to save:', e);
  }
}

function loadAnnotationsFromLocal(): void {
  const key = getStorageKey();
  if (!key || !annotations) return;
  try {
    const json = localStorage.getItem(key);
    if (!json) {
      console.log(`[LocalStorage] No saved annotations for "${key}"`);
      updateAnnotationCount(0);
      return;
    }
    annotations.fromJSON(json, 'merge');
    const count = annotations.getAllAnnotations().length;
    console.log(`[LocalStorage] Loaded ${count} annotations from "${key}"`);
    updateAnnotationCount(count);
  } catch (e) {
    console.warn('[LocalStorage] Failed to load:', e);
  }
}

function updateAnnotationCount(count: number): void {
  const el = document.getElementById('annotation-count');
  if (el) el.textContent = `Annotations: ${count}`;
}

function clearLocalAnnotations(): void {
  const key = getStorageKey();
  if (key) {
    localStorage.removeItem(key);
    console.log(`[LocalStorage] Cleared annotations for "${key}"`);
  }
}

// Preset themes
const THEMES: Record<string, ReaderTheme> = {
  light: {
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    linkColor: '#1a73e8',
  },
  dark: {
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0',
    linkColor: '#6db3f2',
    imageOpacity: 0.9,
  },
  sepia: {
    backgroundColor: '#f5e6c8',
    color: '#5b4636',
    linkColor: '#8b6914',
  },
};

// DOM elements
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const bookInfo = document.getElementById('book-info') as HTMLDivElement;
const bookTitle = document.getElementById('book-title') as HTMLDivElement;
const bookAuthor = document.getElementById('book-author') as HTMLDivElement;
const tocEl = document.getElementById('toc') as HTMLDivElement;
const toolbar = document.getElementById('toolbar') as HTMLDivElement;
const footer = document.getElementById('footer') as HTMLDivElement;
const viewer = document.getElementById('epub-viewer') as HTMLDivElement;
const progressInfo = document.getElementById('progress-info') as HTMLDivElement;

// File input
fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  renderer?.destroy();
  reader?.destroy();
  viewer.innerHTML = '';

  try {
    reader = await EpubReader.fromFile(file);
    await initReader();
  } catch (err) {
    viewer.innerHTML = `<div class="placeholder">Failed to load: ${err}</div>`;
  }
});

async function initReader() {
  if (!reader) return;

  bookInfo.style.display = 'block';
  bookTitle.textContent = reader.metadata.title || 'Untitled';
  bookAuthor.textContent =
    reader.metadata.creators.map((c) => c.name).join(', ') || 'Unknown';

  buildToc(reader.toc as TocItem[]);
  await createRenderer(currentMode);

  toolbar.style.display = 'flex';
  footer.style.display = 'flex';
}

async function createRenderer(mode: 'paginated' | 'scrolled') {
  if (!reader) return;

  const prevSpineIndex = renderer ? renderer.spineIndex : 0;
  renderer?.destroy();
  viewer.innerHTML = '';

  renderer = await reader.createRenderer({
    container: viewer,
    mode,
    columnGap: 40,
    theme: {
      ...THEMES.light,
      fontSize: 16,
      lineHeight: 1.8,
      padding: 24,
    },
  });

  annotations = await renderer.initAnnotations();

  // Auto-save annotations on any change
  annotations.on('annotation:created', () => saveAnnotationsToLocal());
  annotations.on('annotation:removed', () => saveAnnotationsToLocal());
  annotations.on('annotation:updated', () => saveAnnotationsToLocal());
  annotations.on('annotations:cleared', () => {
    clearLocalAnnotations();
    updateAnnotationCount(0);
  });
  annotations.on('annotations:imported', () => saveAnnotationsToLocal());

  renderer.on('renderer:paginated', (info) => {
    if (currentMode === 'paginated') {
      progressInfo.textContent =
        `Page ${info.currentPage + 1} / ${info.totalPages}  |  Chapter ${info.spineIndex + 1} / ${reader!.spine.length}`;
    } else {
      const pct = Math.round(info.chapterProgress * 100);
      progressInfo.textContent =
        `Chapter ${info.spineIndex + 1} / ${reader!.spine.length}  |  ${pct}%`;
    }
  });

  const spineIndex = Math.max(0, Math.min(prevSpineIndex, reader.spine.length - 1));
  if (reader.spine.length > 0) {
    await renderer.display(spineIndex);
  }

  // Load saved annotations from localStorage
  loadAnnotationsFromLocal();

  updateFooterUI(mode);
}

function updateFooterUI(mode: 'paginated' | 'scrolled') {
  const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement;
  const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
  if (mode === 'scrolled') {
    btnPrev.textContent = 'Prev Chapter';
    btnNext.textContent = 'Next Chapter';
  } else {
    btnPrev.textContent = 'Previous';
    btnNext.textContent = 'Next';
  }
}

function buildToc(items: TocItem[], level = 0) {
  tocEl.innerHTML = '';
  renderTocItems(items, level);
}

function renderTocItems(items: TocItem[], level: number) {
  for (const item of items) {
    const div = document.createElement('div');
    div.className = `toc-item${level > 0 ? ' nested' : ''}`;
    div.style.paddingLeft = `${16 + level * 16}px`;
    div.textContent = item.label;
    div.addEventListener('click', async () => {
      if (renderer) {
        await renderer.goToTocItem(item);
        document.querySelectorAll('.toc-item').forEach((el) => el.classList.remove('active'));
        div.classList.add('active');
      }
    });
    tocEl.appendChild(div);
    if (item.children.length > 0) {
      renderTocItems(item.children, level + 1);
    }
  }
}

// Navigation
document.getElementById('btn-prev')!.addEventListener('click', () => renderer?.prev());
document.getElementById('btn-next')!.addEventListener('click', () => renderer?.next());

// Mode switching (select / draw / view)
const modeButtons = ['btn-select', 'btn-draw', 'btn-view'] as const;
const modes = ['select', 'draw', 'view'] as const;
modeButtons.forEach((btnId, i) => {
  document.getElementById(btnId)!.addEventListener('click', () => {
    annotations?.setMode(modes[i]);
    modeButtons.forEach((id) => document.getElementById(id)!.classList.remove('active'));
    document.getElementById(btnId)!.classList.add('active');
  });
});

// Reading mode switching (paginated / scrolled)
document.getElementById('btn-paginated')!.addEventListener('click', async () => {
  if (currentMode === 'paginated' || !renderer) return;
  currentMode = 'paginated';
  document.getElementById('btn-paginated')!.classList.add('active');
  document.getElementById('btn-scrolled')!.classList.remove('active');
  await renderer.setMode('paginated');
  updateFooterUI('paginated');
});
document.getElementById('btn-scrolled')!.addEventListener('click', async () => {
  if (currentMode === 'scrolled' || !renderer) return;
  currentMode = 'scrolled';
  document.getElementById('btn-scrolled')!.classList.add('active');
  document.getElementById('btn-paginated')!.classList.remove('active');
  await renderer.setMode('scrolled');
  updateFooterUI('scrolled');
});

// Color selection
document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedColor = (btn as HTMLElement).dataset.color as HighlightColor;
    useCustomHighlightColor = false;
    document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Custom highlight color
document.getElementById('highlight-custom-color')!.addEventListener('input', (e) => {
  const hex = (e.target as HTMLInputElement).value;
  selectedColor = { custom: hex };
  useCustomHighlightColor = true;
  document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('active'));
});

// Underline style selection
document.getElementById('underline-style-select')!.addEventListener('change', (e) => {
  selectedUnderlineStyle = (e.target as HTMLSelectElement).value as UnderlineStyle;
});

// Annotation actions
document.getElementById('btn-highlight')!.addEventListener('click', () => {
  annotations?.highlightSelection(selectedColor);
});
document.getElementById('btn-underline')!.addEventListener('click', () => {
  const color = (document.getElementById('underline-color') as HTMLInputElement).value;
  annotations?.underlineSelection({ style: selectedUnderlineStyle, color });
});
document.getElementById('btn-note')!.addEventListener('click', () => {
  const content = prompt('Enter note:');
  if (content) annotations?.addNoteToSelection(content);
});

// ── Theme controls ──────────────────────────────────────────

// Preset theme
document.getElementById('theme-select')!.addEventListener('change', (e) => {
  const name = (e.target as HTMLSelectElement).value;
  const preset = THEMES[name];
  if (preset && renderer) {
    renderer.updateTheme(preset);
  }
});

// Font family
document.getElementById('font-select')!.addEventListener('change', (e) => {
  const family = (e.target as HTMLSelectElement).value;
  renderer?.setFontFamily(family || 'inherit');
});

// Font size +/-
document.getElementById('btn-font-dec')!.addEventListener('click', () => {
  if (!renderer) return;
  const cur = renderer.getTheme().fontSize ?? 16;
  if (cur > 12) renderer.setFontSize(cur - 2);
});
document.getElementById('btn-font-inc')!.addEventListener('click', () => {
  if (!renderer) return;
  const cur = renderer.getTheme().fontSize ?? 16;
  if (cur < 32) renderer.setFontSize(cur + 2);
});

// Line height
document.getElementById('line-height-select')!.addEventListener('change', (e) => {
  const lh = parseFloat((e.target as HTMLSelectElement).value);
  renderer?.setLineHeight(lh);
});

// Export / Import / Clear
document.getElementById('btn-export')!.addEventListener('click', () => {
  if (!annotations) return;
  const json = annotations.toJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'annotations.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import')!.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file || !annotations) return;
    const text = await file.text();
    annotations.fromJSON(text, 'merge');
  });
  input.click();
});

document.getElementById('btn-clear-annotations')!.addEventListener('click', () => {
  if (!annotations) return;
  if (confirm('Clear all annotations for this book?')) {
    annotations.clearAllAnnotations();
  }
});

// CFI navigation
document.getElementById('btn-go-cfi')!.addEventListener('click', async () => {
  const input = document.getElementById('cfi-input') as HTMLInputElement;
  const cfi = input.value.trim();
  if (!cfi || !renderer) return;
  try {
    await renderer.goToCfi(cfi);
  } catch (e) {
    console.error('[CFI] Navigation failed:', e);
    alert(`CFI navigation failed: ${e}`);
  }
});
