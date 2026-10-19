import { describe, expect, it } from 'vitest';
import { requestRig } from '../test/audio_request_rig';
import { rig, musicData, sfxData } from '../test/audio_rig';
import { MUSIC_IDS as M, SFX_IDS as S } from './sound_ids';

describe('cartridge request entries on audio_rig', () => {
  it.each([[false, 88, 11], [true, 72, 9]] as const)('DF afterBattle=%s starts the real new song at update %s', (afterBattle, end, interval) => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    const old = r.music.getChannel(1), start = r.synth.update;
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter, afterBattle);
    expect(r.state()).toMatchObject({ newId: 0, last: 0xbd, control: 0xbd, counter: afterBattle ? 8 : 10 });
    r.synth.log = [];
    for (let u = 1; u < end; u++) {
      r.update();
      expect(r.music.getChannel(1)).toBe(old);
      expect(r.synth.masterVolumeRegister, `fade update ${u}`).toBe((7 - Math.floor(u / interval)) * 0x11);
    }
    r.update();
    expect(r.starts[r.starts.length - 1]).toEqual({ u: start + end, id: 0xbd, bank: 2, name: 'pokecenter', kind: 'music' });
    expect(r.music.getChannel(1)).not.toBe(old);
    expect(r.fade.isFadingOut()).toBe(false); expect(r.synth.masterVolumeRegister).toBe(0x77);
    const reference = rig(musicData('pokecenter')); reference.update();
    expect(r.synth.log.filter(w => w.u === start + end && w.m.startsWith('freq')).map(w => [w.m, w.a]))
      .toEqual(reference.synth.log.filter(w => w.m.startsWith('freq')).map(w => [w.m, w.a]));
  });

  it('same song/bank is a no-op, including an already queued request', () => {
    const r = requestRig(); r.requests.playDefaultMusic(M.cities1); r.run(13);
    const old = r.music.getChannel(1), before = r.state(), calls = r.starts.length, clears = r.clears.length;
    r.requests.playDefaultMusicFadeOutCurrent(M.cities1);
    expect(r.state()).toEqual(before); expect(r.starts).toHaveLength(calls); expect(r.clears).toHaveLength(clears);
    r.run(88); expect(r.music.getChannel(1)).toBe(old);
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(24);
    const queued = r.state(); r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter);
    expect(r.state()).toEqual(queued); // counter remains 8, not a reloaded 10
  });

  it('after-battle forces the same song to restart, even after StopAllAudio left silence', () => {
    const r = requestRig(); r.requests.playDefaultMusic(M.cities1); r.run(2);
    const old = r.music.getChannel(1); r.requests.playDefaultMusicFadeOutCurrent(M.cities1, true);
    r.run(71); expect(r.music.getChannel(1)).toBe(old); r.update(); expect(r.music.getChannel(1)).not.toBe(old);
    r.requests.stopAllSounds(); const start = r.synth.update;
    r.requests.playDefaultMusicFadeOutCurrent(M.cities1, true);
    r.run(71); expect(r.music.isPlaying()).toBe(false); r.update();
    expect(r.starts[r.starts.length - 1]?.u).toBe(start + 72);
  });

  it('PM cancels the queue, retains last, changes both banks and restores full volume before new notes', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(22);
    expect(r.synth.masterVolumeRegister).toBe(0x55);
    r.requests.playMusic(M.oakslab);
    expect(r.state()).toMatchObject({ control: 0, newId: 0, last: 0xbd, bank: 0x1f, savedBank: 0x1f });
    expect(r.synth.masterVolumeRegister).toBe(0x55); // PM itself does not write NR50
    r.synth.log = []; r.update(); expect(r.synth.masterVolumeRegister).toBe(0x77);
    expect(r.synth.log[0]).toMatchObject({ m: 'master', a: [7, 7] });
    r.run(100); expect(r.starts.filter(s => s.name === 'pokecenter')).toHaveLength(0);
    r.requests.playSound(S.get_key_item); r.update(); expect(r.sfx.isPlaying()).toBe(true);
    r.requests.playMusic(M.oakslab); expect(r.sfx.isPlaying()).toBe(false);
  });

  it('a second map change re-queues with fresh c but retains the reduced NR50 and old bank', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(22);
    const start = r.synth.update;
    r.requests.playDefaultMusicFadeOutCurrent(M.titlescreen);
    expect(r.state()).toMatchObject({ control: 0xc3, counter: 10, reload: 10, bank: 2, savedBank: 0x1f });
    expect(r.synth.masterVolumeRegister).toBe(0x55);
    r.run(65); expect(r.starts[r.starts.length - 1]?.name).toBe('cities1'); r.update();
    expect(r.starts[r.starts.length - 1]).toMatchObject({ u: start + 66, name: 'titlescreen', bank: 0x1f });
    expect(r.requests.audioBank).toBe(0x1f);
  });

  it('same numeric song ID in a different bank still requests a fade', () => {
    const r = requestRig(); r.requests.playDefaultMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.titlescreen);
    expect(r.state()).toMatchObject({ control: 0xc3, counter: 10, bank: 2, savedBank: 0x1f });
    r.run(88); expect(r.starts[r.starts.length - 1]?.name).toBe('titlescreen');
  });

  it('ordinary PS SFX during a fade is dropped without clearing IDs or touching the queue', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(22);
    const before = r.state(), clears = r.clears.length, starts = r.starts.length;
    expect(r.requests.playSound(S.collision)).toBe('dropped');
    expect(r.state()).toEqual(before); expect(r.clears).toHaveLength(clears); expect(r.starts).toHaveLength(starts);
    expect(r.sfx.isPlaying()).toBe(false);
    r.run(66); expect(r.starts[r.starts.length - 1]?.name).toBe('pokecenter');
  });

  it('the no-op bank comparison uses the current bank and still overwrites the saved bank', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.titlescreen); r.run(10);
    expect(r.state()).toMatchObject({ last: 0xc3, bank: 2, savedBank: 0x1f, counter: 0 });
    r.requests.playDefaultMusicFadeOutCurrent(M.cities1); // same numeric ID, current bank matches
    expect(r.state()).toMatchObject({ control: 0xc3, savedBank: 2, counter: 0 });
    r.run(78); expect(r.starts[r.starts.length - 1]).toMatchObject({ name: 'cities1', bank: 2 });
    expect(r.starts.filter(s => s.name === 'titlescreen')).toHaveLength(0);
  });

  it.each([['pkmnhealed', M.pkmnhealed.id], ['healing_machine', S.healing_machine]] as const)
  ('PN queues %s, reloading from control=Pokecenter ID ($bd), not c=10', (name, id) => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(22); const start = r.synth.update;
    expect(r.requests.playNewSound(id)).toBe('queued');
    expect(r.state()).toMatchObject({ newId: 0, last: id, control: id, reload: 0xbd, counter: 0xbd });
    r.run(1139); expect(r.starts[r.starts.length - 1]?.name).toBe('cities1'); r.update(); // (5 levels + completion) * 190
    expect(r.starts[r.starts.length - 1]).toMatchObject({ u: start + 1140, name });
    expect(r.music.isPlaying()).toBe(name === 'pkmnhealed');
    expect(r.starts.filter(s => s.name === 'pokecenter')).toHaveLength(0);
  });

  it('SA during a track fade queues $ff with reload from control, and actually stops at completion', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(11); const start = r.synth.update;
    expect(r.requests.stopAllMusic()).toBe('queued');
    expect(r.state()).toMatchObject({ last: 0xff, control: 0xff, reload: 0xbd, counter: 0xbd });
    r.run(1329); expect(r.music.isPlaying()).toBe(true); r.update();
    expect(r.stops).toEqual([start + 1330, start + 1330]); // completion SA, then queued SA
    expect(r.music.isPlaying()).toBe(false); expect(r.synth.masterVolumeRegister).toBe(0x77);
  });

  it('last=$ff makes a second SA or explicit PN cancel immediately, without rewriting last', () => {
    for (const next of ['stop', 'jingle'] as const) {
      const r = requestRig(); r.requests.playMusic(M.cities1); r.update();
      r.requests.playDefaultMusicFadeOutCurrent(M.titlescreen); r.requests.stopAllMusic(); r.run(5);
      expect(next === 'stop' ? r.requests.stopAllMusic() : r.requests.playNewSound(M.pkmnhealed.id)).toBe('played');
      expect(r.state()).toMatchObject({ last: 0xff, newId: 0, control: 0 });
      expect(r.music.isPlaying()).toBe(next === 'jingle');
      if (next === 'jingle') expect(r.starts[r.starts.length - 1]?.name).toBe('pkmnhealed');
    }
  });

  it('DM waits for the actual SFX, then restarts immediately and updates banks with c=0', () => {
    const r = requestRig(); r.requests.playDefaultMusic(M.cities1); r.update(); r.requests.playSound(S.get_key_item);
    const before = r.state(); expect(r.requests.playDefaultMusic(M.titlescreen)).toBe(false); expect(r.state()).toEqual(before);
    r.run(121); expect(r.requests.playDefaultMusic(M.titlescreen)).toBe(true);
    expect(r.state()).toMatchObject({ last: 0xc3, control: 0, bank: 0x1f, savedBank: 0x1f });
    expect(r.starts[r.starts.length - 1]?.name).toBe('titlescreen');
    const old = r.music.getChannel(1); expect(r.requests.playDefaultMusic(M.titlescreen)).toBe(true);
    expect(r.music.getChannel(1)).not.toBe(old); // DM resets last even for the same song
  });

  it('PW waits without changing new ID, then uses ordinary PS (also dropped during a fade)', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.requests.playSound(S.get_key_item);
    expect(r.requests.playSoundWaitForCurrent(S.press_ab)).toBe(false);
    r.run(121); expect(r.requests.playSoundWaitForCurrent(S.press_ab)).toBe(true);
    expect(r.starts[r.starts.length - 1]?.name).toBe('press_ab'); expect(r.requests.newSoundId).toBe(0);
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); const before = r.state(), starts = r.starts.length;
    expect(r.requests.playSoundWaitForCurrent(S.collision)).toBe(true);
    expect(r.state()).toEqual(before); expect(r.starts).toHaveLength(starts);
  });

  it('PN clears CHAN5–8 IDs without hardware mute/release; PS alone does not run that clear', () => {
    const r = requestRig(); r.requests.playSound(S.get_key_item); r.update();
    r.synth.log = []; const clears = r.clears.length;
    r.requests.fadeControl = 10; r.requests.playNewSound(M.pokecenter.id);
    expect(r.clears).toHaveLength(clears + 1); expect(r.sfx.isPlaying()).toBe(false);
    expect(r.synth.log).toEqual([]); // an ID clear is not Audio2_StopAllAudio or sound_ret
    const raw = rig(); raw.sfx.play(sfxData('go_outside')); raw.update(); raw.synth.log = [];
    raw.sfx.clearSoundIds(); expect(raw.sfx.isChannelActive(3)).toBe(false); expect(raw.synth.log).toEqual([]);
  });

  it('six immediate passes advance the old music and SFX but never tick the fade', () => {
    const r = requestRig(); r.requests.playMusic(M.cities1); r.requests.playSound(S.go_outside);
    const channel = r.music.getChannel(1)!;
    expect(channel.noteDelayCounter).toBe(1); expect(channel.pc).toBe(0);
    r.sixPasses(); expect(r.synth.update).toBe(0);
    expect(channel.pc).toBe(7); expect(channel.noteDelayCounter).toBe(22);
    expect(r.synth.at('noise')).toHaveLength(2); // first two noise notes, not just six music passes
    r.run(33); expect(r.sfx.isPlaying()).toBe(true); r.update(); expect(r.sfx.isPlaying()).toBe(false); // 6+34=40
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(22);
    const before = r.state(), volume = r.synth.masterVolumeRegister, time = r.synth.update;
    const delay = channel.noteDelayCounter; r.sixPasses();
    expect(r.state()).toEqual(before); expect(r.synth.masterVolumeRegister).toBe(volume); expect(r.synth.update).toBe(time);
    expect(channel.noteDelayCounter).not.toBe(delay);
    r.run(66); expect(r.starts[r.starts.length - 1]?.u).toBe(time + 66);
  });

  it.each([true, false])('blackout: departed header then destination header, same song=%s', same => {
    const r = requestRig(); r.requests.playMusic(M.defeatedwildmon); r.update();
    r.requests.fadeControl = 8; r.requests.stopAllMusic(); r.run(72); // StopMusic wait
    expect(r.music.isPlaying()).toBe(false); r.requests.stopAllSounds();
    expect(r.state()).toMatchObject({ last: 0, newId: 0, control: 0, bank: 2, savedBank: 2 });
    const start = r.synth.update, departed = same ? M.pallettown : M.routes1;
    r.requests.playDefaultMusicFadeOutCurrent(departed); r.run(24); // SpecialEnterMap + controlled copy waits
    expect(r.music.isPlaying()).toBe(false); expect(r.synth.masterVolumeRegister).toBe(0x55);
    const before = r.state(); r.sixPasses(); expect(r.state()).toEqual(before);
    r.requests.playDefaultMusicFadeOutCurrent(M.pallettown);
    expect(r.requests.fadeCounter).toBe(same ? 8 : 10);
    r.run(same ? 63 : 65); expect(r.music.isPlaying()).toBe(false); r.update();
    expect(r.starts[r.starts.length - 1]).toMatchObject({ u: start + (same ? 88 : 90), name: 'pallettown' });
    expect(r.starts.filter(s => s.name === 'routes1')).toHaveLength(0);
  });

  it('idle FadeOutAudio honors the UI no-fade bit; an active fade ignores that bit', () => {
    const r = requestRig(); r.requests.noAudioFadeOut = true; r.synth.setMasterVolume(3, 3); r.update();
    expect(r.synth.masterVolumeRegister).toBe(0x33);
    r.requests.playDefaultMusicFadeOutCurrent(M.pokecenter); r.run(44);
    expect(r.music.isPlaying()).toBe(true); expect(r.synth.masterVolumeRegister).toBe(0x77); // (3+1)*11
    r.synth.setMasterVolume(3, 3); r.requests.noAudioFadeOut = false; r.update();
    expect(r.synth.masterVolumeRegister).toBe(0x77);
  });
});
