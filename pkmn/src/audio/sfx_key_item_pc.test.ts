// A5b3: cartridge-derived note starts, frequency registers and sound_ret updates.
// Source: audio/sfx/*_1.asm, audio/notes.asm and Audio1_note_length/CalculateFrequency.
// Envelopes remain an A1a/V5 departure; these tests do not pin their software steps.

import { describe, it, expect } from 'vitest';
import { rig, sfxData, musicData } from '../test/audio_rig';
import { soundFinished } from './sound_wait';

// Music-mode lengths are note length × speed 5, at SFX tempo $0100.
// Registers: 2048 + (signed16(notes.asm[pitch]) >> (octave - 1)); ch5 adds 1 to its low byte.
const KEY_ITEM = [
  { hw: 0, method: 'duty0', starts: [1, 21, 31, 36, 41, 61, 71, 76, 81],
    registers: [0x6e7, 0x706, 0x706, 0x706, 0x72e, 0x745, 0x745, 0x745, 0x774] },
  { hw: 1, method: 'duty1', starts: [1, 11, 16, 21, 41, 51, 56, 61, 71, 76, 81],
    registers: [0x758, 0x758, 0x758, 0x72d, 0x762, 0x762, 0x762, 0x773, 0x773, 0x773, 0x796] },
  { hw: 2, method: 'wave', starts: [1, 21, 41, 61, 81],
    registers: [0x72d, 0x762, 0x758, 0x744, 0x72d] },
] as const;

// square_note lasts length + 1 updates. Frequencies, including silent zero notes,
// are the raw registers from the source, not pitches resolved by the music table.
const PC_SOUNDS = [
  { name: 'turn_on_pc', starts: [1, 17, 33, 37, 41, 45, 49, 53, 57, 61],
    registers: [0x7c0, 0, 0x780, 0x700, 0x740, 0x700, 0x780, 0x700, 0x7c0, 0x700], end: 70 },
  { name: 'turn_off_pc', starts: [1, 6, 11, 16],
    registers: [0x600, 0x400, 0x200, 0], end: 18 },
  { name: 'enter_pc', starts: [1, 8, 13, 20],
    registers: [0x700, 0, 0x700, 0], end: 22 },
] as const;

describe('get_key_item: three channels, each 120 updates (A5b3)', () => {
  for (const channel of KEY_ITEM) {
    it(`channel ${channel.hw + 5}: source note starts and sound_ret on update 121`, () => {
      const r = rig();
      r.sfx.play(sfxData('get_key_item'));
      r.run(120);
      expect(r.synth.at(channel.method)).toEqual(channel.starts);
      expect(r.sfx.isChannelActive(channel.hw)).toBe(true);
      r.update();
      expect(r.sfx.isChannelActive(channel.hw)).toBe(false);
      expect(r.synth.at(`silence${channel.hw}`)).toEqual([121]);
      expect(r.sfx.isPlaying()).toBe(false);
    });
  }

  it('ch5 writes perfect-pitch registers on pulse 1, including A#3 $6e6 + 1', () => {
    const r = rig();
    r.sfx.play(sfxData('get_key_item'));
    r.run(121);
    expect(r.synth.values('freq0')).toEqual(KEY_ITEM[0].starts.map((u, i) => [u, KEY_ITEM[0].registers[i]]));
  });

  it('ch6 writes pulse 2 and ch7 writes the wave channel without perfect pitch', () => {
    const r = rig();
    r.sfx.play(sfxData('get_key_item'));
    r.run(121);
    for (const channel of [KEY_ITEM[1], KEY_ITEM[2]]) {
      // The first frequency write at a note start is its base pitch. Vibrato writes
      // additional frequencies between those starts, without retriggering the note.
      const writes = r.synth.values(`freq${channel.hw}`);
      expect(channel.starts.map(u => writes.find(([update]) => update === u))).toEqual(
        channel.starts.map((u, i) => [u, channel.registers[i]]),
      );
    }
    expect(r.synth.values('freq1')).toContainEqual([9, 0x759]);
    expect(r.synth.at('noise')).toEqual([]);
  });
});

