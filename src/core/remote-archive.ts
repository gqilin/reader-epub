import type { IEpubArchive } from '../types/archive';

/**
 * HTTP-based archive for reading unpacked EPUB files from a remote server.
 * All file paths are resolved relative to the given baseUrl.
 */
export class RemoteArchive implements IEpubArchive {
  private baseUrl: string;
  private fetchOptions?: RequestInit;

  constructor(baseUrl: string, fetchOptions?: RequestInit) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.fetchOptions = fetchOptions;
  }

  private resolveUrl(path: string): string {
    // Remove leading slash to avoid overriding the base
    const cleanPath = path.replace(/^\/+/, '');
    return new URL(cleanPath, this.baseUrl).href;
  }

  async readText(path: string): Promise<string> {
    const url = this.resolveUrl(path);
    const response = await fetch(url, this.fetchOptions);
    if (!response.ok) {
      throw new Error(`File not found in remote EPUB: ${path} (${response.status})`);
    }
    return response.text();
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const url = this.resolveUrl(path);
    const response = await fetch(url, this.fetchOptions);
    if (!response.ok) {
      throw new Error(`File not found in remote EPUB: ${path} (${response.status})`);
    }
    return response.arrayBuffer();
  }

  async readBlob(path: string, mimeType: string): Promise<Blob> {
    const buffer = await this.readBinary(path);
    return new Blob([buffer], { type: mimeType });
  }
}
