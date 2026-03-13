const parser = new DOMParser();

export function parseXml(text: string): Document {
  const doc = parser.parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    throw new Error(`XML parse error: ${err.textContent}`);
  }
  return doc;
}

export function parseXhtml(text: string): Document {
  return parser.parseFromString(text, 'application/xhtml+xml');
}

const NAMESPACES: Record<string, string> = {
  opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/',
  ncx: 'http://www.daisy.org/z3986/2005/ncx/',
  epub: 'http://www.idpf.org/2007/ops',
  container: 'urn:oasis:names:tc:opendocument:xmlns:container',
  xhtml: 'http://www.w3.org/1999/xhtml',
};

export function nsResolver(prefix: string | null): string | null {
  if (!prefix) return null;
  return NAMESPACES[prefix] ?? null;
}

export function queryAll(doc: Document | Element, selector: string): Element[] {
  return Array.from(doc.querySelectorAll(selector));
}

export function getTextContent(el: Element, tagName: string): string {
  const child = el.getElementsByTagName(tagName)[0]
    ?? el.getElementsByTagNameNS('*', tagName)[0];
  return child?.textContent?.trim() ?? '';
}

export function getAttribute(el: Element, name: string): string | undefined {
  return el.getAttribute(name) ?? undefined;
}

export function getElementsByTagNameNS(
  parent: Document | Element,
  ns: string,
  localName: string
): Element[] {
  return Array.from(parent.getElementsByTagNameNS(NAMESPACES[ns] ?? ns, localName));
}

export function resolveHref(base: string, relative: string): string {
  if (relative.startsWith('/') || relative.includes('://')) {
    return relative;
  }
  const baseParts = base.split('/');
  baseParts.pop();
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }
  return baseParts.join('/');
}
