import { EpubArchive } from './epub-archive';
import { RemoteArchive } from './remote-archive';
import { parseContainer } from './container-parser';
import { parseOpf } from './opf-parser';
import { parseNcx } from './ncx-parser';
import { parseNav } from './nav-parser';
import { resolveSpine, type ResolvedSpineItem } from './spine-resolver';
import { ResourceResolver } from './resource-resolver';
import { TypedEventEmitter } from '../events/event-emitter';
import type { IEpubArchive } from '../types/archive';
import type { EpubReaderEvents } from '../events/event-types';
import type {
  EpubMetadata,
  ManifestItem,
  SpineItem,
  GuideReference,
} from '../types/epub';
import type { TocItem } from '../types/toc';
import type { RendererOptions } from '../types/renderer';

export class EpubReader extends TypedEventEmitter<EpubReaderEvents> {
  private _archive: IEpubArchive;
  private _metadata!: EpubMetadata;
  private _manifest!: Map<string, ManifestItem>;
  private _spine!: SpineItem[];
  private _resolvedSpine!: ResolvedSpineItem[];
  private _toc!: TocItem[];
  private _guide!: GuideReference[];
  private _resources!: ResourceResolver;
  private _opfDir!: string;

  private constructor(archive: IEpubArchive) {
    super();
    this._archive = archive;
  }

  static async fromFile(file: File): Promise<EpubReader> {
    const buffer = await file.arrayBuffer();
    return EpubReader.fromArrayBuffer(buffer);
  }

