import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GBSynthesizer } from './synthesizer';
import type { MusicEngine, MusicData } from './music_engine';

// Map-music CP3 (note 63 §10): the public facade routes each caller through its cartridge entry,
// on the real synthesizer and engines (only the audio device is stubbed).
type Api = typeof import('./index');
let api: Api;
let now = 1000;
let started: { data: MusicData; at: number }[] = [];
let updates = 0;
let musicTicks: { mock: { calls: unknown[] } };

const step = (n = 1): void => { for (let i = 0; i < n; i++) { now += 1000 / 59.7275 + 0.0001; updates++; api.tickAudio(); } };
const track = async (name: string): Promise<MusicData> => (await (await fetch(`audio/music/${name}.json`)).json()) as MusicData;
const playing = (): MusicData | undefined => started[started.length - 1]?.data;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', {});
  // A fresh module graph per test: spy on the same classes the facade will construct
  const { GBSynthesizer: Synth } = await import('./synthesizer');
  const { MusicEngine: Music } = await import('./music_engine');
  vi.spyOn(Synth.prototype, 'resume').mockResolvedValue();
  now = 1000; updates = 0; started = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  musicTicks = vi.spyOn(Music.prototype, 'tick');
  const play = Music.prototype.play;
  vi.spyOn(Music.prototype, 'play').mockImplementation(function (this: MusicEngine, data: MusicData) {
    started.push({ data, at: updates }); play.call(this, data);
  });
  api = await import('./index');
  api.initAudio(); await api.resumeAudio(); api.tickAudio();
});
// Keep the setup file's fetch stub: only the window this file adds is removed
afterEach(() => { vi.restoreAllMocks(); delete (globalThis as { window?: unknown }).window; });

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('map-music requests through the facade', () => {
  it('a door: the old song plays on through 87 updates and the new one starts on update 88', async () => {
    await api.playMusic('cities1'); step(3);
    api.updateMusic6Times(); api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush();
    const t0 = updates, old = playing(), next = await track('pokecenter');
    step(87); expect(playing()).toBe(old); expect(api.isAudioFadingOut()).toBe(true);
    step(1); expect(playing()).toBe(next); expect(started[started.length - 1].at).toBe(t0 + 88);
    expect(api.isAudioFadingOut()).toBe(false);
  });

  it('after a battle the same song restarts, on update 72', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('cities1'); // first request: last = 0 -> fade
    await flush(); step(88);
    const restarted = started.length; step(5);
    api.playDefaultMusicFadeOutCurrent('cities1'); expect(api.isAudioFadingOut()).toBe(false); // same song: nothing
    api.playDefaultMusicFadeOutCurrent('cities1', true); await flush();
    const t0 = updates; step(71); expect(started).toHaveLength(restarted);
    step(1); expect(started).toHaveLength(restarted + 1); expect(started[started.length - 1].at).toBe(t0 + 72);
  });

  it('an ordinary SFX is dropped during the fade, and plays again once the new song has started', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(20);
    await api.playSFX('collision');
    expect(api.isSfxPlaying()).toBe(false); expect(api.isSoundFinished()).toBe(true);
    step(68); expect(api.isAudioFadingOut()).toBe(false);
    await api.playSFX('collision'); expect(api.isSfxPlaying()).toBe(true);
  });

  it('UpdateMusic6Times advances the old music but never the fade', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(22);
    const debug = window as unknown as { _audioEngine(): MusicEngine; _audioSynth(): GBSynthesizer };
    const volume = debug._audioSynth().masterVolumeRegister, pc = debug._audioEngine().getChannel(1)!.pc;
    api.updateMusic6Times();
    expect(debug._audioSynth().masterVolumeRegister).toBe(volume);
    expect(debug._audioEngine().getChannel(1)!.pc).toBeGreaterThan(pc);
    step(66); expect(api.isAudioFadingOut()).toBe(false); // the same 88-update fade as without the passes
  });

  it('PlayMusic (a battle tune) cancels a map fade and plays at once', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(30);
    await api.playMusic('wildbattle');
    expect(api.isAudioFadingOut()).toBe(false); expect(playing()).toBe(await track('wildbattle'));
    step(1); expect((window as unknown as { _audioSynth(): GBSynthesizer })._audioSynth().masterVolumeRegister).toBe(0x77);
    step(100); expect(playing()).toBe(await track('wildbattle')); // the queued Pokécenter song never starts
  });

  it('a stop during a fade (control 0, StopAllMusic) silences at once and drops the queue', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(30);
    api.stopMusic();
    expect(api.isAudioFadingOut()).toBe(false); expect(api.isMusicPlaying()).toBe(false);
    step(120); expect(api.isMusicPlaying()).toBe(false);
  });

  it('the blackout: StopMusic(8) completes, StopAllSounds, then the departed and destination requests', async () => {
    await api.playMusic('cities1'); step(3);
    api.fadeOutAndStopMusic(8); step(72);
    expect(api.isAudioFadingOut()).toBe(false); expect(api.isMusicPlaying()).toBe(false);
    api.stopAllSounds();
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(24); // SpecialEnterMap + copy waits
    api.updateMusic6Times(); api.playDefaultMusicFadeOutCurrent('pallettown'); await flush();
    const t0 = updates, palletTown = await track('pallettown'); // a different song re-queues with the reduced NR50 ($55)
    step(65); expect(playing()).not.toBe(palletTown);
    step(1); expect(playing()).toBe(palletTown); expect(started[started.length - 1].at).toBe(t0 + 66);
    expect(started.some(s => s.data === undefined)).toBe(false);
  });

  it('PlayDefaultMusic waits for a playing SFX on the audio clock, then restarts the map song', async () => {
    await api.playMusic('cities1'); step(3);
    await api.playSFX('get_key_item'); expect(api.isSoundFinished()).toBe(false);
    const before = started.length;
    api.playDefaultMusic('pokecenter'); expect(started).toHaveLength(before);
    for (let i = 0; i < 600 && started.length === before; i++) { step(); await flush(); } // a drum hit can hold the wait longer
    expect(started.length).toBe(before + 1); expect(playing()).toBe(await track('pokecenter'));
  });

  it('the nurse restoration restarts the map song at once with control 0', async () => {
    await api.playMusic('cities1'); step(3);
    api.fadeOutAndStopMusic(4); step(40);
    await api.playMusicNew('pkmnhealed'); step(2);
    api.restoreNurseMusic('pokecenter'); await flush();
    expect(api.isAudioFadingOut()).toBe(false); expect(playing()).toBe(await track('pokecenter'));
  });

  it('Mom\'s jingle is a wNewSoundID request; during a map fade it re-queues, as the cartridge does', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(22);
    const before = started.length;
    await api.playMusicNew('pkmnhealed');
    expect(started).toHaveLength(before); expect(api.isAudioFadingOut()).toBe(true); // queued, not started
  });
});

