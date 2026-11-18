// Opening checkpoint-04 (note 113): the PCM player's numbers and the synthesizer's 1-bit source.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MACHINE_CYCLES_PER_FRAME, MACHINE_CYCLES_PER_SECOND, PCM_CYCLES_PER_SAMPLE, PIKACHU_PCM_HZ,
  clipFrozenFrames, clipMissedVBlanks, decodePikachuClip, type PikachuClipFile,
} from './pikachu_pcm';
import { GBSynthesizer } from './synthesizer';
import { GB_FPS } from '../core/tick_clock';

const GAME = resolve(__dirname, '../..');
const refs = resolve(GAME, '../refs/pokeyellow');
const file = (number: number): PikachuClipFile =>
  JSON.parse(readFileSync(resolve(GAME, `data/audio/pikachu_cries/pikachu_cry_${number}.json`), 'utf8')) as PikachuClipFile;

/**
 * home/pikachu_cries.asm run from its source text, counting machine cycles (Pan Docs' instruction timings).
 * Returns every write of rAUD3LEVEL as [the cycle it ended on, the value]. An instruction outside the table throws.
 */
function runPlayPikachuPCM(clip: number[]): [number, number][] {
  const lines: string[] = [];
  let repeat: string[] | null = null;
  for (const raw of readFileSync(resolve(refs, 'home/pikachu_cries.asm'), 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/;.*/, '').trim();
    if (!line || line.startsWith('vc_hook')) continue;
    if (line === 'REPT 7') { repeat = []; continue; }
    if (line === 'ENDR') { for (let i = 0; i < 7; i++) lines.push(...repeat!); repeat = null; continue; }
    (repeat ?? lines).push(line);
  }
  const labels = new Map<string, number>();
  const program: { op: string; scope: string }[] = [];
  let scope = '';
  for (const line of lines) {
    if (line.endsWith('::')) { scope = line.slice(0, -2); labels.set(scope, program.length); }
    else if (line.startsWith('.')) labels.set(scope + line, program.length);
    else program.push({ op: line.replace(/\s+/g, ' '), scope });
  }
  const reg: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
  const memory = [clip.length & 255, clip.length >> 8, ...clip];
  const stack: number[] = [], writes: [number, number][] = [];
  let hl = 0, zero = false, cycles = 0, pc = labels.get('PlayPikachuPCM')!;
  for (let steps = 0; steps < 100_000; steps++) {
    const { op, scope: inside } = program[pc++];
    let match: RegExpMatchArray | null;
    if (op === 'ldh a, [hLoadedROMBank]') { cycles += 3; reg.a = 0; }
    else if (op === 'push af') { cycles += 4; stack.push(-1 - reg.a); }
    else if (op === 'pop af') { cycles += 3; reg.a = -1 - stack.pop()!; }
    else if (op === 'call BankswitchCommon') cycles += 6 + 3 + 4 + 4; // ldh, ld [rROMB], ret
    else if ((match = op.match(/^call (\w+)$/))) { cycles += 6; stack.push(pc); pc = labels.get(match[1])!; }
    else if (op === 'ret') { cycles += 4; if (stack.length === 0) return writes; pc = stack.pop()!; }
    else if (op === 'ld a, [hli]') { cycles += 2; reg.a = memory[hl++]; }
    else if ((match = op.match(/^ld ([abcd]), ([abcd])$/))) { cycles += 1; reg[match[1]] = reg[match[2]]; }
    else if ((match = op.match(/^ld a, \$([0-9a-f]+)$/))) { cycles += 2; reg.a = parseInt(match[1], 16); }
    else if (op === 'dec a') { cycles += 1; reg.a = (reg.a - 1) & 255; zero = reg.a === 0; }
    else if (op === 'dec bc') { cycles += 2; const bc = ((reg.b << 8 | reg.c) - 1) & 0xffff; reg.b = bc >> 8; reg.c = bc & 255; }
    else if (op === 'or b') { cycles += 1; reg.a |= reg.b; zero = reg.a === 0; }
    else if (op === 'and $80') { cycles += 2; reg.a &= 0x80; zero = reg.a === 0; }
    else if (op === 'srl a') { cycles += 2; reg.a >>= 1; zero = reg.a === 0; }
    else if (op === 'sla d') { cycles += 2; reg.d = (reg.d << 1) & 255; zero = reg.d === 0; }
    else if (op === 'ldh [rAUD3LEVEL], a') { cycles += 3; writes.push([cycles, reg.a]); }
    else if ((match = op.match(/^jr nz, (\.\w+)$/))) {
      if (zero) cycles += 2; else { cycles += 3; pc = labels.get(inside + match[1])!; }
    } else throw new Error(`no timing for "${op}"`);
  }
  throw new Error('PlayPikachuPCM did not return');
}

