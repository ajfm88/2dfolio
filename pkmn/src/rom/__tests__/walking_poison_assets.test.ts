import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BinaryReader } from '../binary_reader';
import { extractTextPrograms } from '../extractors/text_programs';
import { extractSfx, extractSfxAt, SFX_HEADERS } from '../extractors/audio';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';

const symbols = [
  ['PokemonFaintedText', 0, 0x2983, true], ['_PokemonFaintedText', 0x2c, 0x74bc, false],
  ['PlayerBlackedOutText', 0, 0x29b3, true], ['_PlayerBlackedOutText', 0x2c, 0x74ca, false],
  ['RepelWoreOffText', 0, 0x29c1, true], ['_RepelWoreOffText', 0x2c, 0x74f4, false],
] as const;
const expectedSound = { channels: [{ id: 5, commands: [
  { cmd: 'duty_cycle', value: 0 }, { cmd: 'pitch_sweep', length: 1, shift: 4 },
  { cmd: 'square_note', length: 4, volume: 15, fade: 2, frequency: 1536 },
  { cmd: 'sound_loop', count: 4, target: 0 },
  { cmd: 'square_note', length: 15, volume: 15, fade: 3, frequency: 1536 },
  { cmd: 'pitch_sweep', length: 0, shift: 8 }, { cmd: 'sound_ret' },
] }] };
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe.skipIf(!process.env.ROM_PATH)('walking poison assets from the cartridge', () => {
  const rom = () => readFileSync(process.env.ROM_PATH!);
  const reader = () => new BinaryReader(Uint8Array.from(rom()).buffer);
  it('pins text symbols, far operands and the decoded placeholders and terminators', () => {
    const sym = execFileSync('git', ['-C', '../refs/pokeyellow', 'show', 'origin/symbols:pokeyellow.sym'], { encoding: 'utf8' });
    for (const row of symbols) {
      expect(TEXT_PROGRAM_SYMBOLS).toContainEqual(row);
      expect(sym).toContain(`${row[1].toString(16).padStart(2, '0')}:${row[2].toString(16).padStart(4, '0')} ${row[0]}`);
    }
    const bytes = rom();
    expect([...bytes.subarray(0x2983, 0x2988)]).toEqual([0x17, 0xbc, 0x74, 0x2c, 0x50]);
    expect([...bytes.subarray(0x29b3, 0x29b8)]).toEqual([0x17, 0xca, 0x74, 0x2c, 0x50]);
    expect([...bytes.subarray(0x29c1, 0x29c6)]).toEqual([0x17, 0xf4, 0x74, 0x2c, 0x50]);
    expect([...bytes.subarray(0x2c * 0x4000 + 0x34bc, 0x2c * 0x4000 + 0x34bf)]).toEqual([1, 0x6d, 0xcd]);
    const result = extractTextPrograms(reader());
    expect(result.programs.PokemonFaintedText).toEqual([{ op: 'far', program: '_PokemonFaintedText' }]);
    expect(result.programs.PlayerBlackedOutText).toEqual([{ op: 'far', program: '_PlayerBlackedOutText' }]);
    expect(result.programs.RepelWoreOffText).toEqual([{ op: 'far', program: '_RepelWoreOffText' }]);
    expect(result.programs._RepelWoreOffText).toEqual([{ op: 'text', text: "REPEL's effect\nwore off.<DONE>" }]);
    expect(result.programs._PokemonFaintedText).toEqual([{ op: 'ram', binding: 'nameBuffer' }, { op: 'text', text: '\nfainted!<DONE>' }]);
    expect(result.programs._PlayerBlackedOutText).toEqual([{ op: 'text', text: '<PLAYER> is out of\nuseable POKéMON!\f<PLAYER> blacked\nout!<PROMPT>' }]);
    expect(json('data/text_programs.json')).toEqual(result);
    expect(json('static/text_programs.json')).toEqual(result);
  });
  it('decodes both source headers to the same sound and mirrors it', () => {
    const sym = execFileSync('git', ['-C', '../refs/pokeyellow', 'show', 'origin/symbols:pokeyellow.sym'], { encoding: 'utf8' });
    expect(sym).toContain('02:41c5 SFX_Poisoned_1');
    expect(sym).toContain('1f:41c5 SFX_Poisoned_3');
    expect(SFX_HEADERS.poisoned).toEqual({ bank: 2, addr: 0x41c5 });
    expect(extractSfx(reader(), 'poisoned')).toEqual(expectedSound);
    expect(extractSfxAt(reader(), 0x1f, 0x41c5)).toEqual(expectedSound);
    expect(json('data/audio/sfx/poisoned.json')).toEqual(expectedSound);
    expect(json('static/audio/sfx/poisoned.json')).toEqual(expectedSound);
  });
  it('decodes the four teleport sounds identically in both field banks and their mirrors', () => {
    for (const [name, addr, header1, header3] of [
      ['teleport_exit1', 0x41dd, [4, 0x33, 0x45], [4, 0x0d, 0x45]],
      ['teleport_enter1', 0x41e0, [4, 0x4e, 0x45], [4, 0x28, 0x45]],
      ['teleport_exit2', 0x41e3, [4, 0x69, 0x45], [4, 0x43, 0x45]],
      ['teleport_enter2', 0x41e9, [7, 0x7f, 0x45], [7, 0x59, 0x45]],
    ] as const) {
      for (const [bank, expected] of [[2, header1], [0x1f, header3]] as const) {
        const offset = bank * 0x4000 + addr - 0x4000;
        expect([...rom().subarray(offset, offset + 3)]).toEqual(expected);
      }
      const value = extractSfx(reader(), name);
      expect(extractSfxAt(reader(), 0x1f, addr)).toEqual(value);
      expect(json(`data/audio/sfx/${name}.json`)).toEqual(value);
      expect(json(`static/audio/sfx/${name}.json`)).toEqual(value);
    }
  });
});
