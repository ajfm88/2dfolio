import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BattleAudio } from '../battle/battle_audio';
import { rig, sfxData } from '../test/audio_rig';
import { getCryData, playCryProgram } from './cries';
import { lowHealthAlarm, resetLowHealthAlarm, setLowHealthAlarm } from './low_health_alarm';
import { soundFinished } from './sound_wait';
import { sfxNameForSound } from './sound_ids';
import { sfxModifierState } from './sfx_modifiers';
import { GBSynthesizer } from './synthesizer';
import { setNoAudioFadeOut } from './audio_flags';
import type { SfxData } from './sfx_engine';

const channelIds = [5, 6, 7, 8] as const;
const ret = { cmd: 'sound_ret' };
const pulse = (length: number) => ({ cmd: 'square_note', length, volume: 12, fade: 0, frequency: 0x6f0 });
const noise = (length: number) => ({ cmd: 'noise_note', length, volume: 12, fade: 0, param: 0xf4 });

beforeEach(() => {
  resetLowHealthAlarm();
  Object.assign(sfxModifierState, { frequency: 0, tempo: 0, savedVolume: 0 });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { window?: unknown }).window;
  setNoAudioFadeOut(false);
});

it('looks up internal species including MissingNo. and resolves each cry in every bank', () => {
  expect(getCryData(31)).toBe(0x14);
  expect(getCryData(190)).toBe(0x14 + 3 * 0x25);
  expect(() => getCryData(0)).toThrow(RangeError);
  expect(() => getCryData(191)).toThrow(RangeError);
  for (const bank of [2, 8, 0x1f, 0x20]) {
    for (let base = 0; base < 38; base++) {
      expect(sfxNameForSound(0x14 + base * 3, bank)).toBe(`cry${base.toString(16).padStart(2, '0')}`);
    }
    expect(sfxNameForSound(0x15, bank)).toBeUndefined();
  }
});

it('parks an early battle channel, restores NR50 on Ch5, and plays later Ch6/Ch8 notes unmodified', () => {
  const r = rig();
  const audio = new BattleAudio(r.sfx, r.music);
  const cry: SfxData = { channels: [
    { id: 5, commands: [pulse(3), ret] },
    { id: 6, commands: [pulse(7), pulse(3), ret] },
    { id: 8, commands: [noise(8), noise(2), ret] },
  ] };
  const ids = () => channelIds.map(ch => audio.channelId(ch));
  r.synth.setMasterVolume(3, 5);
  // Mew supplies $EE/$FF; this fixture puts new notes on both surviving channels.
  const program = playCryProgram(21, id => { expect(audio.play({ id, data: cry })).toBe(true); },
    () => soundFinished(r.sfx, r.music, 0));
  setLowHealthAlarm(0x97);
  expect(program.next()).toEqual({ done: false, value: 'serviced' });
  expect(lowHealthAlarm()).toBe(0);
  expect(ids()).toEqual([0x6e, 0x6e, 0x6e, 0x6e]);
  expect(r.synth.masterVolumeRegister).toBe(0x77);
  expect(sfxModifierState.savedVolume).toBe(0x35);

  r.update();
  expect(r.sfx.observeChannel(7)).toMatchObject({ active: true, pc: 0, commands: [ret] });
  expect(r.synth.values('freq0')).toEqual([[1, 0x7de]]);
  expect(r.synth.values('noise')).toEqual([[1, 0xe2]]);
  expect(r.sfx.observeChannel(5)?.noteDelayCounter).toBe(5); // 4 × $17F
  expect(r.sfx.observeChannel(8)?.noteDelayCounter).toBe(9);
  r.run(5);
  expect(ids()).toEqual([0, 0x6e, 0, 0x6e]);
  expect(r.synth.masterVolumeRegister).toBe(0x35);
  expect(sfxModifierState.savedVolume).toBe(0);
  expect(program.next().done).toBe(false);
  r.run(6);
  expect(r.synth.values('freq1')).toEqual([[1, 0x7de], [12, 0x6f0]]);
  expect(r.synth.values('noise')).toEqual([[1, 0xe2], [10, 0xf4]]);
  expect(r.sfx.observeChannel(6)?.noteDelayCounter).toBe(4);
  expect(r.synth.masterVolumeRegister).toBe(0x35);
  r.run(4);
  expect(program.next().done).toBe(true);
  expect(ids()).toEqual([0, 0, 0, 0]);
  expect(lowHealthAlarm()).toBe(0x97);
  expect(sfxModifierState).toEqual({ frequency: 0xee, tempo: 0xff, savedVolume: 0 });

  // A separately constructed battle bridge reads the same WRAM bytes.
  setLowHealthAlarm(0);
  audio.dispose();
  const next = new BattleAudio(r.sfx, r.music);
  const battleSfx = { channels: [
    { id: 5, commands: [pulse(3), ret] }, { id: 8, commands: [noise(3), ret] },
  ] };
  expect(next.play({ id: 0x9e, data: battleSfx })).toBe(true);
  r.update();
  expect(r.synth.values('freq0').slice(-1)).toEqual([[17, 0x7de]]);
  expect(r.synth.values('noise').slice(-1)).toEqual([[17, 0xe2]]);
  expect(r.sfx.observeChannel(5)?.noteDelayCounter).toBe(5);
  expect(r.sfx.observeChannel(8)?.noteDelayCounter).toBe(4);
});

