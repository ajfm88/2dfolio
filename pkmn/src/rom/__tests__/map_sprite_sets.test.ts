// A5b2: map sprite sets (rom/extractors/map_sprite_sets.ts) against pret's source.
// Expected tables are parsed from the ASM. The selection and allocation helpers
// below are test references for A5b4; the game does not call them.
import { describe as _describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { BinaryReader } from '../binary_reader';
import { extractMapSpriteSets, invertSpriteNames } from '../extractors/map_sprite_sets';
import type { LinearSpriteSplit, MapSpriteSetsFile } from '../extractors/map_sprite_sets';

const ROM_PATH = process.env.ROM_PATH;
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const DATA_PATH = resolve(__dirname, '../../../data/map_sprite_sets.json');
const STATIC_PATH = resolve(__dirname, '../../../static/map_sprite_sets.json');
const MAPS_DIR = resolve(__dirname, '../../../data/maps');
const STORY_DIR = resolve(__dirname, '../../story');

const describeRom = _describe.skipIf(!ROM_PATH);

const CURRENT_MAPS = [
  'PalletTown', 'ViridianCity', 'Route1', 'Route22', 'RedsHouse1F', 'RedsHouse2F',
  'BluesHouse', 'OaksLab', 'ViridianPokecenter', 'ViridianMart', 'ViridianSchoolHouse',
  'ViridianNicknameHouse', 'Route2', 'DiglettsCaveRoute2', 'ViridianForestNorthGate',
  'Route2TradeHouse', 'Route2Gate', 'ViridianForestSouthGate', 'ViridianForest',
] as const;

/** Engine asset name → pret picture constant. Aliases without a canonical name are absent. */
const ENGINE_SPRITE_CONSTANTS: Record<string, string> = {
  red: 'SPRITE_RED', blue: 'SPRITE_BLUE', prof: 'SPRITE_OAK', youngster: 'SPRITE_YOUNGSTER',
  monster: 'SPRITE_MONSTER', cooltrainer_f: 'SPRITE_COOLTRAINER_F', cooltrainer_m: 'SPRITE_COOLTRAINER_M',
  little_girl: 'SPRITE_LITTLE_GIRL', bird: 'SPRITE_BIRD', middle_aged_man: 'SPRITE_MIDDLE_AGED_MAN',
  gambler: 'SPRITE_GAMBLER', super_nerd: 'SPRITE_SUPER_NERD', girl: 'SPRITE_GIRL', hiker: 'SPRITE_HIKER',
  beauty: 'SPRITE_BEAUTY', gentleman: 'SPRITE_GENTLEMAN', daisy: 'SPRITE_DAISY', biker: 'SPRITE_BIKER',
  sailor: 'SPRITE_SAILOR', cook: 'SPRITE_COOK', bike_shop_clerk: 'SPRITE_BIKE_SHOP_CLERK',
  mr_fuji: 'SPRITE_MR_FUJI', giovanni: 'SPRITE_GIOVANNI', rocket: 'SPRITE_ROCKET',
  channeler: 'SPRITE_CHANNELER', waiter: 'SPRITE_WAITER', silph_worker_f: 'SPRITE_SILPH_WORKER_F',
  middle_aged_woman: 'SPRITE_MIDDLE_AGED_WOMAN', brunette_girl: 'SPRITE_BRUNETTE_GIRL', lance: 'SPRITE_LANCE',
  scientist: 'SPRITE_SCIENTIST', rocker: 'SPRITE_ROCKER', swimmer: 'SPRITE_SWIMMER',
  safari_zone_worker: 'SPRITE_SAFARI_ZONE_WORKER', gym_guide: 'SPRITE_GYM_GUIDE', gramps: 'SPRITE_GRAMPS',
  clerk: 'SPRITE_CLERK', fishing_guru: 'SPRITE_FISHING_GURU', granny: 'SPRITE_GRANNY', nurse: 'SPRITE_NURSE',
  link_receptionist: 'SPRITE_LINK_RECEPTIONIST', silph_president: 'SPRITE_SILPH_PRESIDENT',
  silph_worker_m: 'SPRITE_SILPH_WORKER_M', warden: 'SPRITE_WARDEN', captain: 'SPRITE_CAPTAIN',
  fisher: 'SPRITE_FISHER', koga: 'SPRITE_KOGA', guard: 'SPRITE_GUARD', mom: 'SPRITE_MOM',
  balding_guy: 'SPRITE_BALDING_GUY', little_boy: 'SPRITE_LITTLE_BOY', gameboy_kid: 'SPRITE_GAMEBOY_KID',
  fairy: 'SPRITE_FAIRY', agatha: 'SPRITE_AGATHA', bruno: 'SPRITE_BRUNO', lorelei: 'SPRITE_LORELEI',
  seel: 'SPRITE_SEEL', pikachu: 'SPRITE_PIKACHU', officer_jenny: 'SPRITE_OFFICER_JENNY',
  sandshrew: 'SPRITE_SANDSHREW', oddish: 'SPRITE_ODDISH', bulbasaur: 'SPRITE_BULBASAUR',
  jigglypuff: 'SPRITE_JIGGLYPUFF', clefairy: 'SPRITE_CLEFAIRY', chansey: 'SPRITE_CHANSEY',
  jessie: 'SPRITE_JESSIE', james: 'SPRITE_JAMES', poke_ball: 'SPRITE_POKE_BALL', fossil: 'SPRITE_FOSSIL',
  boulder: 'SPRITE_BOULDER', paper: 'SPRITE_PAPER', pokedex: 'SPRITE_POKEDEX', clipboard: 'SPRITE_CLIPBOARD',
  snorlax: 'SPRITE_SNORLAX', gambler_asleep: 'SPRITE_GAMBLER_ASLEEP',
};

/** Every split row, including Route 20's unused $f8 line. */
const SPLIT_ROWS: Record<number, LinearSpriteSplit> = {
  0xf1: { axis: 'y', divider: 37, belowSetId: 2, atOrAboveSetId: 1 },
  0xf2: { axis: 'y', divider: 50, belowSetId: 2, atOrAboveSetId: 3 },
  0xf3: { axis: 'x', divider: 57, belowSetId: 4, atOrAboveSetId: 8 },
  0xf4: { axis: 'y', divider: 21, belowSetId: 3, atOrAboveSetId: 8 },
  0xf5: { axis: 'x', divider: 8, belowSetId: 10, atOrAboveSetId: 8 },
  0xf6: { axis: 'x', divider: 24, belowSetId: 9, atOrAboveSetId: 5 },
  0xf7: { axis: 'x', divider: 34, belowSetId: 9, atOrAboveSetId: 10 },
  0xf8: { axis: 'x', divider: 53, belowSetId: 1, atOrAboveSetId: 10 },
  0xf9: { axis: 'y', divider: 33, belowSetId: 2, atOrAboveSetId: 7 },
  0xfa: { axis: 'y', divider: 2, belowSetId: 7, atOrAboveSetId: 4 },
  0xfb: { axis: 'x', divider: 17, belowSetId: 5, atOrAboveSetId: 7 },
  0xfc: { axis: 'x', divider: 3, belowSetId: 7, atOrAboveSetId: 3 },
};

/** Map id whose selector is that split. $f8 is present and is not selected by this list. */
const SPLIT_MAPS: { mapId: number; split: number }[] = [
  { mapId: 0x0d, split: 0xf1 }, { mapId: 0x15, split: 0xf2 }, { mapId: 0x16, split: 0xf3 },
  { mapId: 0x17, split: 0xf4 }, { mapId: 0x1a, split: 0xf5 }, { mapId: 0x1b, split: 0xf6 },
  { mapId: 0x1d, split: 0xf7 }, { mapId: 0x10, split: 0xf9 }, { mapId: 0x11, split: 0xfa },
  { mapId: 0x12, split: 0xfb }, { mapId: 0x13, split: 0xfc },
];

/** Cartridge object pictures, duplicates and still objects included. Indoor maps only. */
const INDOOR_OBJECTS: Record<string, readonly string[]> = {
  RedsHouse1F: ['mom'],
  RedsHouse2F: [],
  BluesHouse: ['daisy', 'daisy', 'pokedex'],
  OaksLab: ['blue', 'poke_ball', 'prof', 'pokedex', 'pokedex', 'prof', 'girl', 'scientist', 'scientist'],
  ViridianPokecenter: ['nurse', 'gentleman', 'cooltrainer_m', 'link_receptionist', 'chansey'],
  ViridianMart: ['clerk', 'youngster', 'cooltrainer_m'],
  ViridianSchoolHouse: ['brunette_girl', 'cooltrainer_f', 'little_girl'],
  ViridianNicknameHouse: ['balding_guy', 'little_girl', 'bird', 'clipboard'],
  DiglettsCaveRoute2: ['fishing_guru'],
  ViridianForestNorthGate: ['super_nerd', 'gramps'],
  Route2TradeHouse: ['scientist', 'gameboy_kid'],
  Route2Gate: ['scientist', 'youngster'],
  ViridianForestSouthGate: ['girl', 'little_girl'],
  ViridianForest: [
    'youngster', 'youngster', 'youngster', 'youngster', 'cooltrainer_f', 'youngster',
    'poke_ball', 'poke_ball', 'poke_ball', 'youngster',
  ],
};

const EXPECTED_W: Record<(typeof CURRENT_MAPS)[number], number> = {
  PalletTown: 9, ViridianCity: 9, Route1: 9, Route22: 9, Route2: 9,
  OaksLab: 5, ViridianPokecenter: 6, ViridianMart: 4, ViridianSchoolHouse: 4,
  ViridianNicknameHouse: 4, ViridianForest: 3, ViridianForestNorthGate: 3,
  ViridianForestSouthGate: 3, Route2Gate: 3, Route2TradeHouse: 3,
  RedsHouse1F: 2, BluesHouse: 2, DiglettsCaveRoute2: 2, RedsHouse2F: 1,
};

function fileOff(bank: number, addr: number): number {
  return bank * 0x4000 + (addr & 0x3fff);
}

function copyFrames(tiles: number): number {
  return Math.floor(tiles / 8) + 1;
}

/** 1 window-hide frame + two frames per walking half + 4 player frames. */
function closeFrames(w: number): number {
  return 1 + 2 * w + 4;
}

function walkingCopies(slots: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < 9; i++) if (slots[i] !== 0) count++;
  return count;
}