describe('map-music request details', () => {
  it('the nurse restoration brings back the saved bank and records the map song as last', async () => {
    await api.playMusic('oakslab'); step(3); // bank $1f
    await api.playMusicNew('pkmnhealed'); step(2); // a bank-3 song is stopped; the jingle plays from bank $02
    api.restoreNurseMusic('oakslab'); await flush();
    expect(playing()).toBe(await track('oakslab')); // $cd in bank $1f, not Cinnabar's $cd in bank $02
    api.playDefaultMusicFadeOutCurrent('oakslab'); // last = the map song: nothing to fade
    expect(api.isAudioFadingOut()).toBe(false);
  });

  it('a fade completing inside the tick keeps the audio clock: the update burst around it still runs', async () => {
    await api.playMusic('cities1'); step(3);
    api.playDefaultMusicFadeOutCurrent('pokecenter'); await flush(); step(87);
    const before = musicTicks.mock.calls.length;
    now += 5 * (1000 / 59.7275) + 0.0001; api.tickAudio();
    expect(musicTicks.mock.calls.length - before).toBe(5); // update 88 starts the song; 89–92 still run
  });
});

describe('known departure (note 63 §10.4): the 8-frame warp of the port', () => {
  it('a door sound still playing when the loader requests the map song is cut by the CHAN5–8 ID clear', async () => {
    await api.playMusic('cities1'); step(3);
    await api.playSFX('go_outside'); step(8); // the SFX started; the port loads the map ~8 frames later
    expect(api.isSfxPlaying()).toBe(true);
    api.updateMusic6Times(); api.playDefaultMusicFadeOutCurrent('pokecenter');
    expect(api.isSfxPlaying()).toBe(false); // the cartridge's loader runs after >= 42 updates, when it has ended
  });
});