it('preserves the original saved NR50 when another cry starts before Ch5 returns', () => {
  const r = rig();
  const audio = new BattleAudio(r.sfx, r.music);
  const cry = { id: getCryData(2), data: sfxData('cry03') };
  r.synth.setMasterVolume(3, 4);
  expect(audio.play(cry)).toBe(true);
  r.update();
  r.synth.setMasterVolume(2, 5);
  expect(audio.play(cry)).toBe(true);
  expect(r.synth.masterVolumeRegister).toBe(0x25);
  expect(sfxModifierState.savedVolume).toBe(0x34);
  r.run(47);
  expect(r.synth.masterVolumeRegister).toBe(0x34);
  expect(sfxModifierState.savedVolume).toBe(0);
});

const fieldWindow = { addEventListener() {} };

async function field() {
  vi.stubGlobal('window', fieldWindow);
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
  const api = await import('./index');
  await api.resumeAudio();
  api.stopMusic();
  api.setAudioBank(2);
  setNoAudioFadeOut(true);
  const { sfx } = api.getBattleAudioEngines();
  const synth = (window as unknown as { _audioSynth(): GBSynthesizer })._audioSynth();
  return { api, sfx, synth };
}

it.each([
  [2, 47, 54], // Kangaskhan: Ch5 46 frames of notes, Ch8 53.
  [3, 31, 32], // Nidoran-M: Ch6 outlasts Ch5 by one update.
  [4, 21, 21], // Clefairy: 40 pulse ticks at $0081.
  [27, 37, 59], // Staryu: 58 pulse ticks at $00A0, 58 noise ticks at $0100.
])('field PlayCry(%i) restores NR50 on update %i and waits until update %i', async (index, ch5Return, lastReturn) => {
  const { api, sfx, synth } = await field();
  await api.preloadCry(index);
  api.setMasterVolume(3, 4);
  setLowHealthAlarm(0x9e);
  const nr43 = vi.spyOn(synth, 'triggerNoise');
  const play = api.playCry(index);
  expect(play.next()).toEqual({ done: false, value: 'serviced' });
  expect(lowHealthAlarm()).toBe(0);
  const id = api.channelSoundId(5);
  expect(id).not.toBe(0);
  expect(channelIds.map(api.channelSoundId)).toEqual([id, id, id, id]);
  expect(synth.masterVolumeRegister).toBe(0x77);
  let result;
  for (let update = 1; update <= lastReturn; update++) {
    api.updateMusicCTimes(1);
    result = play.next();
    expect(result.done).toBe(update === lastReturn);
    expect(synth.masterVolumeRegister).toBe(update < ch5Return ? 0x77 : 0x34);
    expect(api.channelSoundId(7)).toBe(update < ch5Return ? id : 0);
    if (index === 2 && update === 45) {
      const ch6 = sfx.observeChannel(6)!;
      expect(ch6.commands[ch6.pc]).toEqual(ret);
      expect(api.channelSoundId(6)).toBe(id);
    }
    if (index === 2 && update === 47) {
      expect(channelIds.map(api.channelSoundId)).toEqual([0, 0, 0, id]);
    }
    if (index === 27 && update === 1) {
      expect(sfx.observeChannel(5)?.noteDelayCounter).toBe(4);
      expect(sfx.observeChannel(8)?.noteDelayCounter).toBe(7);
      expect(nr43.mock.lastCall?.[0]).toBe(3);
    }
    if (index === 27 && update === 38) expect(nr43.mock.lastCall?.[0]).toBe(27);
  }
  expect(lowHealthAlarm()).toBe(0x9e);
  expect(sfxModifierState.savedVolume).toBe(0);
  expect(channelIds.map(api.channelSoundId)).toEqual([0, 0, 0, 0]);
});

it('plays a species name from the console on the audio clock and leaves plain field SFX unmodified', async () => {
  const { api, sfx, synth } = await field();
  const page = window as unknown as { _playCry(species: string): Promise<void> };
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  api.tickAudio();
  setLowHealthAlarm(0x1e);
  await page._playCry('Clefairy');
  expect(api.channelSoundId(5)).toBe(0x5f);
  expect(lowHealthAlarm()).toBe(0);
  for (let update = 1; update <= 21; update++) {
    now += 1000 / 59.7275 + 0.0001;
    api.tickAudio();
    expect(lowHealthAlarm()).toBe(update === 21 ? 0x1e : 0);
  }
  expect(sfxModifierState).toMatchObject({ frequency: 0xcc, tempo: 1 });

  const frequency = vi.spyOn(synth, 'setPulseFrequency');
  const cmd = sfxData('healing_machine').channels[0].commands.find(cmd => cmd.cmd === 'square_note')!;
  await api.playSFX('healing_machine'); // battle-range ID $9E, but Audio 1
  api.updateMusicCTimes(1);
  expect(sfx.observeChannel(5)?.noteDelayCounter).toBe(cmd.length! + 1);
  expect(frequency.mock.lastCall).toEqual([0, 131072 / (2048 - cmd.frequency!)]);
});