function allocateSlots(
  pikachuId: number,
  kindOf: (id: number) => 'walking' | 'still',
  live: readonly number[],
): number[] {
  const slots = Array.from({ length: 11 }, () => 0);
  slots[0] = pikachuId;
  const scan = live.slice(0, 14);
  while (scan.length < 14) scan.push(0);
  for (const id of scan) {
    if (id === 0) continue;
    const still = kindOf(id) === 'still';
    const start = still ? 9 : 0;
    const region = still ? 2 : 9;
    for (let i = 0; i < region; i++) {
      const slot = start + i;
      if (slots[slot] === id || slots[slot] === 0) {
        slots[slot] = id;
        break;
      }
    }
  }
  return slots;
}

function selectOutdoor(file: MapSpriteSetsFile, mapId: number, x: number, y: number): number {
  if (mapId >= file.firstIndoorMapId) throw new Error(`map ${mapId} is indoor`);
  const selector = file.outdoorSetIds[mapId];
  if (selector < 0xf1) return selector;
  if (selector === file.route20.splitSetId) {
    const [west, middle, east] = file.route20.xCuts;
    const [lowBand, highBand] = file.route20.yCuts;
    if (x < west) return file.route20.westSetId;
    if (x >= east) return file.route20.eastSetId;
    const yCut = x < middle ? lowBand : highBand;
    return y < yCut ? file.route20.eastSetId : file.route20.westSetId;
  }
  const split = file.splitSets[selector];
  const coord = split.axis === 'x' ? x : y;
  return coord < split.divider ? split.belowSetId : split.atOrAboveSetId;
}

