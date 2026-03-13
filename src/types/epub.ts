export interface EpubMetadata {
  title: string;
  creators: Author[];
  language: string;
  identifier: string;
  publisher?: string;
  publishDate?: string;
  modifiedDate?: string;
  description?: string;
  rights?: string;
  coverImageId?: string;
  subjects: string[];
  meta: Record<string, string>;
}

export interface Author {
  name: string;
  fileAs?: string;
  role?: string;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
  fallback?: string;
}

export interface SpineItem {
  idref: string;
  linear: boolean;
  properties?: string[];
  index: number;
}

export interface GuideReference {
  type: string;
  title: string;
  href: string;
}

export interface EpubBook {
  metadata: EpubMetadata;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  toc: import('./toc').TocItem[];
  guide: GuideReference[];
}
