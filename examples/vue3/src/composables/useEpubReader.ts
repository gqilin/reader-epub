import { ref, shallowRef } from 'vue';
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
  Annotation,
  SelectionToolbarPosition,
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
  const annotationList = ref<Annotation[]>([]);
  const progressText = ref('Page 0 / 0');
  const activeTocId = ref('');

  // Reading settings (reactive for UI binding)
  const themeName = ref('light');
  const fontFamily = ref('');
  const fontSize = ref(16);
  const lineHeight = ref(1.8);

  // Selection toolbar state
  const selectionToolbar = ref<{
    visible: boolean;
    position: SelectionToolbarPosition | null;
    text: string;
    cfiRange: { start: string; end: string };
  }>({
    visible: false,
    position: null,
    text: '',
    cfiRange: { start: '', end: '' },
  });

  // ── TOC helpers ─────────────────────────────────

  /** Collect all TocItems matching a spineIndex (flat, depth-first order) */
  function collectTocBySpineIndex(items: TocItem[], spineIndex: number): TocItem[] {
    const result: TocItem[] = [];
    for (const item of items) {
      if (item.spineIndex === spineIndex) result.push(item);
      if (item.children.length > 0) {
        result.push(...collectTocBySpineIndex(item.children, spineIndex));
      }
    }
    return result;
  }

  /**
   * Detect which TOC section is currently visible based on anchor positions.
   * Checks each TOC item's fragment anchor in the rendered content,
   * returns the last one whose anchor has scrolled past the viewport top.
   */
  function detectVisibleTocItem(spineIndex: number): TocItem | null {
    if (!renderer.value) return null;

    const candidates = collectTocBySpineIndex(tocItems.value, spineIndex);
    if (candidates.length <= 1) return candidates[0] ?? null;

    const shadowRoot = renderer.value.contentShadowRoot;
    const wrapperRect = renderer.value.wrapperElement.getBoundingClientRect();

    let best: TocItem | null = null;

    for (const item of candidates) {
      const fragment = item.href.split('#')[1];
      if (!fragment) {
        // No fragment = chapter root, always a candidate if nothing better found
        if (!best) best = item;
        continue;
      }

      const el = shadowRoot.getElementById(fragment)
        ?? renderer.value.contentElement.querySelector(`[id="${CSS.escape(fragment)}"]`);
      if (!el) continue;

      const elRect = el.getBoundingClientRect();

      if (renderer.value.mode === 'paginated') {
        // In paginated mode: anchor is "visible" if its left edge is within the wrapper's horizontal bounds
        if (elRect.left >= wrapperRect.left && elRect.left < wrapperRect.right) {
          best = item;
        }
      } else {
        // In scroll mode: anchor is "passed" if its top edge is at or above the wrapper top + small offset
        if (elRect.top <= wrapperRect.top + 10) {
          best = item;
        }
      }
    }

    return best;
  }

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
      refreshAnnotationList();
    } catch (e) {
      console.warn('[LocalStorage] Failed to save:', e);
    }
  }

  function refreshAnnotationList(): void {
    if (!annotations.value) {
      annotationList.value = [];
      annotationCount.value = 0;
      return;
    }
    annotationList.value = annotations.value.getAllAnnotations();
    annotationCount.value = annotationList.value.length;
  }

  function loadAnnotationsFromLocal(): void {
    const key = getStorageKey();
    if (!key || !annotations.value) return;
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        refreshAnnotationList();
        return;
      }
      annotations.value.fromJSON(json, 'merge');
      refreshAnnotationList();
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
      refreshAnnotationList();
    });
    annotations.value.on('annotations:imported', () => saveAnnotationsToLocal());

    renderer.value.on('renderer:paginated', (info: PaginationInfo) => {
      // Detect the most specific visible TOC section
      const match = detectVisibleTocItem(info.spineIndex);
      if (match) activeTocId.value = match.id;

      if (m === 'paginated') {
        progressText.value =
          `Page ${info.currentPage + 1} / ${info.totalPages}  |  Chapter ${info.spineIndex + 1} / ${reader.value!.spine.length}`;
      } else {
        const pct = Math.round(info.chapterProgress * 100);
        progressText.value =
          `Chapter ${info.spineIndex + 1} / ${reader.value!.spine.length}  |  ${pct}%`;
      }
    });

    renderer.value.on('renderer:selection-toolbar', (data) => {
      selectionToolbar.value = { ...data };
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
      activeTocId.value = item.id;
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
      themeName.value = name;
      renderer.value.updateTheme(preset);
    }
  }

  function setFontFamily(family: string) {
    fontFamily.value = family;
    renderer.value?.setFontFamily(family || 'inherit');
  }

  function setFontSize(delta: number) {
    if (!renderer.value) return;
    const cur = fontSize.value;
    const next = cur + delta;
    if (next >= 12 && next <= 32) {
      fontSize.value = next;
      renderer.value.setFontSize(next);
    }
  }

  function setFontSizeAbsolute(size: number) {
    if (!renderer.value) return;
    if (size >= 12 && size <= 32) {
      fontSize.value = size;
      renderer.value.setFontSize(size);
    }
  }

  function setLineHeight(lh: number) {
    lineHeight.value = lh;
    renderer.value?.setLineHeight(lh);
  }

  function resetTheme() {
    if (!renderer.value) return;
    themeName.value = 'light';
    fontFamily.value = '';
    fontSize.value = 16;
    lineHeight.value = 1.8;
    renderer.value.updateTheme({
      ...THEMES.light,
      fontSize: 16,
      lineHeight: 1.8,
      padding: 24,
    });
    renderer.value.setFontFamily('inherit');
  }

  // ── Annotation navigation ─────────────────────
  async function goToAnnotation(annotation: Annotation) {
    if (!renderer.value) return;
    if ('anchor' in annotation) {
      await renderer.value.goToCfi(annotation.anchor.startCfi);
    } else {
      await renderer.value.display(annotation.spineIndex);
    }
  }

  function removeAnnotation(id: string) {
    annotations.value?.removeAnnotation(id);
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

  // ── Selection toolbar actions ──────────────────
  function selectionHighlight() {
    annotations.value?.highlightSelection(selectedColor.value);
  }

  function selectionUnderline() {
    annotations.value?.underlineSelection({
      style: selectedUnderlineStyle.value,
      color: underlineColor.value,
    });
  }

  function selectionAddNote() {
    const content = prompt('Enter note:');
    if (content) {
      annotations.value?.addNoteToSelection(content);
    } else {
      // User cancelled, dismiss toolbar
      renderer.value?.dismissSelectionToolbar();
    }
  }

  function selectionCopy() {
    if (selectionToolbar.value.text) {
      navigator.clipboard.writeText(selectionToolbar.value.text);
    }
    renderer.value?.dismissSelectionToolbar();
  }

  function dismissSelectionToolbar() {
    renderer.value?.dismissSelectionToolbar();
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
    annotationList,
    progressText,
    activeTocId,
    themeName,
    fontFamily,
    fontSize,
    lineHeight,
    selectionToolbar,

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
    setFontSizeAbsolute,
    setLineHeight,
    resetTheme,
    goToCfi,
    goToAnnotation,
    removeAnnotation,
    setSelectedColor,
    setCustomHighlightColor,
    selectionHighlight,
    selectionUnderline,
    selectionAddNote,
    selectionCopy,
    dismissSelectionToolbar,
  };
}
