// Opening checkpoint-03 (note 112): Pikachu's voice clips as data. Since checkpoint-04 (note 113) the audio facade's
// PCM player reads them; nothing in the game calls that player yet.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { BinaryReader } from '../binary_reader';
import {
  extractPikachuClip, pikachuClipFile, NUM_PIKACHU_CRIES, PIKACHU_CLIP_NUMBERS, type PikachuClip,
} from '../extractors/pikachu_pcm';
import { PIKACHU_CRIES_POINTER_TABLE } from '../rom_offsets';
import { clipFrozenFrames } from '../../audio/pikachu_pcm';

const GAME = resolve(__dirname, '../../..');
const REFS = resolve(GAME, '../refs/pokeyellow');
const ROM_PATH = process.env.ROM_PATH;
const committed = (root: 'data' | 'static', number: number): string =>
  readFileSync(resolve(GAME, root, pikachuClipFile(number)), 'utf8');

// pret's symbols (bank:address) and each clip's length word.
const CLIPS = [
  { number: 1, bank: 0x21, addr: 0x4000, length: 2327, next: 0x491a },
  { number: 4, bank: 0x21, addr: 0x59ee, length: 4087, next: null },
  { number: 11, bank: 0x24, addr: 0x4000, length: 1823, next: 0x4722 },
  { number: 17, bank: 0x34, addr: 0x4000, length: 2143, next: null },
  { number: 28, bank: 0x35, addr: 0x4b5a, length: 4679, next: null },
  { number: 35, bank: 0x37, addr: 0x4000, length: 4647, next: null },
  { number: 37, bank: 0x38, addr: 0x4000, length: 3575, next: 0x4dfa },
  { number: 40, bank: 0x38, addr: 0x5a64, length: 3855, next: null },
] as const;

describe('Pikachu\'s clips: the committed files (opening checkpoint-03, data only)', () => {
  it('setup writes exactly the eight clips used by the title, battle, status screen and Bill\'s PC, with identical static mirrors', () => {
    expect([...PIKACHU_CLIP_NUMBERS]).toEqual([1, 4, 11, 17, 28, 35, 37, 40]);
    const names = PIKACHU_CLIP_NUMBERS.map(number => `pikachu_cry_${number}.json`).sort();
    for (const root of ['data', 'static'] as const) {
      expect(readdirSync(resolve(GAME, root, 'audio/pikachu_cries')).sort()).toEqual(names);
    }
    for (const number of PIKACHU_CLIP_NUMBERS) expect(committed('static', number)).toBe(committed('data', number));
  });

  for (const clip of CLIPS) {
    it(`pikachu_cry_${clip.number}: id ${clip.number - 1}, ${clip.length} bytes of lowercase hex`, () => {
      const file: PikachuClip = JSON.parse(committed('data', clip.number));
      expect(Object.keys(file)).toEqual(['id', 'length', 'samples']);
      expect(file.id).toBe(clip.number - 1);
      expect(file.length).toBe(clip.length);
      expect(file.samples).toMatch(/^[0-9a-f]+$/);
      expect(file.samples.length).toBe(2 * clip.length);
      if ([28, 35, 40].includes(clip.number))
        expect(clipFrozenFrames(file.length)).toBe(clip.number === 40 ? 78 : 94);
    });
  }

  it('only the audio facade reads the clips, with title and battle callers', () => {
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'rom' && entry.name !== '__snapshots__') walk(path); }
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) sources.push(path);
      }
    };
    walk(resolve(GAME, 'src'));
    expect(sources.length).toBeGreaterThan(100);
    const holding = (pattern: RegExp): string[] => sources.filter(path => pattern.test(readFileSync(path, 'utf8')))
      .map(path => relative(resolve(GAME, 'src'), path).split('\\').join('/')).sort();
    expect(holding(/pikachu_cr(y|ies)/)).toEqual(['audio/index.ts', 'audio/pikachu_pcm.ts']);
    expect(holding(/audio\/pikachu_cries\/pikachu_cry_\$\{/)).toEqual(['audio/index.ts']);
    expect(holding(/loadPikachuClip|startPikachuClip|playPikachuSoundClip/))
      .toEqual(['audio/index.ts', 'battle/battle_session.ts', 'main.ts', 'menus/bills_pc.ts', 'menus/title_screen.ts']);
  });
});

