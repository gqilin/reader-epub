import { TypedEventEmitter } from '../events/event-emitter';
import type { AnnotationEvents } from '../events/event-types';
import type {
  Annotation,
  HighlightAnnotation,
  UnderlineAnnotation,
  NoteAnnotation,
  DrawingAnnotation,
  HighlightColor,
  AnnotationStore,
} from '../types/annotation';
import type { ContentRenderer } from '../renderer/content-renderer';
import { AnnotationLayer } from './annotation-layer';
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

  setMode(mode: InteractionMode): void {
    this._mode = mode;
    this.interactionHandler.setMode(mode);

    if (mode === 'draw') {
      this.drawingRenderer.startListening((paths, width, height) => {
        const annotation: DrawingAnnotation = {
          id: uuid(),
          type: 'drawing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          spineIndex: this.renderer.spineIndex,
          paths,
          viewportWidth: width,
          viewportHeight: height,
        };
        this.annotations.set(annotation.id, annotation);
        this.emit('annotation:created', { annotation });
        this.emit('annotation:drawing:end', { annotation });
      });
    } else {
      this.drawingRenderer.stopListening();
    }
  }

  get mode(): InteractionMode {
    return this._mode;
  }

  highlightSelection(
    color: HighlightColor = 'yellow',
    opacity = 0.35
  ): HighlightAnnotation | null {
    console.log('[AnnotationManager] highlightSelection() called, color:', color);
    const selection = this.selectionHandler.getSelection();
    console.log('[AnnotationManager] selection result:', selection ? `text="${selection.text.substring(0, 50)}"` : 'null');
    if (!selection) {
      console.log('[AnnotationManager] ❌ No selection, returning null');
      return null;
    }

    const annotation: HighlightAnnotation = {
      id: uuid(),
      type: 'highlight',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
      anchor: {
        startCfi: selection.cfiRange.start,
        endCfi: selection.cfiRange.end,
        textContent: selection.text,
      },
      color,
      opacity,
    };

    const rects = this.layer.getRangeRects(selection.range);
    console.log('[AnnotationManager] highlight rects count:', rects.length);
    this.highlightRenderer.render(annotation, rects);
    this.annotations.set(annotation.id, annotation);
    console.log('[AnnotationManager] ✓ Highlight created, id:', annotation.id);
    this.selectionHandler.clearSelection();
    this.emit('annotation:created', { annotation });
    return annotation;
  }

  underlineSelection(options?: {
    color?: string;
    strokeWidth?: number;
    style?: 'solid' | 'dashed' | 'wavy';
  }): UnderlineAnnotation | null {
    console.log('[AnnotationManager] underlineSelection() called');
    const selection = this.selectionHandler.getSelection();
    console.log('[AnnotationManager] selection result:', selection ? `text="${selection.text.substring(0, 50)}"` : 'null');
    if (!selection) {
      console.log('[AnnotationManager] ❌ No selection, returning null');
      return null;
    }

    const annotation: UnderlineAnnotation = {
      id: uuid(),
      type: 'underline',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
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
    console.log('[AnnotationManager] underline rects count:', rects.length);
    this.underlineRenderer.render(annotation, rects);
    this.annotations.set(annotation.id, annotation);
    console.log('[AnnotationManager] ✓ Underline created, id:', annotation.id);
    this.selectionHandler.clearSelection();
    this.emit('annotation:created', { annotation });
    return annotation;
  }

  addNoteToSelection(
    content: string,
    color = '#f39c12'
  ): NoteAnnotation | null {
    const selection = this.selectionHandler.getSelection();
    if (!selection) return null;

    const annotation: NoteAnnotation = {
      id: uuid(),
      type: 'note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spineIndex: this.renderer.spineIndex,
      anchor: {
        startCfi: selection.cfiRange.start,
        endCfi: selection.cfiRange.end,
        textContent: selection.text,
      },
      content,
      color,
    };

    const rects = this.layer.getRangeRects(selection.range);
    this.noteRenderer.render(annotation, rects);
    this.annotations.set(annotation.id, annotation);
    this.selectionHandler.clearSelection();
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

  removeAnnotation(id: string): boolean {
    const annotation = this.annotations.get(id);
    if (!annotation) return false;

    switch (annotation.type) {
      case 'highlight':
        this.highlightRenderer.remove(id);
        break;
      case 'underline':
        this.underlineRenderer.remove(id);
        break;
      case 'note':
        this.noteRenderer.remove(id);
        break;
      case 'drawing':
        this.drawingRenderer.remove(id);
        break;
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

  /**
   * Called by ContentRenderer when a chapter is displayed.
   * Re-renders annotations for the current spine item.
   */
  onChapterDisplayed(spineIndex: number): void {
    // In scrolled mode, sync SVG layer size to match full content height
    if (this.renderer.mode === 'scrolled') {
      this.layer.syncSize();
    }
    this.layer.clearAll();
    const chapterAnnotations = this.getAnnotationsForSpine(spineIndex);
    for (const annotation of chapterAnnotations) {
      this.renderExistingAnnotation(annotation);
    }
  }

  private renderExistingAnnotation(annotation: Annotation): void {
    if (annotation.type === 'drawing') {
      this.drawingRenderer.renderAnnotation(annotation);
      return;
    }

    // Text-based annotations: resolve CFI to Range relative to contentElement
    const root = this.renderer.contentElement;

    console.log('[AnnotationManager] renderExisting:', annotation.type, annotation.id);
    console.log('[AnnotationManager]   startCfi:', annotation.anchor.startCfi);
    console.log('[AnnotationManager]   endCfi:', annotation.anchor.endCfi);
    console.log('[AnnotationManager]   root:', root.tagName, root.className, 'children:', root.childNodes.length);

    const range = cfiRangeToRange(
      annotation.anchor.startCfi,
      annotation.anchor.endCfi,
      root
    );

    console.log('[AnnotationManager]   range resolved:', range ? 'yes' : 'null');
    if (!range) return;

    const rects = this.layer.getRangeRects(range);
    console.log('[AnnotationManager]   rects:', rects.length);

    switch (annotation.type) {
      case 'highlight':
        this.highlightRenderer.render(annotation, rects);
        break;
      case 'underline':
        this.underlineRenderer.render(annotation, rects);
        break;
      case 'note':
        this.noteRenderer.render(annotation, rects);
        break;
    }
  }

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
      this.annotations.set(annotation.id, annotation);
    }

    // Re-render current chapter
    this.onChapterDisplayed(this.renderer.spineIndex);
    this.emit('annotations:imported', { count: store.annotations.length });
  }

  toJSON(): string {
    return AnnotationSerializer.toJSON('', this.getAllAnnotations());
  }

  fromJSON(json: string, strategy: 'merge' | 'replace' = 'merge'): void {
    const store = AnnotationSerializer.fromJSON(json);
    this.importAnnotations(store, strategy);
  }

  destroy(): void {
    this.drawingRenderer.stopListening();
    this.noteRenderer.destroy();
    this.layer.destroy();
    this.removeAllListeners();
  }
}
