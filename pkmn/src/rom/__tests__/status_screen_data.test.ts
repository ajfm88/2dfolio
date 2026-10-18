// StatusScreen CP2: independent source names/IDs and bold-P pixels, not UI behavior.
import { beforeAll, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BinaryReader } from '../binary_reader';
import { readMoveDisplayNames, readMoveNames } from '../extractors/text';
import { extractPTile } from '../extractors/graphics';
import { installNodeImageData } from '../node_image_data';

const DATA = resolve(__dirname, '../../../data');
const STATIC = resolve(__dirname, '../../../static');
const REFS = resolve(__dirname, '../../../../refs/pokeyellow');
const ROM_PATH = process.env.ROM_PATH;
const names: Record<string, string> = JSON.parse(readFileSync(resolve(DATA, 'move_names.json'), 'utf8'));
const moves: Record<string, { id: number }> = JSON.parse(readFileSync(resolve(DATA, 'moves.json'), 'utf8'));

/** Pair the independent source tables by ID, without production key normalization. */
function sourceNames(): Record<string, string> {
  const constants = readFileSync(resolve(REFS, 'constants/move_constants.asm'), 'utf8')
    .split(/^DEF NUM_ATTACKS\b/m)[0];
  const keys = [...constants.matchAll(/^\s*const\s+(\w+)\b/gm)].map(match => match[1]);
  expect(keys.shift()).toBe('NO_MOVE');
  const displays = [...readFileSync(resolve(REFS, 'data/moves/names.asm'), 'utf8')
    .matchAll(/^\s*li\s+"([^"]+)"\s*(?:;.*)?$/gm)].map(match => match[1]);
  expect(keys).toHaveLength(165);
  expect(displays).toHaveLength(165);
  keys.forEach((key, index) => expect(moves[key]?.id, key).toBe(index + 1));
  return Object.fromEntries(keys.map((key, index) => [key, displays[index]]));
}

it('committed move display names cover exactly the move constants and preserve cartridge spelling', () => {
  expect(Object.keys(names)).toHaveLength(165);
  expect(Object.keys(names).sort()).toEqual(Object.keys(moves).sort());
  expect(names).not.toHaveProperty('NO_MOVE');
  expect(names).toMatchObject({ SAND_ATTACK: 'SAND-ATTACK', DOUBLE_EDGE: 'DOUBLE-EDGE', PSYCHIC_M: 'PSYCHIC' });
  expect(readFileSync(resolve(STATIC, 'move_names.json')))
    .toEqual(readFileSync(resolve(DATA, 'move_names.json')));
});

it('all 165 committed names match MoveNames and move IDs from the disassembly, without a ROM', () => {
  if (!existsSync(REFS)) return; // same optional local-reference convention as other source audits
  expect(names).toEqual(sourceNames());
});

let rom: BinaryReader;
beforeAll(() => {
  if (!ROM_PATH) return;
  installNodeImageData();
  const bytes = readFileSync(ROM_PATH);
  rom = new BinaryReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
});

it.skipIf(!ROM_PATH)('ROM MoveNames retains every display string and the existing numeric-ID constant table', () => {
  const extracted = readMoveDisplayNames(rom);
  expect(extracted).toEqual(names);
  const keysById = Object.entries(moves).sort((a, b) => a[1].id - b[1].id).map(([key]) => key);
  expect(readMoveNames(rom)).toEqual(['NO_MOVE', ...keysById]);
  if (existsSync(REFS)) expect(extracted).toEqual(sourceNames());
});

it.skipIf(!ROM_PATH)('bold P is one 1bpp tile at PTile, matching the committed and reference PNG pixels', () => {
  const image = extractPTile(rom);
  expect([image.width, image.height]).toEqual([8, 8]);
  // Independent bit expansion at the symbol's address (04:5682), all RGBA channels.
  const expected = Buffer.alloc(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const gray = ((rom.readByte(0x11682 + y) >> (7 - x)) & 1) ? 0 : 255;
    const offset = (y * 8 + x) * 4;
    expected.fill(gray, offset, offset + 3);
    expected[offset + 3] = 255;
  }
  expect(Buffer.from(image.data)).toEqual(expected);
  const committed = PNG.sync.read(readFileSync(resolve(STATIC, 'gfx/font/P.png')));
  expect([committed.width, committed.height]).toEqual([8, 8]);
  expect(committed.data).toEqual(expected);
  const refPath = resolve(REFS, 'gfx/font/P.png');
  if (!existsSync(refPath)) return;
  const reference = PNG.sync.read(readFileSync(refPath));
  expect([reference.width, reference.height]).toEqual([8, 8]);
  expect(Buffer.from(image.data)).toEqual(reference.data);
});
