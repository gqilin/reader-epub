import type { EpubArchive } from './epub-archive';
import type { ManifestItem } from '../types/epub';
import { resolveHref } from './xml-utils';

export class ResourceResolver {
  private archive: EpubArchive;
  private opfDir: string;
  private manifest: Map<string, ManifestItem>;
  private blobUrlCache = new Map<string, string>();

  constructor(
    archive: EpubArchive,
    opfDir: string,
    manifest: Map<string, ManifestItem>
  ) {
    this.archive = archive;
    this.opfDir = opfDir;
    this.manifest = manifest;
  }

  resolveFullPath(href: string): string {
    if (this.opfDir) {
      return resolveHref(`${this.opfDir}/dummy`, href);
    }
    return href;
  }

  async getResourceById(id: string): Promise<Blob> {
    const item = this.manifest.get(id);
    if (!item) {
      throw new Error(`Resource with id "${id}" not found in manifest`);
    }
    const fullPath = this.resolveFullPath(item.href);
    return this.archive.readBlob(fullPath, item.mediaType);
  }

  async getResourceByHref(href: string): Promise<Blob> {
    const fullPath = this.resolveFullPath(href);
    // Find matching manifest item for MIME type
    let mimeType = 'application/octet-stream';
    for (const item of this.manifest.values()) {
      if (this.resolveFullPath(item.href) === fullPath) {
        mimeType = item.mediaType;
        break;
      }
    }
    return this.archive.readBlob(fullPath, mimeType);
  }

  async createBlobUrl(href: string): Promise<string> {
    const fullPath = this.resolveFullPath(href);
    if (this.blobUrlCache.has(fullPath)) {
      return this.blobUrlCache.get(fullPath)!;
    }
    const blob = await this.getResourceByHref(href);
    const url = URL.createObjectURL(blob);
    this.blobUrlCache.set(fullPath, url);
    return url;
  }

  revokeBlobUrls(): void {
    for (const url of this.blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlCache.clear();
  }

  async getTextContent(href: string): Promise<string> {
    const fullPath = this.resolveFullPath(href);
    return this.archive.readText(fullPath);
  }
}
