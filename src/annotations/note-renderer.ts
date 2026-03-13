import type { NoteAnnotation } from '../types/annotation';
import type { AnnotationLayer } from './annotation-layer';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class NoteRenderer {
  private layer: AnnotationLayer;
  private popover: HTMLDivElement;
  private activeNoteId: string | null = null;

  constructor(layer: AnnotationLayer, container: HTMLElement) {
    this.layer = layer;

    this.popover = document.createElement('div');
    this.popover.className = 'epub-note-popover';
    this.popover.style.cssText = `
      display:none;position:absolute;z-index:20;
      max-width:300px;padding:12px 16px;
      background:#fff;border:1px solid #ddd;border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
      font-size:14px;line-height:1.5;color:#333;
      word-wrap:break-word;
    `;
    container.appendChild(this.popover);
  }

  render(annotation: NoteAnnotation, rects: DOMRect[], targetGroup: SVGGElement): void {
    if (rects.length === 0) return;

    const firstRect = rects[0];

    // Note marker (circle icon at start of range)
    const marker = document.createElementNS(SVG_NS, 'circle');
    const cx = firstRect.x;
    const cy = firstRect.y;
    const radius = 8;

    marker.setAttribute('cx', String(cx));
    marker.setAttribute('cy', String(cy));
    marker.setAttribute('r', String(radius));
    marker.setAttribute('fill', annotation.color);
    marker.setAttribute('stroke', '#fff');
    marker.setAttribute('stroke-width', '2');
    marker.style.pointerEvents = 'all';
    marker.style.cursor = 'pointer';
    marker.dataset.annotationId = annotation.id;
    marker.dataset.noteContent = annotation.content;
    marker.dataset.noteX = String(cx);
    marker.dataset.noteY = String(cy + radius + 8);

    targetGroup.appendChild(marker);
  }

  showPopover(annotationId: string, content: string, x: number, y: number): void {
    this.activeNoteId = annotationId;
    this.popover.textContent = content;
    this.popover.style.display = 'block';
    this.popover.style.left = `${x}px`;
    this.popover.style.top = `${y}px`;
  }

  hidePopover(): void {
    this.activeNoteId = null;
    this.popover.style.display = 'none';
  }

  togglePopover(annotationId: string, content: string, x: number, y: number): void {
    if (this.activeNoteId === annotationId) {
      this.hidePopover();
    } else {
      this.showPopover(annotationId, content, x, y);
    }
  }

  remove(annotationId: string): void {
    this.layer.removeById(annotationId);
    if (this.activeNoteId === annotationId) {
      this.hidePopover();
    }
  }

  destroy(): void {
    this.popover.remove();
  }
}
