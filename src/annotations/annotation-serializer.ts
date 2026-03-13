import type { AnnotationStore, Annotation } from '../types/annotation';

export class AnnotationSerializer {
  static serialize(
    bookIdentifier: string,
    annotations: Annotation[]
  ): AnnotationStore {
    return {
      version: 1,
      bookIdentifier,
      exportedAt: new Date().toISOString(),
      annotations: structuredClone(annotations),
    };
  }

  static deserialize(json: string): AnnotationStore {
    const store = JSON.parse(json) as AnnotationStore;
    this.validate(store);
    return store;
  }

  static toJSON(bookIdentifier: string, annotations: Annotation[]): string {
    return JSON.stringify(this.serialize(bookIdentifier, annotations), null, 2);
  }

  static fromJSON(json: string): AnnotationStore {
    return this.deserialize(json);
  }

  private static validate(store: AnnotationStore): void {
    if (!store || typeof store !== 'object') {
      throw new Error('Invalid annotation store: not an object');
    }
    if (store.version !== 1) {
      throw new Error(`Unsupported annotation store version: ${store.version}`);
    }
    if (!Array.isArray(store.annotations)) {
      throw new Error('Invalid annotation store: annotations is not an array');
    }
    for (const annotation of store.annotations) {
      if (!annotation.id || !annotation.type) {
        throw new Error('Invalid annotation: missing id or type');
      }
      const validTypes = ['highlight', 'underline', 'note', 'drawing'];
      if (!validTypes.includes(annotation.type)) {
        throw new Error(`Invalid annotation type: ${annotation.type}`);
      }
    }
  }
}
