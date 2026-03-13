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

    console.log('[TextSelectionHandler] shadowRoot.getSelection():', srSel ? `"${srSel.toString().substring(0, 50)}" (rangeCount=${srSel.rangeCount})` : 'null/undefined');
    console.log('[TextSelectionHandler] document.getSelection():', docSel ? `"${docSel.toString().substring(0, 50)}" (rangeCount=${docSel.rangeCount})` : 'null');
    console.log('[TextSelectionHandler] using selection:', selection === srSel ? 'shadowRoot' : 'document');

    if (!selection || selection.isCollapsed) {
      console.log('[TextSelectionHandler] ❌ Selection is null or collapsed');
      return null;
    }

    const text = selection.toString().trim();
    if (!text) {
      console.log('[TextSelectionHandler] ❌ Selection text is empty');
      return null;
    }

    console.log('[TextSelectionHandler] ✓ Selected text:', text.substring(0, 80));

    const range = selection.getRangeAt(0);
    console.log('[TextSelectionHandler] Range:', {
      startContainer: range.startContainer.nodeName,
      startOffset: range.startOffset,
      endContainer: range.endContainer.nodeName,
      endOffset: range.endOffset,
      commonAncestor: range.commonAncestorContainer.nodeName,
    });

    // Ensure selection is inside our content
    const contentEl = this.renderer.contentElement;
    const isInside = contentEl.contains(range.commonAncestorContainer);
    console.log('[TextSelectionHandler] contentElement contains range?', isInside);
    console.log('[TextSelectionHandler] contentElement:', contentEl.tagName, contentEl.className);
    console.log('[TextSelectionHandler] range.commonAncestorContainer:', range.commonAncestorContainer.nodeName, (range.commonAncestorContainer as Element).className ?? '');

    if (!isInside) {
      console.log('[TextSelectionHandler] ❌ Selection is outside contentElement');
      return null;
    }

    // Generate CFI relative to contentElement (the root of chapter HTML)
    const cfiRange = generateCfiRange(
      range,
      this.renderer.spineIndex,
      this.renderer.contentElement
    );
    console.log('[TextSelectionHandler] ✓ CFI range:', cfiRange);

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
