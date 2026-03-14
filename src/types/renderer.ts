export interface ReaderTheme {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  backgroundColor?: string;
  lineHeight?: number | string;
  paragraphSpacing?: number;
  letterSpacing?: number | string;
  textAlign?: 'left' | 'right' | 'center' | 'justify';
  padding?: number | { top: number; right: number; bottom: number; left: number };
  linkColor?: string;
  imageOpacity?: number;
}

export interface RendererOptions {
  container: HTMLElement;
  mode: 'paginated' | 'scrolled';
  /** Show two columns side-by-side per page (only effective when mode is 'paginated'). */
  spread?: boolean;
  columnGap?: number;
  theme?: ReaderTheme;
  customStyles?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  spineIndex: number;
  chapterProgress: number;
  bookProgress: number;
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
