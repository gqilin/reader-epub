export type AnnotationType = 'highlight' | 'underline' | 'note' | 'drawing';

export interface AnnotationBase {
  id: string;
  type: AnnotationType;
  createdAt: string;
  updatedAt: string;
  spineIndex: number;
  userData?: Record<string, unknown>;
}

export interface TextAnchor {
  startCfi: string;
  endCfi: string;
  textContent: string;
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  anchor: TextAnchor;
  color: HighlightColor;
  opacity: number;
}

export interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  anchor: TextAnchor;
  color: string;
  strokeWidth: number;
  style: 'solid' | 'dashed' | 'wavy';
}

export interface NoteAnnotation extends AnnotationBase {
  type: 'note';
  anchor: TextAnchor;
  content: string;
  color: string;
}

export interface DrawingAnnotation extends AnnotationBase {
  type: 'drawing';
  paths: DrawingPath[];
  viewportWidth: number;
  viewportHeight: number;
}

export interface DrawingPath {
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export type Annotation =
  | HighlightAnnotation
  | UnderlineAnnotation
  | NoteAnnotation
  | DrawingAnnotation;

export type HighlightColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'orange'
  | { custom: string };

export interface AnnotationStore {
  version: 1;
  bookIdentifier: string;
  exportedAt: string;
  annotations: Annotation[];
}