/** CamelCase engine map → pret constant. `2F` stays one token; `Route2TradeHouse` splits after the digit. */
function asmMapConst(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Za-z])(\d)/g, '$1_$2')
    .replace(/(\d)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

function requireRef(rel: string): string {
  const path = resolve(REFS, rel);
  if (!existsSync(path)) {
    throw new Error(`A5b2 ROM suite needs refs/pokeyellow/${rel}. Refusing to skip the source comparison.`);
  }
  return path;
}

function sourceLines(rel: string): string[] {
  return readFileSync(requireRef(rel), 'utf8')
    .split(/\r?\n/)
    .map(line => line.replace(/;.*$/, '').trim())
    .filter(line => line.length > 0);
}

function parseNumber(token: string): number {
  if (/^\$[0-9a-fA-F]+$/.test(token)) return parseInt(token.slice(1), 16);
  if (/^\d+$/.test(token)) return Number(token);
  throw new Error(`unsupported number ${token}`);
}

function evalEqu(expr: string, constValue: number, known: Record<string, number>): number {
  const replaced = expr.trim().replace(/const_value/g, String(constValue)).replace(/[A-Z_][A-Z0-9_]*/g, name => {
    if (!(name in known)) throw new Error(`unsupported EQU ${expr}`);
    return String(known[name]);
  });
  if (/^\$[0-9a-fA-F]+$/.test(replaced)) return parseNumber(replaced);
  const parts = replaced.replace(/\s+/g, '').match(/[+-]?\d+/g);
  if (!parts || parts.join('') !== replaced.replace(/\s+/g, '')) throw new Error(`unsupported EQU ${expr}`);
  return parts.reduce((sum, part) => sum + Number(part), 0);
}

function parseConsts(rel: string): Record<string, number> {
  const known: Record<string, number> = {};
  let value = 0;
  let inc = 1;
  let inDef = false;
  let macro = 0;
  for (const line of sourceLines(rel)) {
    if (/^MACRO\b/.test(line)) { macro++; continue; }
    if (/^ENDM\b/.test(line)) { macro--; continue; }
    if (macro > 0) continue;
    let match: RegExpExecArray | null;
    if ((match = /^const_def(?:\s+(\$?[0-9a-fA-F]+))?(?:\s*,\s*(\$?[0-9a-fA-F]+))?$/.exec(line))) {
      value = match[1] ? parseNumber(match[1]) : 0;
      inc = match[2] ? parseNumber(match[2]) : 1;
      inDef = true;
      continue;
    }
    if ((match = /^const_next\s+(\$?[0-9a-fA-F]+)$/.exec(line))) {
      value = parseNumber(match[1]);
      inDef = true;
      continue;
    }
    if ((match = /^(?:const|map_const)\s+([A-Z0-9_]+)\b/.exec(line))) {
      if (!inDef) throw new Error(`const outside const_def: ${line}`);
      known[match[1]] = value;
      value += inc;
      continue;
    }
    if ((match = /^DEF\s+([A-Z0-9_]+)\s+EQU\s+(.+)$/.exec(line))) {
      known[match[1]] = evalEqu(match[2], value, known);
      continue;
    }
    if (/^end_indoor_group\b/.test(line) || /^ASSERT\b/.test(line)) continue;
    throw new Error(`unsupported constant syntax: ${line}`);
  }
  return known;
}

function labelBody(lines: string[], label: string): string[] {
  const start = lines.findIndex(line => line === `${label}:`);
  if (start < 0) throw new Error(`missing label ${label}`);
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_][\w]*:$/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body;
}

