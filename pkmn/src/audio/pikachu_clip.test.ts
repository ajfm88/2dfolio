import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GBSynthesizer } from './synthesizer';
import type { MusicEngine } from './music_engine';

// Opening checkpoint-04 (note 113): PlayPikachuSoundClip on the real facade, synthesizer and engines (only the
// audio device is stubbed). Nothing in the game calls it yet; the console helper does.
type Api = typeof import('./index');
type Freeze = typeof import('../core/cpu_freeze');
type Alarm = typeof import('./low_health_alarm');
let api: Api, freeze: Freeze, alarm: Alarm;
let now = 1000;
let musicTicks: { mock: { calls: unknown[] } };
const page = (): { _audioSynth(): GBSynthesizer; _audioEngine(): MusicEngine; _playPikachuClip(number?: number): Promise<void> } =>
  (globalThis as unknown as { window: ReturnType<typeof page> }).window;

const INTERVAL = 1000 / 59.7275 + 0.0001;
const step = (n = 1): void => { for (let i = 0; i < n; i++) { now += INTERVAL; api.tickAudio(); } };
const bytesOf = (number: number): number[] => {
  const hex = (JSON.parse(readFileSync(resolve(__dirname, `../../data/audio/pikachu_cries/pikachu_cry_${number}.json`), 'utf8')) as { samples: string }).samples;
  return Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
};
const frozenFrames = (): number => { let frames = 0; while (freeze.takeFrozenFrame()) frames++; return frames; };

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', {});
  const { GBSynthesizer: Synth } = await import('./synthesizer');
  const { MusicEngine: Music } = await import('./music_engine');
  vi.spyOn(Synth.prototype, 'resume').mockResolvedValue();
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  musicTicks = vi.spyOn(Music.prototype, 'tick');
  freeze = await import('../core/cpu_freeze');
  alarm = await import('./low_health_alarm');
  api = await import('./index');
  api.initAudio(); await api.resumeAudio(); api.tickAudio();
});
afterEach(() => { freeze.resetCpuFreeze(); alarm.setLowHealthChannel5(0); vi.restoreAllMocks(); delete (globalThis as { window?: unknown }).window; });

