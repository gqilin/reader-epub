import type { ContentRenderer } from '../renderer/content-renderer';
import { generateCfiRange } from '../cfi/cfi-generator';

export interface SelectionInfo {
  text: string;
  range: Range;
  cfiRange: { start: string; end: string };
}

export class TextSelectionHandler {
  private renderer: ContentRenderer;
  private currentSelection: SelectionInfo | null = null;

  constructor(renderer: ContentRenderer) {
    this.renderer = renderer;
  }

  getSelection(): SelectionInfo | null {
    // Shadow DOM: try shadowRoot.getSelection first, fallback to document
    const shadowRoot = this.renderer.contentShadowRoot;
    const srSel = (shadowRoot as unknown as { getSelection?: () => Selection | null })
      .getSelection?.();
    const docSel = document.getSelection();
    const selection = srSel ?? docSel;

    if (!selection || selection.isCollapsed) {
      // Fallback to cached selection (e.g., when a dialog has stolen focus)
      return this.currentSelection;
    }

    const text = selection.toString().trim();
    if (!text) return null;

    const range = selection.getRangeAt(0);

    // Ensure selection is inside our content
    if (!this.renderer.contentElement.contains(range.commonAncestorContainer)) {
      return null;
    }

    // Generate CFI relative to contentElement (the root of chapter HTML)
    const cfiRange = generateCfiRange(
      range,
      this.renderer.spineIndex,
      this.renderer.contentElement
    );

    this.currentSelection = { text, range, cfiRange };
    return this.currentSelection;
  }

  clearSelection(): void {
    const shadowRoot = this.renderer.contentShadowRoot;
    const selection = (shadowRoot as unknown as { getSelection?: () => Selection | null })
      .getSelection?.() ?? document.getSelection();
    selection?.removeAllRanges();
    this.currentSelection = null;
  }

  get current(): SelectionInfo | null {
    return this.currentSelection;
  }
}
