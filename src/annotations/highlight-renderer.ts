import type { HighlightAnnotation, HighlightColor } from '../types/annotation';
import type { AnnotationLayer } from './annotation-layer';

const SVG_NS = 'http://www.w3.org/2000/svg';

function resolveColor(color: HighlightColor): string {
  if (typeof color === 'string') {
    const colorMap: Record<string, string> = {
      yellow: '#FFEB3B',
      green: '#4CAF50',
      blue: '#2196F3',
      pink: '#E91E63',
      orange: '#FF9800',
    };
    return colorMap[color] ?? color;
  }
  return color.custom;
}

export class HighlightRenderer {
  private layer: AnnotationLayer;

  constructor(layer: AnnotationLayer) {
    this.layer = layer;
  }

  render(annotation: HighlightAnnotation, rects: DOMRect[], targetGroup: SVGGElement): void {
    const color = resolveColor(annotation.color);

    for (const rect of rects) {
      const rectEl = document.createElementNS(SVG_NS, 'rect');
      rectEl.setAttribute('x', String(rect.x));
      rectEl.setAttribute('y', String(rect.y));
      rectEl.setAttribute('width', String(rect.width));
      rectEl.setAttribute('height', String(rect.height));
      rectEl.setAttribute('fill', color);
      rectEl.setAttribute('opacity', String(annotation.opacity));
      rectEl.style.mixBlendMode = 'multiply';
      rectEl.style.pointerEvents = 'all';
      rectEl.style.cursor = 'pointer';
      rectEl.dataset.annotationId = annotation.id;
      targetGroup.appendChild(rectEl);
    }
  }

  remove(annotationId: string): void {
    this.layer.removeById(annotationId);
  }
}
