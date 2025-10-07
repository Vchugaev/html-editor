import type JSZip from "jszip";
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
}

