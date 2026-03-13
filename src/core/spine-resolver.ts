import type { SpineItem, ManifestItem } from '../types/epub';

export interface ResolvedSpineItem extends SpineItem {
  href: string;
  mediaType: string;
}

export function resolveSpine(
  spine: SpineItem[],
  manifest: Map<string, ManifestItem>
): ResolvedSpineItem[] {
  return spine.map((item) => {
    const manifestItem = manifest.get(item.idref);
    if (!manifestItem) {
      throw new Error(`Spine idref "${item.idref}" not found in manifest`);
    }
    return {
      ...item,
      href: manifestItem.href,
      mediaType: manifestItem.mediaType,
    };
  });
}
