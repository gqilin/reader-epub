import JSZip from 'jszip';

export class EpubArchive {
  private zip: JSZip;

  private constructor(zip: JSZip) {
    this.zip = zip;
  }

  static async open(buffer: ArrayBuffer): Promise<EpubArchive> {
    const zip = await JSZip.loadAsync(buffer);
    return new EpubArchive(zip);
  }

  async readText(path: string): Promise<string> {
    const file = this.zip.file(path);
    if (!file) {
      throw new Error(`File not found in EPUB: ${path}`);
    }
    return file.async('text');
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const file = this.zip.file(path);
    if (!file) {
      throw new Error(`File not found in EPUB: ${path}`);
    }
    return file.async('arraybuffer');
  }

  async readBlob(path: string, mimeType: string): Promise<Blob> {
    const buffer = await this.readBinary(path);
    return new Blob([buffer], { type: mimeType });
  }

  hasFile(path: string): boolean {
    return this.zip.file(path) !== null;
  }

  listFiles(): string[] {
    const files: string[] = [];
    this.zip.forEach((relativePath, _file) => {
      if (!_file.dir) {
        files.push(relativePath);
      }
    });
    return files;
  }
}
