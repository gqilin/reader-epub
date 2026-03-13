import { parseCfi, cfiStepToSpineIndex } from './cfi-parser';

export interface CfiResolveResult {
  spineIndex: number;
  node: Node;
  offset: number;
}

/**
 * Resolve a CFI string to a DOM node and offset within a document.
 */
export function resolveCfi(
  cfi: string,
  doc: Document
): CfiResolveResult {
  const parsed = parseCfi(cfi);
  const spineIndex = cfiStepToSpineIndex(parsed.spineStep.index);

  // Walk the local path steps through the DOM
  let current: Node = doc.body ?? doc.documentElement;

  for (let i = 0; i < parsed.localPath.steps.length; i++) {
    const step = parsed.localPath.steps[i];
    const isLast = i === parsed.localPath.steps.length - 1;

    // Check if this step targets a text node (odd index)
    const isTextStep = step.index % 2 === 1;

    if (isTextStep) {
      // Find the text node at this position
      const textNode = findTextNode(current, step.index);
      if (textNode) {
        return {
          spineIndex,
          node: textNode,
          offset: parsed.localPath.charOffset ?? 0,
        };
      }
    } else {
      // Find element at even index
      const child = findElementChild(current, step.index);
      if (child) {
        // If step has an ID, validate it
        if (step.id && (child as Element).id !== step.id) {
          // Try to find by ID as fallback
          const byId = doc.getElementById(step.id);
          if (byId) {
            current = byId;
            continue;
          }
        }
        current = child;

        if (isLast && parsed.localPath.charOffset !== undefined) {
          // The last element step with charOffset targets the first text node
          const textNode = current.firstChild;
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            return {
              spineIndex,
              node: textNode,
              offset: parsed.localPath.charOffset,
            };
          }
        }
      }
    }
  }

  return {
    spineIndex,
    node: current,
    offset: parsed.localPath.charOffset ?? 0,
  };
}

/**
 * Create a DOM Range from two CFI strings (start and end).
 */
export function cfiRangeToRange(
  startCfi: string,
  endCfi: string,
  doc: Document
): Range | null {
  try {
    const start = resolveCfi(startCfi, doc);
    const end = resolveCfi(endCfi, doc);

    const range = doc.createRange();
    range.setStart(start.node, Math.min(start.offset, getNodeLength(start.node)));
    range.setEnd(end.node, Math.min(end.offset, getNodeLength(end.node)));
    return range;
  } catch {
    return null;
  }
}

function findElementChild(parent: Node, index: number): Node | null {
  let count = 0;
  let child: Node | null = parent.firstChild;

  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      count += 2;
      if (count === index) return child;
    }
    child = child.nextSibling;
  }
  return null;
}

function findTextNode(parent: Node, index: number): Node | null {
  let count = 0;
  let child: Node | null = parent.firstChild;

  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      count += 2;
    } else if (child.nodeType === Node.TEXT_NODE) {
      count += 1;
      if (count === index) return child;
    }
    child = child.nextSibling;
  }
  return null;
}

function getNodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).length;
  }
  return node.childNodes.length;
}
