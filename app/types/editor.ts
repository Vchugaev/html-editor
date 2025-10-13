import type JSZip from 'jszip';
export interface AttributeItem {
  name: string;
  value: string;
  blobUrl?: string;
}

export interface ProcessedZipResult {
  zip: JSZip;
  fileMap: Map<string, string>;
  indexPath: string;
  htmlForPreview: string;
  siteRoot: string;
}

export interface VariableItem {
  name: string;
  value: string;
  scriptTag: string;
  isProtected: boolean;
}

export interface Language {
  code: string;
  name: string;
  native: string;
}

export interface TranslationState {
  isTranslating: boolean;
  selectedLanguage: string;
  availableLanguages: Language[];
}
