// Map-music CP4 (DECISIONS #68): main's real door path on the REAL audio facade and engines. The door sound plays in
// full before the fade's CHAN5-8 clear; the fade then starts and the new song arrives 88 updates after the request.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } });
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
import { GBSynthesizer } from './audio/synthesizer';
import { MusicEngine } from './audio/music_engine';
import type { MusicData } from './audio/music_engine';
import { restoreFlags } from './events';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { initTextSystem, loadGameText } from './text';
import { loadTextPrograms } from './text/program_data';
import { loadBattleData } from './battle';
import { uiTiles } from './renderer/ui_tiles';
import type { GameMap } from './overworld/map';

const host = (main as unknown as { mainTest: {
  gameTick(): void; reset(): void; handleWarpLoad(map: string, warp: number): Promise<void>; gameMap: GameMap;
} }).mainTest;

let now = 1000;
const interval = 1000 / 59.7275 + 0.0001;
const track = async (name: string): Promise<MusicData> => (await (await fetch(`audio/music/${name}.json`)).json()) as MusicData;

beforeAll(async () => {
  await Promise.all([initTextSystem(), loadGameText(), loadTextPrograms(), loadMapSpriteSets(), loadBattleData(), loadStatusScreenAssets()]);
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
  audio.initAudio(); await audio.resumeAudio();
});
beforeEach(() => { uiTiles.clear(); host.reset(); restoreFlags(['GOT_POKEDEX']); });
afterEach(() => { vi.restoreAllMocks(); });

describe.each([
  ['go_inside', 20, 'ViridianPokecenter', 'cities1', 'pokecenter'],
  ['go_outside', 40, 'ViridianCity', 'pokecenter', 'cities1'],
])('%s through the real main warp path', (sfx, length, dest, from, to) => {
  it(`plays its ${length} updates in full, then the fade starts, and the new song arrives 88 updates after the request`, async () => {
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const started: { data: MusicData; tick: number }[] = [];
    let tick = 0;
    const play = MusicEngine.prototype.play;
    vi.spyOn(MusicEngine.prototype, 'play').mockImplementation(function (this: MusicEngine, data: MusicData) { started.push({ data, tick }); play.call(this, data); });
    const step = (): void => { now += interval; tick++; host.gameTick(); };

    await audio.playMusic(from); for (let i = 0; i < 5; i++) step();
    const sfxStart = tick;
    await audio.playSFX(sfx);
    for (let i = 0; i < 8; i++) step(); // the port's 8-frame screen fade
    await host.handleWarpLoad(dest, 0);
    expect(audio.isAudioFadingOut()).toBe(false);

    let request = -1, sfxEnd = -1;
    for (let i = 0; i < 400 && started.length < 2; i++) {
      step();
      if (sfxEnd < 0 && !audio.isSfxPlaying()) sfxEnd = tick;
      if (request < 0 && audio.isAudioFadingOut()) request = tick;
      if (request < 0) expect(audio.isSfxPlaying() || sfxEnd >= 0, 'no fade before the sound ended').toBe(true);
      await Promise.resolve();
    }
    expect(sfxEnd - sfxStart).toBeGreaterThanOrEqual(length); // played in full: the clear never cut it
    expect(sfxEnd).toBeLessThanOrEqual(request);              // the request came after the sound
    expect(started[started.length - 1].data).toBe(await track(to));
    expect(started[started.length - 1].tick - request).toBe(88);
  });
});