// V5g1 checkpoint-02 (note 103): DetermineAudioFunction reads the SFX from the current music's bank.
describe('SFX by the current audio bank, through the facade', () => {
  const sfxStarts = async () => {
    const { SfxEngine } = await import('./sfx_engine');
    return vi.spyOn(SfxEngine.prototype, 'installSfx'); // the field's PlaySound since V5g2
  };
  const file = async (name: string) => (await (await fetch(`audio/sfx/${name}.json`)).json()) as unknown;
  const finishesOn = (limit: number): number => {
    for (let u = 1; u <= limit; u++) { step(); if (api.isSoundFinished()) return u; }
    return -1;
  };

  it('SAVE under Oak\'s Lab plays save_3 at once and finishes on update 37; under Pallet\'s song, save on 40', async () => {
    const play = await sfxStarts();
    await api.playMusic('oakslab'); step(3);
    void api.playSFX('save');
    expect(play).toHaveBeenCalledTimes(1); // preloaded: started in the frame it was asked for
    expect(play.mock.calls[0][0]).toEqual(await file('save_3'));
    expect(api.isSfxPlaying('save_3')).toBe(true);
    expect(finishesOn(60)).toBe(37);
    await api.playMusic('pallettown'); step(3);
    void api.playSFX('save');
    expect(play.mock.calls[1][0]).toEqual(await file('save'));
    expect(finishesOn(60)).toBe(40);
  });

  it('the PC pair plays Audio 3\'s copies under dungeon2; the other field sounds keep their files there', async () => {
    const play = await sfxStarts();
    await api.playMusic('dungeon2'); step(3);
    for (const name of ['turn_on_pc', 'enter_pc', 'turn_off_pc', 'collision', 'press_ab']) { void api.playSFX(name); step(); while (!api.isSoundFinished()) step(); }
    const expected = await Promise.all(['turn_on_pc_3', 'enter_pc_3', 'turn_off_pc', 'collision', 'press_ab'].map(file));
    expect(play.mock.calls.map(call => call[0])).toEqual(expected);
  });

  it('an id with no file in the current bank plays nothing and warns once per pair', async () => {
    const play = await sfxStarts(), warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await api.playMusic('wildbattle'); step(3);
    void api.playSFX('collision'); step(); void api.playSFX('collision'); step();
    expect(play).not.toHaveBeenCalled();
    expect(api.isSoundFinished()).toBe(true);
    expect(warn.mock.calls.map(call => String(call[0]))).toEqual(['No SFX file for id $b4 in audio bank $8']);
    void api.playSFX('press_ab');
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0][0]).toEqual(await file('press_ab'));
  });
});

