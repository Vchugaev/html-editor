'use client';

import JSZip from 'jszip';
import { ProcessedZipResult } from '../types/editor';

export async function processZipForPreview(
  file: File,
): Promise<ProcessedZipResult> {
  const zip = new JSZip();
  const data = await zip.loadAsync(file);

  const fileMap = new Map<string, string>();
  for (const [path, entry] of Object.entries(data.files)) {
    if (!entry.dir) {
      const content = await entry.async('blob');
      fileMap.set(path, URL.createObjectURL(content));
    }
  }

  // Находим index.html и определяем корневую папку сайта
  const indexPath = Object.keys(data.files).find((p) =>
    p.endsWith('index.html'),
  );
  if (!indexPath) {
    throw new Error('index.html not found in the uploaded archive');
  }

  // Определяем корневую папку сайта (где находится index.html)
  const siteRoot = indexPath.includes('/')
    ? indexPath.substring(0, indexPath.lastIndexOf('/'))
    : '';

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
    if (/^https?:\/\//i.test(urlPath) || urlPath.startsWith('data:'))
      return urlPath;
    if (urlPath.startsWith('/')) {
      // site-root absolute: resolve relative to site root, then to archive root
      const siteRelativePath = urlPath.slice(1);
      const archivePath = siteRoot
        ? `${siteRoot}/${siteRelativePath}`
        : siteRelativePath;
      return archivePath;
    }
    const baseDir = basePath.includes('/')
      ? basePath.slice(0, basePath.lastIndexOf('/'))
      : '';
    return normalizePath(`${baseDir}/${urlPath}`);
  };

  const rewriteCss = (cssText: string, cssPath: string): string => {
    // url(...) replacer
    cssText = cssText.replace(/url\(([^)]+)\)/g, (match, rawInner) => {
      let inner = String(rawInner).trim();
      if (
        (inner.startsWith('"') && inner.endsWith('"')) ||
        (inner.startsWith("'") && inner.endsWith("'"))
      ) {
        inner = inner.slice(1, -1);
      }
      const resolved = resolveRelative(cssPath, inner);
      const tryKeys = [
        resolved,
        resolved.replace(/^\//, ''),
        inner.replace(/^\//, ''),
      ];
      for (const key of tryKeys) {
        const blob = fileMap.get(key);
        if (blob) {
          return `url(${blob})`;
        }
      }
      return match;
    });
    // @import url(...) and @import "..."
    cssText = cssText.replace(
      /@import\s+(?:url\()?(["']?)([^"')]+)\1\)?/g,
      (match, _q, rawPath) => {
        const resolved = resolveRelative(cssPath, rawPath);
        const tryKeys = [
          resolved,
          resolved.replace(/^\//, ''),
          rawPath.replace(/^\//, ''),
        ];
        for (const key of tryKeys) {
          const blob = fileMap.get(key);
          if (blob) {
            return `@import url(${blob})`;
          }
        }
        return match;
      },
    );
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

  let htmlForPreview = await data.files[indexPath].async('string');

  // Функция для замены путей в HTML
  const replaceHtmlPaths = (html: string): string => {
    // Заменяем абсолютные пути относительно корня сайта (начинающиеся с /)
    html = html.replace(
      /(href|src|action)=["']\/([^"']+)["']/g,
      (match, attr, path) => {
        const fullPath = siteRoot ? `${siteRoot}/${path}` : path;
        const blobUrl = fileMap.get(fullPath);
        return blobUrl ? `${attr}="${blobUrl}"` : match;
      },
    );

    // Заменяем относительные пути (не начинающиеся с /, http, data:)
    html = html.replace(
      /(href|src|action)=["'](?!https?:\/\/|data:|#)([^"']+)["']/g,
      (match, attr, path) => {
        // Если это относительный путь, разрешаем его относительно корня сайта
        const fullPath = siteRoot ? `${siteRoot}/${path}` : path;
        const blobUrl = fileMap.get(fullPath);
        return blobUrl ? `${attr}="${blobUrl}"` : match;
      },
    );

    return html;
  };

  htmlForPreview = replaceHtmlPaths(htmlForPreview);

  // Затем заменяем все остальные пути (для совместимости)
  for (const [path, blobUrl] of fileMap.entries()) {
    htmlForPreview = htmlForPreview.replaceAll(path, blobUrl);
  }

  return { zip, fileMap, indexPath, htmlForPreview, siteRoot };
}

export async function generateZipBlob(zip: JSZip): Promise<Blob> {
  return await zip.generateAsync({ type: 'blob' });
}