function resolveToken(token: string, consts: Record<string, number>): number {
  if (token in consts) return consts[token];
  return parseNumber(token);
}

function dbRows(body: string[], width: number, consts: Record<string, number>): number[][] {
  const rows: number[][] = [];
  for (const line of body) {
    if (line.startsWith('table_width ') || line.startsWith('assert_table_length ')) continue;
    const match = /^db\s+(.+)$/.exec(line);
    if (!match) throw new Error(`unsupported sprite-set syntax: ${line}`);
    const args = match[1].split(',').map(part => resolveToken(part.trim(), consts));
    if (args.length !== width) throw new Error(`expected ${width} bytes in: ${line}`);
    rows.push(args);
  }
  return rows;
}

function readerOf(bytes: Uint8Array): BinaryReader {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new BinaryReader(buffer);
}

function loadCommitted(): MapSpriteSetsFile {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8')) as MapSpriteSetsFile;
}

function idsFor(file: MapSpriteSetsFile, names: readonly string[]): number[] {
  return names.map(name => {
    const id = file.pictureIdsBySprite[name];
    if (id === undefined) throw new Error(`missing sprite binding ${name}`);
    return id;
  });
}

function kindOf(file: MapSpriteSetsFile): (id: number) => 'walking' | 'still' {
  return id => {
    const meta = file.pictures[id];
    if (!meta) throw new Error(`malformed picture id ${id}`);
    return meta.kind;
  };
}

