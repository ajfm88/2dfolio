import { describe, expect, it, vi } from 'vitest';
import { rig, musicData, sfxData, track } from '../test/audio_rig';
import { GBSynthesizer } from './synthesizer';

describe('FadeOutAudio / StopAllMusic (note 59 CP2)', () => {
  it('keeps four updates, steps every five, and stops/restores $77 on update 40 exactly', () => {
    const r = rig(musicData('pokecenter'));
    r.update(); // interpret the track's initial volume command before requesting the fade
    r.synth.log = [];
    r.fade.fadeOutAndStopMusic(4);
    const expected = [
      ...Array(4).fill(0x77),
      ...[0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0].flatMap(v => Array(5).fill(v)),
      0x77,
    ];
    for (const [i, volume] of expected.entries()) {
      r.update();
      expect(r.synth.masterVolumeRegister, `fade update ${i + 1}`).toBe(volume);
      expect(r.fade.isFadingOut(), `fade update ${i + 1}`).toBe(i < 39);
      expect(r.music.isPlaying(), `fade update ${i + 1}`).toBe(i < 39);
    }
    expect(r.synth.log.filter(w => w.m === 'master').map(w => [w.u - 1, ...w.a])).toEqual([
      [5, 6, 6], [10, 5, 5], [15, 4, 4], [20, 3, 3], [25, 2, 2], [30, 1, 1],
      [35, 0, 0], [40, 7, 7],
    ]);
    r.update();
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('stops every SFX channel before the completion update can interpret a note', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.fade.fadeOutAndStopMusic(4); r.run(39);
    // A still-active sound when completion occurs; include all four hardware channels.
    r.sfx.play({ channels: [...sfxData('get_key_item').channels, {
      id: 8, commands: [{ cmd: 'noise_note', length: 15, volume: 15, fade: 0, param: 0x35 }, { cmd: 'sound_ret' }],
    }] });
    expect([0, 1, 2, 3].map(hw => r.sfx.isChannelActive(hw))).toEqual([true, true, true, true]);
    r.synth.log = []; r.update();
    expect(r.sfx.isPlaying()).toBe(false);
    expect([0, 1, 2, 3].some(hw => r.sfx.isChannelActive(hw))).toBe(false);
    expect(r.synth.log.some(w => w.m.startsWith('freq') || w.m === 'noise')).toBe(false);
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('clears existing SFX on the request but continues the music during the fade', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.sfx.play(sfxData('get_key_item')); r.update();
    r.fade.fadeOutAndStopMusic(4);
    expect(r.sfx.isPlaying()).toBe(false);
    expect(r.music.isPlaying()).toBe(true);
    expect(r.fade.isFadingOut()).toBe(true);
  });

  it('stops immediately without music, including SFX, and restores $77 without waiting', () => {
    const r = rig(); r.sfx.play(sfxData('get_key_item')); r.update();
    r.synth.setMasterVolume(3, 3);
    r.fade.fadeOutAndStopMusic(4);
    expect(r.fade.isFadingOut()).toBe(false);
    expect(r.sfx.isPlaying()).toBe(false);
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('a second stop cancels a queued fade immediately (wLastMusicSoundID is already $ff)', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.fade.fadeOutAndStopMusic(4); r.run(5);
    expect(r.synth.masterVolumeRegister).toBe(0x66);
    r.fade.fadeOutAndStopMusic(4);
    expect(r.fade.isFadingOut()).toBe(false);
    expect(r.music.isPlaying()).toBe(false);
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('control zero stops immediately, without a counter underflow', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.fade.fadeOutAndStopMusic(0);
    expect(r.fade.isFadingOut()).toBe(false);
    expect(r.music.isPlaying()).toBe(false);
  });

  it('reads the current NR50 and honors a reload of one', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.synth.setMasterVolume(3, 3); r.fade.fadeOutAndStopMusic(1);
    r.run(7);
    expect(r.synth.masterVolumeRegister).toBe(0);
    expect(r.fade.isFadingOut()).toBe(true);
    r.update(); // (3 steps + completion) * (reload 1 + 1) = 8
    expect(r.music.isPlaying()).toBe(false);
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('leaves StatusScreen volume alone on idle updates and after a completed fade', () => {
    const r = rig(track(1, [{ cmd: 'note_type', speed: 12, volume: 10, fade: 0 },
      { cmd: 'note', pitch: 0, length: 16 }, { cmd: 'sound_ret' }]));
    r.update(); r.synth.setMasterVolume(3, 3); r.run(20);
    expect(r.synth.masterVolumeRegister).toBe(0x33);
    r.fade.fadeOutAndStopMusic(4); r.run(20); // three levels plus completion
    expect(r.fade.isFadingOut()).toBe(false);
    r.synth.setMasterVolume(3, 3); r.run(5);
    expect(r.synth.masterVolumeRegister).toBe(0x33);
  });

  it('retains the source DEC/OR underflow if one side reaches zero before the other', () => {
    const r = rig(musicData('pokecenter')); r.update();
    r.synth.setMasterVolume(3, 0); r.fade.fadeOutAndStopMusic(1); r.run(2);
    expect(r.synth.masterVolumeRegister).toBe(0xff); // low-nibble DEC 0 -> $ff dominates OR
    r.run(30); expect(r.synth.masterVolumeRegister).toBe(0);
    expect(r.fade.isFadingOut()).toBe(true);
    r.run(2); expect(r.fade.isFadingOut()).toBe(false);
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('waits on a playing track latch even if its music channels have finished', () => {
    const r = rig(musicData('pkmnhealed')); r.run(136);
    expect(r.music.getChannel(1)?.active).toBe(false);
    r.fade.fadeOutAndStopMusic(4);
    expect(r.fade.isFadingOut()).toBe(true);
    r.run(39); expect(r.music.isPlaying()).toBe(true);
    r.update(); expect(r.music.isPlaying()).toBe(false);
  });

  it('NR50 uses (n+1)/8, including zero, half, full and asymmetric output levels', () => {
    const synth = new GBSynthesizer();
    const setValueAtTime = vi.fn();
    // Observe the real setter's Web Audio write without starting an audio device.
    Object.assign(synth, { ctx: { currentTime: 12 }, masterGainNode: { gain: { setValueAtTime } } });
    for (const [left, right, gain] of [[0, 0, 0.0625], [3, 3, 0.25], [7, 7, 0.5], [0, 7, 0.28125], [15, 15, 0.5]]) {
      synth.setMasterVolume(left, right);
      expect(setValueAtTime).toHaveBeenLastCalledWith(gain, 12);
      expect(synth.masterVolumeRegister).toBe((left << 4) | right);
    }
  });
});

describe('SFX_HEALING_MACHINE (audio/sfx/healing_machine_1.asm)', () => {
  it('preserves every source command, uses only CHAN5 and returns on update 11', () => {
    const data = sfxData('healing_machine');
    expect(data).toEqual({ channels: [{ id: 5, commands: [
      { cmd: 'duty_cycle', value: 2 },
      { cmd: 'pitch_sweep', length: 2, shift: -4 },
      { cmd: 'square_note', length: 4, volume: 15, fade: 2, frequency: 1280 },
      { cmd: 'pitch_sweep', length: 2, shift: 2 },
      { cmd: 'square_note', length: 2, volume: 15, fade: 1, frequency: 1280 },
      { cmd: 'pitch_sweep', length: 0, shift: 8 },
      { cmd: 'square_note', length: 1, volume: 0, fade: 0, frequency: 0 },
      { cmd: 'sound_ret' },
    ] }] });
    const r = rig(); r.sfx.play(data); r.run(10);
    expect(r.sfx.isChannelActive(0)).toBe(true);
    // The duty_cycle command writes first, then each square_note writes its duty again.
    expect(r.synth.values('duty0')).toEqual([[1, 2], [1, 2], [6, 2], [9, 2]]);
    expect(r.synth.values('freq0').filter(([u]) => [1, 6, 9].includes(u))).toEqual([
      [1, 1280], [6, 1280], [9, 0],
    ]);
    r.update(); expect(r.sfx.isPlaying()).toBe(false);
    expect([1, 2, 3].some(hw => r.sfx.isChannelActive(hw))).toBe(false);
  });
});
