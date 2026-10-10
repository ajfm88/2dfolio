// static/ export tests — the files the browser loads instead of the ROM.
// Requires ROM_PATH, like the extraction suite; skipped otherwise.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PNG } from 'pngjs';
import { describe as _describe, it, expect, beforeAll } from 'vitest';
import { installNodeImageData } from '../node_image_data';
import { extractRom } from '../index';
import { encodePng, staticPathFor } from '../static_export';
import type { ExtractedData } from '../data_provider';

const ROM_PATH = process.env.ROM_PATH;
const DATA_DIR = resolve(__dirname, '../../../data');
const STATIC_DIR = resolve(__dirname, '../../../static');

const describe = _describe.skipIf(!ROM_PATH);

let extracted: ExtractedData;

beforeAll(async () => {
  if (!ROM_PATH) return;
  installNodeImageData();
  const buffer = readFileSync(ROM_PATH);
  extracted = await extractRom(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
});

describe('static/ export: asset keys', () => {
  it('extracts 520 images and the 3 title tilemaps, all under gfx/', () => {
    // Exact counts are a regression guard — update them deliberately when an
    // extractor starts producing more (or fewer) graphics.
    // (518 → 519 in V1a: oldmanb.png; → 520 in A6d: overworld/shadow.png.)
    const imageKeys = Object.keys(extracted.imageData);
    const binaryKeys = Object.keys(extracted.binaryData).sort();
    expect(imageKeys.length).toBe(520);
    expect(binaryKeys).toEqual([
      'gfx/title/pika_bubble.tilemap',
      'gfx/title/pikachu.tilemap',
      'gfx/title/pokemon_logo.tilemap',
    ]);
    for (const key of [...imageKeys, ...binaryKeys]) {
      expect(() => staticPathFor(key)).not.toThrow();
    }
  });

  it('rejects keys that would escape gfx/', () => {
    expect(() => staticPathFor('/gfx/../../evil.png')).toThrow();
    expect(() => staticPathFor('/data/pokemon.json')).toThrow();
    expect(() => staticPathFor('gfx/font/font.exe')).toThrow();
  });
});

describe('static/ export: PNG encoding', () => {
  it('uses only the four Game Boy grays', () => {
    const values = new Set<number>();
    for (const img of Object.values(extracted.imageData)) {
      for (let i = 0; i < img.data.length; i += 4) values.add(img.data[i]);
    }
    expect([...values].sort((a, b) => a - b)).toEqual([0, 85, 170, 255]);
  });

  it('round-trips every image through PNG losslessly (all 4 channels)', () => {
    const mismatches: string[] = [];
    for (const [key, img] of Object.entries(extracted.imageData)) {
      const decoded = PNG.sync.read(encodePng(img));
      const original = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
      if (decoded.width !== img.width || decoded.height !== img.height || !decoded.data.equals(original)) {
        mismatches.push(key);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('static/ export: JSON', () => {
  it('registers map_sprite_sets.json in extractRom, data/ and the static mirror', () => {
    expect(extracted.jsonData).toHaveProperty('map_sprite_sets.json');
    const dataPath = resolve(DATA_DIR, 'map_sprite_sets.json');
    const staticPath = resolve(STATIC_DIR, 'map_sprite_sets.json');
    expect(existsSync(dataPath)).toBe(true);
    expect(existsSync(staticPath)).toBe(true);
    const dataBytes = readFileSync(dataPath);
    expect(readFileSync(staticPath).equals(dataBytes)).toBe(true);
    const rendered = JSON.stringify(extracted.jsonData['map_sprite_sets.json'], null, 2) + '\n';
    expect(dataBytes.toString('utf8')).toBe(rendered);
  });

  it('extractRom() JSON is byte-identical to data/ (what static/ mirrors)', () => {
    // The browser used to get extractRom()'s JSON; after R1b it gets the data/
    // mirror. They must be the same bytes.
    const differ: string[] = [];
    for (const [key, value] of Object.entries(extracted.jsonData)) {
      const path = resolve(DATA_DIR, key);
      const expected = JSON.stringify(value, null, 2) + '\n';
      if (!existsSync(path) || readFileSync(path, 'utf-8') !== expected) differ.push(key);
    }
    expect(differ).toEqual([]);
  });
});

describe('static/ export: files on disk', () => {
  it.skipIf(!existsSync(STATIC_DIR))('static/ is up to date with the extractors', () => {
    // Fails when an extractor changed but `npm run setup` wasn't re-run.
    const stale: string[] = [];
    for (const [key, img] of Object.entries(extracted.imageData)) {
      const path = resolve(STATIC_DIR, staticPathFor(key));
      if (!existsSync(path) || !readFileSync(path).equals(encodePng(img))) stale.push(key);
    }
    for (const [key, bytes] of Object.entries(extracted.binaryData)) {
      const path = resolve(STATIC_DIR, staticPathFor(key));
      if (!existsSync(path) || !readFileSync(path).equals(Buffer.from(bytes))) stale.push(key);
    }
    for (const key of Object.keys(extracted.jsonData)) {
      const path = resolve(STATIC_DIR, key);
      if (!existsSync(path) || !readFileSync(path).equals(readFileSync(resolve(DATA_DIR, key)))) stale.push(key);
    }
    expect(stale).toEqual([]);
    // It re-encodes ~520 PNGs and reads ~850 files: under 1 s warm, but a cold file cache
    // on the first run of a session went past vitest's default 5 s (2026-09-28, 2026-10-06).
  }, 30_000);
});
