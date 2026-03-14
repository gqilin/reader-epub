import { TypedEventEmitter } from '../events/event-emitter';
import type { AnnotationEvents } from '../events/event-types';
import type {
  Annotation,
  HighlightAnnotation,
  UnderlineAnnotation,
  UnderlineStyle,
  NoteAnnotation,
  DrawingAnnotation,
  HighlightColor,
  AnnotationStore,
} from '../types/annotation';
import type { ContentRenderer } from '../renderer/content-renderer';
import { getChapterId } from '../renderer/content-renderer';
import { AnnotationLayer } from './annotation-layer';
import type { ChapterSvgGroup } from './annotation-layer';
import { TextSelectionHandler } from './text-selection-handler';
import { HighlightRenderer } from './highlight-renderer';
import { UnderlineRenderer } from './underline-renderer';
import { NoteRenderer } from './note-renderer';
import { DrawingRenderer, type DrawingOptions } from './drawing-renderer';
import { InteractionHandler, type InteractionMode } from './interaction-handler';
import { AnnotationSerializer } from './annotation-serializer';
import { cfiRangeToRange } from '../cfi/cfi-resolver';

function uuid(): string {
  return crypto.randomUUID();
}

export class AnnotationManager extends TypedEventEmitter<AnnotationEvents> {
  private renderer: ContentRenderer;
  private layer: AnnotationLayer;
  private selectionHandler: TextSelectionHandler;
  private highlightRenderer: HighlightRenderer;
  private underlineRenderer: UnderlineRenderer;
  private noteRenderer: NoteRenderer;
  private drawingRenderer: DrawingRenderer;
  private interactionHandler: InteractionHandler;
  private annotations = new Map<string, Annotation>();
  private _mode: InteractionMode = 'select';

  /** Maps chapterId → the chapter's DOM root element (for CFI resolution). */
  private chapterRoots = new Map<string, HTMLElement>();

  constructor(renderer: ContentRenderer) {
    super();
    this.renderer = renderer;

    this.layer = new AnnotationLayer(renderer);
    this.selectionHandler = new TextSelectionHandler(renderer);
    this.highlightRenderer = new HighlightRenderer(this.layer);
    this.underlineRenderer = new UnderlineRenderer(this.layer);
    this.noteRenderer = new NoteRenderer(this.layer, renderer.wrapperElement);
    this.drawingRenderer = new DrawingRenderer(this.layer);
    this.interactionHandler = new InteractionHandler(
      this.layer,
      this.noteRenderer
    );

    this.setupInteraction();
  }

  private setupInteraction(): void {
    this.interactionHandler.setClickHandler((id, event) => {
      const annotation = this.annotations.get(id);
      if (annotation) {
        this.emit('annotation:selected', { annotation, event });
      }
    });

    this.interactionHandler.setHoverHandler((id, event) => {
      const annotation = id ? this.annotations.get(id) ?? null : null;
      this.emit('annotation:hover', { annotation, event });
    });
  }

  // ── Mode ────────────────────────────────────────────────────

  setMode(mode: InteractionMode): void {
    this._mode = mode;
    this.interactionHandler.setMode(mode);

    if (mode === 'draw') {
      // Point drawing renderer at the current chapter's drawings group
      const chapterId = this.renderer.chapterId;
      const group = this.layer.getChapterGroup(chapterId);
      this.drawingRenderer.setTargetGroup(group?.drawings ?? null);

      this.drawingRenderer.startListening((paths, width, height) => {
        const annotation: DrawingAnnotation = {
          id: uuid(),
          type: 'drawing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          spineIndex: this.renderer.spineIndex,
          chapterId,
          paths,
          viewportWidth: width,
          viewportHeight: height,
        };
        this.annotations.set(annotation.id, annotation);
        this.emit('annotation:created', { annotation });
        this.emit('annotation:drawing:end', { annotation });
      });
    } else {
      this.drawingRenderer.setTargetGroup(null);
      this.drawingRenderer.stopListening();
    }
  }

  get mode(): InteractionMode {
    return this._mode;
  }

  // ── Create annotations from current selection ───────────────

