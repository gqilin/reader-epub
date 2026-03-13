import type { UnderlineAnnotation } from '../types/annotation';
import type { AnnotationLayer } from './annotation-layer';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class UnderlineRenderer {
  private layer: AnnotationLayer;

  constructor(layer: AnnotationLayer) {
    this.layer = layer;
  }

  render(annotation: UnderlineAnnotation, rects: DOMRect[]): void {
    const group = this.layer.underlines;
    console.log('[UnderlineRenderer] render() rects:', rects.length, 'color:', annotation.color, 'style:', annotation.style);

    for (const rect of rects) {
      const y = rect.y + rect.height - 1;

      if (annotation.style === 'wavy') {
        const path = this.createWavyPath(rect.x, y, rect.width);
        path.setAttribute('stroke', annotation.color);
        path.setAttribute('stroke-width', String(annotation.strokeWidth));
        path.setAttribute('fill', 'none');
        path.style.pointerEvents = 'all';
        path.style.cursor = 'pointer';
        path.dataset.annotationId = annotation.id;
        group.appendChild(path);
      } else {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(rect.x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(rect.x + rect.width));
        line.setAttribute('y2', String(y));
        line.setAttribute('stroke', annotation.color);
        line.setAttribute('stroke-width', String(annotation.strokeWidth));
        if (annotation.style === 'dashed') {
          line.setAttribute('stroke-dasharray', '6 3');
        }
        line.style.pointerEvents = 'all';
        line.style.cursor = 'pointer';
        line.dataset.annotationId = annotation.id;
        group.appendChild(line);
      }
    }
  }

  private createWavyPath(x: number, y: number, width: number): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    const amplitude = 2;
    const wavelength = 8;
    let d = `M ${x} ${y}`;

    for (let i = 0; i < width; i += wavelength) {
      const x1 = x + i + wavelength / 4;
      const y1 = y - amplitude;
      const x2 = x + i + wavelength / 2;
      const y2 = y;
      d += ` Q ${x1} ${y1} ${x2} ${y2}`;

      const x3 = x + i + (wavelength * 3) / 4;
      const y3 = y + amplitude;
      const x4 = x + Math.min(i + wavelength, width);
      const y4 = y;
      d += ` Q ${x3} ${y3} ${x4} ${y4}`;
    }

    path.setAttribute('d', d);
    return path;
  }

  remove(annotationId: string): void {
    const elements = this.layer.underlines.querySelectorAll(
      `[data-annotation-id="${annotationId}"]`
    );
    elements.forEach((el) => el.remove());
  }
}
