// The item jingles as music-mode SFX, WaitForSoundToFinish, drums on software channel 8
// and the SFX-mode sounds (A1a, notes/16-a1a-plan.md §6 checkpoint 4).

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { soundFinished } from './sound_wait';
import { EXTRACTED_SFX } from './sfx_names';
import { rig, track, sfxData } from '../test/audio_rig';
import type { MusicCommand } from './music_engine';
import type { SfxData } from './sfx_engine';

const C_ = 0;
const drums = (speed: number, hits: [number, number][]): MusicCommand[] => [
  { cmd: 'drum_speed', speed },
  ...hits.map(([instrument, length]): MusicCommand => ({ cmd: 'drum_note', instrument, length })),
  { cmd: 'sound_ret' },
];

describe('get_item1 (audio/sfx/get_item1_1.asm): 72 updates on every channel', () => {
  // SFX tempo $0100 (Audio1_SetSfxTempo), so a note lasts length × speed updates:
  // speed 4 → 8, 8, 8; speed 12 → 48 (ch5, ch6); ch7 4-update notes and rests, then 24 + 24.
  // PlaySound leaves each delay counter at 1, so the first note plays on update 1.
  it('notes start on updates 1, 9, 17, 25 and every channel reads sound_ret on update 73', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item1'));
    r.run(72);
    expect(r.sfx.isChannelActive(0) && r.sfx.isChannelActive(1) && r.sfx.isChannelActive(2)).toBe(true);
    r.update();
    expect([0, 1, 2, 3].some(hw => r.sfx.isChannelActive(hw))).toBe(false);
    expect(r.synth.at('duty0')).toEqual([1, 9, 17, 25]);
    expect(r.synth.at('duty1')).toEqual([1, 9, 17, 25]);
    expect(r.synth.at('wave')).toEqual([1, 9, 17, 25]);
    // ch7's rests (Audio1_note_pitch: disable channel 3), and its end on update 73
    expect(r.synth.at('silence2')).toEqual([5, 13, 21, 49, 73]);
  });
});

describe('get_item2 (audio/sfx/get_item2_1.asm): 180 updates on every channel', () => {
  it('speed 5: 20, 20, 40, six of 10, 40; ch7\'s 5-update notes and rests; sound_ret on update 181', () => {
    const r = rig();
    r.sfx.play(sfxData('get_item2'));
    r.run(180);
    expect(r.sfx.isPlaying()).toBe(true);
    r.update();
    expect(r.sfx.isPlaying()).toBe(false);
    const starts = [1, 21, 41, 81, 91, 101, 111, 121, 131, 141];
    expect(r.synth.at('duty0')).toEqual(starts);
    expect(r.synth.at('duty1')).toEqual(starts);
    expect(r.synth.at('wave')).toEqual(starts);
    expect(r.synth.at('silence2')).toEqual([86, 96, 106, 116, 126, 136, 181]);
  });
});

describe('WaitForSoundToFinish (home/delay.asm): channels 5, 6 and 8, not 7', () => {
  it('finishes on the update the jingle reads sound_ret: 73 for get_item1, 181 for get_item2', () => {
    for (const [name, end] of [['get_item1', 73], ['get_item2', 181]] as const) {
      const r = rig();
      r.sfx.play(sfxData(name));
      r.run(end - 1);
      expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
      r.update();
      expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    }
  });

  it('skips channel 7: a sound whose channel 7 outlasts 5 finishes when 5 does', () => {
    const sound: SfxData = { channels: [
      { id: 5, commands: [{ cmd: 'execute_music' }, { cmd: 'note_type', speed: 1, volume: 10, fade: 0 },
        { cmd: 'octave', value: 4 }, { cmd: 'note', pitch: C_, length: 4 }, { cmd: 'sound_ret' }] },
      { id: 7, commands: [{ cmd: 'execute_music' }, { cmd: 'note_type', speed: 1, volume: 1, fade: 0 },
        { cmd: 'octave', value: 4 }, { cmd: 'note', pitch: C_, length: 16 }, { cmd: 'sound_ret' }] },
    ] };
    const r = rig();
    r.sfx.play(sound);
    r.run(4);
    expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
    r.update(); // update 5: channel 5 reads sound_ret
    expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    expect(r.sfx.isChannelActive(2)).toBe(true);
  });

  it('a drum hit on channel 8 on the jingle\'s last update holds the wait one update more', () => {
    // Music channel 4: instrument 1 (one noise_note of length 0: 1 update on channel 8)
    // every 12 × 6 = 72 updates: hits on 1, 73, 145
    const r = rig(track(4, drums(12, [[1, 6], [1, 6], [1, 6]])));
    r.sfx.play(sfxData('get_item1'));
    r.run(73);
    expect(r.sfx.isPlaying()).toBe(false);
    expect(r.music.channel8DrumBusy).toBe(true);
    expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
    r.update();
    expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
  });

  it('a real SFX on channel 8 counts; a sound still loading counts', () => {
    const r = rig();
    r.sfx.play(sfxData('start_menu'));
    r.update();
    expect(soundFinished(r.sfx, r.music, 0)).toBe(false);
    for (let i = 0; i < 300 && r.sfx.isChannelActive(3); i++) r.update();
    expect(soundFinished(r.sfx, r.music, 0)).toBe(true);
    expect(soundFinished(r.sfx, r.music, 1)).toBe(false);
    expect(soundFinished(null, null, 0)).toBe(true);
  });
});