  highlightSelection(
    color: HighlightColor = 'yellow',
    opacity = 0.35
  ): HighlightAnnotation | null {
    const selection = this.selectionHandler.getSelection();
    if (!selection) return null;

    const chapterId = this.renderer.chapterId;
    const group = this.layer.getChapterGroup(chapterId);
    if (!group) return null;

    const annotation: HighlightAnnotation = {
      id: uuid(),
      type: 'highlight',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
      chapterId,
      anchor: {
        startCfi: selection.cfiRange.start,
        endCfi: selection.cfiRange.end,
        textContent: selection.text,
      },
      color,
      opacity,
    };

    const rects = this.layer.getRangeRects(selection.range);
    this.highlightRenderer.render(annotation, rects, group.highlights);
    this.annotations.set(annotation.id, annotation);
    this.selectionHandler.clearSelection();
    this.renderer.dismissSelectionToolbar();
    this.emit('annotation:created', { annotation });
    return annotation;
  }

  underlineSelection(options?: {
    color?: string;
    strokeWidth?: number;
    style?: UnderlineStyle;
  }): UnderlineAnnotation | null {
    const selection = this.selectionHandler.getSelection();
    if (!selection) return null;

    const chapterId = this.renderer.chapterId;
    const group = this.layer.getChapterGroup(chapterId);
    if (!group) return null;

    const annotation: UnderlineAnnotation = {
      id: uuid(),
      type: 'underline',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
      chapterId,
      anchor: {
        startCfi: selection.cfiRange.start,
        endCfi: selection.cfiRange.end,
        textContent: selection.text,
      },
      color: options?.color ?? '#e74c3c',
      strokeWidth: options?.strokeWidth ?? 2,
      style: options?.style ?? 'solid',
    };

    const rects = this.layer.getRangeRects(selection.range);
    this.underlineRenderer.render(annotation, rects, group.underlines);
    this.annotations.set(annotation.id, annotation);
    this.selectionHandler.clearSelection();
    this.renderer.dismissSelectionToolbar();
    this.emit('annotation:created', { annotation });
    return annotation;
  }

  addNoteToSelection(
    content: string,
    color = '#f39c12'
  ): NoteAnnotation | null {
    const selection = this.selectionHandler.getSelection();
    if (!selection) return null;

    const chapterId = this.renderer.chapterId;
    const group = this.layer.getChapterGroup(chapterId);
    if (!group) return null;

    const annotation: NoteAnnotation = {
      id: uuid(),
      type: 'note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
      chapterId,
      anchor: {
        startCfi: selection.cfiRange.start,
        endCfi: selection.cfiRange.end,
        textContent: selection.text,
      },
      content,
      color,
    };

    const rects = this.layer.getRangeRects(selection.range);
    this.noteRenderer.render(annotation, rects, group.notes);
    this.annotations.set(annotation.id, annotation);
    this.selectionHandler.clearSelection();
    this.renderer.dismissSelectionToolbar();
    this.emit('annotation:created', { annotation });
    return annotation;
  }

  updateNoteContent(annotationId: string, content: string): void {
    const annotation = this.annotations.get(annotationId);
    if (!annotation || annotation.type !== 'note') return;

    (annotation as NoteAnnotation).content = content;
    annotation.updatedAt = new Date().toISOString();
    this.emit('annotation:updated', { annotation });
  }

  setDrawingOptions(options: Partial<DrawingOptions>): void {
    this.drawingRenderer.setOptions(options);
  }

  // ── Query ───────────────────────────────────────────────────

  getAnnotation(id: string): Annotation | undefined {
    return this.annotations.get(id);
  }

  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  getAnnotationsForSpine(spineIndex: number): Annotation[] {
    return this.getAllAnnotations().filter(
      (a) => a.spineIndex === spineIndex
    );
  }

  getAnnotationsForChapter(chapterId: string): Annotation[] {
    return this.getAllAnnotations().filter(
      (a) => a.chapterId === chapterId
    );
  }

  // ── Refresh ────────────────────────────────────────────────

