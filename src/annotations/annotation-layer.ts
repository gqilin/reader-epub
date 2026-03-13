import type { ContentRenderer } from '../renderer/content-renderer';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG sub-groups owned by a single chapter. */
export interface ChapterSvgGroup {
  root: SVGGElement;
  highlights: SVGGElement;
  underlines: SVGGElement;
  notes: SVGGElement;
  drawings: SVGGElement;
}

export class AnnotationLayer {
  private svg: SVGSVGElement;
  private renderer: ContentRenderer;
  private chapterGroups = new Map<string, ChapterSvgGroup>();

  constructor(renderer: ContentRenderer) {
    this.renderer = renderer;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('epub-annotation-layer');
    this.svg.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';

    // Append SVG into the shadow root (must be inside shadow DOM to be visible)
    renderer.contentShadowRoot.appendChild(this.svg);
  }

  // ── Per-chapter lifecycle ────────────────────────────────────

  /**
   * Create SVG groups for a chapter. Idempotent — returns existing group
   * if the chapter is already mounted.
   */
  mountChapter(chapterId: string): ChapterSvgGroup {
    const existing = this.chapterGroups.get(chapterId);
    if (existing) return existing;

    const root = this.createGroup(`chapter-${chapterId}`);
    root.dataset.chapterId = chapterId;

    const highlights = this.createGroup('highlights');
    const underlines = this.createGroup('underlines');
    const notes = this.createGroup('notes');
    const drawings = this.createGroup('drawings');
    root.append(highlights, underlines, notes, drawings);

    this.svg.appendChild(root);
    const group: ChapterSvgGroup = { root, highlights, underlines, notes, drawings };
    this.chapterGroups.set(chapterId, group);
    return group;
  }

  /**
   * Remove SVG groups for a chapter (e.g. when it scrolls out of view
   * in lazy-loading mode). Annotation *data* is not affected.
   */
  unmountChapter(chapterId: string): void {
    const group = this.chapterGroups.get(chapterId);
    if (group) {
      group.root.remove();
      this.chapterGroups.delete(chapterId);
    }
  }

  /** Get the SVG groups for a mounted chapter. */
  getChapterGroup(chapterId: string): ChapterSvgGroup | undefined {
    return this.chapterGroups.get(chapterId);
  }

  // ── Helpers ─────────────────────────────────────────────────

  private createGroup(className: string): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(className);
    return g;
  }

  get svgElement(): SVGSVGElement {
    return this.svg;
  }

  /**
   * Transform a DOMRect from viewport coordinates to SVG overlay coordinates.
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
    const result: DOMRect[] = [];
    for (let i = 0; i < rects.length; i++) {
      const transformed = this.transformRect(rects[i]);
      if (transformed.width > 0 && transformed.height > 0) {
        result.push(transformed);
      }
    }
    return result;
  }

  setDrawingMode(enabled: boolean): void {
    this.svg.style.pointerEvents = enabled ? 'all' : 'none';
    // Also enable pointer events on all chapter drawing groups
    for (const group of this.chapterGroups.values()) {
      group.drawings.style.pointerEvents = enabled ? 'all' : 'none';
    }
  }

  /**
   * Sync SVG size to the full scrollable content height (scrolled mode).
   */
  syncSize(): void {
    const wrapper = this.renderer.wrapperElement;
    this.svg.style.width = `${wrapper.scrollWidth}px`;
    this.svg.style.height = `${wrapper.scrollHeight}px`;
  }

  /** Remove a single annotation's SVG elements by id (searches all chapters). */
  removeById(id: string): void {
    const els = this.svg.querySelectorAll(`[data-annotation-id="${id}"]`);
    els.forEach((el) => el.remove());
  }

  /** Clear all chapter groups. */
  clearAll(): void {
    for (const [, group] of this.chapterGroups) {
      group.root.remove();
    }
    this.chapterGroups.clear();
  }

  destroy(): void {
    this.svg.remove();
  }
}
