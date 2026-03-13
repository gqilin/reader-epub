import type { DrawingAnnotation, DrawingPath } from '../types/annotation';
import type { AnnotationLayer } from './annotation-layer';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface DrawingOptions {
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export class DrawingRenderer {
  private layer: AnnotationLayer;
  private options: DrawingOptions = {
    stroke: '#e74c3c',
    strokeWidth: 3,
    opacity: 0.8,
  };

  private isDrawing = false;
  private currentPath: SVGPathElement | null = null;
  private points: Array<{ x: number; y: number }> = [];
  private onFinish: ((paths: DrawingPath[], width: number, height: number) => void) | null = null;

  /** The SVG group where new drawing strokes are appended. Set by the manager. */
  private _targetGroup: SVGGElement | null = null;

  constructor(layer: AnnotationLayer) {
    this.layer = layer;
  }

  /** Set the current target group for new drawing strokes. */
  setTargetGroup(group: SVGGElement | null): void {
    this._targetGroup = group;
  }

  setOptions(options: Partial<DrawingOptions>): void {
    Object.assign(this.options, options);
  }

  startListening(
    onFinish: (paths: DrawingPath[], width: number, height: number) => void
  ): void {
    this.onFinish = onFinish;
    const svg = this.layer.svgElement;

    svg.addEventListener('pointerdown', this.handlePointerDown);
    svg.addEventListener('pointermove', this.handlePointerMove);
    svg.addEventListener('pointerup', this.handlePointerUp);
    svg.addEventListener('pointerleave', this.handlePointerUp);
  }

  stopListening(): void {
    const svg = this.layer.svgElement;
    svg.removeEventListener('pointerdown', this.handlePointerDown);
    svg.removeEventListener('pointermove', this.handlePointerMove);
    svg.removeEventListener('pointerup', this.handlePointerUp);
    svg.removeEventListener('pointerleave', this.handlePointerUp);
    this.onFinish = null;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    const targetGroup = this._targetGroup;
    if (!targetGroup) return;

    this.isDrawing = true;
    this.points = [{ x: e.offsetX, y: e.offsetY }];

    this.currentPath = document.createElementNS(SVG_NS, 'path');
    this.currentPath.setAttribute('fill', 'none');
    this.currentPath.setAttribute('stroke', this.options.stroke);
    this.currentPath.setAttribute(
      'stroke-width',
      String(this.options.strokeWidth)
    );
    this.currentPath.setAttribute('opacity', String(this.options.opacity));
    this.currentPath.setAttribute('stroke-linecap', 'round');
    this.currentPath.setAttribute('stroke-linejoin', 'round');
    this.currentPath.setAttribute(
      'd',
      `M ${e.offsetX} ${e.offsetY}`
    );

    targetGroup.appendChild(this.currentPath);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDrawing || !this.currentPath) return;

    this.points.push({ x: e.offsetX, y: e.offsetY });
    const d = this.currentPath.getAttribute('d') ?? '';
    this.currentPath.setAttribute(
      'd',
      `${d} L ${e.offsetX} ${e.offsetY}`
    );
  };

  private handlePointerUp = (): void => {
    if (!this.isDrawing || !this.currentPath) return;
    this.isDrawing = false;

    // Simplify path
    const simplified = this.simplifyPoints(this.points, 2);
    const d = this.buildPathData(simplified);
    this.currentPath.setAttribute('d', d);

    const svg = this.layer.svgElement;
    const rect = svg.getBoundingClientRect();

    if (this.onFinish) {
      this.onFinish(
        [
          {
            d,
            stroke: this.options.stroke,
            strokeWidth: this.options.strokeWidth,
            opacity: this.options.opacity,
          },
        ],
        rect.width,
        rect.height
      );
    }

    this.currentPath = null;
    this.points = [];
  };

  renderAnnotation(annotation: DrawingAnnotation, targetGroup: SVGGElement): void {
    const svg = this.layer.svgElement;
    const svgRect = svg.getBoundingClientRect();
    const scaleX = svgRect.width / annotation.viewportWidth;
    const scaleY = svgRect.height / annotation.viewportHeight;

    for (const path of annotation.paths) {
      const pathEl = document.createElementNS(SVG_NS, 'path');
      const scaledD = this.scalePath(path.d, scaleX, scaleY);
      pathEl.setAttribute('d', scaledD);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', path.stroke);
      pathEl.setAttribute('stroke-width', String(path.strokeWidth));
      pathEl.setAttribute('opacity', String(path.opacity));
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      pathEl.style.pointerEvents = 'all';
      pathEl.dataset.annotationId = annotation.id;
      targetGroup.appendChild(pathEl);
    }
  }

  remove(annotationId: string): void {
    this.layer.removeById(annotationId);
  }

  /**
   * Ramer-Douglas-Peucker path simplification.
   */
  private simplifyPoints(
    points: Array<{ x: number; y: number }>,
    tolerance: number
  ): Array<{ x: number; y: number }> {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDist(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tolerance) {
      const left = this.simplifyPoints(
        points.slice(0, maxIndex + 1),
        tolerance
      );
      const right = this.simplifyPoints(
        points.slice(maxIndex),
        tolerance
      );
      return [...left.slice(0, -1), ...right];
    }

    return [first, last];
  }

  private perpendicularDist(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }

    return (
      Math.abs(
        dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
      ) / Math.sqrt(lengthSq)
    );
  }

  private buildPathData(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  private scalePath(d: string, scaleX: number, scaleY: number): string {
    return d.replace(
      /([ML])\s*([\d.]+)\s+([\d.]+)/g,
      (_match, cmd: string, x: string, y: string) => {
        return `${cmd} ${parseFloat(x) * scaleX} ${parseFloat(y) * scaleY}`;
      }
    );
  }
}
