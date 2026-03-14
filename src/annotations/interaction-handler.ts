import type { Annotation } from '../types/annotation';
import type { AnnotationLayer } from './annotation-layer';
import type { NoteRenderer } from './note-renderer';

export type InteractionMode = 'select' | 'draw' | 'view';

export class InteractionHandler {
  private layer: AnnotationLayer;
  private noteRenderer: NoteRenderer;
  private mode: InteractionMode = 'select';
  private onAnnotationClick: ((id: string, event: MouseEvent) => void) | null = null;
  private onAnnotationHover: ((id: string | null, event: MouseEvent) => void) | null = null;
  private onNoteEdit: ((id: string, event: MouseEvent) => void) | null = null;

  constructor(layer: AnnotationLayer, noteRenderer: NoteRenderer) {
    this.layer = layer;
    this.noteRenderer = noteRenderer;
    this.setupListeners();
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
    this.layer.setDrawingMode(mode === 'draw');

    if (mode !== 'draw') {
      // In select/view mode, SVG layer doesn't block events
      // except for annotation elements with pointer-events: all
      this.layer.svgElement.style.pointerEvents = 'none';
    }
  }

  getMode(): InteractionMode {
    return this.mode;
  }

  setClickHandler(
    handler: (id: string, event: MouseEvent) => void
  ): void {
    this.onAnnotationClick = handler;
  }

  setHoverHandler(
    handler: (id: string | null, event: MouseEvent) => void
  ): void {
    this.onAnnotationHover = handler;
  }

  setNoteEditHandler(
    handler: (id: string, event: MouseEvent) => void
  ): void {
    this.onNoteEdit = handler;
  }

  private setupListeners(): void {
    const svg = this.layer.svgElement;

    svg.addEventListener('click', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as SVGElement;
      const annotationId = target?.dataset?.annotationId;

      if (annotationId) {
        const annotationType = target?.dataset?.annotationType;

        // Handle note edit
        if (annotationType === 'note') {
          this.onNoteEdit?.(annotationId, mouseEvent);
        } else {
          // Handle note popover for other annotations
          const noteContent = target?.dataset?.noteContent;
          if (noteContent) {
            const noteX = parseFloat(target?.dataset?.noteX ?? '0');
            const noteY = parseFloat(target?.dataset?.noteY ?? '0');
            this.noteRenderer.togglePopover(
              annotationId,
              noteContent,
              noteX,
              noteY
            );
          }
        }

        this.onAnnotationClick?.(annotationId, mouseEvent);
      } else {
        // Clicked outside annotation
        this.noteRenderer.hidePopover();
      }
    });

    svg.addEventListener('mouseover', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as SVGElement;
      const annotationId = target?.dataset?.annotationId;
      this.onAnnotationHover?.(annotationId ?? null, mouseEvent);
    });

    svg.addEventListener('mouseout', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      this.onAnnotationHover?.(null, mouseEvent);
    });
  }

  findAnnotationAtPoint(
    x: number,
    y: number,
    annotations: Annotation[]
  ): Annotation | null {
    const elements = this.layer.svgElement.querySelectorAll(
      '[data-annotation-id]'
    );
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i] as SVGElement;
      const bbox = (el as SVGGraphicsElement).getBBox?.();
      if (bbox && x >= bbox.x && x <= bbox.x + bbox.width &&
          y >= bbox.y && y <= bbox.y + bbox.height) {
        const id = el.dataset.annotationId;
        return annotations.find((a) => a.id === id) ?? null;
      }
    }
    return null;
  }
}