  static async fromUrl(
    url: string,
    fetchOptions?: RequestInit
  ): Promise<EpubReader> {
    // Detect remote (unpacked) EPUB by entry file extension
    if (/container\.xml(\?|#|$)/i.test(url) || /\.opf(\?|#|$)/i.test(url)) {
      return EpubReader.fromRemoteUrl(url, fetchOptions);
    }
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPUB: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return EpubReader.fromArrayBuffer(buffer);
  }

  /**
   * Load an unpacked (directory-based) EPUB from a remote server.
   * @param entryUrl URL to container.xml or a .opf file
   * @param fetchOptions Optional fetch options forwarded to every HTTP request
   */
  static async fromRemoteUrl(
    entryUrl: string,
    fetchOptions?: RequestInit
  ): Promise<EpubReader> {
    let baseUrl: string;
    let opfPath: string | undefined;

    if (/container\.xml(\?|#|$)/i.test(entryUrl)) {
      // URL points to META-INF/container.xml
      const idx = entryUrl.indexOf('META-INF/container.xml');
      baseUrl = idx > 0 ? entryUrl.substring(0, idx) : entryUrl.substring(0, entryUrl.lastIndexOf('/') + 1);
    } else if (/\.opf(\?|#|$)/i.test(entryUrl)) {
      // URL points to a .opf file — try to locate the epub root
      const found = await EpubReader.resolveEpubRoot(entryUrl, fetchOptions);
      baseUrl = found.baseUrl;
      opfPath = found.opfPath;
    } else {
      // Treat as epub root directory
      baseUrl = entryUrl.endsWith('/') ? entryUrl : entryUrl + '/';
    }

    const archive = new RemoteArchive(baseUrl, fetchOptions);
    const reader = new EpubReader(archive);
    await reader.parse(opfPath);
    return reader;
  }

  /**
   * Given a .opf URL, try to find the epub root by searching upward for META-INF/container.xml.
   * If found, returns the baseUrl and the opfPath as listed in container.xml.
   * If not found, falls back to using the .opf's parent directory as the base.
   */
  private static async resolveEpubRoot(
    opfUrl: string,
    fetchOptions?: RequestInit
  ): Promise<{ baseUrl: string; opfPath?: string }> {
    const urlObj = new URL(opfUrl);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Try each ancestor directory (from opf's parent upward)
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const candidateBase = urlObj.origin + '/' + pathParts.slice(0, i).join('/') + '/';
      const containerUrl = candidateBase + 'META-INF/container.xml';
      try {
        const resp = await fetch(containerUrl, fetchOptions);
        if (resp.ok) {
          return { baseUrl: candidateBase };
        }
      } catch {
        // continue searching upward
      }
    }

    // Fallback: use the .opf's parent directory as base, skip container.xml
    const lastSlash = opfUrl.lastIndexOf('/');
    const baseUrl = opfUrl.substring(0, lastSlash + 1);
    const opfFileName = opfUrl.substring(lastSlash + 1).replace(/[?#].*$/, '');
    return { baseUrl, opfPath: opfFileName };
  }

  /**
   * 从自定义 IEpubArchive 实现创建阅读器。
   * 适用于需要自定义内容获取逻辑的场景（如加密章节、自定义 API 等）。
   * @param archive 自定义的 IEpubArchive 实现
   * @param opfPath 可选的 OPF 文件路径；不传则自动读取 META-INF/container.xml 解析
   */
  static async fromArchive(
    archive: IEpubArchive,
    opfPath?: string
  ): Promise<EpubReader> {
    const reader = new EpubReader(archive);
    await reader.parse(opfPath);
    return reader;
  }

  static async fromArrayBuffer(buffer: ArrayBuffer): Promise<EpubReader> {
    const archive = await EpubArchive.open(buffer);
    const reader = new EpubReader(archive);
    await reader.parse();
    return reader;
  }

  private async parse(knownOpfPath?: string): Promise<void> {
    try {
      // 1. Determine OPF path
      let opfPath: string;
      if (knownOpfPath) {
        opfPath = knownOpfPath;
      } else {
        const containerXml = await this._archive.readText(
          'META-INF/container.xml'
        );
        opfPath = parseContainer(containerXml);
      }
      this._opfDir = opfPath.includes('/')
        ? opfPath.substring(0, opfPath.lastIndexOf('/'))
        : '';

      // 2. Parse OPF
      const opfXml = await this._archive.readText(opfPath);
      const opfResult = parseOpf(opfXml);
      this._metadata = opfResult.metadata;
      this._manifest = opfResult.manifest;
      this._spine = opfResult.spine;
      this._guide = opfResult.guide;
      this._resolvedSpine = resolveSpine(this._spine, this._manifest);

      // 3. Create resource resolver
      this._resources = new ResourceResolver(
        this._archive,
        this._opfDir,
        this._manifest
      );

      // 4. Parse TOC
      this._toc = await this.parseToc(opfResult.tocId);

      this.emit('book:ready', { metadata: this._metadata });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('book:error', { error: err });
      throw err;
    }
  }

  private async parseToc(tocId?: string): Promise<TocItem[]> {
    // Try EPUB 3 nav document first
    const navItem = this.findNavItem();
    if (navItem) {
      try {
        const navXhtml = await this._resources.getTextContent(navItem.href);
        const toc = parseNav(
          navXhtml,
          this._spine,
          this._manifest,
          this._opfDir
        );
        if (toc.length > 0) return toc;
      } catch {
        // Fall through to NCX
      }
    }

    // Try EPUB 2 NCX
    if (tocId) {
      const ncxItem = this._manifest.get(tocId);
      if (ncxItem) {
        try {
          const ncxXml = await this._resources.getTextContent(ncxItem.href);
          return parseNcx(
            ncxXml,
            this._spine,
            this._manifest,
            this._opfDir
          );
        } catch {
          // Fall through
        }
      }
    }

    // Fallback: look for any .ncx file in manifest
    for (const item of this._manifest.values()) {
      if (item.mediaType === 'application/x-dtbncx+xml') {
        try {
          const ncxXml = await this._resources.getTextContent(item.href);
          return parseNcx(
            ncxXml,
            this._spine,
            this._manifest,
            this._opfDir
          );
        } catch {
          // Fall through
        }
      }
    }

    return [];
  }

  private findNavItem(): ManifestItem | undefined {
    for (const item of this._manifest.values()) {
      if (item.properties?.includes('nav')) {
        return item;
      }
    }
    return undefined;
  }

  get metadata(): EpubMetadata {
    return this._metadata;
  }

  get spine(): ReadonlyArray<SpineItem> {
    return this._spine;
  }

  get resolvedSpine(): ReadonlyArray<ResolvedSpineItem> {
    return this._resolvedSpine;
  }

  get toc(): ReadonlyArray<TocItem> {
    return this._toc;
  }

  get manifest(): ReadonlyMap<string, ManifestItem> {
    return this._manifest;
  }

  get guide(): ReadonlyArray<GuideReference> {
    return this._guide;
  }

  get resources(): ResourceResolver {
    return this._resources;
  }

  async getCoverImage(): Promise<Blob | null> {
    if (!this._metadata.coverImageId) return null;
    try {
      return await this._resources.getResourceById(this._metadata.coverImageId);
    } catch {
      return null;
    }
  }

  async getResource(id: string): Promise<Blob> {
    return this._resources.getResourceById(id);
  }

  async getResourceByHref(href: string): Promise<Blob> {
    return this._resources.getResourceByHref(href);
  }

  async getChapterContent(spineIndex: number): Promise<string> {
    const resolved = this._resolvedSpine[spineIndex];
    if (!resolved) {
      throw new Error(`Invalid spine index: ${spineIndex}`);
    }
    return this._resources.getTextContent(resolved.href);
  }

  async createRenderer(options: RendererOptions): Promise<import('../renderer/content-renderer').ContentRenderer> {
    const { ContentRenderer: Renderer } = await import('../renderer/content-renderer');
    return new Renderer(this, options);
  }

  destroy(): void {
    this._resources.revokeBlobUrls();
    this.removeAllListeners();
  }
}
