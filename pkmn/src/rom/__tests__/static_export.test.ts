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
  // A5c3d checkpoint-03 adds three unused battle SFX JSON and their mirrors.
  // A5c3f checkpoint-02: four more SFX plus stat_mod_text, which extractRom now emits. 190 → 195.
  // A5e checkpoint-05: battle_animations.json and audio/sfx/ball_poof.json. 196 → 198.
  // A5f checkpoint-01: audio/sfx/ball_toss.json and audio/sfx/tink.json. 198 → 200.
  // V3 checkpoint-01: maps/Museum1F.json, maps/Museum2F.json and maps/PewterGym.json. 200 → 203.
  // V5c checkpoint-01: toggleable_objects.json. 206 → 207.
  // V5g1 checkpoint-01: audio/sfx/turn_on_pc_3.json, enter_pc_3.json and save_3.json (Audio 3). 207 → 210.
  // V5g3 checkpoint-02: audio/sfx/ledge.json. 210 → 211.
  // Opening checkpoint-01: audio/sfx/intro_crash.json, intro_whoosh.json and shooting_star.json (Audio 3). 211 → 214.
  // Cries checkpoint-01: cries.json and audio/sfx/cry00.json … cry25.json. 219 → 258.
  it('includes the movie tables, the cries and prior data in the JSON mirror (262 JSON total)', () => {
    // Opening checkpoint-03: audio/pikachu_cries/pikachu_cry_{1,4,11,37}.json. 214 → 218.
    expect(Object.keys(extracted.jsonData)).toHaveLength(262);
    expect(extracted.jsonData).toHaveProperty('cries.json');
    for (let base = 0; base < 38; base++) {
      expect(extracted.jsonData).toHaveProperty(`audio/sfx/cry${base.toString(16).padStart(2, '0')}.json`);
    }
    expect(extracted.jsonData).toHaveProperty('yellow_intro.json');
    for (const number of [1, 4, 11, 17, 28, 35, 37, 40]) expect(extracted.jsonData).toHaveProperty(`audio/pikachu_cries/pikachu_cry_${number}.json`);
    for (const name of ['intro_crash', 'intro_whoosh', 'shooting_star']) expect(extracted.jsonData).toHaveProperty(`audio/sfx/${name}.json`);
    expect(extracted.jsonData).toHaveProperty('audio/sfx/ledge.json');
    for (const name of ['turn_on_pc_3', 'enter_pc_3', 'save_3']) expect(extracted.jsonData).toHaveProperty(`audio/sfx/${name}.json`);
    expect(extracted.jsonData).toHaveProperty('toggleable_objects.json');
    for (const name of ['Museum1F', 'Museum2F', 'PewterGym', 'DiglettsCave', 'DiglettsCaveRoute11']) expect(extracted.jsonData).toHaveProperty(`maps/${name}.json`);
    expect(extracted.jsonData).toHaveProperty('battle_transitions.json');
    expect(extracted.jsonData).toHaveProperty('battle_animations.json');
    expect(extracted.jsonData).toHaveProperty('stat_mod_text.json');
    expect(extracted.jsonData).toHaveProperty('audio/sfx/healing_machine.json');
    expect(extracted.jsonData).toHaveProperty('audio/sfx/shrink.json');
    expect(extracted.jsonData).toHaveProperty('audio/sfx/run.json');
    for (const name of ['level_up', 'faint_fall', 'faint_thud', 'damage', 'not_very_effective', 'super_effective', 'trainer_appeared', 'ball_poof'])
      expect(extracted.jsonData).toHaveProperty(`audio/sfx/${name}.json`);
    for (const name of ['PewterCity', 'PewterPokecenter', 'PewterMart', 'PewterNidoranHouse', 'PewterSpeechHouse'])
      expect(extracted.jsonData).toHaveProperty(`maps/${name}.json`);
    expect(extracted.jsonData).toHaveProperty('maps/Route3.json');
  });

  it('extracts 536 images and the 6 title/movie tilemaps, all under gfx/', () => {
    // Exact counts are a regression guard — update them deliberately when an
    // extractor starts producing more (or fewer) graphics.
    // (518 → 519 in V1a: oldmanb.png; → 520 in A6d: overworld/shadow.png.)
    // StatusScreen CP2 adds font/P.png → 521.
    // V2c CP2 adds pikachu/unknown_e7b83.png, unknown_e7d13.png, emotes/zzz.png → 524.
    // A5c3f checkpoint-02 adds battle/ghost.png → 525.
    // V3 checkpoint-02c adds the two fossil pictures → 527.
    const imageKeys = Object.keys(extracted.imageData);
    const binaryKeys = Object.keys(extracted.binaryData).sort();
    // Opening checkpoint-02 adds splash/copyright.png, gamefreak_presents.png, gamefreak_logo.png,
    // falling_star.png, title/nine.png and battle/move_anim_1.png → 533.
    expect(imageKeys.length).toBe(536);
    for (const name of ['yellow_intro_1', 'yellow_intro_2', 'clouds']) expect(imageKeys).toContain(`/gfx/intro/${name}.png`);
    for (const key of ['splash/copyright', 'splash/gamefreak_presents', 'splash/gamefreak_logo', 'splash/falling_star',
      'title/nine', 'battle/move_anim_1']) expect(imageKeys).toContain(`/gfx/${key}.png`);
    expect(imageKeys).toContain('/gfx/sprites/front/fossilkabutops.png');
    expect(imageKeys).toContain('/gfx/sprites/front/fossilaerodactyl.png');
    expect(imageKeys).toContain('/gfx/battle/ghost.png');
    expect(imageKeys).toContain('/gfx/font/P.png');
    expect(binaryKeys).toEqual([
      'gfx/intro/cloud_pair.tilemap',
      'gfx/intro/clouds.tilemap',
      'gfx/intro/small_cloud.tilemap',
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
  it('round-trips shrink through extractRom, setup data and the static mirror byte for byte', () => {
    const shrink = extracted.jsonData['audio/sfx/shrink.json'];
    expect(shrink).toBeDefined();
    const bytes = readFileSync(resolve(DATA_DIR, 'audio/sfx/shrink.json'));
    expect(bytes.toString('utf8')).toBe(JSON.stringify(shrink, null, 2) + '\n');
    expect(readFileSync(resolve(STATIC_DIR, 'audio/sfx/shrink.json'))).toEqual(bytes);
  });

  it('registers move_names.json in extractRom, data/ and the static mirror', () => {
    const extractedNames = extracted.jsonData['move_names.json'];
    expect(extractedNames).toBeDefined();
    const bytes = readFileSync(resolve(DATA_DIR, 'move_names.json'));
    expect(bytes.toString('utf8')).toBe(JSON.stringify(extractedNames, null, 2) + '\n');
    expect(readFileSync(resolve(STATIC_DIR, 'move_names.json'))).toEqual(bytes);
  });

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
    // It re-encodes ~521 PNGs and reads ~850 files: under 1 s warm, but a cold file cache
    // on the first run of a session went past vitest's default 5 s (2026-09-28, 2026-10-06).
  });
});
