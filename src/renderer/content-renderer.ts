import { TypedEventEmitter } from '../events/event-emitter';
import type { RendererEvents } from '../events/event-types';
import type { RendererOptions, PaginationInfo, ReaderTheme } from '../types/renderer';
import type { TocItem } from '../types/toc';
import type { EpubReader } from '../core/epub-parser';
import { ImageResolver } from './image-resolver';
import { StyleInjector } from './style-injector';
import { Paginator } from './pagination';
import { resolveHref } from '../core/xml-utils';
import { parseCfi, cfiStepToSpineIndex } from '../cfi/cfi-parser';
import { generateCfiRange } from '../cfi/cfi-generator';
import { resolveCfi } from '../cfi/cfi-resolver';
import type { AnnotationManager } from '../annotations/annotation-manager';

/** Derive a stable chapter container ID from a spine index. */
export function getChapterId(spineIndex: number): string {
  return `epub-spine-${spineIndex}`;
}

export class ContentRenderer extends TypedEventEmitter<RendererEvents> {
  private reader: EpubReader;
  private options: RendererOptions;
  private wrapper: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private contentEl: HTMLDivElement;
  private styleEl: HTMLStyleElement;
  private imageResolver: ImageResolver;
  private styleInjector: StyleInjector;
  private paginator: Paginator;
  private _annotations: AnnotationManager | null = null;
  private currentSpineIndex = -1;
  private resizeObserver: ResizeObserver;
  private scrollHandler: (() => void) | null = null;
  private _pagination: PaginationInfo = {
    currentPage: 0,
    totalPages: 1,
    spineIndex: 0,
    chapterProgress: 0,
    bookProgress: 0,
  };

  constructor(reader: EpubReader, options: RendererOptions) {
    super();
    this.reader = reader;
    this.options = options;
    this.imageResolver = new ImageResolver(reader.resources);
    this.styleInjector = new StyleInjector();
    this.paginator = new Paginator(options.columnGap ?? 40);

    if (options.theme) this.styleInjector.setTheme(options.theme);
    if (options.customStyles) this.styleInjector.setCustomCSS(options.customStyles);

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'epub-reader-wrapper';
    this.applyWrapperStyle();
    options.container.appendChild(this.wrapper);

    // Create Shadow DOM
    this.shadowRoot = this.wrapper.attachShadow({ mode: 'open' });

    // Style element inside shadow root
    this.styleEl = document.createElement('style');
    this.shadowRoot.appendChild(this.styleEl);

    // Content container inside shadow root
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'epub-body';
    this.shadowRoot.appendChild(this.contentEl);

    // Observe resize
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.wrapper);