describe('PlayPikachuSoundClip on the facade (opening checkpoint-04)', () => {
  it.each([[4, 82], [11, 36], [37, 72]])('battle clip %i clears once and preserves the resumed VBlank alarm id', async (id, frames) => {
    const { BattleAudio } = await import('../battle/battle_audio');
    const { playPikachuClipCue } = await import('../battle/battle_voice_cues');
    const { sfx, music, banks } = api.getBattleAudioEngines();
    const battle = new BattleAudio(sfx, music, banks);
    const clear = vi.spyOn(battle, 'clearIds');
    await api.loadPikachuClip(id);
    const program = playPikachuClipCue({ *cry() {}, clip: api.startPikachuClip }, id);
    expect(program.next()).toEqual({ done: false, value: 'serviced' });
    for (let i = 0; i < 2; i++) {
      step();
      expect(program.next()).toEqual({ done: false, value: 'serviced' });
    }
    alarm.setLowHealthAlarm(0x9e);
    step();
    expect(battle.channelId(5)).toBe(alarm.CRY_SFX_END);
    expect(program.next()).toEqual({ done: false, value: 'serviced' });
    expect(clear).toHaveBeenCalledOnce();
    expect([5, 6, 7, 8].map(ch => battle.channelId(ch))).toEqual([0, 0, 0, 0]);
    expect(frozenFrames()).toBe(frames);
    step();
    expect(battle.channelId(5)).toBe(alarm.CRY_SFX_END);
    expect(program.next().done).toBe(true);
    expect(clear).toHaveBeenCalledOnce();
    expect(battle.channelId(5)).toBe(alarm.CRY_SFX_END);
    battle.dispose();
  });
  it('a clip must be loaded before it starts, and only an extracted clip loads', async () => {
    expect(() => api.startPikachuClip(1)).toThrow('Pikachu clip 1 is not loaded');
    expect(page()._audioSynth().pcmPlaying).toBe(false); expect(freeze.isCpuFrozen()).toBe(false);
    await expect(api.loadPikachuClip(2)).rejects.toThrow('Pikachu clip 2: HTTP 404');
    await api.loadPikachuClip(1);
    expect(() => api.startPikachuClip(11)).toThrow('Pikachu clip 11 is not loaded');
  });

  it('each clip is fetched once', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    await api.loadPikachuClip(37); await api.loadPikachuClip(37); await api.loadPikachuClip(4);
    expect(fetched.mock.calls.map(call => call[0])).toEqual(
      ['audio/pikachu_cries/pikachu_cry_37.json', 'audio/pikachu_cries/pikachu_cry_4.json']);
  });

  it.each([[1, 46], [4, 82], [11, 36], [17, 42], [37, 72]])('PikachuCry%i plays its own bytes at 45 cycles a sample and freezes %i frames', async (number, frames) => {
    const synth = page()._audioSynth();
    await api.loadPikachuClip(number);
    expect(api.startPikachuClip(number)).toBe(true);
    expect(frozenFrames()).toBe(frames);
    const bytes = bytesOf(number);
    const out = new Float32Array(bytes.length * 8 + 2);
    synth.render(out, 1_048_576 / 45);
    const expected = bytes.flatMap(byte => Array.from({ length: 8 }, (_, bit) => (byte << bit) & 0x80 ? 0.25 : -0.25));
    expect([...out]).toEqual([...expected, 0, 0]);
    expect(synth.pcmPlaying).toBe(false);
  });

  it('the body: full volume, the wave channel off afterwards, the four SFX ids zero; the music is not stopped', async () => {
    const synth = page()._audioSynth();
    await api.loadPikachuClip(1);
    await api.playMusic('cities1'); step(40);
    await api.playSFX('start_menu'); step(1);
    api.setMasterVolume(3, 3); alarm.setLowHealthChannel5(0x91);
    expect(synth.wave.enabled).toBe(true);
    const ids = (): number[] => [5, 6, 7, 8].map(channel => api.channelSoundId(channel as 5 | 6 | 7 | 8));
    expect(api.isSfxPlaying()).toBe(true); expect(ids().some(id => id !== 0)).toBe(true);
    expect(api.startPikachuClip(1)).toBe(true);
    expect(synth.masterVolumeRegister).toBe(0x77);
    expect(synth.pcmPlaying).toBe(true);
    expect([synth.wave.enabled, synth.wave.volumeLevel]).toEqual([false, 0]);
    expect(api.isSfxPlaying()).toBe(false);
    expect(ids()).toEqual([0, 0, 0, 0]);
    expect(alarm.lowHealthChannel5()).toBe(0);
    expect(api.isSoundFinished()).toBe(true);
    expect(api.isMusicPlaying()).toBe(true);
    expect(frozenFrames()).toBe(46);
    // The wave voice comes back with the music's next note on that channel, as after any SFX.
    let updates = 0;
    while (!synth.wave.enabled && updates < 600) { step(1); updates++; }
    expect(synth.wave.enabled).toBe(true); expect(updates).toBeGreaterThan(0);
  });

  it('a drum hit on channel 8 is cut with the ids', async () => {
    await api.loadPikachuClip(11);
    await api.playMusic('cities1');
    const music = page()._audioEngine();
    let updates = 0;
    while (!music.channel8DrumBusy && updates < 600) { step(1); updates++; }
    expect(music.channel8DrumBusy).toBe(true); expect(api.isSoundFinished()).toBe(false);
    api.startPikachuClip(11);
    expect(music.channel8DrumBusy).toBe(false); expect(api.isSoundFinished()).toBe(true);
  });

  it('a frozen frame\'s time is not owed to the audio clock: one update on the first serviced frame', async () => {
    await api.playMusic('cities1'); step(5);
    let before = musicTicks.mock.calls.length;
    for (let frame = 0; frame < 46; frame++) { now += INTERVAL; api.holdAudioClock(); }
    expect(musicTicks.mock.calls.length).toBe(before);
    step(1); expect(musicTicks.mock.calls.length - before).toBe(1);
    step(1); expect(musicTicks.mock.calls.length - before).toBe(2);
    // The same gap without the hold: the audio clock catches up by its two-update cap.
    before = musicTicks.mock.calls.length;
    now += 46 * INTERVAL;
    step(1); expect(musicTicks.mock.calls.length - before).toBe(2);
  });

  it('as a frame program: three frames, the body, one more frame; a clip that misses no VBlank ends with its body', async () => {
    const synth = page()._audioSynth();
    await api.loadPikachuClip(1);
    const program = api.playPikachuSoundClip(1);
    for (let frame = 0; frame < 3; frame++) {
      expect(program.next().done).toBe(false);
      expect(synth.pcmPlaying).toBe(false); expect(freeze.isCpuFrozen()).toBe(false);
    }
    expect(program.next().done).toBe(false);
    expect(synth.pcmPlaying).toBe(true); expect(frozenFrames()).toBe(46);
    expect(program.next().done).toBe(true);

    // A 48-byte clip is 17,280 cycles, shorter than a frame.
    const fetched = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, status: 200, json: async () => ({ id: 41, length: 48, samples: 'a5'.repeat(48) }) } as Response);
    await api.loadPikachuClip(42);
    fetched.mockRestore();
    const short = api.playPikachuSoundClip(42);
    for (let frame = 0; frame < 3; frame++) expect(short.next().done).toBe(false);
    expect(short.next().done).toBe(true);
    expect(freeze.isCpuFrozen()).toBe(false);
  });

  it('the console helper loads and starts a clip, PikachuCry1 by default', async () => {
    const synth = page()._audioSynth();
    await page()._playPikachuClip();
    expect(synth.pcmPlaying).toBe(true); expect(frozenFrames()).toBe(46);
    await page()._playPikachuClip(11);
    expect(frozenFrames()).toBe(36);
  });
});
