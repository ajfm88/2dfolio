// The shared channel interpreter against audio/engine_1.asm (A1a, notes/a1a-plan.md §6
// checkpoint 3). Each test drives the real engines one audio update at a time and reads
// the register writes they make (src/test/audio_rig.ts).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { SoundChannel, perfectPitchRegister } from './sound_channel';
import { registerToHz, waveRegisterToHz } from './frequency_table';
import { rig, track, sfxData, musicData } from '../test/audio_rig';
import type { MusicCommand } from './music_engine';

const C_ = 0, D_ = 2, A_SHARP = 10;
const noteType = (speed: number, volume: number, fade: number): MusicCommand => ({ cmd: 'note_type', speed, volume, fade });
const octave = (value: number): MusicCommand => ({ cmd: 'octave', value });
const note = (pitch: number, length: number): MusicCommand => ({ cmd: 'note', pitch, length });
const rest = (length: number): MusicCommand => ({ cmd: 'rest', length });
const vibrato = (delay: number, depth: number, rate: number): MusicCommand => ({ cmd: 'vibrato', delay, depth, rate });
const tempo = (value: number): MusicCommand => ({ cmd: 'tempo', value });
const RET: MusicCommand = { cmd: 'sound_ret' };

afterEach(() => vi.restoreAllMocks());

describe('channels by id, the wave octave, perfect pitch (get_item1, update 1)', () => {
  it('CHAN5 → pulse 1, CHAN6 → pulse 2, CHAN7 → wave, with G#3 raised by perfect pitch', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item1'));
    r.update();
    // notes.asm via Audio1_CalculateFrequency: G#3 $06c4, +1 (toggle_perfect_pitch); E4 $0739; B4 $077b
    expect(r.synth.values('freq0')).toEqual([[1, 0x06c5]]);
    expect(r.synth.values('freq1')).toEqual([[1, 0x0739]]);
    expect(r.synth.values('freq2')).toEqual([[1, 0x077b]]);
  });

  it('the wave channel sounds an octave below a pulse at the same register (65536 / (2048 − x))', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item1'));
    r.update();
    expect(r.synth.wave.frequency).toBeCloseTo(65536 / (2048 - 0x077b), 9);
    expect(waveRegisterToHz(0x077b)).toBeCloseTo(registerToHz(0x077b) / 2, 9);
  });

  it('perfect pitch adds 1 to the low byte only: $ff wraps to $00 without a carry', () => {
    expect(perfectPitchRegister(0x06c4)).toBe(0x06c5);
    expect(perfectPitchRegister(0x07ff)).toBe(0x0700);
  });

  it('a track with only channel 3 writes the wave channel, not pulse 1', () => {
    const r = rig(track(3, [noteType(12, 1, 0), octave(4), note(C_, 4), RET]));
    r.update();
    expect(r.synth.values('freq2')).toEqual([[1, 0x0705]]);
    expect(r.synth.at('freq0')).toEqual([]);
  });
});

describe('vibrato (engine_1.asm 79–142, 393–439)', () => {
  it('waits out its delay, then vibrates every rate + 1 updates, up first, ±⌈n/2⌉/⌊n/2⌋', () => {
    // delay 2: updates 2–3 count it down; rate 3: the counter runs 3→0 on updates 4–6,
    // the first vibration is update 7, then every 4 updates
    const r = rig(track(1, [noteType(12, 10, 0), octave(4), vibrato(2, 2, 3), note(C_, 16), RET]));
    r.run(20);
    expect(r.synth.values('freq0')).toEqual([
      [1, 0x0705], [7, 0x0706], [11, 0x0704], [15, 0x0706], [19, 0x0704],
    ]);
  });

  it('rate 0 vibrates every update (the battle themes\' channel 3: vibrato 0, 2, 0)', () => {
    const r = rig(track(3, [noteType(12, 1, 0), octave(4), vibrato(0, 2, 0), note(C_, 16), RET]));
    r.run(5);
    expect(r.synth.values('freq2')).toEqual([[1, 0x0705], [2, 0x0706], [3, 0x0704], [4, 0x0706], [5, 0x0704]]);
  });

  it('moves the low byte only, clamped at $ff and $00 (depth 15: +8 / −7)', () => {
    // A#8 = $07f7, $07f8 with perfect pitch: +8 clamps to $ff
    const high = rig(track(1, [noteType(12, 10, 0), { cmd: 'toggle_perfect_pitch' }, octave(8),
      vibrato(0, 15, 0), note(A_SHARP, 16), RET]));
    high.run(3);
    expect(high.synth.values('freq0')).toEqual([[1, 0x07f8], [2, 0x07ff], [3, 0x07f1]]);
    // C4 = $0705: −7 clamps to $00
    const low = rig(track(1, [noteType(12, 10, 0), octave(4), vibrato(0, 15, 0), note(C_, 16), RET]));
    low.run(3);
    expect(low.synth.values('freq0')).toEqual([[1, 0x0705], [2, 0x070d], [3, 0x0700]]);
  });

  it('keeps its direction across notes (BIT_VIBRATO_DIRECTION is reset only at play)', () => {
    // Note 1 (updates 1–4) vibrates up, down, up; note 2's first vibration goes down
    const r = rig(track(1, [noteType(1, 10, 0), octave(4), vibrato(0, 2, 0), note(C_, 4), note(C_, 4), RET]));
    r.run(6);
    expect(r.synth.values('freq0')).toEqual([
      [1, 0x0705], [2, 0x0706], [3, 0x0704], [4, 0x0706], [5, 0x0705], [6, 0x0704],
    ]);
  });
});

