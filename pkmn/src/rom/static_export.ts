// Write ROM-extracted graphics to static/ as real files, so the browser can load
// them with plain fetch() / <img> and never needs the ROM (Vite publicDir).
// Node-only: used by scripts/extract_dev_data.ts and tests, never by the browser.

import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { PNG } from 'pngjs';
import type { ExtractedData } from './data_provider';

// Extracted asset keys are URL paths under gfx/ ('/gfx/font/font.png',
// 'gfx/title/pikachu.tilemap'). Anything else must not be written to disk.
const GFX_KEY = /^\/?gfx\/[A-Za-z0-9_\-./]+\.(png|tilemap)$/;

/** static/-relative path for an extracted asset key. Throws on unexpected keys. */
export function staticPathFor(key: string): string {
  if (!GFX_KEY.test(key) || key.includes('..')) {
    throw new Error(`Refusing to export unexpected asset key: ${key}`);
  }
  return key.replace(/^\//, '');
}

/**
 * Encode grayscale ImageData as a lossless 8-bit PNG — grayscale (colorType 0)
 * when fully opaque, grayscale+alpha (colorType 4) otherwise. Same format family
 * as pret's gfx/*.png; decodes back to the exact same RGBA bytes.
 */
export function encodePng(img: ImageData): Buffer {
  const d = img.data;
  let opaque = true;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) {
      throw new Error(`encodePng: non-gray pixel at byte ${i}`);
    }
    if (d[i + 3] !== 255) opaque = false;
  }
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(d.buffer, d.byteOffset, d.byteLength);
  return PNG.sync.write(png, { colorType: opaque ? 0 : 4, inputColorType: 6, bitDepth: 8 });
}

/** All *.json files under dir, as dir-relative paths with forward slashes. */
function listJson(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

export interface StaticExportCounts {
  images: number;
  binaries: number;
  json: number;
}

/**
 * Rebuild static/ from scratch: every extracted image as PNG, every binary
 * verbatim, and a mirror of data/'s JSON (DECISIONS #16). static/ is 100%
 * generated — it is deleted first so stale files never linger.
 */
export function writeStatic(extracted: ExtractedData, dataDir: string, staticDir: string): StaticExportCounts {
  if (basename(staticDir) !== 'static') {
    throw new Error(`writeStatic: refusing to wipe ${staticDir} (expected a dir named "static")`);
  }
  rmSync(staticDir, { recursive: true, force: true });

  const write = (rel: string, bytes: Uint8Array) => {
    const full = join(staticDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  };

  const imageKeys = Object.keys(extracted.imageData).sort();
  for (const key of imageKeys) {
    write(staticPathFor(key), encodePng(extracted.imageData[key]));
  }

  const binaryKeys = Object.keys(extracted.binaryData).sort();
  for (const key of binaryKeys) {
    write(staticPathFor(key), extracted.binaryData[key]);
  }

  const jsonFiles = listJson(dataDir);
  for (const rel of jsonFiles) {
    const dest = join(staticDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(dataDir, rel), dest);
  }

  return { images: imageKeys.length, binaries: binaryKeys.length, json: jsonFiles.length };
}
