import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BinaryReader } from '../binary_reader';
import { MAP_TEXT_PTRS } from '../rom_offsets';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';
import { extractMap } from '../extractors/maps';
import { readItemNames, readTrainerClassNames } from '../extractors/text';

describe.skipIf(!process.env.ROM_PATH)('trainer end-battle label extraction', () => {
  let bytes: Uint8Array;
  beforeAll(() => { bytes = new Uint8Array(readFileSync(process.env.ROM_PATH!)); });
  const map = (source = bytes) => {
    const rom = new BinaryReader(source.slice().buffer);
    return extractMap(rom,'ViridianForest',readItemNames(rom),readTrainerClassNames(rom))!;
  };
  const labels = ['Youngster2','Youngster3','Youngster4','CooltrainerF','Youngster5']
    .map(n => `ViridianForest${n}EndBattleText`);
  it('pins all five label pairs and their existence in the extracted programs', () => {
    const trainers = map().npcs.filter(n => n.trainerClass);
    expect(trainers).toHaveLength(5);
    const programs = JSON.parse(readFileSync('data/text_programs.json','utf8')).programs;
    expect(trainers.map(n => n.endBattleTextLabels)).toEqual(labels.map(name => ({win:name,lose:name})));
    for (const trainer of trainers) {
      expect(trainer.endBattleTextLabels!.win).toBe(trainer.endBattleTextLabels!.lose);
      expect(programs).toHaveProperty(trainer.endBattleTextLabels!.win);
      expect(programs).toHaveProperty(trainer.endBattleTextLabels!.lose);
    }
  });
  // Locate the real standard trainer header through TextPointers: text_asm;
  // ld hl, header. Patch its words to make the otherwise equal pointers distinct.
  function firstHeader(): number {
    const rom = new BinaryReader(bytes.slice().buffer), table = MAP_TEXT_PTRS.ViridianForest;
    for (let i = 0; i < table.count; i++) {
      const handler = rom.resolvePointer(table.bank,rom.readWord(table.offset+i*2));
      if (rom.readByte(handler) === 8 && rom.readByte(handler+1) === 0x21)
        return rom.resolvePointer(table.bank,rom.readWord(handler+2));
    }
    throw new Error('Forest trainer header not found');
  }
  it('reads the independent lose pointer at offset ten', () => {
    const changed = bytes.slice(), header = firstHeader();
    const addr = TEXT_PROGRAM_SYMBOLS.find(([name]) => name === labels[1])![2];
    changed[header+10] = addr&255; changed[header+11] = addr>>8;
    const trainer = map(changed).npcs.find(n => n.trainerClass)!;
    expect(trainer.endBattleTextLabels).toEqual({win:labels[0],lose:labels[1]});
  });
  it.each([8,10])('fails extraction for an unresolved pointer at header +%s', field => {
    const changed = bytes.slice(), header = firstHeader();
    changed[header+field] = 0x34; changed[header+field+1] = 0x12;
    expect(() => map(changed)).toThrow(/unresolved end-battle text/);
  });
});
