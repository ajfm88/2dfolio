// Opening checkpoint-04 (note 113): PlayPikachuSoundClip's frozen span through main's real tick, on the REAL
// audio facade and engines. A frozen frame has no VBlank and runs no program; the frame after it is serviced.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const saved = vi.hoisted(() => {
  const saved = new Map<string, string>();
  Object.assign(globalThis, { window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem: (key: string, value: string) => { saved.set(key, value); } } });
  return saved;
});
vi.mock('./debug', () => ({ isNoClip: () => false, isNoEncounters: () => true, consumeDebugWarp: () => null }));
vi.mock('./renderer', () => ({
  getMonsterPalette: () => 'YELLOWMON', drawFadeOverlay: vi.fn(), fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), getScale: () => 1,
  beginSpriteLog: vi.fn(), endSpriteLog: () => [], drawZzzBubble: vi.fn(),
  getCtx: () => ({ drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} }), getActivePalette: () => 'PALLET',
  setActivePalette: vi.fn(), getMapPalette: () => 'PALLET',
  loadFont: async () => ({ width: 128 }), loadTileset: vi.fn(async (url: string) => ({ width: 128, url })),
  loadTilesetTransparent: async () => ({ width: 128 }),
  loadSpriteMapped: async () => ({ width: 8, height: 16 }),
  obpMapping: (reg: number) => [0, 1, 2, 3].map(c => (reg >> (2 * c)) & 3),
  loadSprite: async () => ({ width: 16, height: 96 }), loadBattleSprite: async () => ({ width: 56 }),
  captureUi: (draw: () => void) => { uiTiles.clear(); draw(); return () => {}; },
}));
vi.mock('./battle/battle_ui', async importOriginal => {
  const actual = await importOriginal<typeof import('./battle/battle_ui')>();
  return { ...actual, createSilhouette: () => ({ width: 1, height: 1 }) as never }; // no canvas in node
});
import { loadStatusScreenAssets } from './menus/status_screen';
import * as main from './main';
import * as audio from './audio';
import * as input from './input';
import { GBSynthesizer } from './audio/synthesizer';
import { MusicEngine } from './audio/music_engine';
import { freezeFrames, isCpuFrozen } from './core/cpu_freeze';
import { restoreFlags } from './events';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { initTextSystem, loadGameText } from './text';
import { loadTextPrograms } from './text/program_data';
import { loadBattleData } from './battle';
import { uiTiles } from './renderer/ui_tiles';
import type { GameButton } from './core';

const host = (main as unknown as { mainTest: {
  gameTick(): void; runTick(): void; reset(): void; writeSave(): void;
  readonly pageTicks: number; readonly random: { random(carry: 0 | 1): number };
  state: string; mainMenu: { update(): unknown };
} }).mainTest;

let now = 1000;
const interval = 1000 / 59.7275 + 0.0001;
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
const playTime = (): number => { host.writeSave(); return (JSON.parse(saved.get('p151-s')!) as { playTimeMs: number }).playTimeMs; };

beforeAll(async () => {
  await Promise.all([initTextSystem(), loadGameText(), loadTextPrograms(), loadMapSpriteSets(), loadBattleData(), loadStatusScreenAssets()]);
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
  audio.initAudio(); await audio.resumeAudio();
  await Promise.all([1, 11].map(number => audio.loadPikachuClip(number)));
});
beforeEach(() => {
  uiTiles.clear(); host.reset(); restoreFlags(['GOT_POKEDEX']);
  for (const key of buttons) input.setKey(key, false);
  input.updateInput(); input.syncJoypadRead();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => { audio.stopMusic(); vi.restoreAllMocks(); });

/** What one tick did: Random calls, the state's own update (the main menu's), audio updates, and the hardware
 *  clock's ticks. */
function probe() {
  const random = vi.spyOn(host.random, 'random');
  host.state = 'main_menu';
  const program = vi.spyOn(host.mainMenu, 'update').mockReturnValue(null);
  const music = vi.spyOn(MusicEngine.prototype, 'tick');
  const counts = () => [random.mock.calls.length, program.mock.calls.length, music.mock.calls.length, host.pageTicks];
  return (tick: () => void): number[] => {
    const before = counts();
    now += interval; tick();
    return counts().map((count, i) => count - before[i]);
  };
}

describe('a frozen frame through main (opening checkpoint-04)', () => {
  it('has no Random, no program step and no audio update; only the hardware clock counts; the next frame is serviced', async () => {
    await audio.playMusic('cities1');
    const tick = probe();
    for (let frame = 0; frame < 3; frame++) expect(tick(host.gameTick), `before ${frame}`).toEqual([1, 1, 1, 1]);
    freezeFrames(3);
    for (let frame = 0; frame < 3; frame++) expect(tick(host.gameTick), `frozen ${frame}`).toEqual([0, 0, 0, 1]);
    expect(isCpuFrozen()).toBe(false);
    for (let frame = 0; frame < 3; frame++) expect(tick(host.gameTick), `after ${frame}`).toEqual([1, 1, 1, 1]);
  });

  it.each([[1, 46], [11, 36]])('PikachuCry%i freezes main for %i ticks; the next one is the late VBlank, with one audio update', async (number, frames) => {
    await audio.playMusic('cities1');
    const tick = probe();
    for (let frame = 0; frame < 3; frame++) expect(tick(host.runTick)).toEqual([1, 1, 1, 1]);
    expect(audio.startPikachuClip(number)).toBe(true);
    const frozen: number[][] = [];
    while (isCpuFrozen()) frozen.push(tick(host.runTick));
    expect(frozen).toHaveLength(frames);
    expect(frozen.every(counts => counts.join() === '0,0,0,1')).toBe(true);
    expect(tick(host.runTick)).toEqual([1, 1, 1, 1]);
    expect(tick(host.runTick)).toEqual([1, 1, 1, 1]);
    expect(audio.isMusicPlaying()).toBe(true);
  });

  it('a key pressed during the freeze and still held is a press on the first serviced frame, not before', () => {
    const step = (...held: GameButton[]): void => {
      for (const key of buttons) input.setKey(key, held.includes(key));
      now += interval; host.runTick();
    };
    step(); expect(input.isPressed('a')).toBe(false);
    freezeFrames(4);
    step(); step('a'); step('a'); step('a');
    expect(isCpuFrozen()).toBe(false);
    expect(input.isPressed('a')).toBe(false); expect(input.isHeld('a')).toBe(true);
    step('a'); expect(input.isPressed('a')).toBe(true);
    step('a'); expect(input.isPressed('a')).toBe(false);
  });

  it('a key pressed and released inside the freeze is never seen', () => {
    const step = (...held: GameButton[]): void => {
      for (const key of buttons) input.setKey(key, held.includes(key));
      now += interval; host.runTick();
    };
    step();
    freezeFrames(3);
    step(); step('b'); step();
    step(); expect(input.isPressed('b')).toBe(false);
    step(); expect(input.isPressed('b')).toBe(false);
  });

  it('play time stays wall-clock across the frozen span (V5f ruling 2)', () => {
    let t = 8_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => t);
    host.gameTick(); // lastPlayTimeUpdate becomes t
    const first = playTime();
    const step = (): void => { t += 16; now += interval; host.gameTick(); };
    step(); step();
    freezeFrames(5);
    for (let frame = 0; frame < 5; frame++) step();
    expect(playTime() - first).toBe(2 * 16); // a frozen frame adds nothing itself
    step();
    expect(playTime() - first).toBe(8 * 16); // the first serviced frame adds the whole span
  });
});
