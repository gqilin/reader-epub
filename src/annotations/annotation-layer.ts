import type { ContentRenderer } from '../renderer/content-renderer';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class AnnotationLayer {
  private svg: SVGSVGElement;
  private highlightGroup: SVGGElement;
  private underlineGroup: SVGGElement;
  private noteGroup: SVGGElement;
  private drawingGroup: SVGGElement;
  private renderer: ContentRenderer;

  constructor(renderer: ContentRenderer) {
    this.renderer = renderer;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('epub-annotation-layer');
    this.svg.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';

    this.highlightGroup = this.createGroup('highlights');
    this.underlineGroup = this.createGroup('underlines');
    this.noteGroup = this.createGroup('notes');
    this.drawingGroup = this.createGroup('drawings');

    this.svg.append(
      this.highlightGroup,
      this.underlineGroup,
      this.noteGroup,
      this.drawingGroup
    );

    // Append SVG into the shadow root (must be inside shadow DOM to be visible)
    renderer.contentShadowRoot.appendChild(this.svg);
    console.log('[AnnotationLayer] SVG layer created and appended to shadowRoot');
    console.log('[AnnotationLayer] wrapper:', renderer.wrapperElement.tagName, renderer.wrapperElement.className);
    console.log('[AnnotationLayer] SVG isConnected:', this.svg.isConnected);
  }

  private createGroup(className: string): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(className);
    return g;
  }

  get svgElement(): SVGSVGElement {
    return this.svg;
  }

  get highlights(): SVGGElement {
    return this.highlightGroup;
  }

  get underlines(): SVGGElement {
    return this.underlineGroup;
  }

  get notes(): SVGGElement {
    return this.noteGroup;
  }

  get drawings(): SVGGElement {
    return this.drawingGroup;
  }

  /**
   * Transform a DOMRect from viewport coordinates to SVG overlay coordinates.
   * Since Shadow DOM is in the same document, we just need to offset
   * relative to the wrapper element.
   */
  transformRect(rect: DOMRect): DOMRect {
    const wrapperRect = this.renderer.wrapperElement.getBoundingClientRect();
    const scrollTop = this.renderer.wrapperElement.scrollTop;
    const scrollLeft = this.renderer.wrapperElement.scrollLeft;

    return new DOMRect(
      rect.x - wrapperRect.left + scrollLeft,
      rect.y - wrapperRect.top + scrollTop,
      rect.width,
      rect.height
    );
  }

  /**
   * Get all client rects for a Range, transformed to SVG space.
   */
  getRangeRects(range: Range): DOMRect[] {
    const rects = range.getClientRects();
    console.log('[AnnotationLayer] range.getClientRects() count:', rects.length);
    for (let i = 0; i < rects.length; i++) {
      console.log(`[AnnotationLayer]   raw rect[${i}]:`, { x: rects[i].x, y: rects[i].y, w: rects[i].width, h: rects[i].height });
    }

    const wrapperRect = this.renderer.wrapperElement.getBoundingClientRect();
    console.log('[AnnotationLayer] wrapperRect:', { x: wrapperRect.x, y: wrapperRect.y, w: wrapperRect.width, h: wrapperRect.height });
    console.log('[AnnotationLayer] scrollTop:', this.renderer.wrapperElement.scrollTop, 'scrollLeft:', this.renderer.wrapperElement.scrollLeft);

    const result: DOMRect[] = [];
    for (let i = 0; i < rects.length; i++) {
      const transformed = this.transformRect(rects[i]);
      console.log(`[AnnotationLayer]   transformed[${i}]:`, { x: transformed.x, y: transformed.y, w: transformed.width, h: transformed.height });
      if (transformed.width > 0 && transformed.height > 0) {
        result.push(transformed);
      }
    }
    console.log('[AnnotationLayer] final rects count:', result.length);
    return result;
  }

  setDrawingMode(enabled: boolean): void {
    this.drawingGroup.style.pointerEvents = enabled ? 'all' : 'none';
    this.svg.style.pointerEvents = enabled ? 'all' : 'none';
  }

  /**
   * Sync SVG size to the full scrollable content height (scrolled mode).
   */
  syncSize(): void {
    const wrapper = this.renderer.wrapperElement;
    this.svg.style.width = `${wrapper.scrollWidth}px`;
    this.svg.style.height = `${wrapper.scrollHeight}px`;
  }

  clearGroup(group: SVGGElement): void {
    while (group.firstChild) {
      group.removeChild(group.firstChild);
    }
  }

  clearAll(): void {
    this.clearGroup(this.highlightGroup);
    this.clearGroup(this.underlineGroup);
    this.clearGroup(this.noteGroup);
    this.clearGroup(this.drawingGroup);
  }

  removeById(id: string): void {
    const el = this.svg.querySelector(`[data-annotation-id="${id}"]`);
    el?.remove();
  }

  destroy(): void {
    this.svg.remove();
  }
}
