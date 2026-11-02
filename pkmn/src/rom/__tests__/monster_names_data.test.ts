import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRom } from '../index';
import { BinaryReader } from '../binary_reader';
import { installNodeImageData } from '../node_image_data';
import { MONSTER_NAMES } from '../rom_offsets';
import { readMonsterNames } from '../extractors/text';
import { encodeText } from '../../battle/battle_state';

describe.skipIf(!process.env.ROM_PATH)('cartridge MonsterNames data', () => {
  let rom: BinaryReader;
  let buffer: ArrayBuffer;
  beforeAll(() => {
    installNodeImageData();
    const bytes = readFileSync(process.env.ROM_PATH!);
    buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    rom = new BinaryReader(buffer);
  });
  it('extractRom, committed data and static mirror are byte-identical', async () => {
    const extracted = await extractRom(buffer);
    const bytes = readFileSync(resolve(__dirname, '../../../data/monster_names.json'));
    expect(bytes.toString('utf8')).toBe(JSON.stringify(extracted.jsonData['monster_names.json'], null, 2) + '\n');
    expect(readFileSync(resolve(__dirname, '../../../static/monster_names.json'))).toEqual(bytes);
  });
  it('keeps the internal-id sentinel, all 190 entries and the cartridge spellings', () => {
    const names = readMonsterNames(rom);
    expect(names).toHaveLength(191);
    expect([names[0], names[3], names[15], names[42], names[84], names[190]])
      .toEqual([null, 'NIDORAN♂', 'NIDORAN♀', 'MR.MIME', 'PIKACHU', 'VICTREEBEL']);
    expect(names.filter(name => name === 'MISSINGNO.')).toHaveLength(39);
  });
  it('re-encodes every entry to its ten ROM bytes, including MISSINGNO slots', () => {
    const names = readMonsterNames(rom);
    for (let id = 1; id <= 190; id++) {
      const bytes = encodeText(names[id]!.padEnd(10, '@'));
      expect(bytes, `internal id ${id}`).toEqual([...rom.readBytes(MONSTER_NAMES + (id - 1) * 10, 10)]);
    }
  });
});