describe('A5b2 committed map sprite sets', () => {
  const file = loadCommitted();

  it('keeps the cartridge ids and the current map bridge', () => {
    expect(file.firstIndoorMapId).toBe(0x25);
    expect(file.firstStillPictureId).toBe(0x47);
    expect(file.pikachuPictureId).toBe(0x3d);
    expect(Object.keys(file.mapIds)).toEqual([...CURRENT_MAPS]);
    expect(file.mapIds.Route2).toBe(13);
    expect(file.mapIds.ViridianForest).toBe(51);
    expect(file.mapIds.RedsHouse2F).toBe(38);
    expect(file.pictureIdsBySprite.prof).toBe(3);
    expect(file.pictureIdsBySprite.pikachu).toBe(61);
    expect(file.pictureIdsBySprite.poke_ball).toBe(71);
    expect(file.pictureIdsBySprite.pokedex).toBe(75);
    expect(file.pictureIdsBySprite.gambler_asleep).toBe(82);
    expect(Object.values(file.pictureIdsBySprite)).not.toContain(0x50);
    expect(file.outdoorSetIds).toHaveLength(37);
    expect(file.outdoorSetIds).not.toContain(0xf0);
    expect(Object.keys(file.splitSets).map(Number).sort((a, b) => a - b)).toEqual(
      Object.keys(SPLIT_ROWS).map(Number).sort((a, b) => a - b),
    );
    expect(file.splitSets).toEqual(SPLIT_ROWS);
    expect(file.route20).toEqual({
      splitSetId: 0xf8, xCuts: [43, 55, 62], yCuts: [13, 8], westSetId: 1, eastSetId: 10,
    });
  });

  it('rejects a repeated engine sprite name', () => {
    expect(() => invertSpriteNames({ 1: 'red', 31: 'red' })).toThrow(/duplicate sprite name red/);
  });

  it('classifies every picture id, including aliases that share graphics', () => {
    expect(Object.keys(file.pictures)).toHaveLength(82);
    for (let id = 1; id <= 82; id++) {
      const meta = file.pictures[id];
      const still = id !== file.pikachuPictureId && id >= file.firstStillPictureId;
      expect(meta).toEqual({ kind: still ? 'still' : 'walking', tileCount: still ? 4 : 12 });
    }
    for (const id of [0x1f, 0x32, 0x36]) expect(file.pictures[id].kind).toBe('walking');
    for (const id of [0x4e, 0x4f, 0x50, 0x51, 0x52]) expect(file.pictures[id].kind).toBe('still');
    for (const slots of Object.values(file.spriteSets)) {
      expect(slots).toHaveLength(11);
      expect(slots[0]).toBe(file.pikachuPictureId);
      expect(slots.slice(0, 9).every(id => file.pictures[id].kind === 'walking')).toBe(true);
      expect(slots.slice(9).every(id => file.pictures[id].kind === 'still')).toBe(true);
    }
  });

  it('selects ordinary splits on the map-step coordinate, equality on the second set', () => {
    for (const { mapId, split } of SPLIT_MAPS) {
      const row = SPLIT_ROWS[split];
      expect(file.outdoorSetIds[mapId]).toBe(split);
      const below = row.axis === 'y' ? [0, row.divider - 1] : [row.divider - 1, 0];
      const edge = row.axis === 'y' ? [99, row.divider] : [row.divider, 99];
      expect(selectOutdoor(file, mapId, below[0], below[1])).toBe(row.belowSetId);
      expect(selectOutdoor(file, mapId, edge[0], edge[1])).toBe(row.atOrAboveSetId);
    }
    expect(selectOutdoor(file, 0x0d, 0, 36)).toBe(2);
    expect(selectOutdoor(file, 0x0d, 99, 36)).toBe(2);
    expect(selectOutdoor(file, 0x0d, 0, 37)).toBe(1);
    expect(selectOutdoor(file, 0x0d, 99, 37)).toBe(1);
    for (const mapId of [0x00, 0x01, 0x0c, 0x21]) {
      expect(file.outdoorSetIds[mapId]).toBe(1);
      expect(selectOutdoor(file, mapId, 0, 0)).toBe(1);
      expect(selectOutdoor(file, mapId, 99, 99)).toBe(1);
    }
  });

  it('uses Route 20\'s branch instead of the unused X = 53 row', () => {
    expect(file.outdoorSetIds[0x1f]).toBe(0xf8);
    const cases: [number, number, number][] = [
      [42, 0, 1], [43, 12, 10], [43, 13, 1], [54, 12, 10], [54, 13, 1],
      [55, 7, 10], [55, 8, 1], [61, 7, 10], [61, 8, 1], [62, 0, 10], [53, 20, 1],
    ];
    for (const [x, y, setId] of cases) expect(selectOutdoor(file, 0x1f, x, y)).toBe(setId);
    const unused = file.splitSets[0xf8];
    const linear = 53 < unused.divider ? unused.belowSetId : unused.atOrAboveSetId;
    expect(unused.divider).toBe(53);
    expect(linear).toBe(10);
    expect(selectOutdoor(file, 0x1f, 53, 20)).not.toBe(linear);
  });

  it('allocates eleven slots and drops pictures past the class capacity', () => {
    const pikachu = file.pikachuPictureId;
    const of = kindOf(file);
    const alloc = (ids: number[]) => allocateSlots(pikachu, of, ids);
    expect(alloc([])).toEqual([pikachu, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(alloc([0, 0x04, 0, 0x47])).toEqual([pikachu, 0x04, 0, 0, 0, 0, 0, 0, 0, 0x47, 0]);
    expect(alloc([0x04, 0x04, 0x47, 0x47])).toEqual([pikachu, 0x04, 0, 0, 0, 0, 0, 0, 0, 0x47, 0]);
    expect(alloc([pikachu, 0x04])).toEqual([pikachu, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(alloc([0x47, 0x48, 0x49])).toEqual([pikachu, 0, 0, 0, 0, 0, 0, 0, 0, 0x47, 0x48]);
    expect(alloc([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([pikachu, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0]);
    expect(alloc([0x01, 0x1f])).toEqual([pikachu, 0x01, 0x1f, 0, 0, 0, 0, 0, 0, 0, 0]);
    const before = alloc([0x04]);
    const after = alloc([0x04, 0x05]);
    expect(before).toEqual([pikachu, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(after).toEqual([pikachu, 0x04, 0x05, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(walkingCopies(before)).toBe(2);
    expect(walkingCopies(after)).toBe(3);
    expect(() => alloc([0x99])).toThrow(/malformed picture id 153/);
  });

  it('counts a copy as floor(tiles / 8) + 1 frames', () => {
    expect([4, 8, 12, 16].map(copyFrames)).toEqual([1, 2, 2, 3]);
    expect(copyFrames(8)).not.toBe(Math.ceil(8 / 8));
    expect(copyFrames(16)).not.toBe(Math.ceil(16 / 8));
  });

  it('gives every current map its walking-half count and normal close', () => {
    const of = kindOf(file);
    for (const name of CURRENT_MAPS) {
      const mapId = file.mapIds[name];
      let slots: number[];
      if (mapId < file.firstIndoorMapId) {
        const setId = name === 'Route2' ? selectOutdoor(file, mapId, 0, 36) : selectOutdoor(file, mapId, 0, 0);
        slots = file.spriteSets[setId];
        if (name === 'Route2') {
          expect(walkingCopies(file.spriteSets[selectOutdoor(file, mapId, 0, 37)])).toBe(EXPECTED_W.Route2);
        }
      } else {
        slots = allocateSlots(file.pikachuPictureId, of, idsFor(file, INDOOR_OBJECTS[name]));
      }
      const w = walkingCopies(slots);
      expect(w, name).toBe(EXPECTED_W[name]);
      expect(closeFrames(w), name).toBe(5 + 2 * EXPECTED_W[name]);
    }
    expect(file.pictures[file.pictureIdsBySprite.poke_ball].kind).toBe('still');
    expect(file.pictures[file.pictureIdsBySprite.pokedex].kind).toBe('still');
    expect(file.pictures[file.pictureIdsBySprite.clipboard].kind).toBe('still');
    const withoutStills = (names: readonly string[]) =>
      names.filter(sprite => file.pictures[file.pictureIdsBySprite[sprite]].kind === 'walking');
    const copies = (names: readonly string[]) =>
      walkingCopies(allocateSlots(file.pikachuPictureId, of, idsFor(file, names)));
    const lab = INDOOR_OBJECTS.OaksLab;
    const house = INDOOR_OBJECTS.ViridianNicknameHouse;
    const blues = INDOOR_OBJECTS.BluesHouse;
    const forest = INDOOR_OBJECTS.ViridianForest;
    expect(copies(lab)).toBe(5);
    expect(copies(withoutStills(lab))).toBe(5);
    expect(copies(blues)).toBe(2);
    expect(copies(withoutStills(blues))).toBe(2);
    expect(copies(forest)).toBe(3);
    expect(copies(withoutStills(forest))).toBe(3);
    expect(copies(house)).toBe(4);
    expect(copies(withoutStills(house))).toBe(4);
    expect(lab.length).toBe(9);
    expect(INDOOR_OBJECTS.BluesHouse.length).toBe(3);
  });

  it('binds every sprite name used by current map JSON and showNpc', () => {
    const bound = new Set(Object.keys(file.pictureIdsBySprite));
    for (const mapFile of readdirSync(MAPS_DIR)) {
      const map = JSON.parse(readFileSync(resolve(MAPS_DIR, mapFile), 'utf8')) as { npcs?: { sprite: string }[] };
      for (const npc of map.npcs ?? []) expect(bound.has(npc.sprite), `${mapFile} ${npc.sprite}`).toBe(true);
    }
    const shown = new Set<string>();
    for (const story of readdirSync(STORY_DIR).filter(name => name.endsWith('.ts'))) {
      const text = readFileSync(resolve(STORY_DIR, story), 'utf8');
      if (!text.includes('showNpc')) continue;
      for (const match of text.matchAll(/sprite:\s*'([^']+)'/g)) shown.add(match[1]);
    }
    expect([...shown]).toContain('prof');
    for (const name of shown) expect(bound.has(name), name).toBe(true);
  });

  it('mirrors the committed JSON into static/', () => {
    expect(readFileSync(STATIC_PATH).equals(readFileSync(DATA_PATH))).toBe(true);
  });
});

describeRom('A5b2 map sprite sets from the ROM', () => {
  let romBytes: Buffer;
  let extracted: MapSpriteSetsFile;

  beforeAll(() => {
    if (!ROM_PATH) return;
    requireRef('data/maps/sprite_sets.asm');
    requireRef('data/sprites/sprites.asm');
    requireRef('constants/sprite_set_constants.asm');
    requireRef('constants/sprite_constants.asm');
    requireRef('constants/map_constants.asm');
    romBytes = readFileSync(ROM_PATH);
    extracted = extractMapSpriteSets(readerOf(romBytes));
  });

  function romAt(addr: number, length: number): number[] {
    const offset = fileOff(5, addr);
    return [...romBytes.subarray(offset, offset + length)];
  }

  it('matches the referring instructions and the Route 20 branch', () => {
    const branch = [
      0xfe, 0x2b, 0x3e, 0x01, 0xd8, 0x7e, 0xfe, 0x3e, 0x3e, 0x0a, 0xd0, 0x7e, 0xfe, 0x37,
      0x06, 0x08, 0x30, 0x02, 0x06, 0x0d, 0xfa, 0x60, 0xd3, 0xb8, 0x3e, 0x0a, 0xd8, 0x3e, 0x01, 0xc9,
    ];
    expect(romAt(0x41c8, branch.length)).toEqual(branch);
    expect(romAt(0x4196, 3)).toEqual([0x21, 0xe6, 0x41]);
    expect(romAt(0x41a2, 3)).toEqual([0x21, 0x0b, 0x42]);
    expect(romAt(0x404a, 3)).toEqual([0x21, 0x3b, 0x42]);
    expect(romAt(0x4140, 3)).toEqual([0x11, 0xa9, 0x42]);
    expect(romAt(0x402c, 2)).toEqual([0xfe, 0x25]);
    expect(romAt(0x406b, 2)).toEqual([0x3e, 0x3d]);
    expect(romAt(0x40ac, 2)).toEqual([0xfe, 0x3d]);
    expect(romAt(0x40af, 2)).toEqual([0xfe, 0x47]);
    expect(romAt(0x419b, 2)).toEqual([0xfe, 0xf0]);
    expect(romAt(0x419e, 2)).toEqual([0xfe, 0xf8]);
    expect(extracted.firstIndoorMapId).toBe(romAt(0x402c, 2)[1]);
    expect(extracted.pikachuPictureId).toBe(romAt(0x406b, 2)[1]);
    expect(extracted.firstStillPictureId).toBe(romAt(0x40af, 2)[1]);
    expect(extracted.route20.splitSetId).toBe(romAt(0x419e, 2)[1]);
    expect(extracted.route20.xCuts).toEqual([romAt(0x41c8, 2)[1], romAt(0x41d4, 2)[1], romAt(0x41ce, 2)[1]]);
    expect(extracted.route20.yCuts).toEqual([romAt(0x41da, 2)[1], romAt(0x41d6, 2)[1]]);
    expect(extracted.route20.westSetId).toBe(romAt(0x41ca, 2)[1]);
    expect(extracted.route20.eastSetId).toBe(romAt(0x41d0, 2)[1]);
    expect(romAt(0x41e3, 2)[1]).toBe(extracted.route20.westSetId);
    expect(romAt(0x41e0, 2)[1]).toBe(extracted.route20.eastSetId);
  });

  it('matches the three source tables, in declaration order', () => {
    const setConsts = parseConsts('constants/sprite_set_constants.asm');
    const pictureConsts = parseConsts('constants/sprite_constants.asm');
    const consts = { ...setConsts, ...pictureConsts };
    const lines = sourceLines('data/maps/sprite_sets.asm');
    const selectors = dbRows(labelBody(lines, 'MapSpriteSets'), 1, consts).map(row => row[0]);
    const splits = dbRows(labelBody(lines, 'SplitMapSpriteSets'), 4, consts);
    const sets = dbRows(labelBody(lines, 'SpriteSets'), 1, consts).map(row => row[0]);
    expect(setConsts.NUM_SPRITE_SETS).toBe(10);
    expect(setConsts.NUM_SPLIT_SETS).toBe(12);
    expect(setConsts.SPRITE_SET_LENGTH).toBe(11);
    expect(setConsts.FIRST_SPLIT_SET).toBe(0xf1);
    expect(selectors).toHaveLength(37);
    expect(splits).toHaveLength(12);
    expect(sets).toHaveLength(110);
    const setAddr = romAt(0x404a, 3)[1] | (romAt(0x404a, 3)[2] << 8);
    const splitAddr = romAt(0x41a2, 3)[1] | (romAt(0x41a2, 3)[2] << 8);
    const mapAddr = romAt(0x4196, 3)[1] | (romAt(0x4196, 3)[2] << 8);
    expect(romAt(mapAddr, 37)).toEqual(selectors);
    expect(romAt(splitAddr, 48)).toEqual(splits.flat());
    expect(romAt(setAddr, 110)).toEqual(sets);
    expect(extracted.outdoorSetIds).toEqual(selectors);
    expect(extracted.spriteSets[1]).toEqual(sets.slice(0, 11));
    expect(extracted.spriteSets[10]).toEqual(sets.slice(99, 110));
    splits.forEach((row, index) => {
      const id = 0xf1 + index;
      expect(extracted.splitSets[id]).toEqual({
        axis: row[0] === setConsts.EAST_WEST ? 'x' : 'y',
        divider: row[1],
        belowSetId: row[2],
        atOrAboveSetId: row[3],
      });
    });
  });

  it('matches every overworld_sprite tile count', () => {
    const body = labelBody(sourceLines('data/sprites/sprites.asm'), 'SpriteSheetPointerTable');
    const counts: number[] = [];
    for (const line of body) {
      if (line.startsWith('table_width ') || line.startsWith('assert_table_length ')) continue;
      const match = /^overworld_sprite\s+\w+\s*,\s*(\d+)$/.exec(line);
      if (!match) throw new Error(`unsupported picture syntax: ${line}`);
      counts.push(Number(match[1]));
    }
    expect(counts).toHaveLength(82);
    const table = romAt(0x4140, 3)[1] | (romAt(0x4140, 3)[2] << 8);
    counts.forEach((tiles, index) => {
      expect(romAt(table + index * 4 + 2, 1)[0]).toBe((tiles * 16) & 0xff);
      expect(extracted.pictures[index + 1].tileCount).toBe(tiles === 12 ? 12 : 4);
    });
  });

  it('binds current map ids and engine names to the source constants', () => {
    const maps = parseConsts('constants/map_constants.asm');
    const pictures = parseConsts('constants/sprite_constants.asm');
    expect(maps.FIRST_INDOOR_MAP).toBe(0x25);
    expect(maps.ROUTE_2).toBe(13);
    expect(maps.VIRIDIAN_FOREST).toBe(51);
    expect(maps.REDS_HOUSE_2F).toBe(38);
    expect(pictures.SPRITE_OAK).toBe(3);
    expect(pictures.SPRITE_PIKACHU).toBe(61);
    expect(pictures.SPRITE_POKE_BALL).toBe(71);
    expect(pictures.SPRITE_POKEDEX).toBe(75);
    expect(pictures.SPRITE_GAMBLER_ASLEEP).toBe(82);
    expect(pictures.NUM_SPRITES).toBe(82);
    expect(pictures.FIRST_STILL_SPRITE).toBe(0x47);
    for (const name of CURRENT_MAPS) {
      expect(extracted.mapIds[name], name).toBe(maps[asmMapConst(name)]);
    }
    expect(Object.keys(extracted.pictureIdsBySprite).sort()).toEqual(Object.keys(ENGINE_SPRITE_CONSTANTS).sort());
    for (const [name, constant] of Object.entries(ENGINE_SPRITE_CONSTANTS)) {
      expect(extracted.pictureIdsBySprite[name], name).toBe(pictures[constant]);
    }
  });

  it('reproduces the current close counts from the source object lists', () => {
    const pictures = parseConsts('constants/sprite_constants.asm');
    const maps = parseConsts('constants/map_constants.asm');
    const sourceKind = (id: number): 'walking' | 'still' => {
      if (id === pictures.SPRITE_PIKACHU) return 'walking';
      if (id >= pictures.FIRST_STILL_SPRITE) return 'still';
      return 'walking';
    };
    for (const name of CURRENT_MAPS) {
      const lines = sourceLines(`data/maps/objects/${name}.asm`);
      const ids = lines.flatMap(line => {
        const match = /^object_event\s+[^,]+,\s*[^,]+,\s*(SPRITE_[A-Z0-9_]+)\b/.exec(line);
        return match ? [pictures[match[1]]] : [];
      });
      const mapId = maps[asmMapConst(name)];
      let w: number;
      if (mapId < maps.FIRST_INDOOR_MAP) {
        const setId = name === 'Route2' ? selectOutdoor(extracted, mapId, 0, 36) : selectOutdoor(extracted, mapId, 0, 0);
        w = walkingCopies(extracted.spriteSets[setId]);
        expect(ids.length, name).not.toBe(w);
      } else {
        w = walkingCopies(allocateSlots(pictures.SPRITE_PIKACHU, sourceKind, ids));
        expect(w, name).toBe(walkingCopies(allocateSlots(
          extracted.pikachuPictureId,
          kindOf(extracted),
          ids,
        )));
      }
      expect(w, name).toBe(EXPECTED_W[name]);
      expect(closeFrames(w)).toBe(5 + 2 * w);
    }
    const oakLines = sourceLines('data/maps/objects/OaksLab.asm').filter(line => line.startsWith('object_event '));
    const blueLines = sourceLines('data/maps/objects/BluesHouse.asm').filter(line => line.startsWith('object_event '));
    expect(oakLines).toHaveLength(9);
    expect(blueLines).toHaveLength(3);
    expect(EXPECTED_W.OaksLab).not.toBe(oakLines.length);
    expect(EXPECTED_W.BluesHouse).not.toBe(blueLines.length);
  });

  it('equals the committed data and static mirror', () => {
    const data = readFileSync(DATA_PATH);
    expect(JSON.parse(data.toString('utf8'))).toEqual(extracted);
    expect(readFileSync(STATIC_PATH).equals(data)).toBe(true);
  });

  it('rejects a truncated table, a bad axis, a bad reference and a bad size byte', () => {
    expect(() => extractMapSpriteSets(readerOf(romBytes.subarray(0, 0x141e6)))).toThrow(/outside the ROM/);
    const mutate = (offset: number, value: number) => {
      const copy = Buffer.from(romBytes);
      copy[offset] = value;
      return readerOf(copy);
    };
    expect(() => extractMapSpriteSets(mutate(0x1420b, 0x03))).toThrow(/axis byte/);
    expect(() => extractMapSpriteSets(mutate(0x141e6, 0xf0))).toThrow(/selector/);
    expect(() => extractMapSpriteSets(mutate(0x1423c, 0x00))).toThrow(/picture id/);
    expect(() => extractMapSpriteSets(mutate(0x142ab, 0x80))).toThrow(/tiles/);
  });
});
