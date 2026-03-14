import { ref, shallowRef } from 'vue';
import { EpubReader } from 'xml-ebook';
import type {
  ContentRenderer,
} from 'xml-ebook';
import type {
  TocItem,
  HighlightColor,
  ReaderTheme,
  UnderlineStyle,
  PaginationInfo,
  AnnotationManager,
  Annotation,
  SelectionToolbarPosition,
} from 'xml-ebook';

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
const SETTINGS_KEY = 'epub-reader-settings';

interface ReaderSettings {
  mode: 'paginated' | 'scrolled';
  spread: boolean;
  themeName: string;
  fontFamily: string;
  fontSize: number | null;
  lineHeight: number | null;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  mode: 'scrolled',
  spread: false,
  themeName: 'light',
  fontFamily: '',
  fontSize: null,
  lineHeight: null,
};

function loadSettings(): ReaderSettings {
  try {
    const json = localStorage.getItem(SETTINGS_KEY);
    if (json) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(settings: Partial<ReaderSettings>): void {
  try {
    const current = loadSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  } catch { /* ignore */ }
}

export function useEpubReader() {
  const savedSettings = loadSettings();

  const reader = shallowRef<EpubReader | null>(null);
  const renderer = shallowRef<ContentRenderer | null>(null);
  const annotations = shallowRef<AnnotationManager | null>(null);

  const bookTitle = ref('');
  const bookAuthor = ref('');
  const tocItems = ref<TocItem[]>([]);
  const isLoaded = ref(false);

  const currentMode = ref<'paginated' | 'scrolled'>(savedSettings.mode);
  const spreadEnabled = ref(savedSettings.spread);
  const selectedColor = ref<HighlightColor>('yellow');
  const selectedUnderlineStyle = ref<UnderlineStyle>('solid');
  const underlineColor = ref('#e74c3c');
  const highlightCustomColor = ref('#FF9800');
  const annotationCount = ref(0);
  const annotationList = ref<Annotation[]>([]);
  const progressText = ref('Page 0 / 0');
  const activeTocId = ref('');

  // Reading settings (reactive for UI binding)
  // null means "use epub's own value"
  const themeName = ref(savedSettings.themeName);
  const fontFamily = ref(savedSettings.fontFamily);
  const fontSize = ref<number | null>(savedSettings.fontSize);
  const lineHeight = ref<number | null>(savedSettings.lineHeight);

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

  // Note dialog state
  const noteDialog = ref<{
    visible: boolean;
    source: 'new' | 'edit';
    editId: string | null;
    content: string;
  }>({
    visible: false,
    source: 'new',
    editId: null,
    content: '',
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

  async function loadUrl(url: string) {
    renderer.value?.destroy();
    reader.value?.destroy();

    reader.value = await EpubReader.fromUrl(url);
    bookTitle.value = reader.value.metadata.title || 'Untitled';
    bookAuthor.value =
      reader.value.metadata.creators.map((c) => c.name).join(', ') || 'Unknown';
    tocItems.value = reader.value.toc as TocItem[];
    isLoaded.value = true;
  }

  async function loadArrayBuffer(buffer: ArrayBuffer) {
    renderer.value?.destroy();
    reader.value?.destroy();

    reader.value = await EpubReader.fromArrayBuffer(buffer);
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

    // Build theme from cached settings; null values are omitted so epub's own CSS applies
    const themePreset = THEMES[themeName.value] || THEMES.light;
    const theme: ReaderTheme = { ...themePreset, padding: 24 };
    if (fontSize.value !== null) theme.fontSize = fontSize.value;
    if (lineHeight.value !== null) theme.lineHeight = lineHeight.value;
    if (fontFamily.value) theme.fontFamily = fontFamily.value;

    renderer.value = await reader.value.createRenderer({
      container,
      mode: m,
      // spread: spreadEnabled.value,
      spread: true,
      columnGap: 40,
      theme,
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
    annotations.value.on('annotation:edit', (data) => {
      openNoteEditDialog(data.annotation.id, (data.annotation as any).content);
    });

    renderer.value.on('renderer:paginated', (info: PaginationInfo) => {
      // Detect the most specific visible TOC section
      const match = detectVisibleTocItem(info.spineIndex);
      if (match) activeTocId.value = match.id;

      if (currentMode.value === 'paginated') {
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

  async function switchMode(mode: 'paginated' | 'scrolled', _container: HTMLElement) {
    if (currentMode.value === mode || !renderer.value) return;
    currentMode.value = mode;
    persistSettings({ mode });
    await renderer.value.setMode(mode);
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

  function openNoteEditDialog(editId: string, content: string) {
    noteDialog.value = {
      visible: true,
      source: 'edit',
      editId,
      content,
    };
  }

  function confirmNoteDialog() {
    if (noteDialog.value.source === 'new') {
      if (noteDialog.value.content) {
        annotations.value?.addNoteToSelection(noteDialog.value.content);
      }
    } else if (noteDialog.value.source === 'edit' && noteDialog.value.editId) {
      annotations.value?.updateNoteContent(noteDialog.value.editId, noteDialog.value.content);
    }
    closeNoteDialog();
  }

  function closeNoteDialog() {
    noteDialog.value = {
      visible: false,
      source: 'new',
      editId: null,
      content: '',
    };
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

  // ── Spread toggle ─────────────────────────────
  async function toggleSpread(enabled: boolean) {
    spreadEnabled.value = enabled;
    persistSettings({ spread: enabled });
    await renderer.value?.setSpread(enabled);
  }

  // ── Theme controls ────────────────────────────
  function updateTheme(name: string) {
    const preset = THEMES[name];
    if (preset && renderer.value) {
      themeName.value = name;
      persistSettings({ themeName: name });
      renderer.value.updateTheme(preset);
    }
  }

  function setFontFamily(family: string) {
    fontFamily.value = family;
    persistSettings({ fontFamily: family });
    renderer.value?.setFontFamily(family || 'inherit');
  }

  function setFontSize(delta: number) {
    if (!renderer.value) return;
    const cur = fontSize.value ?? 16;
    const next = cur + delta;
    if (next >= 12 && next <= 32) {
      fontSize.value = next;
      persistSettings({ fontSize: next });
      renderer.value.setFontSize(next);
    }
  }

  function setFontSizeAbsolute(size: number) {
    if (!renderer.value) return;
    if (size >= 12 && size <= 32) {
      fontSize.value = size;
      persistSettings({ fontSize: size });
      renderer.value.setFontSize(size);
    }
  }

  function setLineHeight(lh: number) {
    lineHeight.value = lh;
    persistSettings({ lineHeight: lh });
    renderer.value?.setLineHeight(lh);
  }

  function resetTheme() {
    if (!renderer.value) return;
    themeName.value = 'light';
    fontFamily.value = '';
    fontSize.value = null;
    lineHeight.value = null;
    persistSettings({ themeName: 'light', fontFamily: '', fontSize: null, lineHeight: null });
    renderer.value.updateTheme({
      ...THEMES.light,
      padding: 24,
    });
    renderer.value.setFontFamily('inherit');
    renderer.value.setFontSize(0);
    renderer.value.setLineHeight(0);
  }

  // ── Annotation navigation ─────────────────────
  async function goToAnnotation(annotation: Annotation) {
    if (!annotations.value) return;
    await annotations.value.navigateToAnnotation(annotation.id);
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
    // Capture selection before dialog steals focus
    annotations.value?.captureSelection();

    // Open note dialog in "new" mode
    noteDialog.value = {
      visible: true,
      source: 'new',
      editId: null,
      content: '',
    };
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
    spreadEnabled,
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
    noteDialog,

    // Methods
    loadFile,
    loadUrl,
    loadArrayBuffer,
    createRenderer,
    switchMode,
    toggleSpread,
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
    openNoteEditDialog,
    confirmNoteDialog,
    closeNoteDialog,
  };
}
