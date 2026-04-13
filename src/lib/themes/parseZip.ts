// ============================================================
// PAWEN — Shopify Theme ZIP Parser
// Extracts .liquid, .json, .css, .js files from a Shopify theme ZIP.
// Uses fflate (8kb) for client-side decompression.
// ============================================================

import { unzipSync } from 'fflate';
import { ThemeFile, categorizeFile } from './types';

// File extensions we care about for editing
const EDITABLE_EXTENSIONS = new Set([
  '.liquid', '.json', '.css', '.scss', '.js', '.svg',
]);

// Max file size to include (skip large binary assets)
const MAX_FILE_SIZE = 512_000; // 512KB

export function parseThemeZip(zipBuffer: ArrayBuffer): ThemeFile[] {
  const uint8 = new Uint8Array(zipBuffer);
  const unzipped = unzipSync(uint8);

  const files: ThemeFile[] = [];
  const decoder = new TextDecoder('utf-8');

  for (const [rawPath, data] of Object.entries(unzipped)) {
    // Skip directories (empty entries)
    if (data.length === 0) continue;

    // Normalize path: strip leading theme folder name if present
    // Shopify exports as "theme-name/sections/..." — we want "sections/..."
    let path = rawPath.replace(/\\/g, '/');

    // Strip first directory if it's not a known Shopify folder
    const firstDir = path.split('/')[0];
    const knownDirs = ['layout', 'templates', 'sections', 'snippets', 'assets', 'config', 'locales'];
    if (!knownDirs.includes(firstDir) && path.includes('/')) {
      path = path.substring(path.indexOf('/') + 1);
    }

    // Skip binary assets, non-editable files, and oversized files
    const ext = '.' + path.split('.').pop()?.toLowerCase();
    if (!EDITABLE_EXTENSIONS.has(ext)) continue;
    if (data.length > MAX_FILE_SIZE) continue;

    const content = decoder.decode(data);

    files.push({
      path,
      content,
      type: categorizeFile(path),
      size: data.length,
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