describe.skipIf(!ROM_PATH)('Pikachu\'s clips: the ROM (opening checkpoint-03)', () => {
  const buffer = ROM_PATH ? readFileSync(resolve(GAME, ROM_PATH)) : Buffer.alloc(0);
  const rom = new BinaryReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const at = (bank: number, addr: number): number => bank * 0x4000 + (addr & 0x3fff);

  it('PikachuCriesPointerTable is 42 dba rows at 3c:408e, one per pikacry_def', () => {
    expect(PIKACHU_CRIES_POINTER_TABLE).toBe(at(0x3c, 0x408e));
    const source = readFileSync(resolve(REFS, 'audio/pikachu_cries_pointers.asm'), 'utf8');
    const defs = [...source.matchAll(/^\tpikacry_def (PikachuCry(\d+))$/gm)].map(match => Number(match[2]));
    expect(defs).toEqual(Array.from({ length: NUM_PIKACHU_CRIES }, (_, index) => index + 1));
  });

  for (const clip of CLIPS) {
    it(`PikachuCry${clip.number}: the table row, the length word and pret's next label`, () => {
      const row = PIKACHU_CRIES_POINTER_TABLE + 3 * (clip.number - 1);
      expect([rom.readByte(row), rom.readWord(row + 1)]).toEqual([clip.bank, clip.addr]);
      expect(rom.readWord(at(clip.bank, clip.addr))).toBe(clip.length);
      // `pcm`: dw .End - .Start - 1, then the bytes. The length word leaves out one trailing byte.
      if (clip.next !== null) expect(clip.addr + 2 + clip.length + 1).toBe(clip.next);
    });

    it(`PikachuCry${clip.number}: extraction equals the committed JSON, byte for byte`, () => {
      const extracted = extractPikachuClip(rom, clip.number);
      expect(JSON.stringify(extracted, null, 2) + '\n').toBe(committed('data', clip.number));
      const bytes = rom.readBytes(at(clip.bank, clip.addr) + 2, clip.length);
      expect(extracted.samples).toBe(Buffer.from(bytes).toString('hex'));
    });

    it(`PikachuCry${clip.number}: every bit is pret's pikachu_cry_${clip.number}.wav sample at the tool's threshold`, () => {
      // tools/pcm.c:102 packs eight 8-bit samples a byte, most significant bit first: a bit is set when the
      // sample is greater than $80. pret's WAVs hold only $00 and $FF, so no sample sits at the threshold.
      // The WAV also carries the eight samples of the trailing byte.
      const path = resolve(REFS, `audio/pikachu_cries/pikachu_cry_${clip.number}.wav`);
      expect(existsSync(path)).toBe(true);
      const wav = readFileSync(path);
      const data = wav.indexOf('data');
      const samples = wav.subarray(data + 8, data + 8 + wav.readUInt32LE(data + 4));
      expect(samples.length).toBe(8 * (clip.length + 1));
      expect([...new Set(samples)].sort((a, b) => a - b)).toEqual([0x00, 0xff]);
      const hex = extractPikachuClip(rom, clip.number).samples;
      const packed = Buffer.alloc(clip.length);
      for (let i = 0; i < 8 * clip.length; i++) if (samples[i] > 0x80) packed[i >> 3] |= 0x80 >> (i & 7);
      expect(hex).toBe(packed.toString('hex'));
    });
  }

  it('a number outside the table throws', () => {
    expect(() => extractPikachuClip(rom, 0)).toThrow('PikachuCry0 is not in PikachuCriesPointerTable');
    expect(() => extractPikachuClip(rom, 43)).toThrow('PikachuCry43 is not in PikachuCriesPointerTable');
    expect(() => extractPikachuClip(rom, 1.5)).toThrow('is not in PikachuCriesPointerTable');
  });
});
