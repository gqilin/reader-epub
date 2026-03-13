import type { CfiExpression, CfiStep, CfiLocalPath } from './cfi-types';

/**
 * Parse a CFI string like "epubcfi(/6/4!/4/2[id1]/3:10)"
 * into a structured CfiExpression.
 */
export function parseCfi(cfi: string): CfiExpression {
  // Strip wrapper
  let inner = cfi.trim();
  if (inner.startsWith('epubcfi(') && inner.endsWith(')')) {
    inner = inner.slice(8, -1);
  }

  // Split on "!" which separates spine reference from local path
  const bangIndex = inner.indexOf('!');
  if (bangIndex === -1) {
    throw new Error(`Invalid CFI: missing "!" separator: ${cfi}`);
  }

  const spineRef = inner.substring(0, bangIndex);
  const localRef = inner.substring(bangIndex + 1);

  // Parse spine reference: /6/4 → steps with index 6 and 4
  const spineSteps = parseSteps(spineRef);
  if (spineSteps.length < 2) {
    throw new Error(`Invalid CFI spine reference: ${spineRef}`);
  }

  // The second step is the spine item index
  const spineStep = spineSteps[1];

  // Parse local path
  const localPath = parseLocalPath(localRef);

  return { spineStep, localPath };
}

function parseSteps(path: string): CfiStep[] {
  const steps: CfiStep[] = [];
  const parts = path.split('/').filter(Boolean);

  for (const part of parts) {
    const idMatch = part.match(/^(\d+)\[([^\]]+)\]$/);
    if (idMatch) {
      steps.push({
        index: parseInt(idMatch[1], 10),
        id: idMatch[2],
      });
    } else {
      const index = parseInt(part, 10);
      if (isNaN(index)) {
        throw new Error(`Invalid CFI step: ${part}`);
      }
      steps.push({ index });
    }
  }

  return steps;
}

function parseLocalPath(path: string): CfiLocalPath {
  // Check for character offset (":N" at the end)
  let charOffset: number | undefined;
  let stepsStr = path;

  const colonIndex = path.lastIndexOf(':');
  if (colonIndex !== -1) {
    const afterColon = path.substring(colonIndex + 1);
    const offset = parseInt(afterColon, 10);
    if (!isNaN(offset)) {
      charOffset = offset;
      stepsStr = path.substring(0, colonIndex);
    }
  }

  const steps = parseSteps(stepsStr);
  return { steps, charOffset };
}

/**
 * Convert a spine index to the CFI spine step value.
 * CFI uses 1-based indexing and counts only element nodes,
 * so spine index N becomes step index (N+1)*2.
 */
export function spineIndexToCfiStep(spineIndex: number): number {
  return (spineIndex + 1) * 2;
}

/**
 * Convert a CFI spine step value back to a spine index.
 */
export function cfiStepToSpineIndex(step: number): number {
  return step / 2 - 1;
}
