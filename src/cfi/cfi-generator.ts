import { spineIndexToCfiStep } from './cfi-parser';

/**
 * Generate a CFI string from a DOM Range within an EPUB chapter.
 * @param root The root element to generate paths relative to (e.g. contentElement).
 */
export function generateCfi(
  range: Range,
  spineIndex: number,
  root: Node
): string {
  const startPath = nodeToPath(range.startContainer, range.startOffset, root);
  return `epubcfi(/6/${spineIndexToCfiStep(spineIndex)}!${startPath})`;
}

/**
 * Generate a CFI range (start and end) from a DOM Range.
 * @param root The root element to generate paths relative to (e.g. contentElement).
 */
export function generateCfiRange(
  range: Range,
  spineIndex: number,
  root: Node
): { start: string; end: string } {
  const spineStep = spineIndexToCfiStep(spineIndex);
  const startPath = nodeToPath(range.startContainer, range.startOffset, root);
  const endPath = nodeToPath(range.endContainer, range.endOffset, root);

  return {
    start: `epubcfi(/6/${spineStep}!${startPath})`,
    end: `epubcfi(/6/${spineStep}!${endPath})`,
  };
}

function nodeToPath(node: Node, offset: number, root: Node): string {
  const steps: string[] = [];
  let current: Node | null = node;
  let charOffset: number | undefined;

  // If it's a text node, record char offset and move to parent
  if (current.nodeType === Node.TEXT_NODE) {
    charOffset = offset;
    // Count preceding text nodes to get position among siblings
    const textIndex = getTextNodeIndex(current);
    steps.unshift(`/${textIndex}`);
    current = current.parentNode;
  }

  // Walk up the DOM tree, stopping at the root element
  while (current && current !== root) {
    const index = getElementIndex(current);
    const id = (current as Element).id;
    if (id) {
      steps.unshift(`/${index}[${id}]`);
    } else {
      steps.unshift(`/${index}`);
    }
    current = current.parentNode;
  }

  let path = steps.join('');
  if (charOffset !== undefined) {
    path += `:${charOffset}`;
  }
  return path;
}

/**
 * Get the 1-based index of an element among its siblings,
 * counting only element nodes (even indices in CFI).
 */
function getElementIndex(node: Node): number {
  let index = 0;
  let sibling: Node | null = node.parentNode?.firstChild ?? null;

  while (sibling) {
    if (sibling.nodeType === Node.ELEMENT_NODE) {
      index += 2; // CFI uses even numbers for elements
    }
    if (sibling === node) break;
    sibling = sibling.nextSibling;
  }

  return index;
}

/**
 * Get the CFI index for a text node.
 * Text nodes get odd indices in CFI.
 */
function getTextNodeIndex(node: Node): number {
  let index = 0;
  let sibling: Node | null = node.parentNode?.firstChild ?? null;

  while (sibling) {
    if (sibling.nodeType === Node.ELEMENT_NODE) {
      index += 2;
    } else if (sibling.nodeType === Node.TEXT_NODE) {
      index += 1;
      if (sibling === node) break;
    }
    if (sibling === node) break;
    sibling = sibling.nextSibling;
  }

  return index;
}