describe('drums occupy software channel 8 (Audio1_PlaySound 1425–1436)', () => {
  // Instrument 5: six noise_notes of lengths 7…2, so 8 + 7 + 6 + 5 + 4 + 3 = 33 updates
  it('a drum hit while channel 8 is busy is dropped; the next one after it frees plays', () => {
    // Hits on updates 1 (instrument 5), 5, 21 and 37 (instrument 1: param 51, volume 12)
    const r = rig(track(4, drums(1, [[5, 4], [1, 16], [1, 16], [1, 16]])));
    r.run(40);
    const instrument1 = r.synth.log.filter(w => w.m === 'noise' && w.a[0] === 51 && w.a[1] === 12).map(w => w.u);
    expect(instrument1).toEqual([37]);
  });

  it('a real SFX on channel 8 replaces a drum hit (cancelDrum)', () => {
    const r = rig(track(4, drums(1, [[5, 40]])));
    r.update();
    expect(r.music.channel8DrumBusy).toBe(true);
    r.music.cancelDrum();
    expect(r.music.channel8DrumBusy).toBe(false);
    expect(r.music.getChannel(4)!.drumNoteActive).toBe(false);
  });
});

describe('SFX-mode sounds and the hand-off', () => {
  it('press_ab keeps its frame timing: notes on 1–4, the last for 13 updates, sound_ret on 17', () => {
    // square_note 0 (1 update) ×3, then square_note 12 (13 updates), tempo $0100
    const r = rig();
    r.sfx.play(sfxData('press_ab'));
    r.run(16);
    expect(r.sfx.isChannelActive(0)).toBe(true);
    r.update();
    expect(r.sfx.isChannelActive(0)).toBe(false);
    expect(r.synth.at('freq0')).toEqual([1, 2, 3, 4]);
  });

  it('an SFX stopped by another hands its channels back, as an ending one does', () => {
    const r = rig({ channels: [
      { id: 1, commands: [{ cmd: 'note_type', speed: 12, volume: 10, fade: 0 }, { cmd: 'octave', value: 4 },
        { cmd: 'note', pitch: C_, length: 16 }, { cmd: 'sound_ret' }] },
      { id: 2, commands: [{ cmd: 'note_type', speed: 12, volume: 10, fade: 0 }, { cmd: 'octave', value: 4 },
        { cmd: 'note', pitch: C_, length: 16 }, { cmd: 'sound_ret' }] },
    ] });
    const released: number[] = [];
    r.sfx.onChannelDone = hw => { released.push(hw); r.music.releaseChannel(hw); };
    r.update();
    r.sfx.play(sfxData('get_item1'));
    r.run(10);
    r.sfx.play(sfxData('press_ab')); // replaces the jingle (channel 5 only)
    expect(released).toEqual([0, 1, 2]);
    r.update();
    // Music channel 2 is no longer suppressed, but holds no note: silent until its next one
    expect(r.music.getChannel(2)!.released).toBe(true);
    expect(r.synth.pulse[1].enabled).toBe(false);
  });
});

describe('the SFX preload list', () => {
  it('is exactly the SFX setup extracts (data/audio/sfx/)', () => {
    const files = readdirSync(resolve(__dirname, '../../data/audio/sfx')).map(f => f.replace(/\.json$/, '')).sort();
    expect([...EXTRACTED_SFX].sort()).toEqual(files);
  });
});
