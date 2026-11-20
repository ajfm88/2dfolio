// Opening checkpoint-12a: direct Audio1_UpdateMusic passes; the caller supplies the byte C.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rig, sfxData } from '../test/audio_rig';
import { updateMusicCTimes, updateMusic6Times } from './sound_wait';
import { AudioFade } from './fade_audio';
import { lowHealthAlarm, setLowHealthAlarm } from './low_health_alarm';

afterEach(() => { vi.restoreAllMocks(); setLowHealthAlarm(0); vi.unstubAllGlobals(); });

describe('UpdateMusicCTimes (home/audio.asm): direct counted passes', () => {
  for (const [count, passes] of [[1, 1], [5, 5], [8, 8], [255, 255], [0, 256], [261, 5]]) {
    it(`C=${count}: ${passes} music-then-SFX passes, with the SFX owner supplied to music`, () => {
      const r = rig(), order: string[] = [];
      const music = vi.spyOn(r.music, 'tick').mockImplementation(() => { order.push('music'); });
      const sfx = vi.spyOn(r.sfx, 'tick').mockImplementation(() => { order.push('sfx'); });
      updateMusicCTimes(r.music, r.sfx, count);
      expect(order).toEqual(Array.from({ length: passes }, () => ['music', 'sfx']).flat());
      expect(music).toHaveBeenCalledTimes(passes); expect(sfx).toHaveBeenCalledTimes(passes);
      for (const [owner] of music.mock.calls) expect(owner).toBe(r.sfx);
    });
  }
  it('the existing UpdateMusic6Times wrapper still performs six passes in the same order', () => {
    const r = rig(), order: string[] = [];
    vi.spyOn(r.music, 'tick').mockImplementation(() => { order.push('music'); });
    vi.spyOn(r.sfx, 'tick').mockImplementation(() => { order.push('sfx'); });
    updateMusic6Times(r.music, r.sfx);
    expect(order).toEqual(Array.from({ length: 6 }, () => ['music', 'sfx']).flat());
  });
  it('does not advance fade, alarm or wall-clock time during the direct updates', () => {
    const r = rig(); setLowHealthAlarm(0x85);
    const fade = vi.spyOn(AudioFade.prototype, 'tick');
    const clock = vi.spyOn(performance, 'now');
    updateMusicCTimes(r.music, r.sfx, 8);
    expect(lowHealthAlarm()).toBe(0x85); expect(fade).not.toHaveBeenCalled(); expect(clock).not.toHaveBeenCalled();
  });
  it('can update either existing owner while the other engine is absent, and safely handles both null', () => {
    const r = rig();
    const music = vi.spyOn(r.music, 'tick'), sfx = vi.spyOn(r.sfx, 'tick');
    updateMusicCTimes(r.music, null, 5); expect(music).toHaveBeenCalledTimes(5); expect(music).toHaveBeenCalledWith(undefined);
    updateMusicCTimes(null, r.sfx, 8); expect(sfx).toHaveBeenCalledTimes(8);
    expect(() => updateMusicCTimes(null, null, 0)).not.toThrow();
  });
  it('advances the real intro crash exactly to its twentieth-update sound_ret', () => {
    const r = rig(); r.sfx.play(sfxData('intro_crash'));
    updateMusicCTimes(r.music, r.sfx, 8); updateMusicCTimes(r.music, r.sfx, 5); updateMusic6Times(r.music, r.sfx);
    expect(r.sfx.isPlaying()).toBe(true);
    updateMusicCTimes(r.music, r.sfx, 1); expect(r.sfx.isPlaying()).toBe(false);
  });
  it('the public facade forwards the count to the page-owned engines without running tickAudio', async () => {
    vi.stubGlobal('window', {});
    const api = await import('./index'); api.initAudio();
    const owners = api.getBattleAudioEngines();
    const music = vi.spyOn(owners.music, 'tick'), sfx = vi.spyOn(owners.sfx, 'tick');
    const clock = vi.spyOn(api, 'tickAudio');
    api.updateMusicCTimes(5); api.updateMusicCTimes(8);
    expect(music).toHaveBeenCalledTimes(13); expect(sfx).toHaveBeenCalledTimes(13); expect(clock).not.toHaveBeenCalled();
    api.updateMusic6Times(); expect(music).toHaveBeenCalledTimes(19); expect(sfx).toHaveBeenCalledTimes(19);
  });
});