describe('note length (Audio1_note_length 700–746, Audio1_MultiplyAdd)', () => {
  it('a delay that computes to 0 lasts 256 updates (the counter is a byte)', () => {
    // tempo 1, speed 1, length 1: 1 × 1 = 1 → delay 0, fraction 1
    const r = rig(track(1, [tempo(1), noteType(1, 10, 0), octave(4), note(C_, 1), note(D_, 1), RET]));
    r.run(300);
    expect(r.synth.at('duty0')).toEqual([1, 257]);
  });

  it('the product is 16 bits: 240 × 300 wraps to 6464, a delay of 25', () => {
    const r = rig(track(1, [tempo(300), noteType(15, 10, 0), octave(4), note(C_, 16), note(D_, 1), RET]));
    r.run(40);
    expect(r.synth.at('duty0')).toEqual([1, 26]);
  });

  it('a music tempo command clears the channels\' fractions', () => {
    // tempo 384, speed 1, length 1: delays 1 (fraction 128), 2 (0), 1 (128), then the
    // second tempo clears the fraction, so the next is 1 again (not 2)
    const cmds = (secondTempo: boolean): MusicCommand[] => [
      tempo(384), noteType(1, 10, 0), octave(4), note(C_, 1), note(C_, 1), note(C_, 1),
      ...(secondTempo ? [tempo(384)] : []), note(C_, 1), note(C_, 1), RET,
    ];
    const cleared = rig(track(1, cmds(true)));
    cleared.run(8);
    expect(cleared.synth.at('duty0')).toEqual([1, 2, 4, 5, 6]);
    const kept = rig(track(1, cmds(false)));
    kept.run(8);
    expect(kept.synth.at('duty0')).toEqual([1, 2, 4, 5, 7]);
  });

  it('no track ever computes a zero delay (so the byte counter changes nothing today)', () => {
    const results: number[] = [];
    const proto = SoundChannel.prototype as unknown as { noteLength(length: number): number };
    const original = proto.noteLength;
    vi.spyOn(proto, 'noteLength').mockImplementation(function (this: SoundChannel, length: number) {
      const d = original.call(this, length);
      results.push(d);
      return d;
    });
    const dir = resolve(__dirname, '../../data/audio/music');
    for (const f of readdirSync(dir)) {
      if (f === 'pokefluteinbattle.json') continue; // not a track (STATUS: E1)
      const r = rig(musicData(f.replace('.json', '')));
      r.run(60 * 180);
    }
    expect(results.length).toBeGreaterThan(50_000);
    expect(results.filter(d => d === 0)).toEqual([]);
  });
});

describe('rests and the envelope', () => {
  it('a rest stays silent: the fade of the note before it no longer turns it back on', () => {
    // A slow fade (pace 7) is still at volume 11 when the rest comes on update 13
    const r = rig(track(1, [noteType(12, 12, 7), { cmd: 'duty_cycle', value: 2 }, octave(4), note(C_, 1), rest(4), RET]));
    const on: boolean[] = [];
    for (let u = 1; u <= 60; u++) { r.update(); on.push(r.synth.pulse[0].enabled); }
    expect(on.slice(0, 12).every(Boolean)).toBe(true);
    expect(on.slice(12).some(Boolean)).toBe(false);
  });
});

