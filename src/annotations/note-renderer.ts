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

    // Create clickable area for all text rectangles
    rects.forEach((rect, index) => {
      const x = rect.x;
      const y = rect.y;
      const width = rect.width;
      const height = rect.height;

      // Transparent rect covering the entire text (for click area)
      const clickRect = document.createElementNS(SVG_NS, 'rect');
      clickRect.setAttribute('x', String(x));
      clickRect.setAttribute('y', String(y));
      clickRect.setAttribute('width', String(width));
      clickRect.setAttribute('height', String(height));
      clickRect.setAttribute('fill', 'transparent');
      clickRect.style.pointerEvents = 'all';
      clickRect.style.cursor = 'pointer';
      clickRect.dataset.annotationId = annotation.id;
      clickRect.dataset.annotationType = 'note';
      clickRect.dataset.noteContent = annotation.content;

      // Store position for the first rect's underline
      if (index === 0) {
        clickRect.dataset.noteX = String(x);
        clickRect.dataset.noteY = String(y + height + 8);
      }

      targetGroup.appendChild(clickRect);

      // Dashed underline overlay (for visual feedback and flash animation)
      const underlineY = y + height - 2;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${x} ${underlineY} L ${x + width} ${underlineY}`);
      path.setAttribute('stroke', annotation.color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '4,3');
      path.setAttribute('fill', 'none');
      path.style.pointerEvents = 'none';
      path.dataset.annotationId = annotation.id;

      targetGroup.appendChild(path);
    });
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
