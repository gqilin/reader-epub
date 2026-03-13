import { parseXml, getAttribute } from './xml-utils';
import type { TocItem } from '../types/toc';
import type { SpineItem, ManifestItem } from '../types/epub';

export function parseNcx(
  xml: string,
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>,
  opfDir: string
): TocItem[] {
  const doc = parseXml(xml);
  const navMap = doc.getElementsByTagName('navMap')[0];
  if (!navMap) return [];
  return parseNavPoints(navMap, spine, manifest, opfDir);
}

function parseNavPoints(
  parent: Element,
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>,
  opfDir: string
): TocItem[] {
  const items: TocItem[] = [];
  const navPoints = parent.children;

  for (let i = 0; i < navPoints.length; i++) {
    const np = navPoints[i];
    if (np.tagName !== 'navPoint') continue;

    const id = getAttribute(np, 'id') ?? `nav-${i}`;
    const playOrderStr = getAttribute(np, 'playOrder');
    const playOrder = playOrderStr ? parseInt(playOrderStr, 10) : undefined;

    // navLabel > text
    const labelEl = np.getElementsByTagName('navLabel')[0];
    const textEl = labelEl?.getElementsByTagName('text')[0];
    const label = textEl?.textContent?.trim() ?? '';

    // content@src
    const contentEl = np.getElementsByTagName('content')[0];
    const src = getAttribute(contentEl, 'src') ?? '';

    const spineIndex = resolveSpineIndex(src, spine, manifest, opfDir);
    const children = parseNavPoints(np, spine, manifest, opfDir);

    items.push({ id, label, href: src, spineIndex, children, playOrder });
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
