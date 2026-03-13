import type { ResourceResolver } from '../core/resource-resolver';

export class ImageResolver {
  private resources: ResourceResolver;

  constructor(resources: ResourceResolver) {
    this.resources = resources;
  }

  async resolveImages(
    xhtml: string,
    chapterHref: string
  ): Promise<{ content: string; replacements: Map<string, string> }> {
    const replacements = new Map<string, string>();

    // Match src="..." and href="..." for images/resources
    const srcPattern = /(?:src|href|xlink:href)=["']([^"']+)["']/g;
    const matches: { original: string; href: string }[] = [];

    let match;
    while ((match = srcPattern.exec(xhtml)) !== null) {
      const href = match[1];
      if (this.isResourceRef(href)) {
        matches.push({ original: href, href });
      }
    }

    // Also handle CSS url() references
    const urlPattern = /url\(["']?([^"')]+)["']?\)/g;
    while ((match = urlPattern.exec(xhtml)) !== null) {
      const href = match[1];
      if (this.isResourceRef(href)) {
        matches.push({ original: href, href });
      }
    }

    // Resolve unique hrefs
    const seen = new Set<string>();
    for (const { original, href } of matches) {
      if (seen.has(original)) continue;
      seen.add(original);
      try {
        const resolvedHref = this.resolveRelative(chapterHref, href);
        const blobUrl = await this.resources.createBlobUrl(resolvedHref);
        replacements.set(original, blobUrl);
      } catch {
        // Skip resources that can't be resolved
      }
    }

    return { content: xhtml, replacements };
  }

  private isResourceRef(href: string): boolean {
    if (!href) return false;
    if (href.startsWith('data:')) return false;
    if (href.startsWith('http://') || href.startsWith('https://')) return false;
    if (href.startsWith('#')) return false;
    return true;
  }

  private resolveRelative(chapterHref: string, resourceHref: string): string {
    const chapterDir = chapterHref.includes('/')
      ? chapterHref.substring(0, chapterHref.lastIndexOf('/'))
      : '';
    if (!chapterDir) return resourceHref;

    const parts = chapterDir.split('/');
    const relParts = resourceHref.split('/');
    for (const part of relParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    return parts.join('/');
  }
}
