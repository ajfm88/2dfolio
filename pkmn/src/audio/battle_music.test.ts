import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { battleMusicFor } from './battle_music';
import type { MusicData, MusicEngine } from './music_engine';
import type { PlaySound } from './play_sound';

it.each([
  [0, 25, 'wildbattle'], [0, 165, 'wildbattle'], [0, 199, 'wildbattle'],
  [0, 200, 'trainerbattle'], [0, 202, 'trainerbattle'], [0, 225, 'trainerbattle'],
  [0, 243, 'finalbattle'], [0, 247, 'gymleaderbattle'],
  [1, 25, 'gymleaderbattle'], [8, 243, 'gymleaderbattle'],
] as const)('song gym=%i opponent=%i -> %s', (gymLeaderNo, curOpponent, song) => {
  expect(battleMusicFor({ gymLeaderNo, curOpponent })).toBe(song);
});

it('keeps the future gym-leader, Lance and Champion branches tied to the source IDs', () => {
  const refs = resolve(__dirname, '../../../refs/pokeyellow');
  if (!existsSync(refs)) return;
  const constants = readFileSync(resolve(refs, 'constants/trainer_constants.asm'), 'utf8');
  const offset = Number(constants.match(/OPP_ID_OFFSET EQU (\d+)/)![1]);
  const classes = [...constants.matchAll(/^\s*trainer_const\s+(\w+)/gm)].map(match => match[1]);
  expect(battleMusicFor({ gymLeaderNo: 0, curOpponent: offset + classes.indexOf('LANCE') })).toBe('gymleaderbattle');
  expect(battleMusicFor({ gymLeaderNo: 0, curOpponent: offset + classes.indexOf('RIVAL3') })).toBe('finalbattle');
  const source = readFileSync(resolve(refs, 'audio/play_battle_music.asm'), 'utf8');
  expect(source).toMatch(/ld \[wAudioFadeOutControl\], a[\s\S]*call StopAllMusic\s+call DelayFrame/);
  expect(source).toMatch(/cp OPP_RIVAL3[\s\S]*cp OPP_LANCE/);
});

type Api = typeof import('./index');
let api: Api;
let now = 1000, updates = 0;
let starts: { name: string; update: number }[];
let requests: { kind: string; update: number; control: number }[];

beforeEach(async () => {
  vi.resetModules(); vi.stubGlobal('window', {});
  const { GBSynthesizer } = await import('./synthesizer');
  const { MusicEngine: Music } = await import('./music_engine');
  const { PlaySound: Sound } = await import('./play_sound');
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
  now = 1000; updates = 0; starts = []; requests = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const play = Music.prototype.play;
  vi.spyOn(Music.prototype, 'play').mockImplementation(function(this: MusicEngine, data: MusicData) {
    starts.push({ name: data === wild ? 'wildbattle' : 'other', update: updates }); play.call(this, data);
  });
  const stop = Sound.prototype.stopAllMusic;
  vi.spyOn(Sound.prototype, 'stopAllMusic').mockImplementation(function(this: PlaySound) {
    requests.push({ kind: 'SA', update: updates, control: this.fadeControl }); return stop.call(this);
  });
  const pm = Sound.prototype.playMusic;
  vi.spyOn(Sound.prototype, 'playMusic').mockImplementation(function(this: PlaySound, sound) {
    requests.push({ kind: 'PM', update: updates, control: this.fadeControl }); return pm.call(this, sound);
  });
  api = await import('./index'); api.initAudio(); await api.resumeAudio(); api.tickAudio();
  wild = await (await fetch('audio/music/wildbattle.json')).json() as MusicData;
});
let wild: MusicData;
afterEach(() => { vi.restoreAllMocks(); delete (globalThis as { window?: unknown }).window; });
const tick = () => { now += 1000 / 59.7275 + 0.001; updates++; api.tickAudio(); };

it('facade steps clear a live fade and SFX at E, keep one silent frame, and PM at E+1', async () => {
  await api.preloadMusic('wildbattle');
  await api.playMusic('cities1');
  await api.playSFX('get_key_item');
  api.playDefaultMusicFadeOutCurrent('pokecenter');
  expect(api.isAudioFadingOut()).toBe(true);
  starts = []; requests = [];
  const program = api.playBattleMusic({ gymLeaderNo: 0, curOpponent: 25 });
  expect(program.next().done).toBe(false); // CPU E: stop only
  expect(requests).toEqual([{ kind: 'SA', update: 0, control: 0 }]);
  expect(api.isAudioFadingOut()).toBe(false);
  expect(api.isMusicPlaying()).toBe(false); expect(api.isSfxPlaying()).toBe(false);
  tick(); // VBlank E+1: no battle song request yet
  expect(starts).toEqual([]); expect(api.isMusicPlaying()).toBe(false);
  expect(program.next().done).toBe(true); // CPU E+1: PM
  expect(requests).toEqual([{ kind: 'SA', update: 0, control: 0 }, { kind: 'PM', update: 1, control: 0 }]);
  expect(starts).toEqual([{ name: 'wildbattle', update: 1 }]);
  tick(); // E+2: first battle music update, transition entry belongs to CP4
  expect(api.isMusicPlaying()).toBe(true);
  for (let i = 0; i < 120; i++) tick();
  expect(starts).toHaveLength(1); // cancelled map queue never restarts
  expect(program.next().done).toBe(true); expect(requests).toHaveLength(2);
});

it.each([[0, 202, 'trainerbattle'], [3, 234, 'gymleaderbattle'], [0, 247, 'gymleaderbattle'],
  [0, 243, 'finalbattle']] as const)('facade dispatches gym=%i opponent=%i to %s after its wait', async (gymLeaderNo, curOpponent, song) => {
  await api.preloadMusic(song);
  const data = await (await fetch(`audio/music/${song}.json`)).json() as MusicData;
  const { MusicEngine: Music } = await import('./music_engine');
  const spy = vi.spyOn(Music.prototype, 'play');
  const program = api.playBattleMusic({ gymLeaderNo, curOpponent });
  program.next(); expect(spy).not.toHaveBeenCalled(); tick(); program.next();
  expect(spy).toHaveBeenCalledExactlyOnceWith(data);
});
