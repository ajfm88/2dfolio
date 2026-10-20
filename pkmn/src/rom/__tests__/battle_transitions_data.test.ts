import { beforeAll, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractBattleTransitions } from '../extractors/battle_transitions';
import type { BattleTransitionData } from '../extractors/battle_transitions';
import { EXTRACTABLE_MAPS } from '../extractors/maps';
import { PRESET_RIVAL_PROBE_BYTES } from '../../overworld/battle_transition_choice';

const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const ROM_PATH = process.env.ROM_PATH;
const file: BattleTransitionData = JSON.parse(readFileSync(resolve(DATA, 'battle_transitions.json'), 'utf8'));
const source = (path: string): string => readFileSync(resolve(REFS, path), 'utf8');

function mapConstants(): Record<string, number> {
  return Object.fromEntries([...source('constants/map_constants.asm').matchAll(/^\s*map_const\s+(\w+),/gm)]
    .map((match, index) => [match[1], index]));
}
function dungeonLists(): { dungeonMaps: number[]; dungeonRanges: number[][] } {
  const ids = mapConstants();
  const asm = source('data/maps/dungeon_maps.asm');
  const rows = (part: string): number[][] => [...part.matchAll(/^\s*db\s+([^;\n]+)/gm)]
    .map(match => match[1].trim()).filter(row => row !== '-1')
    .map(row => row.split(',').map(name => {
      const id = ids[name.trim()];
      if (id === undefined) throw new Error(`unknown map ${name}`);
      return id;
    }));
  return { dungeonMaps: rows(asm.split('DungeonMaps1:')[1].split('DungeonMaps2:')[0]).flat(),
    dungeonRanges: rows(asm.split('DungeonMaps2:')[1]) };
}

it('commits one new data file with literal dungeon lists and the 24 runtime map IDs', () => {
  expect(Object.keys(file).sort()).toEqual(['dungeonMaps', 'dungeonRanges', 'mapIds', 'mapObjectCounts']);
  expect(file.dungeonMaps).toEqual([51, 82, 192, 232]);
  expect(file.dungeonRanges).toEqual([[59, 61], [95, 118], [141, 151], [207, 228]]);
  expect(file.mapIds).toEqual(EXTRACTABLE_MAPS);
  expect(Object.keys(file.mapIds)).toHaveLength(24);
  for (const name of Object.keys(file.mapIds)) {
    const map = JSON.parse(readFileSync(resolve(DATA, `maps/${name}.json`), 'utf8'));
    expect(map).not.toHaveProperty('mapId'); expect(map).not.toHaveProperty('id');
  }
  expect(readFileSync(resolve(STATIC, 'battle_transitions.json')))
    .toEqual(readFileSync(resolve(DATA, 'battle_transitions.json')));
});

it.skipIf(!ROM_PATH)('keeps every original object slot, including filtered and hidden objects', () => {
  const counts: Record<string, number> = {};
  for (const [name, id] of Object.entries(file.mapIds)) {
    const bank = bytes[0xfc3e4 + id];
    const address = (pointer: number): number => bank * 0x4000 + (pointer & 0x3fff);
    const header = address(bytes.readUInt16LE(0xfc1f2 + id * 2));
    const connections = [1, 2, 4, 8].filter(bit => bytes[header + 9] & bit).length;
    let p = address(bytes.readUInt16LE(header + 10 + connections * 11)) + 1;
    const warps = bytes[p++]; p += warps * 4;
    const signs = bytes[p++]; p += signs * 3;
    counts[name] = bytes[p];
  }
  expect(file.mapObjectCounts).toEqual(counts);
  expect(counts).toMatchObject({ Route22: 2, BluesHouse: 3, OaksLab: 9, RedsHouse2F: 0 });
});

it('matches the disassembly lists and each map_header constant independently, without ROM', () => {
  if (!existsSync(REFS)) return;
  expect(file).toMatchObject(dungeonLists());
  const constants = mapConstants();
  for (const [name, id] of Object.entries(file.mapIds)) {
    const header = source(`data/maps/headers/${name}.asm`).match(/map_header\s+\w+,\s*(\w+),/);
    expect(header, name).not.toBeNull();
    expect(id, name).toBe(constants[header![1]]);
  }
});

let bytes: Buffer;
let rom: BinaryReader;
beforeAll(() => {
  if (!ROM_PATH) return;
  if (!existsSync(REFS)) throw new Error('CP2 ROM/source audit requires refs/pokeyellow');
  bytes = readFileSync(ROM_PATH);
  rom = new BinaryReader(Uint8Array.from(bytes).buffer);
});

it.skipIf(!ROM_PATH)('reads both sentinel-terminated ROM lists, source-matches them, and emits the committed schema', () => {
  expect([...rom.readBytes(0x70aa9, 5)]).toEqual([...dungeonLists().dungeonMaps, 255]);
  expect([...rom.readBytes(0x70aae, 9)]).toEqual([...dungeonLists().dungeonRanges.flat(), 255]);
  expect(extractBattleTransitions(rom)).toEqual(file);
});

it.skipIf(!ROM_PATH)('pins BattleTransitionTile at 1c:4ac3 and rejects a changed bitplane', () => {
  expect([...rom.readBytes(0x70ac3, 16)]).toEqual(Array(16).fill(255));
  for (const offset of [0, 7, 15]) {
    const changed = Uint8Array.from(bytes);
    changed[0x70ac3 + offset] ^= 1;
    expect(() => extractBattleTransitions(new BinaryReader(changed.buffer))).toThrow('BattleTransitionTile');
  }
});

it.skipIf(!ROM_PATH)('rejects missing list terminators and reversed inclusive ranges', () => {
  for (const [offset, value, message] of [[0x70aad, 0, 'DungeonMaps1'],
    [0x70ab6, 0, 'DungeonMaps2'], [0x70aae, 62, 'DungeonMaps2']] as const) {
    const changed = Uint8Array.from(bytes); changed[offset] = value;
    expect(() => extractBattleTransitions(new BinaryReader(changed.buffer))).toThrow(message);
  }
});

it.skipIf(!ROM_PATH)('pins all three preset rival words from DefaultNamesRivalList, including JOHN overread', () => {
  // origin/symbols: 01:688d list, nine-byte NEW NAME@; variable-length default entries.
  let entry = 0x6896;
  for (const name of ['BLUE', 'GARY', 'JOHN']) {
    const encoded = Array.from(name, char => char.charCodeAt(0) - 65 + 0x80);
    expect([...rom.readBytes(entry, name.length + 1)]).toEqual([...encoded, 0x50]);
    expect(PRESET_RIVAL_PROBE_BYTES[name]).toEqual([...rom.readBytes(entry + 6, 2)]);
    entry += name.length + 1;
  }
});
