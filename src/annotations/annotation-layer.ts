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
  private animStyle: HTMLStyleElement;

  constructor(renderer: ContentRenderer) {
    this.renderer = renderer;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('epub-annotation-layer');
    this.svg.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';

    // Flash animation styles for navigateToAnnotation
    this.animStyle = document.createElement('style');
    this.animStyle.textContent = `
      @keyframes epub-annotation-flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .epub-annotation-flash {
        animation: epub-annotation-flash 0.8s ease-in-out 3;
      }
      @keyframes epub-highlight-flash {
        0%, 100% { opacity: 0; }
        50% { opacity: var(--highlight-opacity, 0.35); }
      }
      .epub-highlight-flash {
        animation: epub-highlight-flash 0.8s ease-in-out 3;
      }
    `;
    renderer.contentShadowRoot.appendChild(this.animStyle);

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
   * Uses the SVG's own bounding rect so coordinates are always correct
   * regardless of padding, margin, scroll or CSS transforms.
   */
  transformRect(rect: DOMRect): DOMRect {
    const svgRect = this.svg.getBoundingClientRect();

    return new DOMRect(
      rect.x - svgRect.left,
      rect.y - svgRect.top,
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

  /**
   * Position SVG at the content element's origin.
   * Uses offsetLeft/offsetTop which account for wrapper padding AND
   * any content margin from the book's CSS, and are unaffected by
   * CSS transforms (important for paginated mode).
   */
  private positionSvgAtContent(): void {
    const content = this.renderer.contentElement;
    this.svg.style.left = `${content.offsetLeft}px`;
    this.svg.style.top = `${content.offsetTop}px`;
  }

  setDrawingMode(enabled: boolean): void {
    this.svg.style.pointerEvents = enabled ? 'all' : 'none';
    // Also enable pointer events on all chapter drawing groups
    for (const group of this.chapterGroups.values()) {
      group.drawings.style.pointerEvents = enabled ? 'all' : 'none';
    }
  }

  /**
   * Sync SVG size to the actual content area (scrolled mode).
   * Uses contentElement instead of wrapperElement to avoid the SVG's own
   * absolutely-positioned box inflating the measured scrollHeight.
   */
  syncSize(): void {
    const content = this.renderer.contentElement;
    this.positionSvgAtContent();
    this.svg.style.width = `${content.scrollWidth}px`;
    this.svg.style.height = `${content.scrollHeight}px`;
    this.svg.style.transform = '';
  }

  /**
   * Sync SVG width and transform for paginated mode.
   * Width covers all column pages; transform matches content's translateX.
   */
  syncPaginatedLayout(): void {
    const content = this.renderer.contentElement;
    this.positionSvgAtContent();
    this.svg.style.width = `${content.scrollWidth}px`;
    this.svg.style.height = `${content.offsetHeight}px`;
    this.svg.style.transform = content.style.transform;
  }

  /** Remove a single annotation's SVG elements by id (searches all chapters). */
  removeById(id: string): void {
    const els = this.svg.querySelectorAll(`[data-annotation-id="${id}"]`);
    els.forEach((el) => el.remove());
  }

  /**
   * Apply a flash/blink animation to an annotation's SVG elements
   * so the user can quickly locate the annotation after navigation.
   */
  flashAnnotation(id: string): void {
    const els = this.svg.querySelectorAll(`[data-annotation-id="${id}"]`);
    if (els.length === 0) return;

    // Remove existing flash classes (in case of rapid re-trigger)
    els.forEach((el) => {
      el.classList.remove('epub-annotation-flash');
      el.classList.remove('epub-highlight-flash');
    });

    // Force reflow then add animation class
    requestAnimationFrame(() => {
      els.forEach((el) => {
        // Highlight rects get special animation (0 → opacity → 0)
        if ((el as SVGElement).tagName === 'rect') {
          const opacity = (el as SVGElement).getAttribute('opacity');
          if (opacity) {
            (el as SVGElement).style.setProperty('--highlight-opacity', opacity);
          }
          el.classList.add('epub-highlight-flash');
        } else {
          // Lines and paths use standard animation (1 → 0.3 → 1)
          el.classList.add('epub-annotation-flash');
        }
      });
    });

    // Clean up class after animation completes
    const onEnd = () => {
      els.forEach((el) => {
        el.classList.remove('epub-annotation-flash');
        el.classList.remove('epub-highlight-flash');
      });
    };
    els[0].addEventListener('animationend', onEnd, { once: true });
  }

  /** Clear all chapter groups. */
  clearAll(): void {
    for (const [, group] of this.chapterGroups) {
      group.root.remove();
    }
    this.chapterGroups.clear();
  }

  destroy(): void {
    this.animStyle.remove();
    this.svg.remove();
  }
}