    this.emit('renderer:ready', undefined);
  }

  private applyWrapperStyle(): void {
    if (this.options.mode === 'scrolled') {
      this.wrapper.style.cssText =
        'position:relative;width:100%;height:100%;overflow-y:auto;overflow-x:hidden;';
    } else {
      this.wrapper.style.cssText =
        'position:relative;width:100%;height:100%;overflow:hidden;';
    }
  }

  async display(spineIndex: number): Promise<void> {
    this.dismissSelectionToolbar();
    const resolved = this.reader.resolvedSpine[spineIndex];
    if (!resolved) {
      throw new Error(`Invalid spine index: ${spineIndex}`);
    }

    this.currentSpineIndex = spineIndex;
    const chapterId = getChapterId(spineIndex);
    const xhtml = await this.reader.getChapterContent(spineIndex);
    const { replacements } = await this.imageResolver.resolveImages(
      xhtml,
      resolved.href
    );

    // Extract body content from XHTML
    let bodyHtml = this.extractBody(xhtml);

    // Replace resource references with blob URLs
    for (const [original, blobUrl] of replacements) {
      bodyHtml = bodyHtml.replaceAll(original, blobUrl);
    }

    // Extract inline <style> blocks and linked CSS from the XHTML
    const bookStyles = await this.extractStyles(xhtml, replacements, resolved.href);

    // Build CSS
    const rect = this.wrapper.getBoundingClientRect();
    let css = bookStyles + '\n';
    css += this.styleInjector.buildContentStyles() + '\n';

    if (this.options.mode === 'paginated') {
      css += this.styleInjector.buildPaginationStyles(
        rect.width,
        this.paginator.columnGap,
        rect.height
      );
    } else {
      css += this.styleInjector.buildScrolledStyles();
    }

    this.styleEl.textContent = css;
    this.contentEl.innerHTML = bodyHtml;
    this.contentEl.id = chapterId;

    // Wait for images
    await this.waitForImages();

    if (this.options.mode === 'paginated') {
      this.paginator.apply(this.contentEl, rect.width, rect.height);
      this.paginator.goToPage(0);
    } else {
      this.wrapper.scrollTop = 0;
      this.setupScrollListener();
    }

    // Set up selection listener
    this.setupSelectionListener();

    this.updatePaginationInfo();
    this.emit('renderer:displayed', { spineIndex });

    // Notify annotation layer: unmount previous, mount current
    if (this._annotations) {
      this._annotations.onChapterMounted(spineIndex, this.contentEl);
    }
  }

  async next(): Promise<boolean> {
    this.dismissSelectionToolbar();
    if (this.options.mode === 'paginated') {
      if (this.paginator.nextPage()) {
        this.updatePaginationInfo();
        return true;
      }
    }
    const nextIndex = this.currentSpineIndex + 1;
    if (nextIndex < this.reader.spine.length) {
      await this.display(nextIndex);
      return true;
    }
    return false;
  }

  async prev(): Promise<boolean> {
    this.dismissSelectionToolbar();
    if (this.options.mode === 'paginated') {
      if (this.paginator.prevPage()) {
        this.updatePaginationInfo();
        return true;
      }
      const prevIndex = this.currentSpineIndex - 1;
      if (prevIndex >= 0) {
        await this.display(prevIndex);
        const state = this.paginator.current;
        this.paginator.goToPage(state.totalPages - 1);
        this.updatePaginationInfo();
        return true;
      }
      return false;
    }
    const prevIndex = this.currentSpineIndex - 1;
    if (prevIndex >= 0) {
      await this.display(prevIndex);
      this.wrapper.scrollTop = this.wrapper.scrollHeight;
      this.updatePaginationInfo();
      return true;
    }
    return false;
  }

  async goToTocItem(tocItem: TocItem): Promise<void> {
    this.dismissSelectionToolbar();
    if (tocItem.spineIndex >= 0) {
      await this.display(tocItem.spineIndex);
      const fragment = tocItem.href.split('#')[1];
      if (fragment) {
        const el = this.shadowRoot.getElementById(fragment)
          ?? this.contentEl.querySelector(`[id="${fragment}"]`);
        if (el) {
          if (this.options.mode === 'paginated') {
            this.scrollToElement(el);
          } else {
            const elRect = el.getBoundingClientRect();
            const wrapperRect = this.wrapper.getBoundingClientRect();
            this.wrapper.scrollTop += elRect.top - wrapperRect.top;
          }
        }
      }
    }
  }

  async goToCfi(cfi: string): Promise<void> {
    this.dismissSelectionToolbar();
    const parsed = parseCfi(cfi);
    const spineIndex = cfiStepToSpineIndex(parsed.spineStep.index);

    if (spineIndex < 0 || spineIndex >= this.reader.spine.length) {
      throw new Error(`CFI references invalid spine index: ${spineIndex}`);
    }

    if (spineIndex !== this.currentSpineIndex) {
      await this.display(spineIndex);
    }

    const resolved = resolveCfi(cfi, this.contentEl);
    this.scrollToNode(resolved.node, resolved.offset);
  }

  get pagination(): PaginationInfo {
    return { ...this._pagination };
  }

  get spineIndex(): number {
    return this.currentSpineIndex;
  }

  get chapterId(): string {
    return getChapterId(this.currentSpineIndex);
  }

  /** The shadow root containing rendered content. */
  get contentShadowRoot(): ShadowRoot {
    return this.shadowRoot;
  }

  /** The div holding chapter HTML inside shadow root. */
  get contentElement(): HTMLDivElement {
    return this.contentEl;
  }

  get wrapperElement(): HTMLDivElement {
    return this.wrapper;
  }

  get mode(): 'paginated' | 'scrolled' {
    return this.options.mode;
  }

  // ── Theme API ─────────────────────────────────────────────

  /** Replace the entire theme. */
  setTheme(theme: ReaderTheme): void {
    this.styleInjector.setTheme(theme);
    this.applyStyles();
  }

  /** Merge partial theme values (only overwrite provided keys). */
  updateTheme(partial: Partial<ReaderTheme>): void {
    this.styleInjector.updateTheme(partial);
    this.applyStyles();
  }

  /** Get current theme values. */
  getTheme(): ReaderTheme {
    return this.styleInjector.getTheme();
  }

  /** Convenience setters */
  setFontSize(px: number): void {
    this.updateTheme({ fontSize: px });
  }

  setFontFamily(family: string): void {
    this.updateTheme({ fontFamily: family });
  }

  setColor(color: string): void {
    this.updateTheme({ color });
  }

  setBackgroundColor(bg: string): void {
    this.updateTheme({ backgroundColor: bg });
  }

  setLineHeight(lh: number | string): void {
    this.updateTheme({ lineHeight: lh });
  }

  setParagraphSpacing(px: number): void {
    this.updateTheme({ paragraphSpacing: px });
  }

  setLetterSpacing(val: number | string): void {
    this.updateTheme({ letterSpacing: val });
  }

  setTextAlign(align: 'left' | 'right' | 'center' | 'justify'): void {
    this.updateTheme({ textAlign: align });
  }

  injectCSS(css: string): void {
    this.styleInjector.setCustomCSS(css);
    this.applyStyles();
  }

  // ── Annotations ───────────────────────────────────────────

  get annotations(): AnnotationManager {
    if (!this._annotations) {
      throw new Error(
        'AnnotationManager not initialized. Call initAnnotations() first.'
      );
    }
    return this._annotations;
  }

  async initAnnotations(): Promise<AnnotationManager> {
    if (!this._annotations) {
      const { AnnotationManager: AM } = await import(
        '../annotations/annotation-manager'
      );
      this._annotations = new AM(this);
    }
    return this._annotations;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  resize(): void {
    if (this.currentSpineIndex < 0) return;
    const rect = this.wrapper.getBoundingClientRect();
    this.emit('renderer:resized', {
      width: rect.width,
      height: rect.height,
    });

    if (this.options.mode === 'paginated') {
      this.paginator.apply(this.contentEl, rect.width, rect.height);
      this.updatePaginationInfo();
    } else {
      this.updatePaginationInfo();
    }

    // Refresh annotation positions after layout change
    requestAnimationFrame(() => {
      this._annotations?.refreshAnnotations();
    });
  }

  destroy(): void {
    this.removeScrollListener();
    this.resizeObserver.disconnect();
    this._annotations?.destroy();
    this.wrapper.remove();
    this.removeAllListeners();
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Intercept <a> tag clicks inside epub content.
   * - Fragment-only links (#id): scroll within the current chapter
   * - Internal cross-chapter links (chapter2.xhtml#section): navigate to that chapter
   * - External links (http://...): emit event and open in new tab
   */
  private handleLinkClick(event: MouseEvent): void {
    // Walk up from event target to find the closest <a> element
    let target = event.target as HTMLElement | null;
    while (target && target !== this.contentEl) {
      if (target.tagName === 'A') break;
      target = target.parentElement;
    }
    if (!target || target.tagName !== 'A') return;

    const href = target.getAttribute('href');
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();

    // External link
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
      this.emit('renderer:link-click', { href, isExternal: true, event });
      window.open(href, '_blank', 'noopener');
      return;
    }

    this.emit('renderer:link-click', { href, isExternal: false, event });

    // Fragment-only link (#footnote1) — same chapter
    if (href.startsWith('#')) {
      const fragment = href.substring(1);
      this.scrollToFragment(fragment);
      return;
    }

    // Internal epub link — resolve to spine index
    this.navigateToHref(href);
  }

  /**
   * Scroll to a fragment (element by id) within the currently displayed chapter.
   */
  private scrollToFragment(fragment: string): void {
    const el = this.shadowRoot.getElementById(fragment)
      ?? this.contentEl.querySelector(`[id="${CSS.escape(fragment)}"]`);
    if (!el) return;

    if (this.options.mode === 'paginated') {
      this.scrollToElement(el);
    } else {
      const elRect = el.getBoundingClientRect();
      const wrapperRect = this.wrapper.getBoundingClientRect();
      this.wrapper.scrollTop += elRect.top - wrapperRect.top;
      this.updatePaginationInfo();
    }
  }

  /**
   * Resolve an internal epub href (e.g. "chapter2.xhtml#section1") to a spine index
   * and navigate to it.
   */
  private async navigateToHref(href: string): Promise<void> {
    const [filePart, fragment] = href.split('#');
    const currentChapterHref = this.reader.resolvedSpine[this.currentSpineIndex]?.href ?? '';

    // Resolve relative href against the current chapter's path
    const resolvedHref = filePart
      ? resolveHref(currentChapterHref, filePart)
      : currentChapterHref;

    // Find matching spine index
    const spineIndex = this.findSpineIndexByHref(resolvedHref);
    if (spineIndex < 0) return;

    if (spineIndex === this.currentSpineIndex && fragment) {
      // Same chapter, just scroll to fragment
      this.scrollToFragment(fragment);
      return;
    }

    await this.display(spineIndex);
    if (fragment) {
      this.scrollToFragment(fragment);
    }
  }

  /**
   * Find spine index by matching the resolved href against spine items.
   * Tries exact match first, then filename-only match for robustness.
   */
  private findSpineIndexByHref(href: string): number {
    const spine = this.reader.resolvedSpine;

    // Exact match
    for (let i = 0; i < spine.length; i++) {
      if (spine[i].href === href) return i;
    }

    // Filename-only match (strip directory prefix)
    const hrefFilename = href.includes('/') ? href.substring(href.lastIndexOf('/') + 1) : href;
    for (let i = 0; i < spine.length; i++) {
      const spineHref = spine[i].href;
      const spineFilename = spineHref.includes('/') ? spineHref.substring(spineHref.lastIndexOf('/') + 1) : spineHref;
      if (spineFilename === hrefFilename) return i;
    }

    return -1;
  }

  private applyStyles(): void {
    const rect = this.wrapper.getBoundingClientRect();

    // Preserve book-level CSS already in <style>
    const bookCss = this.extractBookCssFromStyleEl();

    let css = bookCss + '\n';
    css += this.styleInjector.buildContentStyles() + '\n';

    if (this.options.mode === 'paginated') {
      css += this.styleInjector.buildPaginationStyles(
        rect.width,
        this.paginator.columnGap,
        rect.height
      );
      // Re-measure pagination, then refresh annotations after reflow
      requestAnimationFrame(() => {
        this.paginator.recalculate();
        this.updatePaginationInfo();
        this._annotations?.refreshAnnotations();
      });
    } else {
      css += this.styleInjector.buildScrolledStyles();
      // Refresh annotations after reflow in scrolled mode
      requestAnimationFrame(() => {
        this._annotations?.refreshAnnotations();
      });
    }

    this.styleEl.textContent = css;
  }

  /** Extract the book's own CSS from the current style element (everything before our generated section). */
  private extractBookCssFromStyleEl(): string {
    const full = this.styleEl.textContent ?? '';
    const marker = ':host';
    const idx = full.indexOf(marker);
    return idx > 0 ? full.substring(0, idx).trim() : '';
  }

  private extractBody(xhtml: string): string {
    // Strip <script> tags for security
    let html = xhtml.replace(/<script[\s\S]*?<\/script>/gi, '');

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1];
    }
    // Fallback: strip XML declaration, doctype, html/head wrappers
    html = html.replace(/<\?xml[^?]*\?>/i, '');
    html = html.replace(/<!DOCTYPE[^>]*>/i, '');
    html = html.replace(/<html[^>]*>/i, '');
    html = html.replace(/<\/html>/i, '');
    html = html.replace(/<head[\s\S]*?<\/head>/i, '');
    return html.trim();
  }

  private async extractStyles(
    xhtml: string,
    replacements: Map<string, string>,
    chapterHref: string
  ): Promise<string> {
    const styles: string[] = [];

    // 1. Load external <link rel="stylesheet"> CSS files
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(xhtml)) !== null) {
      const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/);
      if (!hrefMatch) continue;

      const cssHref = hrefMatch[1];
      const resolvedCssHref = resolveHref(chapterHref, cssHref);

      try {
        let css = await this.reader.resources.getTextContent(resolvedCssHref);

        // Resolve url() references inside the CSS (relative to CSS file location)
        const urlPattern = /url\(["']?([^"')]+)["']?\)/g;
        let urlMatch;
        const cssReplacements = new Map<string, string>();
        while ((urlMatch = urlPattern.exec(css)) !== null) {
          const ref = urlMatch[1];
          if (!ref || ref.startsWith('data:') || ref.startsWith('http://') || ref.startsWith('https://')) continue;
          if (cssReplacements.has(ref)) continue;
          try {
            const resolvedRef = resolveHref(resolvedCssHref, ref);
            const blobUrl = await this.reader.resources.createBlobUrl(resolvedRef);
            cssReplacements.set(ref, blobUrl);
          } catch {
            // Skip unresolvable resources
          }
        }
        for (const [original, blobUrl] of cssReplacements) {
          css = css.replaceAll(original, blobUrl);
        }

        css = this.scopeCSS(css);
        styles.push(css);
      } catch {
        // Skip CSS files that can't be loaded
      }
    }

    // 2. Extract inline <style> blocks
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = styleRegex.exec(xhtml)) !== null) {
      let css = match[1];
      // Scope selectors under .epub-body
      css = this.scopeCSS(css);
      // Replace resource URLs
      for (const [original, blobUrl] of replacements) {
        css = css.replaceAll(original, blobUrl);
      }
      styles.push(css);
    }

    return styles.join('\n');
  }

  /** Roughly scope CSS rules under .epub-body so they don't leak. */
  private scopeCSS(css: string): string {
    // Replace body/html selectors with .epub-body
    let scoped = css.replace(/\bbody\b/g, '.epub-body');
    scoped = scoped.replace(/\bhtml\b/g, ':host');
    return scoped;
  }

  private setupSelectionListener(): void {
    // Existing selectionchange handler for backward compat
    const selectionChangeHandler = () => {
      const selection = this.getContentSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      if (!this.contentEl.contains(range.commonAncestorContainer)) return;

      this.emit('renderer:selection', {
        text,
        range,
        cfiRange: { start: '', end: '' },
      });
    };

    document.addEventListener('selectionchange', selectionChangeHandler);

    // mouseup: show floating toolbar after selection completes
    const mouseupHandler = () => {
      requestAnimationFrame(() => this.emitSelectionToolbar());
    };
    this.contentEl.addEventListener('mouseup', mouseupHandler);

    // touchend: mobile support
    const touchendHandler = () => {
      setTimeout(() => this.emitSelectionToolbar(), 100);
    };
    this.contentEl.addEventListener('touchend', touchendHandler);

    // click: dismiss toolbar when clicking without selection + handle links + emit click event
    this.contentEl.addEventListener('click', (event) => {
      this.handleLinkClick(event as MouseEvent);
      this.emit('renderer:click', { event: event as MouseEvent });
    });

    // Store handlers for cleanup
    const store = this as unknown as Record<string, unknown>;
    store._selectionHandler = selectionChangeHandler;
    store._mouseupHandler = mouseupHandler;
    store._touchendHandler = touchendHandler;
  }

  /** Read the current selection from the Shadow DOM. */
  private getContentSelection(): Selection | null {
    const sr = this.shadowRoot as unknown as { getSelection?: () => Selection | null };
    return sr.getSelection?.() ?? document.getSelection();
  }

  /** Compute toolbar position from the current selection and emit event. */
  private emitSelectionToolbar(): void {
    const selection = this.getContentSelection();
    if (!selection || selection.isCollapsed) {
      this.dismissSelectionToolbar();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      this.dismissSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!this.contentEl.contains(range.commonAncestorContainer)) {
      this.dismissSelectionToolbar();
      return;
    }

    const rects = range.getClientRects();
    if (rects.length === 0) {
      this.dismissSelectionToolbar();
      return;
    }

    // Compute bounding box from all client rects (viewport coords)
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.top < top) top = r.top;
      if (r.left < left) left = r.left;
      if (r.right > right) right = r.right;
      if (r.bottom > bottom) bottom = r.bottom;
    }

    // Generate CFI range if possible
    let cfiRange = { start: '', end: '' };
    try {
      cfiRange = generateCfiRange(range, this.currentSpineIndex, this.contentEl);
    } catch {
      // CFI generation may fail, continue without it
    }

    this.emit('renderer:selection-toolbar', {
      visible: true,
      position: {
        x: (left + right) / 2,
        y: top,
        selectionRect: { top, left, right, bottom },
      },
      text,
      cfiRange,
    });
  }

  /** Hide the selection toolbar. */
  dismissSelectionToolbar(): void {
    this.emit('renderer:selection-toolbar', {
      visible: false,
      position: null,
      text: '',
      cfiRange: { start: '', end: '' },
    });
  }

  private setupScrollListener(): void {
    this.removeScrollListener();
    this.scrollHandler = () => {
      this.updatePaginationInfo();
    };
    this.wrapper.addEventListener('scroll', this.scrollHandler, {
      passive: true,
    });
  }

  private removeScrollListener(): void {
    if (this.scrollHandler) {
      this.wrapper.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    const store = this as unknown as Record<string, (() => void) | undefined>;
    if (store._selectionHandler) {
      document.removeEventListener('selectionchange', store._selectionHandler);
    }
    if (store._mouseupHandler) {
      this.contentEl.removeEventListener('mouseup', store._mouseupHandler);
    }
    if (store._touchendHandler) {
      this.contentEl.removeEventListener('touchend', store._touchendHandler);
    }
  }

  private updatePaginationInfo(): void {
    const totalSpineItems = this.reader.spine.length;

    if (this.options.mode === 'paginated') {
      const state = this.paginator.current;
      this._pagination = {
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        spineIndex: this.currentSpineIndex,
        chapterProgress:
          state.totalPages > 1
            ? state.currentPage / (state.totalPages - 1)
            : 1,
        bookProgress:
          totalSpineItems > 0
            ? (this.currentSpineIndex +
                state.currentPage / state.totalPages) /
              totalSpineItems
            : 0,
      };
    } else {
      const scrollTop = this.wrapper.scrollTop;
      const scrollHeight =
        this.wrapper.scrollHeight - this.wrapper.clientHeight;
      const chapterProgress =
        scrollHeight > 0 ? Math.min(1, scrollTop / scrollHeight) : 1;

      this._pagination = {
        currentPage: 0,
        totalPages: 1,
        spineIndex: this.currentSpineIndex,
        chapterProgress,
        bookProgress:
          totalSpineItems > 0
            ? (this.currentSpineIndex + chapterProgress) / totalSpineItems
            : 0,
      };
    }

    this.emit('renderer:paginated', this._pagination);
  }

  private scrollToElement(el: Element): void {
    const rect = el.getBoundingClientRect();
    const wrapperRect = this.wrapper.getBoundingClientRect();
    const pageWidth = wrapperRect.width + this.paginator.columnGap;
    const page = Math.floor((rect.left - wrapperRect.left) / pageWidth);
    this.paginator.goToPage(page);
    this.updatePaginationInfo();
  }

  private scrollToNode(node: Node, offset: number): void {
    const range = document.createRange();
    const safeOffset = node.nodeType === Node.TEXT_NODE
      ? Math.min(offset, (node as Text).length)
      : Math.min(offset, node.childNodes.length);
    range.setStart(node, safeOffset);
    range.collapse(true);

    const rect = range.getBoundingClientRect();

    if (this.options.mode === 'paginated') {
      const wrapperRect = this.wrapper.getBoundingClientRect();
      const pageWidth = wrapperRect.width + this.paginator.columnGap;
      const page = Math.floor((rect.left - wrapperRect.left) / pageWidth);
      this.paginator.goToPage(page);
      this.updatePaginationInfo();
    } else {
      const wrapperRect = this.wrapper.getBoundingClientRect();
      this.wrapper.scrollTop += rect.top - wrapperRect.top;
      this.updatePaginationInfo();
    }
  }

  private waitForImages(): Promise<void> {
    return new Promise((resolve) => {
      const images = this.contentEl.querySelectorAll('img');
      if (images.length === 0) {
        requestAnimationFrame(() => resolve());
        return;
      }

      let loaded = 0;
      const total = images.length;
      const onLoad = () => {
        loaded++;
        if (loaded >= total) resolve();
      };

      images.forEach((img) => {
        if (img.complete) {
          onLoad();
        } else {
          img.addEventListener('load', onLoad, { once: true });
          img.addEventListener('error', onLoad, { once: true });
        }
      });

      setTimeout(resolve, 3000);
    });
  }
}
