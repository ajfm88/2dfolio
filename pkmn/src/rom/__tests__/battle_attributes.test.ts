import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPaletteColors } from '../../renderer/palettes';
import { BATTLE_ATTRIBUTE_HEADER, BATTLE_ATTRIBUTE_ROM_OFFSET, BATTLE_BG_ATTRIBUTES } from '../../battle/battle_attributes';

const ROM_PATH = process.env.ROM_PATH;
let rom: Buffer;
beforeAll(() => { if (ROM_PATH) rom = readFileSync(ROM_PATH); });

it.skipIf(!ROM_PATH)('guards BGMapAttributes_Battle at 2f:6960, both copies and the blank columns', () => {
  expect(rom[BATTLE_ATTRIBUTE_ROM_OFFSET]).toBe(0x23);
  expect(rom.readUInt16LE(BATTLE_ATTRIBUTE_ROM_OFFSET + 1)).toBe(0x000d);
  expect([...rom.subarray(BATTLE_ATTRIBUTE_ROM_OFFSET, BATTLE_ATTRIBUTE_ROM_OFFSET + 16)]).toEqual([...BATTLE_ATTRIBUTE_HEADER]);
  expect((rom[BATTLE_ATTRIBUTE_ROM_OFFSET] + 1) * 16).toBe(BATTLE_BG_ATTRIBUTES.length);
  const block = BATTLE_ATTRIBUTE_ROM_OFFSET + 0x10;
  const second = BATTLE_ATTRIBUTE_ROM_OFFSET + 3 + rom.readUInt16LE(BATTLE_ATTRIBUTE_ROM_OFFSET + 1);
  expect(second).toBe(block);
  expect([...rom.subarray(block, block + BATTLE_BG_ATTRIBUTES.length)]).toEqual([...BATTLE_BG_ATTRIBUTES]);
  for (let row = 0; row < 18; row++) {
    expect([...rom.subarray(block + row * 32 + 20, block + row * 32 + 32)].every(byte => byte === 0)).toBe(true);
  }
});

it.skipIf(!ROM_PATH)('guards PAL_BLACK at CGBBasePalettes entry $1E', () => {
  const base = 0x1c * 0x4000 + (0x6af9 - 0x4000);
  const offset = base + 0x1e * 8;
  const colour = (index: number): number[] => {
    const word = rom.readUInt16LE(offset + index * 2);
    return [word & 31, (word >> 5) & 31, (word >> 10) & 31];
  };
  expect(colour(0)).toEqual([31, 31, 31]);
  expect(colour(1)).toEqual([3, 3, 3]);
  expect(colour(2)).toEqual([3, 3, 3]);
  expect(colour(3)).toEqual([3, 3, 3]);
  expect(getPaletteColors('PAL_BLACK')[0]).toEqual([255, 255, 255]);
  expect(getPaletteColors('PAL_BLACK')[1]).toEqual([25, 25, 25]);
  expect(getPaletteColors('PAL_BLACK')[2]).toEqual([25, 25, 25]);
  expect(getPaletteColors('PAL_BLACK')[3]).toEqual([25, 25, 25]);
});