// V5g2 (note 105): Audio1_PlaySound's priority per channel, and two SFX at once on different channels.
describe('two SFX at once and SFX priority, through the facade (V5g2)', () => {
  const engines = async () => {
    const { SfxEngine } = await import('./sfx_engine');
    return { install: vi.spyOn(SfxEngine.prototype, 'installSfx'), stopAll: vi.spyOn(SfxEngine.prototype, 'stop') };
  };
  const ids = () => ([5, 6, 7, 8] as const).map(channel => api.channelSoundId(channel));
  const ready = async () => { await api.playMusic('pallettown'); step(3); };

  it('START then A: start_menu keeps CHAN8 while press_ab takes CHAN5; nothing is stopped', async () => {
    const { install, stopAll } = await engines(); await ready();
    void api.playSFX('start_menu'); step(); void api.playSFX('press_ab');
    expect(install).toHaveBeenCalledTimes(2); expect(stopAll).not.toHaveBeenCalled();
    expect(ids()).toEqual([0x90, 0, 0, 0x8f]);
    step(); expect(ids()).toEqual([0x90, 0, 0, 0x8f]);
  });

  it('on one channel the lower or equal id wins: collision is refused over press_ab, press_ab replaces collision', async () => {
    const { install } = await engines(); await ready();
    void api.playSFX('press_ab'); step(); void api.playSFX('collision');
    expect(install).toHaveBeenCalledTimes(1); expect(ids()[0]).toBe(0x90);
    while (!api.isSoundFinished()) step();
    void api.playSFX('collision'); step(); void api.playSFX('press_ab'); void api.playSFX('press_ab');
    expect(install).toHaveBeenCalledTimes(4); expect(ids()[0]).toBe(0x90);
  });

  it('CHAN8 compares ids too: go_inside ($ad) is refused over start_menu ($8f); start_menu replaces go_inside', async () => {
    const { install } = await engines(); await ready();
    void api.playSFX('start_menu'); step(); void api.playSFX('go_inside');
    expect(install).toHaveBeenCalledTimes(1); expect(ids()[3]).toBe(0x8f);
    while (!api.isSoundFinished()) step();
    void api.playSFX('go_inside'); step(); void api.playSFX('start_menu');
    expect(install).toHaveBeenCalledTimes(3); expect(ids()[3]).toBe(0x8f);
  });

  it('a refusal after an accepted channel leaves that channel cleared: swap over purchase\'s CHAN6 and press_ab\'s CHAN5', async () => {
    const { install } = await engines(); await ready();
    void api.playSFX('purchase'); step(); void api.playSFX('press_ab'); step();
    expect(ids()).toEqual([0x90, 0xb2, 0, 0]);
    void api.playSFX('swap'); // CHAN6 accepted ($ae <= $b2) and cleared, then CHAN5 refuses ($ae > $90)
    expect(install).toHaveBeenCalledTimes(2); expect(ids()).toEqual([0x90, 0, 0, 0]);
  });

  it('isSfxPlaying(collision) is CHAN5\'s id: a later sound on CHAN8 does not hide it, press_ab on CHAN5 does', async () => {
    await engines(); await ready();
    void api.playSFX('collision'); step(); void api.playSFX('start_menu'); step();
    expect(api.isSfxPlaying('collision')).toBe(true);
    void api.playSFX('press_ab'); expect(api.isSfxPlaying('collision')).toBe(false);
    expect(api.isSfxPlaying('press_ab')).toBe(true);
  });

  it('PlaySound\'s ID clear for a music request leaves every channel idle', async () => {
    await engines(); await ready();
    void api.playSFX('start_menu'); void api.playSFX('press_ab'); step();
    await api.playMusic('routes1');
    expect(ids()).toEqual([0, 0, 0, 0]);
  });
});

// V5g3 checkpoint-04 (note 109): the field's text sounds go through TEXT_SOUND_IDS and the bank table.
describe('the field textbox\'s sound commands by the current bank (V5g3 checkpoint-04)', () => {
  const installs = async () => {
    const { SfxEngine } = await import('./sfx_engine');
    return vi.spyOn(SfxEngine.prototype, 'installSfx');
  };
  const file = async (name: string) => (await (await fetch(`audio/sfx/${name}.json`)).json()) as unknown;

  it('caught_mon is SFX $9A: Audio 2\'s caught jingle under battle music, Audio 1\'s turn_off_pc under a town\'s', async () => {
    const install = await installs();
    await api.playMusic('wildbattle'); step(3);
    await api.playSFX('caught_mon'); // not preloaded by the field: the first request fetches the file
    for (let u = 0; u < 600 && api.isSfxPlaying('caught_mon'); u++) step(); // battle drums keep CHAN8 busy
    expect(api.isSfxPlaying('caught_mon')).toBe(false);
    await api.playMusic('pallettown'); step(3);
    await api.playSFX('caught_mon');
    expect(install.mock.calls.map(call => call[0])).toEqual([await file('caught_mon'), await file('turn_off_pc')]);
    expect(api.channelSoundId(5)).toBe(0x9a);
  });

  it('dex_page_added is SFX $98: its file under battle music; no file under a town\'s, so nothing plays', async () => {
    const install = await installs(), warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await api.playMusic('wildbattle'); step(3);
    await api.playSFX('dex_page_added'); // not preloaded by the field: the first request fetches the file
    for (let u = 0; u < 600 && api.isSfxPlaying('dex_page_added'); u++) step(); // battle drums keep CHAN8 busy
    expect(api.isSfxPlaying('dex_page_added')).toBe(false);
    await api.playMusic('pallettown'); step(3);
    await api.playSFX('dex_page_added');
    expect(install.mock.calls.map(call => call[0])).toEqual([await file('dex_page_added')]);
    expect(warn.mock.calls.map(call => String(call[0]))).toEqual(['No SFX file for id $98 in audio bank $2']);
  });
});
