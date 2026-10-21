import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TYPE_DISPLAY_NAMES, moveTypeDisplayName } from './type_names';
import { TYPE_NAMES } from '../rom/constants';
import { MOVES, MOVE_LENGTH } from '../rom/rom_offsets';

const moves = JSON.parse(readFileSync(resolve(__dirname, '../../data/moves.json'), 'utf8')) as
  Record<string, { id: number; type: string }>;

describe('battle type display constants', () => {
  it('retains all 27 display slots including BIRD and the eleven NORMAL aliases', () => {
    expect(TYPE_DISPLAY_NAMES).toHaveLength(27);
    expect(TYPE_DISPLAY_NAMES[6]).toBe('BIRD');
    expect(TYPE_DISPLAY_NAMES.slice(9, 20)).toEqual(Array(11).fill('NORMAL'));
    expect(TYPE_DISPLAY_NAMES[20]).toBe('FIRE');
  });

  it('resolves every mechanics key by reversing TYPE_NAMES without changing the key', () => {
    for (const [id, key] of Object.entries(TYPE_NAMES))
      expect(moveTypeDisplayName(key), key).toBe(TYPE_DISPLAY_NAMES[Number(id)]);
    expect(TYPE_NAMES[24]).toBe('PSYCHIC_TYPE');
    expect(moveTypeDisplayName('PSYCHIC_TYPE')).toBe('PSYCHIC');
    expect(Object.values(moves).filter(m => m.type === 'PSYCHIC_TYPE')).toHaveLength(15);
  });

  it('rejects unknown keys rather than silently displaying NORMAL', () => {
    for (const key of ['PSYCHIC', 'BIRD', 'toString', 'missing', ''])
      expect(() => moveTypeDisplayName(key)).toThrow('unknown move type key');
  });
});

const ROM_PATH = process.env.ROM_PATH;
let rom: Buffer;
beforeAll(() => { if (ROM_PATH) rom = readFileSync(ROM_PATH); });
const offset = (addr: number) => 9 * 0x4000 + (addr & 0x3fff);
const TABLE = offset(0x7d63);

function romTypeName(id: number): string {
  const ptr = rom.readUInt16LE(TABLE + id * 2);
  expect(ptr).toBeGreaterThanOrEqual(0x7d99); // immediately after the 27 pointers
  expect(ptr).toBeLessThan(0x8000);
  let at = offset(ptr), text = '';
  for (let count = 0; count < 9; count++) {
    const byte = rom[at++];
    if (byte === 0x50) return text;
    expect(byte).toBeGreaterThanOrEqual(0x80);
    expect(byte).toBeLessThanOrEqual(0x99);
    text += String.fromCharCode(65 + byte - 0x80);
  }
  throw new Error('Type name lacks @ terminator');
}

describe.skipIf(!ROM_PATH)('TypeNames ROM table at 09:7d63', () => {
  it('pins every display entry and the exact unused-type pointer aliases', () => {
    expect(rom.readUInt16LE(TABLE)).toBe(0x7d99);
    expect(Array.from({ length: 27 }, (_, id) => romTypeName(id))).toEqual(TYPE_DISPLAY_NAMES);
    for (let id = 9; id <= 19; id++) expect(rom.readUInt16LE(TABLE + id * 2)).toBe(rom.readUInt16LE(TABLE));
    const used = [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23, 24, 25, 26];
    expect(new Set(used.map(id => rom.readUInt16LE(TABLE + id * 2))).size).toBe(16);
  });

  it('maps all 165 committed moves to the string for their ROM type byte', () => {
    expect(Object.keys(moves)).toHaveLength(165);
    for (const [move, data] of Object.entries(moves)) {
      const id = rom[MOVES + (data.id - 1) * MOVE_LENGTH + 3];
      expect(TYPE_NAMES[id], move).toBe(data.type);
      expect(moveTypeDisplayName(data.type), move).toBe(romTypeName(id));
    }
  });
});
