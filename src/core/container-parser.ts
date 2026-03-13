import { parseXml, getElementsByTagNameNS, getAttribute } from './xml-utils';

export function parseContainer(xml: string): string {
  const doc = parseXml(xml);
  const rootfiles = getElementsByTagNameNS(doc, 'container', 'rootfile');
  if (rootfiles.length === 0) {
    throw new Error('No rootfile found in container.xml');
  }
  const fullPath = getAttribute(rootfiles[0], 'full-path');
  if (!fullPath) {
    throw new Error('rootfile missing full-path attribute');
  }
  return fullPath;
}
