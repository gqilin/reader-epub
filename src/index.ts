// Core
export { EpubReader } from './core/epub-parser';
export { ResourceResolver } from './core/resource-resolver';

// Renderer
export { ContentRenderer, getChapterId } from './renderer/content-renderer';

// Annotations
export { AnnotationManager } from './annotations/annotation-manager';
export { AnnotationSerializer } from './annotations/annotation-serializer';
export type { ChapterSvgGroup } from './annotations/annotation-layer';

// CFI
export { parseCfi, spineIndexToCfiStep, cfiStepToSpineIndex } from './cfi/cfi-parser';
export { generateCfi, generateCfiRange } from './cfi/cfi-generator';
export { resolveCfi, cfiRangeToRange } from './cfi/cfi-resolver';

// Events
export { TypedEventEmitter } from './events/event-emitter';

// Types
export type {
  EpubBook,
  EpubMetadata,
  ManifestItem,
  SpineItem,
  GuideReference,
  Author,
} from './types/epub';
export type { TocItem, TocSource } from './types/toc';
export type {
  Annotation,
  AnnotationType,
  AnnotationBase,
  HighlightAnnotation,
  UnderlineAnnotation,
  UnderlineStyle,
  NoteAnnotation,
  DrawingAnnotation,
  DrawingPath,
  TextAnchor,
  HighlightColor,
  AnnotationStore,
} from './types/annotation';
export type {
  RendererOptions,
  PaginationInfo,
  ViewportRect,
  ReaderTheme,
} from './types/renderer';
export type {
  EpubReaderEvents,
  RendererEvents,
  AnnotationEvents,
} from './events/event-types';
export type { Disposable } from './types/common';
