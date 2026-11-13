// V5c checkpoint-01 (note 93): ToggleableObjectStates and ToggleableObjectMapPointers as data, unused at runtime.
import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractToggleableObjects, type ToggleableObjectsData } from '../extractors/toggleable_objects';
import { EXTRACTABLE_MAPS } from '../extractors/maps';
import { NO_TOGGLE_DATA, TOGGLEABLE_OBJECT_MAP_POINTERS, TOGGLEABLE_OBJECT_STATES } from '../rom_offsets';

const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const ROM_PATH = process.env.ROM_PATH;
const file: ToggleableObjectsData = JSON.parse(readFileSync(resolve(DATA, 'toggleable_objects.json'), 'utf8'));
const source = (path: string): string => readFileSync(resolve(REFS, path), 'utf8');

/** pret's own table: map_const order gives map ids; each objects/*.asm's const_export order gives 1-based objects. */
function pretRows(): { map: number; object: number; on: boolean }[] {
  const maps = Object.fromEntries([...source('constants/map_constants.asm').matchAll(/^\s*map_const\s+(\w+),/gm)]
    .map((match, index) => [match[1], index]));
  const objects: Record<string, number> = {};
  for (const name of readdirSync(resolve(REFS, 'data/maps/objects'))) {
    [...source(`data/maps/objects/${name}`).matchAll(/^\s*const_export\s+(\w+)/gm)]
      .forEach((match, index) => { objects[match[1]] = index + 1; });
  }
  const table = source('data/maps/toggleable_objects.asm').split('ToggleableObjectStates:')[1];
  const rows: { map: number; object: number; on: boolean }[] = [];
  let map = -1;
  for (const line of table.split('\n').map(l => l.split(';')[0].trim()).filter(Boolean)) {
    let m = /^toggleable_objects_for\s+(\w+)$/.exec(line);
    if (m) { map = maps[m[1]]; continue; }
    m = /^toggle_object_state\s+(\$?\w+),\s*(ON|OFF)$/.exec(line);
    // One row names its object by number: `toggle_object_state $02, ON ; unused`.
    if (m) { rows.push({ map, object: m[1].startsWith('$') ? parseInt(m[1].slice(1), 16) : objects[m[1]], on: m[2] === 'ON' }); continue; }
    m = /^db\s+(\w+),\s*(\w+),\s*(ON|OFF)$/.exec(line);
    if (m && m[1] !== '-1') { rows.push({ map: maps[m[1]], object: objects[m[2]], on: m[3] === 'ON' }); continue; }
  }
  for (const row of rows) if (row.map === undefined || row.object === undefined) throw new Error('unresolved pret row');
  return rows;
}

it('commits the 239 rows in ROM order, equal to pret, with the static mirror', () => {
  expect(Object.keys(file).sort()).toEqual(['mapFirst', 'states']);
  expect(file.states).toHaveLength(239); // constants/toggle_constants.asm NUM_TOGGLEABLE_OBJECTS = $EF
  expect(file.states).toEqual(pretRows());
  expect(readFileSync(resolve(STATIC, 'toggleable_objects.json'))).toEqual(readFileSync(resolve(DATA, 'toggleable_objects.json')));
});

it("gives each extracted map its first row, or null for NoToggleData, and pins the rows today's maps own", () => {
  expect(Object.keys(file.mapFirst).sort()).toEqual(Object.keys(EXTRACTABLE_MAPS).sort());
  const owned = Object.fromEntries(Object.entries(file.mapFirst).filter(([, first]) => first !== null));
  expect(owned).toEqual({ PalletTown: 0, ViridianCity: 1, PewterCity: 4, Route2: 26, Route22: 35, BluesHouse: 40,
    OaksLab: 43, Museum1F: 51, ViridianForest: 100 });
  const rows = (name: string) => {
    const first = file.mapFirst[name]!, id = EXTRACTABLE_MAPS[name];
    const out: [number, boolean][] = [];
    for (let i = first; i < file.states.length && file.states[i].map === id; i++) out.push([file.states[i].object, file.states[i].on]);
    return out;
  };
  // data/maps/toggleable_objects.asm
  expect(rows('BluesHouse')).toEqual([[1, true], [2, false], [3, true]]);
  expect(rows('OaksLab')).toEqual([[1, true], [2, true], [3, false], [4, true], [5, true], [6, false]]);
  expect(rows('ViridianCity')).toEqual([[5, true], [7, false], [8, false]]);
  expect(rows('Route22')).toEqual([[1, false], [2, false]]);
  // The three raw `db BLUES_HOUSE` rows at the end are the unused routine's copies (TOGGLE_*_COPY, $EC–$EE).
  expect(file.states.slice(236)).toEqual([{ map: 39, object: 1, on: true }, { map: 39, object: 2, on: false }, { map: 39, object: 3, on: true }]);
});

const rom = ROM_PATH ? new BinaryReader(new Uint8Array(readFileSync(resolve(__dirname, '../../..', ROM_PATH))).buffer) : null;
const patched = (at: number, value: number): BinaryReader => {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../..', ROM_PATH!)));
  bytes[at] = value;
  return new BinaryReader(bytes.buffer);
};

it.skipIf(!ROM_PATH)('the extractor reproduces the committed file from the ROM', () => {
  expect(extractToggleableObjects(rom!)).toEqual(file);
});

it.skipIf(!ROM_PATH)('fails loudly on a bad state byte, a bad object, a missing terminator and a pointer off a row', () => {
  expect(() => extractToggleableObjects(patched(TOGGLEABLE_OBJECT_STATES + 2, 0x12))).toThrow('state $12');
  expect(() => extractToggleableObjects(patched(TOGGLEABLE_OBJECT_STATES + 1, 0))).toThrow('object 0');
  expect(() => extractToggleableObjects(patched(TOGGLEABLE_OBJECT_STATES + 239 * 3, 0x00))).toThrow();
  const blues = EXTRACTABLE_MAPS.BluesHouse;
  expect(() => extractToggleableObjects(patched(TOGGLEABLE_OBJECT_MAP_POINTERS + blues * 2, 0x00))).toThrow('BluesHouse');
  expect(NO_TOGGLE_DATA).toBe(TOGGLEABLE_OBJECT_STATES - 3);
});

// V5c checkpoint-01 review (note 93 §8): a pointer on a row boundary that belongs to another map must throw too.
it.skipIf(!ROM_PATH)("fails loudly when a map's pointer lands on another map's row", () => {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../..', ROM_PATH!)));
  const at = TOGGLEABLE_OBJECT_MAP_POINTERS + EXTRACTABLE_MAPS.BluesHouse * 2;
  bytes[at] = 0x92; bytes[at + 1] = 0x48; // 03:4892, row 0: PalletTown's Oak
  expect(() => extractToggleableObjects(new BinaryReader(bytes.buffer))).toThrow('BluesHouse: row 0 is map 0');
});
