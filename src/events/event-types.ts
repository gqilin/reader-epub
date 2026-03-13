import type { PaginationInfo } from '../types/renderer';
import type { Annotation, DrawingAnnotation } from '../types/annotation';

export interface EpubReaderEvents {
  'book:ready': { metadata: import('../types/epub').EpubMetadata };
  'book:error': { error: Error };
}

export interface SelectionToolbarPosition {
  /** Viewport-relative X (horizontal center of selection) */
  x: number;
  /** Viewport-relative Y (top edge of selection) */
  y: number;
  /** Full bounding rect of the selection in viewport coords */
  selectionRect: { top: number; left: number; right: number; bottom: number };
}

export interface RendererEvents {
  'renderer:ready': undefined;
  'renderer:displayed': { spineIndex: number };
  'renderer:paginated': PaginationInfo;
  'renderer:resized': { width: number; height: number };
  'renderer:selection': {
    text: string;
    range: Range;
    cfiRange: { start: string; end: string };
  };
  'renderer:selection-toolbar': {
    visible: boolean;
    position: SelectionToolbarPosition | null;
    text: string;
    cfiRange: { start: string; end: string };
  };
  'renderer:click': { event: MouseEvent };
  'renderer:link-click': {
    href: string;
    isExternal: boolean;
    event: MouseEvent;
  };
  'renderer:error': { error: Error };
}

export interface AnnotationEvents {
  'annotation:created': { annotation: Annotation };
  'annotation:updated': { annotation: Annotation };
  'annotation:removed': { id: string };
  'annotation:selected': { annotation: Annotation; event: MouseEvent };
  'annotation:hover': { annotation: Annotation | null; event: MouseEvent };
  'annotation:drawing:start': undefined;
  'annotation:drawing:end': { annotation: DrawingAnnotation };
  'annotations:imported': { count: number };
  'annotations:cleared': undefined;
}
