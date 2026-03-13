/**
 * Abstract interface for reading EPUB archive content.
 * Implemented by EpubArchive (zip-based) and RemoteArchive (HTTP-based).
 */
export interface IEpubArchive {
  readText(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;
  readBlob(path: string, mimeType: string): Promise<Blob>;
}
