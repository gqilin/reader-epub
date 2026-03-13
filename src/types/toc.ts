export interface TocItem {
  id: string;
  label: string;
  href: string;
  spineIndex: number;
  children: TocItem[];
  playOrder?: number;
}

export type TocSource = 'ncx' | 'nav';
