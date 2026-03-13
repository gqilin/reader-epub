import { ref, shallowRef, type Ref } from 'vue';
import { EpubReader } from 'epub-reader';
import type {
  ContentRenderer,
} from 'epub-reader';
import type {
  TocItem,
  HighlightColor,
  ReaderTheme,
  UnderlineStyle,
  PaginationInfo,
  AnnotationManager,
} from 'epub-reader';

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

const STORAGE_PREFIX = 'epub-annotations-';

export function useEpubReader() {
  const reader = shallowRef<EpubReader | null>(null);
  const renderer = shallowRef<ContentRenderer | null>(null);
  const annotations = shallowRef<AnnotationManager | null>(null);

  const bookTitle = ref('');
  const bookAuthor = ref('');
  const tocItems = ref<TocItem[]>([]);
  const isLoaded = ref(false);

  const currentMode = ref<'paginated' | 'scrolled'>('paginated');
  const selectedColor = ref<HighlightColor>('yellow');
  const selectedUnderlineStyle = ref<UnderlineStyle>('solid');
  const underlineColor = ref('#e74c3c');
  const highlightCustomColor = ref('#FF9800');
  const annotationCount = ref(0);
  const progressText = ref('Page 0 / 0');
  const activeTocHref = ref('');

  // ── localStorage helpers ──────────────────────
  function getStorageKey(): string | null {
    if (!reader.value) return null;
    const id = reader.value.metadata.identifier || reader.value.metadata.title || '';
    if (!id) return null;
    return STORAGE_PREFIX + id;
  }

  function saveAnnotationsToLocal(): void {
    const key = getStorageKey();
    if (!key || !annotations.value) return;
    try {
      const json = annotations.value.toJSON();
      localStorage.setItem(key, json);
      annotationCount.value = annotations.value.getAllAnnotations().length;
    } catch (e) {
      console.warn('[LocalStorage] Failed to save:', e);
    }
  }

  function loadAnnotationsFromLocal(): void {
    const key = getStorageKey();
    if (!key || !annotations.value) return;
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        annotationCount.value = 0;
        return;
      }
      annotations.value.fromJSON(json, 'merge');
      annotationCount.value = annotations.value.getAllAnnotations().length;
    } catch (e) {
      console.warn('[LocalStorage] Failed to load:', e);
    }
  }

  function clearLocalAnnotations(): void {
    const key = getStorageKey();
    if (key) localStorage.removeItem(key);
  }

  // ── Core methods ──────────────────────────────
  async function loadFile(file: File) {
    renderer.value?.destroy();
    reader.value?.destroy();

    reader.value = await EpubReader.fromFile(file);
    bookTitle.value = reader.value.metadata.title || 'Untitled';
    bookAuthor.value =
      reader.value.metadata.creators.map((c) => c.name).join(', ') || 'Unknown';
    tocItems.value = reader.value.toc as TocItem[];
    isLoaded.value = true;
  }

  async function createRenderer(container: HTMLElement, mode?: 'paginated' | 'scrolled') {
    if (!reader.value) return;

    const m = mode ?? currentMode.value;
    const prevSpineIndex = renderer.value ? renderer.value.spineIndex : 0;
    renderer.value?.destroy();
    container.innerHTML = '';

    renderer.value = await reader.value.createRenderer({
      container,
      mode: m,
      columnGap: 40,
      theme: {
        ...THEMES.light,
        fontSize: 16,
        lineHeight: 1.8,
        padding: 24,
      },
    });

    annotations.value = await renderer.value.initAnnotations();

    // Auto-save on changes
    annotations.value.on('annotation:created', () => saveAnnotationsToLocal());
    annotations.value.on('annotation:removed', () => saveAnnotationsToLocal());
    annotations.value.on('annotation:updated', () => saveAnnotationsToLocal());
    annotations.value.on('annotations:cleared', () => {
      clearLocalAnnotations();
      annotationCount.value = 0;
    });
    annotations.value.on('annotations:imported', () => saveAnnotationsToLocal());

    renderer.value.on('renderer:paginated', (info: PaginationInfo) => {
      if (m === 'paginated') {
        progressText.value =
          `Page ${info.currentPage + 1} / ${info.totalPages}  |  Chapter ${info.spineIndex + 1} / ${reader.value!.spine.length}`;
      } else {
        const pct = Math.round(info.chapterProgress * 100);
        progressText.value =
          `Chapter ${info.spineIndex + 1} / ${reader.value!.spine.length}  |  ${pct}%`;
      }
    });

    const spineIndex = Math.max(0, Math.min(prevSpineIndex, reader.value.spine.length - 1));
    if (reader.value.spine.length > 0) {
      await renderer.value.display(spineIndex);
    }

    loadAnnotationsFromLocal();
  }

  async function switchMode(mode: 'paginated' | 'scrolled', container: HTMLElement) {
    if (currentMode.value === mode) return;
    currentMode.value = mode;
    await createRenderer(container, mode);
  }

  function prev() {
    renderer.value?.prev();
  }

  function next() {
    renderer.value?.next();
  }

  async function goToTocItem(item: TocItem) {
    if (renderer.value) {
      await renderer.value.goToTocItem(item);
    }
  }

  // ── Annotation actions ────────────────────────
  function setAnnotationMode(mode: 'select' | 'draw' | 'view') {
    annotations.value?.setMode(mode);
  }

  function highlight() {
    annotations.value?.highlightSelection(selectedColor.value);
  }

  function underline() {
    annotations.value?.underlineSelection({
      style: selectedUnderlineStyle.value,
      color: underlineColor.value,
    });
  }

  function addNote() {
    const content = prompt('Enter note:');
    if (content) annotations.value?.addNoteToSelection(content);
  }

  function exportAnnotations() {
    if (!annotations.value) return;
    const json = annotations.value.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importAnnotations() {
    return new Promise<void>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file || !annotations.value) {
          resolve();
          return;
        }
        const text = await file.text();
        annotations.value.fromJSON(text, 'merge');
        resolve();
      });
      input.click();
    });
  }

  function clearAnnotations() {
    if (!annotations.value) return;
    if (confirm('Clear all annotations for this book?')) {
      annotations.value.clearAllAnnotations();
    }
  }

  // ── Theme controls ────────────────────────────
  function updateTheme(name: string) {
    const preset = THEMES[name];
    if (preset && renderer.value) {
      renderer.value.updateTheme(preset);
    }
  }

  function setFontFamily(family: string) {
    renderer.value?.setFontFamily(family || 'inherit');
  }

  function setFontSize(delta: number) {
    if (!renderer.value) return;
    const cur = renderer.value.getTheme().fontSize ?? 16;
    const next = cur + delta;
    if (next >= 12 && next <= 32) renderer.value.setFontSize(next);
  }

  function setLineHeight(lh: number) {
    renderer.value?.setLineHeight(lh);
  }

  async function goToCfi(cfi: string) {
    if (!renderer.value) return;
    await renderer.value.goToCfi(cfi);
  }

  function setSelectedColor(color: HighlightColor) {
    selectedColor.value = color;
  }

  function setCustomHighlightColor(hex: string) {
    selectedColor.value = { custom: hex };
    highlightCustomColor.value = hex;
  }

  return {
    // State
    reader,
    renderer,
    annotations,
    bookTitle,
    bookAuthor,
    tocItems,
    isLoaded,
    currentMode,
    selectedColor,
    selectedUnderlineStyle,
    underlineColor,
    highlightCustomColor,
    annotationCount,
    progressText,
    activeTocHref,

    // Methods
    loadFile,
    createRenderer,
    switchMode,
    prev,
    next,
    goToTocItem,
    setAnnotationMode,
    highlight,
    underline,
    addNote,
    exportAnnotations,
    importAnnotations,
    clearAnnotations,
    updateTheme,
    setFontFamily,
    setFontSize,
    setLineHeight,
    goToCfi,
    setSelectedColor,
    setCustomHighlightColor,
  };
}