describe('Pikachu\'s PCM: the rate and the frozen span (opening checkpoint-04)', () => {
  it.skipIf(!existsSync(refs))('PlayPikachuPCM writes eight levels a byte, most significant bit first, 45 machine cycles apart', () => {
    const clip = [0xa5, 0x0f, 0x80, 0x01, 0xff];
    const writes = runPlayPikachuPCM(clip);
    expect(writes.map(([, level]) => level)).toEqual(
      clip.flatMap(byte => Array.from({ length: 8 }, (_, bit) => (byte << bit) & 0x80 ? 0x20 : 0x00)));
    const gaps = writes.slice(1).map(([cycle], i) => cycle - writes[i][0]);
    expect(gaps).toHaveLength(39);
    expect(new Set(gaps)).toEqual(new Set([PCM_CYCLES_PER_SAMPLE]));
    // Both paths are in that set: gap 7 crosses from the first byte to the second.
    expect([gaps[6], gaps[7], gaps[8]]).toEqual([45, 45, 45]);
  });

  it('a sample is 45 machine cycles of a 1,048,576 Hz CPU; a frame is 154 lines of 114', () => {
    expect(PCM_CYCLES_PER_SAMPLE).toBe(45);
    expect(MACHINE_CYCLES_PER_SECOND).toBe(4_194_304 / 4);
    expect(MACHINE_CYCLES_PER_FRAME).toBe(154 * 114);
    expect(MACHINE_CYCLES_PER_SECOND / MACHINE_CYCLES_PER_FRAME).toBe(GB_FPS);
    expect(PIKACHU_PCM_HZ).toBe(1_048_576 / 45);
    expect(Math.round(PIKACHU_PCM_HZ * 10)).toBe(233_017);
  });

  it.each([[1, 2327, 47, 46], [4, 4087, 83, 82], [11, 1823, 37, 36], [37, 3575, 73, 72]])(
    'PikachuCry%i: %i bytes miss %i VBlanks, and %i frames are frozen', (number, bytes, missed, frozen) => {
      expect(file(number).length).toBe(bytes);
      expect(clipMissedVBlanks(bytes)).toBe(missed);
      expect(clipFrozenFrames(bytes)).toBe(frozen);
      // The clip ends inside the frame after the last missed VBlank, never on a boundary.
      const frames = bytes * 8 * 45 / 17_556;
      expect(frames).toBeGreaterThan(missed); expect(frames).toBeLessThan(missed + 1);
    });

  it('a clip shorter than a frame misses nothing; the first missed VBlank is the late one, not a frozen frame', () => {
    expect([clipMissedVBlanks(48), clipFrozenFrames(48)]).toEqual([0, 0]); // 17,280 cycles
    expect([clipMissedVBlanks(49), clipFrozenFrames(49)]).toEqual([1, 0]); // 17,640
    expect([clipMissedVBlanks(97), clipFrozenFrames(97)]).toEqual([1, 0]); // 34,920
    expect([clipMissedVBlanks(98), clipFrozenFrames(98)]).toEqual([2, 1]); // 35,280
  });

  it('a committed file decodes to its played bytes; a wrong id, length or spelling throws', () => {
    const clip = decodePikachuClip(file(1), 1);
    expect(clip.id).toBe(0);
    expect(clip.bytes).toHaveLength(2327);
    expect([...clip.bytes.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...clip.bytes.slice(-4)]).toEqual([0xfe, 0x9f, 0xef, 0xfd]);
    expect([...decodePikachuClip({ id: 41, length: 3, samples: 'a50f80' }, 42).bytes]).toEqual([0xa5, 0x0f, 0x80]);
    expect(() => decodePikachuClip(file(1), 11)).toThrow('Pikachu clip 11: the file holds id 0');
    expect(() => decodePikachuClip({ id: 0, length: 2, samples: 'a50f80' }, 1)).toThrow('Pikachu clip 1: 2 bytes expected');
    expect(() => decodePikachuClip({ id: 0, length: 3, samples: 'A50F80' }, 1)).toThrow('Pikachu clip 1: 3 bytes expected');
    expect(() => decodePikachuClip({ id: 0, length: 0, samples: '' }, 1)).toThrow('Pikachu clip 1: 0 bytes expected');
  });
});