  /**
   * Re-render all annotations for currently mounted chapters.
   * Call after layout changes (font size, line height, resize, etc.)
   * so SVG positions match the reflowed text.
   */
  refreshAnnotations(): void {
    for (const [chapterId, rootElement] of this.chapterRoots) {
      const spineIndex = this.chapterIdToSpineIndex(chapterId);
      const group = this.layer.getChapterGroup(chapterId);
      if (!group) continue;
      this.clearChapterSvg(group);
      this.renderChapterAnnotations(spineIndex, chapterId, rootElement, group);
    }

    if (this.renderer.mode === 'scrolled') {
      this.layer.syncSize();
    } else if (this.renderer.mode === 'paginated') {
      this.layer.syncPaginatedLayout();
    }
  }

  /**
   * Sync annotation SVG layer for paginated mode.
   * Call after page changes so SVG width and translateX match the content.
   */
  syncPaginatedLayout(): void {
    if (this.renderer.mode === 'paginated') {
      this.layer.syncPaginatedLayout();
    }
  }

  // ── Navigate ────────────────────────────────────────────────

  /**
   * Navigate to the specified annotation and flash it so the user
   * can quickly locate the marked position.
   *
   * Returns `true` if navigation succeeded, `false` if the annotation
   * was not found or is not navigable (e.g. a drawing without text anchor).
   */
  async navigateToAnnotation(id: string): Promise<boolean> {
    const annotation = this.annotations.get(id);
    if (!annotation) return false;

    // Drawing annotations have no text anchor — can only jump to the chapter
    if (annotation.type === 'drawing') {
      if (annotation.spineIndex !== this.renderer.spineIndex) {
        await this.renderer.display(annotation.spineIndex);
      }
      return true;
    }

    // Navigate to the annotation's CFI position
    await this.renderer.goToCfi(annotation.anchor.startCfi);

    // Flash the annotation after navigation settles
    requestAnimationFrame(() => {
      this.layer.flashAnnotation(id);
    });

    return true;
  }

  // ── Remove ──────────────────────────────────────────────────

  removeAnnotation(id: string): boolean {
    const annotation = this.annotations.get(id);
    if (!annotation) return false;

    // Remove SVG elements
    this.layer.removeById(id);

    // Type-specific cleanup
    if (annotation.type === 'note') {
      this.noteRenderer.remove(id);
    }

    this.annotations.delete(id);
    this.emit('annotation:removed', { id });
    return true;
  }

  clearAllAnnotations(): void {
    this.annotations.clear();
    this.layer.clearAll();
    this.emit('annotations:cleared', undefined);
  }

  // ── Chapter lifecycle ───────────────────────────────────────

  /**
   * Called when a chapter's DOM is mounted (rendered into the page).
   * Creates the chapter's SVG group and renders its annotations.
   *
   * In single-chapter mode, the previous chapter is automatically unmounted.
   * In lazy-loading mode, multiple chapters can be mounted simultaneously.
   */
  onChapterMounted(spineIndex: number, rootElement: HTMLElement): void {
    const chapterId = getChapterId(spineIndex);

    // In current single-chapter mode: unmount all others first
    for (const [id] of this.chapterRoots) {
      if (id !== chapterId) {
        this.onChapterUnmounted(this.chapterIdToSpineIndex(id));
      }
    }

    // Register this chapter's DOM root
    this.chapterRoots.set(chapterId, rootElement);

    // Sync SVG size in scrolled mode
    if (this.renderer.mode === 'scrolled') {
      this.layer.syncSize();
    } else if (this.renderer.mode === 'paginated') {
      this.layer.syncPaginatedLayout();
    }

    // Mount SVG group and render annotations
    const group = this.layer.mountChapter(chapterId);
    this.renderChapterAnnotations(spineIndex, chapterId, rootElement, group);

    // If in draw mode, update target group
    if (this._mode === 'draw') {
      this.drawingRenderer.setTargetGroup(group.drawings);
    }
  }

