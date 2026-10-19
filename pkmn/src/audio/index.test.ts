import { afterEach, expect, it, vi } from 'vitest';
import { GBSynthesizer } from './synthesizer';
import { setNoAudioFadeOut } from './audio_flags';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('public fade API uses the real audio clock, works before unlock and preloads the machine SFX', async () => {
  vi.stubGlobal('window', {});
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue(); // no physical audio device
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const api = await import('./index');
  expect(api.isAudioFadingOut()).toBe(false);
  api.fadeOutAndStopMusic(4); // no engine yet
  expect(api.isAudioFadingOut()).toBe(false);
  api.initAudio(); api.tickAudio();
  api.setMasterVolume(3, 3); api.fadeOutAndStopMusic(4); // engine exists, no splash unlock
  expect(api.isAudioFadingOut()).toBe(false);

  const debug = window as unknown as { _audioSynth(): GBSynthesizer };
  const synth = debug._audioSynth();
  expect(synth.masterVolumeRegister).toBe(0x77);
  const fetches = vi.spyOn(globalThis, 'fetch');
  await api.resumeAudio();
  expect(fetches).toHaveBeenCalledWith('audio/sfx/healing_machine.json');
  const preloadedFetchCount = fetches.mock.calls.length;
  const ballSound = api.playSFX('healing_machine');
  expect(api.isSfxPlaying('healing_machine')).toBe(true); // synchronous from cache
  await ballSound;
  expect(fetches).toHaveBeenCalledTimes(preloadedFetchCount);

  await api.playMusic('pokecenter');
  const step = (): void => { now += 1000 / 59.7275 + 0.0001; api.tickAudio(); };
  step();
  api.fadeOutAndStopMusic(4);
  expect(api.isAudioFadingOut()).toBe(true);
  for (let u = 1; u <= 39; u++) step();
  expect(api.isAudioFadingOut()).toBe(true);
  expect(api.isMusicPlaying()).toBe(true);
  expect(synth.masterVolumeRegister).toBe(0);
  // Map-music CP3 (note 63 §10.1): an ordinary PlaySound during a fade is ignored (new ID = 0), so the
  // request neither starts nor counts as pending (completion's SFX stop stays pinned in fade_audio.test.ts).
  void api.playSFX('get_key_item');
  expect(api.isSoundFinished()).toBe(true);
  step(); // update 40: finish before any music/SFX commands, volume already full
  expect(api.isAudioFadingOut()).toBe(false);
  expect(api.isMusicPlaying()).toBe(false);
  expect(api.isSfxPlaying()).toBe(false);
  expect(api.isSoundFinished()).toBe(true);
  expect(synth.masterVolumeRegister).toBe(0x77);

  setNoAudioFadeOut(true); // BIT_NO_AUDIO_FADE_OUT is a real flag StatusScreen sets (note 63 CP3)
  api.setMasterVolume(3, 3); step();
  expect(synth.masterVolumeRegister).toBe(0x33); // idle audio cannot undo StatusScreen
  await api.preloadMusic('pkmnhealed');
  expect(api.isMusicPlaying()).toBe(false); // preload does not start playback
  const beforeCachedPlay = fetches.mock.calls.length;
  const jingle = api.playMusic('pkmnhealed');
  expect(api.isMusicChannelActive(1)).toBe(true); // starts synchronously before the first await
  await jingle;
  expect(fetches).toHaveBeenCalledTimes(beforeCachedPlay);
});