describe('PC sounds: pulse 1 square_notes (A5b3)', () => {
  for (const sound of PC_SOUNDS) {
    it(`${sound.name}: source note starts/registers and sound_ret on update ${sound.end}`, () => {
      const r = rig();
      r.sfx.play(sfxData(sound.name));
      r.run(sound.end - 1);
      expect(r.sfx.isChannelActive(0)).toBe(true);
      r.update();
      expect(r.sfx.isPlaying()).toBe(false);
      expect(r.synth.values('freq0')).toEqual(sound.starts.map((u, i) => [u, sound.registers[i]]));
      expect(r.synth.at('silence0')).toEqual([sound.end]);
      expect(r.synth.log.some(w => ['freq1', 'duty1', 'vol1', 'silence1',
        'freq2', 'wave', 'level2', 'silence2', 'noise'].includes(w.m))).toBe(false);
    });
  }
});

describe('sound waits and music hand-off (A5b3)', () => {
  it('WaitForSoundToFinish returns on 121 / 70 / 18 / 22 for the four sounds', () => {
    for (const sound of [{ name: 'get_key_item', end: 121 }, ...PC_SOUNDS]) {
      const r = rig();
      r.sfx.play(sfxData(sound.name));
      r.run(sound.end - 1);
      expect(soundFinished(r.sfx, r.music, 0), sound.name).toBe(false);
      r.update();
      expect(soundFinished(r.sfx, r.music, 0), sound.name).toBe(true);
    }
  });

  it('the key-item jingle preserves Forest tempo and leaves music silent until its next note', () => {
    // Music_Dungeon2 (Viridian Forest) begins at tempo 144, speed 12.
    // A four-beat note lasts 48 × 144 / 256 = 27 updates on ch1/ch2.
    // Wave .sub2 lengths are 2,4,1,3,1,1,4 (108 updates per call),
    // so its second call's four-beat rest runs from 122 through 148.
    // Start SFX after update 1: it returns at global update 122. The next
    // ch1/ch2 notes are at 136; wave's next note is at 149.
    const r = rig(musicData('dungeon2'));
    const uninterrupted = rig(musicData('dungeon2'));
    r.update();
    uninterrupted.update();
    expect(r.music.musicTempo).toBe(144);
    r.sfx.play(sfxData('get_key_item'));
    for (let i = 0; i < 121; i++) { r.update(); uninterrupted.update(); }
    expect(r.music.musicTempo).toBe(144);
    expect(r.sfx.isPlaying()).toBe(false);
    for (const id of [1, 2, 3]) {
      expect(r.music.getChannel(id)!.released).toBe(true);
      expect(r.music.getChannel(id)!.pc).toBe(uninterrupted.music.getChannel(id)!.pc);
      expect(r.music.getChannel(id)!.noteDelayCounter).toBe(uninterrupted.music.getChannel(id)!.noteDelayCounter);
    }
    expect(r.synth.pulse.map(ch => ch.enabled)).toEqual([false, false]);
    expect(r.synth.wave.enabled).toBe(false);
    r.synth.log = [];
    r.run(13); // through update 135, before the first music note/rest
    expect(r.synth.at('duty0')).toEqual([]);
    expect(r.synth.at('duty1')).toEqual([]);
    expect(r.synth.at('wave')).toEqual([]);
    expect(r.synth.pulse.map(ch => ch.enabled)).toEqual([false, false]);
    expect(r.synth.wave.enabled).toBe(false);
    r.update(); // update 136: pulse notes resume, wave stays in its rest
    expect(r.synth.at('duty0')).toEqual([136]);
    expect(r.synth.at('duty1')).toEqual([136]);
    expect(r.synth.wave.enabled).toBe(false);
    r.run(12); // through update 148: the wave has not restarted
    expect(r.synth.at('wave')).toEqual([]);
    expect(r.synth.wave.enabled).toBe(false);
    r.update(); // update 149: the wave resumes with the music's instrument
    expect(r.synth.values('wave')).toEqual([[149, 3]]);
    expect(r.synth.wave.enabled).toBe(true);
  });
});
