import { parseXhtml } from './xml-utils';
import type { TocItem } from '../types/toc';
import type { SpineItem, ManifestItem } from '../types/epub';

export function parseNav(
  xhtml: string,
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>,
  opfDir: string
): TocItem[] {
  const doc = parseXhtml(xhtml);

  // Find <nav epub:type="toc"> or fallback to first <nav>
  let navEl: Element | null = null;
  const navs = doc.getElementsByTagName('nav');
  for (let i = 0; i < navs.length; i++) {
    const epubType =
      navs[i].getAttributeNS('http://www.idpf.org/2007/ops', 'type') ??
      navs[i].getAttribute('epub:type');
    if (epubType === 'toc') {
      navEl = navs[i];
      break;
    }
  }
  if (!navEl && navs.length > 0) {
    navEl = navs[0];
  }
  if (!navEl) return [];

  const ol = navEl.getElementsByTagName('ol')[0];
  if (!ol) return [];

  return parseOlItems(ol, spine, manifest, opfDir);
}

function parseOlItems(
  ol: Element,
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>,
  opfDir: string
): TocItem[] {
  const items: TocItem[] = [];
  let counter = 0;

  for (let i = 0; i < ol.children.length; i++) {
    const li = ol.children[i];
    if (li.tagName.toLowerCase() !== 'li') continue;

    const a = li.getElementsByTagName('a')[0];
    if (!a) continue;

    const href = a.getAttribute('href') ?? '';
    const label = a.textContent?.trim() ?? '';
    const id = a.getAttribute('id') ?? `nav-item-${counter++}`;

    const spineIndex = resolveSpineIndex(href, spine, manifest, opfDir);

    // Check for nested <ol>
    let children: TocItem[] = [];
    const nestedOl = li.getElementsByTagName('ol')[0];
    if (nestedOl) {
      children = parseOlItems(nestedOl, spine, manifest, opfDir);
    }

    items.push({ id, label, href, spineIndex, children });
  }
  return items;
}

function resolveSpineIndex(
  href: string,
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>,
  opfDir: string
): number {
  const [filePath] = href.split('#');
  const fullPath = opfDir ? `${opfDir}/${filePath}` : filePath;

  for (const spineItem of spine) {
    const manifestItem = manifest.get(spineItem.idref);
    if (!manifestItem) continue;
    const manifestPath = opfDir
      ? `${opfDir}/${manifestItem.href}`
      : manifestItem.href;
    if (manifestPath === fullPath || manifestItem.href === filePath) {
      return spineItem.index;
    }
  }
  return -1;
}