describe('an SFX over the music: suppression, tempo, hand-off (Viridian Forest + get_item1)', () => {
  it('suppressed music channels write nothing and run no effects; the drums play on', () => {
    const r = rig(musicData('dungeon2'));
    r.run(60);
    const ch1 = r.music.getChannel(1)!;
    const before = { rates: ch1.vibratoRates, dir: ch1.vibratoDirection, freq: ch1.freqReg, env: ch1.envVolume };
    r.sfx.play(sfxData('get_item1'));
    r.run(72); // updates 61–132: the jingle's 1–72
    const during = (m: string): [number, number][] => r.synth.values(m).filter(([u]) => u > 60 && u <= 132);
    // Pulse 1 carries the jingle's channel 5 only. Perfect pitch raises every note (G#3
    // $06c5, E4 $073a). Vibrato 6,2,6 never fires within an 8-update G# note, but each
    // runs the rate counter down once (notes reload the delay, not the rate), so E4's
    // first vibration is jingle update 35, then every 7: ±1 around $073a.
    expect(during('freq0').map(([u, reg]) => [u - 60, reg])).toEqual([
      [1, 0x06c5], [9, 0x06c5], [17, 0x06c5], [25, 0x073a],
      [35, 0x073b], [42, 0x0739], [49, 0x073b], [56, 0x0739], [63, 0x073b], [70, 0x0739],
    ]);
    expect({ rates: ch1.vibratoRates, dir: ch1.vibratoDirection, freq: ch1.freqReg, env: ch1.envVolume }).toEqual(before);
    expect(during('noise').length).toBeGreaterThan(0);
  });

  it('the jingle\'s tempo 256 never reaches the music (tempo 144), whose timing is untouched', () => {
    const plain = rig(musicData('dungeon2'));
    const withJingle = rig(musicData('dungeon2'));
    plain.run(60);
    withJingle.run(60);
    withJingle.sfx.play(sfxData('get_item1'));
    plain.run(340);
    withJingle.run(340);
    expect(withJingle.music.musicTempo).toBe(144);
    for (const id of [1, 2, 3, 4]) {
      const a = plain.music.getChannel(id)!;
      const b = withJingle.music.getChannel(id)!;
      expect([b.pc, b.noteDelayCounter, b.noteDelayFractional]).toEqual([a.pc, a.noteDelayCounter, a.noteDelayFractional]);
    }
  });

  it('after the jingle, pulse 1 stays silent until the music\'s next note or rest', () => {
    const r = rig(musicData('dungeon2'));
    r.run(60);
    r.sfx.play(sfxData('get_item1'));
    r.run(72); // the jingle reads sound_ret on update 132 (its 73rd)
    r.update();
    expect(r.sfx.isChannelActive(0)).toBe(false);
    const enabled: [number, boolean][] = [];
    for (let i = 0; i < 200; i++) { r.update(); enabled.push([r.synth.update, r.synth.pulse[0].enabled]); }
    const firstTrigger = r.synth.log.find(w => w.u > 133 && (w.m === 'duty0' || w.m === 'silence0'))!.u;
    expect(enabled.filter(([u, on]) => u < firstTrigger && on)).toEqual([]);
    expect(r.synth.values('vol0').filter(([u]) => u > 133 && u < firstTrigger)).toEqual([]);
  });
});

describe('the hand-off on a wave channel and the update order', () => {
  // The music's channel 3: wave instrument 3, a note every 12 updates (1, 13, 25, …)
  const bass = (): ReturnType<typeof rig> =>
    rig(track(3, [noteType(12, 1, 3), octave(3), { cmd: 'sound_loop', count: 0, target: 3 }, note(C_, 1), { cmd: 'sound_loop', count: 0, target: 3 }]));

  it('music before SFX: the music note on the update the jingle ends is still suppressed', () => {
    const r = bass();
    r.run(12);
    r.sfx.play(sfxData('get_item1')); // its updates 1–73 are 13–85
    r.run(73);
    // The music's notes at 13 … 85 wrote nothing (its instrument is 3, the jingle's 0).
    // 85 is the jingle's last update: with SFX first, that music note would have sounded.
    expect(r.synth.values('wave').filter(([u, w]) => u > 12 && u <= 85 && w === 3)).toEqual([]);
    expect(r.synth.wave.enabled).toBe(false);
  });

  it('the music\'s next note reloads its own wave instrument (3), not the jingle\'s (0)', () => {
    const r = bass();
    r.run(12);
    r.sfx.play(sfxData('get_item1'));
    r.run(73 + 12);
    expect(r.synth.values('wave').filter(([u]) => u > 85)).toEqual([[97, 3]]);
    expect(r.synth.wave.enabled).toBe(true);
  });
});
