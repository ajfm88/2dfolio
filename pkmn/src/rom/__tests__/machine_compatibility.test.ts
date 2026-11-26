import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import { extractMachineCompatibility } from '../extractors/machine_compatibility';
import { BASE_STATS, BASE_DATA_SIZE } from '../rom_offsets';
import { canLearnTM } from '../../machine_compatibility';
import data from '../../../data/machine_compatibility.json';
import machines from '../../../data/machine_data.json';

it('matches source bit order and species witnesses including both last-byte boundaries', () => {
  const macro = readFileSync(resolve(__dirname, '../../../../refs/pokeyellow/macros/data.asm'), 'utf8');
  expect(macro).toMatch(/DEF i = \(\\1_TMNUM - 1\) % 8/);
  expect(macro).toMatch(/_tm\{d:n\} \|= 1 << i/);
  expect(data).toHaveLength(152); expect(data[0]).toBeNull();
  expect(data[151]).toEqual([255, 255, 255, 255, 255, 255, 127]);
  expect(data[10]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(data[132]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(canLearnTM(25, machines.moves[54])).toBe(true);
  for (const dex of [10, 132]) for (const move of machines.moves) expect(canLearnTM(dex, move)).toBe(false);
  for (const dex of [1, 25, 151]) for (const index of [49, 50, 54]) {
    expect(canLearnTM(dex, machines.moves[index])).toBe(Boolean(data[dex]![6] & (1 << (index - 48))));
  }
  expect(canLearnTM(25, 1)).toBe(false);
  for (const dex of [0, 152, -1, 1.5, NaN]) expect(canLearnTM(dex, machines.moves[0])).toBe(false);
  for (const move of [0, 166, 1.5, NaN]) expect(canLearnTM(25, move)).toBe(false);
  expect(readFileSync(resolve(__dirname, '../../../static/machine_compatibility.json')))
    .toEqual(readFileSync(resolve(__dirname, '../../../data/machine_compatibility.json')));
});

it.skipIf(!process.env.ROM_PATH)('extracts every raw ROM byte and rejects malformed records', () => {
  const bytes = readFileSync(process.env.ROM_PATH!);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const rom = new BinaryReader(buffer);
  for (let dex = 1; dex <= 151; dex++) {
    const offset = BASE_STATS + (dex - 1) * BASE_DATA_SIZE;
    expect(rom.readByte(offset)).toBe(dex);
    expect(data[dex]).toEqual([...rom.readBytes(offset + 0x14, 7)]);
  }
  expect(extractMachineCompatibility(rom)).toEqual(data);
  expect(readFileSync(resolve(__dirname, '../../../data/machine_compatibility.json'), 'utf8'))
    .toBe(JSON.stringify(extractMachineCompatibility(rom), null, 2) + '\n');
  const broken = new Uint8Array(buffer.slice(0));
  broken[BASE_STATS] = 0;
  expect(() => extractMachineCompatibility(new BinaryReader(broken.buffer))).toThrow();
  broken[BASE_STATS] = 1; broken[BASE_STATS + 0x1a] |= 0x80;
  expect(() => extractMachineCompatibility(new BinaryReader(broken.buffer))).toThrow();
  expect(() => extractMachineCompatibility(new BinaryReader(buffer.slice(0, BASE_STATS + 0x1a)))).toThrow();
});
