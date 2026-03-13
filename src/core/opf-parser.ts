import {
  parseXml,
  getElementsByTagNameNS,
  getAttribute,
  getTextContent,
} from './xml-utils';
import type {
  EpubMetadata,
  ManifestItem,
  SpineItem,
  GuideReference,
  Author,
} from '../types/epub';

export interface OpfParseResult {
  metadata: EpubMetadata;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  guide: GuideReference[];
  tocId?: string;
}

export function parseOpf(xml: string): OpfParseResult {
  const doc = parseXml(xml);
  const metadata = parseMetadata(doc);
  const manifest = parseManifest(doc);
  const { spine, tocId } = parseSpine(doc);
  const guide = parseGuide(doc);

  // Resolve cover image
  if (!metadata.coverImageId) {
    const coverMeta = Array.from(
      doc.querySelectorAll('meta[name="cover"]')
    ).find((el) => el.getAttribute('name') === 'cover');
    if (coverMeta) {
      metadata.coverImageId = coverMeta.getAttribute('content') ?? undefined;
    }
  }
  // EPUB 3: look for manifest item with cover-image property
  if (!metadata.coverImageId) {
    for (const [id, item] of manifest) {
      if (item.properties?.includes('cover-image')) {
        metadata.coverImageId = id;
        break;
      }
    }
  }

  return { metadata, manifest, spine, guide, tocId };
}

function parseMetadata(doc: Document): EpubMetadata {
  const metadataEl = getElementsByTagNameNS(doc, 'opf', 'metadata')[0]
    ?? doc.getElementsByTagName('metadata')[0];

  if (!metadataEl) {
    throw new Error('No <metadata> element found in OPF');
  }

  const title = getTextContent(metadataEl, 'title');
  const language = getTextContent(metadataEl, 'language') || 'en';
  const identifier = getTextContent(metadataEl, 'identifier');
  const publisher = getTextContent(metadataEl, 'publisher') || undefined;
  const description = getTextContent(metadataEl, 'description') || undefined;
  const rights = getTextContent(metadataEl, 'rights') || undefined;
  const publishDate = getTextContent(metadataEl, 'date') || undefined;

  // Creators
  const creatorEls = getElementsByTagNameNS(metadataEl, 'dc', 'creator');
  const creators: Author[] = creatorEls.map((el) => ({
    name: el.textContent?.trim() ?? '',
    fileAs: getAttribute(el, 'opf:file-as') ?? getAttribute(el, 'file-as'),
    role: getAttribute(el, 'opf:role') ?? getAttribute(el, 'role'),
  }));

  // Subjects
  const subjectEls = getElementsByTagNameNS(metadataEl, 'dc', 'subject');
  const subjects = subjectEls
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean);

  // Meta
  const meta: Record<string, string> = {};
  const metaEls = metadataEl.getElementsByTagName('meta');
  for (let i = 0; i < metaEls.length; i++) {
    const el = metaEls[i];
    const property = getAttribute(el, 'property');
    const name = getAttribute(el, 'name');
    if (property && el.textContent) {
      meta[property] = el.textContent.trim();
    } else if (name) {
      meta[name] = getAttribute(el, 'content') ?? '';
    }
  }

  const modifiedDate = meta['dcterms:modified'] ?? undefined;

  return {
    title,
    creators,
    language,
    identifier,
    publisher,
    publishDate,
    modifiedDate,
    description,
    rights,
    subjects,
    meta,
  };
}

function parseManifest(doc: Document): Map<string, ManifestItem> {
  const manifestEl = getElementsByTagNameNS(doc, 'opf', 'manifest')[0]
    ?? doc.getElementsByTagName('manifest')[0];

  const manifest = new Map<string, ManifestItem>();
  if (!manifestEl) return manifest;

  const items = manifestEl.getElementsByTagName('item');
  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    const id = getAttribute(el, 'id');
    const href = getAttribute(el, 'href');
    const mediaType = getAttribute(el, 'media-type');
    if (!id || !href || !mediaType) continue;

    const properties = getAttribute(el, 'properties')?.split(/\s+/);
    const fallback = getAttribute(el, 'fallback');

    manifest.set(id, { id, href, mediaType, properties, fallback });
  }
  return manifest;
}

function parseSpine(doc: Document): { spine: SpineItem[]; tocId?: string } {
  const spineEl = getElementsByTagNameNS(doc, 'opf', 'spine')[0]
    ?? doc.getElementsByTagName('spine')[0];

  if (!spineEl) {
    return { spine: [] };
  }

  const tocId = getAttribute(spineEl, 'toc');
  const itemrefs = spineEl.getElementsByTagName('itemref');
  const spine: SpineItem[] = [];

  for (let i = 0; i < itemrefs.length; i++) {
    const el = itemrefs[i];
    const idref = getAttribute(el, 'idref');
    if (!idref) continue;

    const linear = getAttribute(el, 'linear') !== 'no';
    const properties = getAttribute(el, 'properties')?.split(/\s+/);

    spine.push({ idref, linear, properties, index: i });
  }
  return { spine, tocId };
}

function parseGuide(doc: Document): GuideReference[] {
  const guideEl = getElementsByTagNameNS(doc, 'opf', 'guide')[0]
    ?? doc.getElementsByTagName('guide')[0];

  if (!guideEl) return [];

  const refs = guideEl.getElementsByTagName('reference');
  const guide: GuideReference[] = [];

  for (let i = 0; i < refs.length; i++) {
    const el = refs[i];
    const type = getAttribute(el, 'type') ?? '';
    const title = getAttribute(el, 'title') ?? '';
    const href = getAttribute(el, 'href') ?? '';
    guide.push({ type, title, href });
  }
  return guide;
}