describe('the synthesizer\'s PCM source (opening checkpoint-04)', () => {
  const render = (synth: GBSynthesizer, samples: number, rate: number): number[] => {
    const out = new Float32Array(samples);
    synth.render(out, rate);
    return [...out];
  };

  it('plays each bit once at the clip\'s own rate, most significant first, at the wave channel\'s full swing, then stops', () => {
    const synth = new GBSynthesizer();
    expect(synth.pcmPlaying).toBe(false);
    synth.playPcm(Uint8Array.of(0xa5, 0x0f), 1000);
    expect(synth.pcmPlaying).toBe(true);
    const bits = [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1];
    // One channel of four: 15 is +1 and 0 is -1 through the DAC, a quarter each in the mix.
    expect(render(synth, 16, 1000)).toEqual(bits.map(bit => bit ? 0.25 : -0.25));
    expect(synth.pcmPlaying).toBe(true);
    expect(render(synth, 4, 1000)).toEqual([0, 0, 0, 0]);
    expect(synth.pcmPlaying).toBe(false);
  });

  it('holds each sample for the output samples its 45 cycles cover', () => {
    const synth = new GBSynthesizer();
    synth.playPcm(Uint8Array.of(0xa5, 0x0f), 1000);
    // 2.5 output samples a bit: output k plays bit floor(k / 2.5).
    const bits = [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1];
    const out = render(synth, 44, 2500);
    expect(out.slice(0, 40)).toEqual(Array.from({ length: 40 }, (_, k) => bits[Math.floor(k / 2.5)] ? 0.25 : -0.25));
    expect(out.slice(40)).toEqual([0, 0, 0, 0]);
  });

  it('PikachuCry1 lasts 18,616 samples of 45 cycles: 0.799 s, 38,348 output samples at 48 kHz', () => {
    const synth = new GBSynthesizer();
    const clip = decodePikachuClip(file(1), 1);
    synth.playPcm(clip.bytes, PIKACHU_PCM_HZ);
    const out = render(synth, 40_000, 48_000);
    const played = out.findIndex(value => value === 0);
    expect(out.slice(played).every(value => value === 0)).toBe(true);
    expect(clip.bytes.length * 8).toBe(18_616);
    expect(Math.abs(played - 18_616 * 45 / 1_048_576 * 48_000)).toBeLessThan(1.5);
    expect(played).toBeGreaterThanOrEqual(38_347); expect(played).toBeLessThanOrEqual(38_349);
    expect(synth.pcmPlaying).toBe(false);
  });

  it('replaces the wave channel while it plays, whatever that channel\'s routing; the pulse channels keep sounding', () => {
    const synth = new GBSynthesizer();
    synth.setWaveInstrument(Array.from({ length: 32 }, (_, step) => step & 15));
    synth.setWaveVolume(1); synth.setWaveFrequency(1000);
    synth.setPulseVolume(0, 15); synth.setPulseDuty(0, 2); synth.setPulseFrequency(0, 1000);
    const pulse = (k: number): number => { // 50 % duty at an eighth of a cycle per output sample, phase advanced first
      const step = (k + 1) & 7;
      return [1, 0, 0, 0, 0, 1, 1, 1][step] ? 1 : -1;
    };
    synth.setChannelOutput(2, false); // the clip ORs both of channel 3's bits into rAUDTERM
    synth.playPcm(Uint8Array.of(0xf0), 8000);
    const during = render(synth, 8, 8000);
    expect(during).toEqual([1, 1, 1, 1, -1, -1, -1, -1].map((pcm, k) => (pulse(k) + pcm) * 0.25));
    // After the last sample the wave channel is the wave channel again (muted here by its routing bit).
    const after = render(synth, 8, 8000);
    expect(synth.pcmPlaying).toBe(false);
    expect(after).toEqual(Array.from({ length: 8 }, (_, k) => pulse(k + 8) * 0.25));
    synth.setChannelOutput(2, true);
    expect(render(synth, 8, 8000).some((value, k) => value !== pulse(k + 16) * 0.25)).toBe(true);
  });

  it('a second clip replaces the one that is playing', () => {
    const synth = new GBSynthesizer();
    synth.playPcm(Uint8Array.of(0xff, 0xff), 1000);
    expect(render(synth, 3, 1000)).toEqual([0.25, 0.25, 0.25]);
    synth.playPcm(Uint8Array.of(0x00), 1000);
    expect(render(synth, 10, 1000)).toEqual([...Array<number>(8).fill(-0.25), 0, 0]);
  });
});
