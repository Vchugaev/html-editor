"use client";

import JSZip from "jszip";
import { ProcessedZipResult } from "../types/editor";

export async function processZipForPreview(file: File): Promise<ProcessedZipResult> {
  const zip = new JSZip();
  const data = await zip.loadAsync(file);

  const fileMap = new Map<string, string>();
  for (const [path, entry] of Object.entries(data.files)) {
    if (!entry.dir) {
      const content = await entry.async("blob");
      fileMap.set(path, URL.createObjectURL(content));
    }
  }

  const indexPath = Object.keys(data.files).find((p) => p.endsWith("index.html"));
  if (!indexPath) {
    throw new Error("index.html not found in the uploaded archive");
  }

  // Helpers to normalize and resolve CSS url() paths
  const normalizePath = (path: string): string => {
    const parts: string[] = [];
    for (const segment of path.split('/')) {
      if (segment === '' || segment === '.') continue;
      if (segment === '..') {
        parts.pop();
      } else {
        parts.push(segment);
      }
    }
    return parts.join('/');
  };
  const resolveRelative = (basePath: string, urlPath: string): string => {
    if (/^https?:\/\//i.test(urlPath) || urlPath.startsWith('data:')) return urlPath;
    if (urlPath.startsWith('/')) {
      // site-root absolute: drop leading slash and try map
      return urlPath.slice(1);
    }
    const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '';
    return normalizePath(`${baseDir}/${urlPath}`);
  };

  const rewriteCss = (cssText: string, cssPath: string): string => {
    // url(...) replacer
    cssText = cssText.replace(/url\(([^)]+)\)/g, (match, rawInner) => {
      let inner = String(rawInner).trim();
      if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith('\'') && inner.endsWith('\''))) {
        inner = inner.slice(1, -1);
      }
      const resolved = resolveRelative(cssPath, inner);
      const tryKeys = [resolved, resolved.replace(/^\//, ''), inner.replace(/^\//, '')];
      for (const key of tryKeys) {
        const blob = fileMap.get(key);
        if (blob) {
          return `url(${blob})`;
        }
      }
      return match;
    });
    // @import url(...) and @import "..."
    cssText = cssText.replace(/@import\s+(?:url\()?(["']?)([^"')]+)\1\)?/g, (match, _q, rawPath) => {
      const resolved = resolveRelative(cssPath, rawPath);
      const tryKeys = [resolved, resolved.replace(/^\//, ''), rawPath.replace(/^\//, '')];
      for (const key of tryKeys) {
        const blob = fileMap.get(key);
        if (blob) {
          return `@import url(${blob})`;
        }
      }
      return match;
    });
    return cssText;
  };

  // Rewrite asset paths inside CSS files to blob URLs for preview (with proper relative resolution)
  const cssPaths = Object.keys(data.files).filter((p) => p.endsWith('.css'));
  for (const cssPath of cssPaths) {
    const entry = data.files[cssPath];
    if (!entry || entry.dir) continue;
    try {
      let cssText = await entry.async('string');
      cssText = rewriteCss(cssText, cssPath);
      const cssBlob = new Blob([cssText], { type: 'text/css' });
      const cssBlobUrl = URL.createObjectURL(cssBlob);
      fileMap.set(cssPath, cssBlobUrl);
    } catch {
      // ignore broken css entry
    }
  }

  let htmlForPreview = await data.files[indexPath].async("string");
  for (const [path, blobUrl] of fileMap.entries()) {
    htmlForPreview = htmlForPreview.replaceAll(path, blobUrl);
  }

  return { zip, fileMap, indexPath, htmlForPreview };
}

export async function generateZipBlob(zip: JSZip): Promise<Blob> {
  return await zip.generateAsync({ type: "blob" });
}