  /**
   * Called when a chapter's DOM is destroyed (e.g. scrolled out of view
   * in lazy-loading mode). Removes SVG elements but keeps annotation data.
   */
  onChapterUnmounted(spineIndex: number): void {
    const chapterId = getChapterId(spineIndex);
    this.chapterRoots.delete(chapterId);
    this.layer.unmountChapter(chapterId);
  }

  /**
   * @deprecated Use onChapterMounted / onChapterUnmounted instead.
   */
  onChapterDisplayed(spineIndex: number): void {
    const rootElement = this.renderer.contentElement;
    this.onChapterMounted(spineIndex, rootElement);
  }

  // ── Import / Export ─────────────────────────────────────────

  exportAnnotations(): AnnotationStore {
    return AnnotationSerializer.serialize(
      '',
      this.getAllAnnotations()
    );
  }

  importAnnotations(
    store: AnnotationStore,
    strategy: 'merge' | 'replace' = 'merge'
  ): void {
    if (strategy === 'replace') {
      this.clearAllAnnotations();
    }

    for (const annotation of store.annotations) {
      // Ensure chapterId exists (backwards compatibility with old data)
      if (!annotation.chapterId) {
        annotation.chapterId = getChapterId(annotation.spineIndex);
      }
      this.annotations.set(annotation.id, annotation);
    }

    // Re-render all currently mounted chapters
    for (const [chapterId, rootElement] of this.chapterRoots) {
      const spineIndex = this.chapterIdToSpineIndex(chapterId);
      const group = this.layer.mountChapter(chapterId);
      this.clearChapterSvg(group);
      this.renderChapterAnnotations(spineIndex, chapterId, rootElement, group);
    }

    this.emit('annotations:imported', { count: store.annotations.length });
  }

  toJSON(): string {
    return AnnotationSerializer.toJSON('', this.getAllAnnotations());
  }

  fromJSON(json: string, strategy: 'merge' | 'replace' = 'merge'): void {
    const store = AnnotationSerializer.fromJSON(json);
    this.importAnnotations(store, strategy);
  }

  // ── Lifecycle ───────────────────────────────────────────────

  destroy(): void {
    this.drawingRenderer.stopListening();
    this.noteRenderer.destroy();
    this.layer.destroy();
    this.chapterRoots.clear();
    this.removeAllListeners();
  }

  // ── Private ─────────────────────────────────────────────────

  private renderChapterAnnotations(
    spineIndex: number,
    chapterId: string,
    rootElement: HTMLElement,
    group: ChapterSvgGroup
  ): void {
    const chapterAnnotations = this.getAnnotationsForSpine(spineIndex);
    for (const annotation of chapterAnnotations) {
      // Update chapterId if it was missing (old data)
      if (!annotation.chapterId) {
        annotation.chapterId = chapterId;
      }
      this.renderExistingAnnotation(annotation, rootElement, group);
    }
  }

  private renderExistingAnnotation(
    annotation: Annotation,
    rootElement: HTMLElement,
    group: ChapterSvgGroup
  ): void {
    if (annotation.type === 'drawing') {
      this.drawingRenderer.renderAnnotation(annotation, group.drawings);
      return;
    }

    // Text-based annotations: resolve CFI to Range relative to rootElement
    const range = cfiRangeToRange(
      annotation.anchor.startCfi,
      annotation.anchor.endCfi,
      rootElement
    );
    if (!range) return;

    const rects = this.layer.getRangeRects(range);

    switch (annotation.type) {
      case 'highlight':
        this.highlightRenderer.render(annotation, rects, group.highlights);
        break;
      case 'underline':
        this.underlineRenderer.render(annotation, rects, group.underlines);
        break;
      case 'note':
        this.noteRenderer.render(annotation, rects, group.notes);
        break;
    }
  }

  private clearChapterSvg(group: ChapterSvgGroup): void {
    for (const g of [group.highlights, group.underlines, group.notes, group.drawings]) {
      while (g.firstChild) g.removeChild(g.firstChild);
    }
  }

  private chapterIdToSpineIndex(chapterId: string): number {
    // Inverse of getChapterId: "epub-spine-3" → 3
    return parseInt(chapterId.replace('epub-spine-', ''), 10);
  }
}
