// CP4 runs real main dispatch, input, maps, scripts, frame programs, capture,
// renderer and audio facade. Only Battle.init / demo asset readiness are held.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } }));
vi.mock('./debug', () => ({ isNoClip: () => false, isNoEncounters: () => false, consumeDebugWarp: () => null }));
import * as main from './main';
import * as renderer from './renderer';
import * as audio from './audio';
import * as input from './input';
import { GBSynthesizer } from './audio/synthesizer';
import { PlaySound } from './audio/play_sound';
import { musicNameForSound } from './audio/sound_ids';
import { MusicEngine } from './audio/music_engine';
import { RasterCanvas } from './test/raster_canvas';
import { installNodeImageData } from './rom/node_image_data';
import { injectRawImage } from './renderer/renderer';
import { PNG } from 'pngjs';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initTextSystem, loadGameText } from './text';
import { loadTextPrograms } from './text/program_data';
import { setTextSpeed } from './text/textbox';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { loadBattleTransitionData } from './overworld/battle_transition_choice';
import { textBgTransfer } from './text/bg_transfer';
import { uiTiles } from './renderer/ui_tiles';
import { Battle, createPokemon, loadBattleData, loadTrainerData, getTrainerClass } from './battle';
import type { BattlePokemon } from './battle';
import type { GameMap, Player } from './overworld';
import type { OverworldDeps, OverworldState } from './overworld';
import type { PikachuFollower } from './pikachu';
import { loadPikachuMovementData } from './pikachu';
import { getScriptNpcs } from './script';
import { buildOaksLabIntroScript } from './story/oaks_lab';
import { restoreFlags, restoreMapScripts } from './events';
import { setPlayerName, setRivalName } from './core/player_state';
import { setJoyIgnore } from './input/joy_ignore';
import { getSpriteIndex, setSpriteIndex } from './overworld/sprite_index';
import * as spriteIndex from './overworld/sprite_index';
import { updateSprites } from './overworld/sprites';
import type { TransitionScreen } from './overworld/transition_screen';
import type { TransitionCapture } from './overworld/transition_screen_render';
import type { GameButton } from './core';

type Entry = { screen: TransitionScreen | null; capture: TransitionCapture | null;
  choice: { id: number; spiralDirection: number } | null; initialising: boolean;
  levels: { leadLevel: number; enemyLevel: number } };
const host = (main as unknown as { mainTest: {
  reset(): void; gameTick(): void; checkUiEntry(): void; renderBattleEntry(): void;
  startScript(commands: import('./script').ScriptCommand[]): void;
  handleWarpLoad(name: string, warp: number, pos?: { x: number; y: number }): Promise<void>;
  overworldDeps(): OverworldDeps; ow: OverworldState; state: string; battle: Battle | null;
  player: Player; gameMap: GameMap; pikachuFollower: PikachuFollower; playerParty: BattlePokemon[];
  textBox: { active: boolean }; readonly battleEntry: Entry | null;
} }).mainTest;
let output: RasterCanvas, frame = 0, now = 1000;
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
const requests: { frame: number; song: string }[] = [];
const starts: { frame: number }[] = [];
const stops: number[] = [];
let restoreTrainer: (() => void) | undefined;
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

beforeAll(async () => {
  installNodeImageData();
  output = new RasterCanvas();
  vi.stubGlobal('document', { createElement: () => new RasterCanvas(), getElementById: (id: string) => id === 'screen' ? output : null });
  vi.stubGlobal('window', { innerWidth: 480, innerHeight: 432, addEventListener() {} });
  renderer.initRenderer();
  // The same committed PNGs loadSprite preloads in the browser, no colourized-art inference.
  const gfx = resolve(__dirname, '../static/gfx');
  for (const path of readdirSync(gfx, { recursive: true }) as string[]) {
    if (!path.endsWith('.png')) continue;
    const png = PNG.sync.read(readFileSync(resolve(gfx, path)));
    injectRawImage(`/gfx/${path.replace(/\\/g, '/')}`, new ImageData(new Uint8ClampedArray(png.data), png.width, png.height));
  }
  await Promise.all([initTextSystem(), loadGameText(), loadTextPrograms(), loadMapSpriteSets(), loadBattleTransitionData(),
    loadBattleData(), loadTrainerData(), loadPikachuMovementData(), host.player.loadSprite(), host.pikachuFollower.loadSprite()]);
  vi.spyOn(GBSynthesizer.prototype, 'resume').mockResolvedValue();
  audio.initAudio(); await audio.resumeAudio();
  await Promise.all(['wildbattle', 'trainerbattle', 'gymleaderbattle', 'finalbattle', 'meetrival', 'meetprofoak', 'meetmaletrainer'].map(audio.preloadMusic));
});
beforeEach(() => {
  host.reset(); restoreFlags([]); restoreMapScripts({}); setJoyIgnore('none');
  setPlayerName('YELLOW'); setRivalName('BLUE'); setSpriteIndex(0);
  renderer.overworldObjectPalettes.obp0 = 0xd0; renderer.overworldObjectPalettes.obp1 = 0xe0;
  setTextSpeed('fast'); uiTiles.clear(); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  buttons.forEach(key => input.setKey(key, false)); input.updateInput(); input.syncJoypadRead();
  frame = 0; requests.length = starts.length = stops.length = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const stop = PlaySound.prototype.stopAllMusic, play = PlaySound.prototype.playMusic, enginePlay = MusicEngine.prototype.play;
  vi.spyOn(PlaySound.prototype, 'stopAllMusic').mockImplementation(function (this: PlaySound) { stops.push(frame); return stop.call(this); });
  vi.spyOn(PlaySound.prototype, 'playMusic').mockImplementation(function (this: PlaySound, sound) {
    requests.push({ frame, song: musicNameForSound(sound.id, sound.bank)! }); return play.call(this, sound);
  });
  vi.spyOn(MusicEngine.prototype, 'play').mockImplementation(function (this: MusicEngine, data) { starts.push({ frame }); enginePlay.call(this, data); });
});
afterEach(() => { restoreTrainer?.(); restoreTrainer = undefined; vi.restoreAllMocks(); });

async function step(keys: GameButton[] = []) {
  frame++; now += 1000 / 59.7275 + 0.001;
  buttons.forEach(key => input.setKey(key, keys.includes(key))); input.updateInput();
  host.gameTick(); host.checkUiEntry(); await Promise.resolve();
}
async function world(name: string, x: number, y: number, flags: string[] = ['GOT_STARTER', 'FOLLOWED_OAK_INTO_LAB', 'BATTLED_RIVAL_IN_OAKS_LAB'], lead = 10) {
  restoreFlags(flags); host.playerParty.push(createPokemon('PIKACHU', lead)!);
  await host.handleWarpLoad(name, 0, { x, y });
  host.state = 'overworld'; host.ow.doorExitStep = false; host.ow.justWarped = false; host.ow.encounterCooldown = 0;
  updateSprites(host.overworldDeps().npcs, host.gameMap, host.player, host.pikachuFollower);
}
async function untilEntry(keys?: GameButton[]) {
  for (let i = 0; i < 6000 && host.state !== 'battle_transition'; i++) {
    await step(keys ?? (Math.floor(frame / 2) % 2 === 0 ? ['a'] : []));
  }
  expect(host.state, `entry after ${frame} ticks, sprite index ${getSpriteIndex()}`).toBe('battle_transition');
  expect(host.textBox.active).toBe(false);
  return frame;
}

// Totals are the checked CP1 tables, not calculated from the production generator.
const cases = [
  { name: 'Route 1 wild step', map: 'Route1', id: 0, duration: 119, index: 0, survivor: 0 },
  { name: 'Route 1 wild step stronger', map: 'Route1', id: 2, duration: 149, index: 0, survivor: 0, lead: 0 },
  { name: 'Forest wild step', map: 'ViridianForest', id: 4, duration: 77, index: 0, survivor: 0 },
  { name: 'Forest wild step stronger', map: 'ViridianForest', id: 6, duration: 71, index: 0, survivor: 0, lead: 0 },
  { name: 'Forest trainer talk', map: 'ViridianForest', id: 5, duration: 81, index: 5, survivor: 5 },
  { name: 'Forest trainer talk stronger', map: 'ViridianForest', id: 7, duration: 81, index: 5, survivor: 5, lead: 1 },
  { name: 'Forest trainer sight', map: 'ViridianForest', id: 5, duration: 81, index: 2, survivor: 2 },
  { name: 'Lab rival', map: 'OaksLab', id: 1, duration: 170, index: 1, survivor: 1 },
  { name: 'Lab rival stronger', map: 'OaksLab', id: 3, duration: 137, index: 1, survivor: 1, lead: 1 },
  { name: 'forced old man', map: 'ViridianCity', id: 0, duration: 119, index: 8, survivor: 8 },
  { name: 'repeat old man', map: 'ViridianCity', id: 0, duration: 119, index: 7, survivor: 7 },
  { name: 'Oak Pikachu preset', map: 'PalletTown', id: 0, duration: 119, index: 1, survivor: 1 },
  { name: 'Oak Pikachu custom', map: 'PalletTown', id: 2, duration: 149, index: 1, survivor: 1 },
  { name: 'Route 22 turn after sign', map: 'Route22', id: 0, duration: 119, index: 3, survivor: 15 },
] as const;

it.each(cases)('$name: actual entry, E/PM/tick0, capture, survivor, frames and black readiness hold', async row => {
  const lead = 'lead' in row ? row.lead : 10;
  const ready = deferred();
  const init = vi.spyOn(Battle.prototype, 'init').mockImplementation(() => ready.promise);
  const originalSprite = renderer.loadBattleSprite;
  const demoLoad = vi.spyOn(renderer, 'loadBattleSprite').mockImplementation(async (...args) => { await ready.promise; return originalSprite(...args); });
  if (row.name.includes('wild') || row.name.includes('turn')) {
    await world(row.map, 5, 5, undefined, lead);
    // Find a real grass destination with a clear, walkable approach on this map.
    const data = host.gameMap.mapData!;
    let point: { x: number; y: number } | undefined;
    for (let y = 4; y < data.height * 4 - 4 && !point; y += 2) for (let x = 4; x < data.width * 4 - 4; x += 2) {
      if (host.gameMap.isGrassTile(x, y) && host.gameMap.isWalkable(x, y) && host.gameMap.isWalkable(x, y - 2)
        && host.overworldDeps().npcs.every(npc => Math.abs(npc.x / 8 - x) + Math.abs(npc.y / 8 - y) > 10)) { point = { x, y }; break; }
    }
    expect(point).toBeDefined();
    host.player.setTilePosition(point!.x, row.name.includes('turn') ? point!.y : point!.y - 2);
    host.player.direction = 'down';
    host.pikachuFollower.spawn(host.player.x, host.player.y, 'down');
    updateSprites(host.overworldDeps().npcs, host.gameMap, host.player, host.pikachuFollower);
    if (row.name === 'Forest wild step') {
      const fainted = createPokemon('RATTATA', 1)!; fainted.currentHp = 0; host.playerParty.unshift(fainted);
    }
    if (row.name.includes('turn')) setSpriteIndex(3); // a sign's stale hTextID; no land-collision write on a turn
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await untilEntry([row.name.includes('turn') ? 'left' : 'down']);
    expect(host.player.justTurned).toBe(row.name.includes('turn'));
  } else if (row.name.includes('trainer')) {
    const talk = row.name.includes('talk');
    await world(row.map, talk ? 2 : 27, talk ? 42 : 33, undefined, lead);
    host.player.direction = talk ? 'up' : 'right';
    if (talk) {
      // Future trainers can mix levels. Keep the real map/talk/ReadTrainer path,
      // with a fixture whose first member would select Split instead of Shrink.
      const parties = getTrainerClass('LASS')!.parties, original = parties[18];
      parties[18] = original.map((member, index) => ({ ...member, level: index === 0 ? 16 : 6 }));
      restoreTrainer = () => { parties[18] = original; };
    }
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await untilEntry();
  } else if (row.name.includes('Lab rival')) {
    await world(row.map, 4, 6, ['GOT_STARTER', 'FOLLOWED_OAK_INTO_LAB'], lead);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await untilEntry();
  } else if (row.name === 'forced old man') {
    await world(row.map, 19, 9, ['GOT_STARTER', 'GOT_POKEDEX']);
    restoreMapScripts({ ViridianCity: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await untilEntry();
  } else if (row.name === 'repeat old man') {
    await world(row.map, 17, 6, ['GOT_STARTER', 'GOT_POKEDEX', 'COMPLETED_CATCH_TRAINING', 'SPAWNED_OLD_MAN_1']);
    expect(host.overworldDeps().npcs.find(npc => npc.data.id === 'oldman1')!.hidden).toBe(false);
    host.player.direction = 'up';
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await untilEntry();
  } else {
    await world(row.map, 10, 0, []); host.playerParty.length = 0; host.pikachuFollower.visible = false;
    if (row.name.includes('custom')) setRivalName('X');
    await untilEntry();
  }
  const e = frame, entry = host.battleEntry!;
  expect(getSpriteIndex()).toBe(row.index);
  expect(stops[stops.length - 1]).toBe(e);
  expect(requests.filter(request => request.frame === e)).toEqual([]);
  expect(entry.screen).toBeNull(); expect(init).not.toHaveBeenCalled(); expect(demoLoad).not.toHaveBeenCalled();
  const transfer = vi.spyOn(textBgTransfer, 'tick');
  const readIndex = vi.spyOn(spriteIndex, 'getSpriteIndex');
  const mapRender = vi.spyOn(host.gameMap, 'render');
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await step();
  const song = row.name.includes('trainer') || row.name.includes('Lab rival') ? 'trainerbattle' : 'wildbattle';
  expect(requests[requests.length - 1]).toEqual({ frame: e + 1, song }); expect(starts[starts.length - 1]).toEqual({ frame: e + 1 });
  expect(entry.screen).toBeNull(); expect(mapRender).not.toHaveBeenCalled();
  expect(readIndex).not.toHaveBeenCalled();
  // Palettes and hSpriteIndex are sampled at tick 0, not when entry was requested.
  renderer.overworldObjectPalettes.obp1 = 0xc8;
  await step();
  expect(frame).toBe(e + 2); expect(mapRender).toHaveBeenCalledExactlyOnceWith(host.player.getCameraX(), host.player.getCameraY());
  expect(fetcher).not.toHaveBeenCalled(); expect(transfer).toHaveBeenCalledTimes(2);
  expect(readIndex).toHaveBeenCalledOnce();
  expect(entry.choice).toEqual({ id: row.id, kind: ['doubleCircle', 'spiral', 'circle', 'spiral', 'horizontalStripes', 'shrink', 'verticalStripes', 'split'][row.id], spiralDirection: row.id & 2 ? 0 : 1 });
  expect([entry.screen!.obp0, entry.screen!.obp1]).toEqual([0xd0, 0xc8]);
  expect(entry.levels.leadLevel).toBe(row.name.includes('custom') ? 0 : row.name.includes('Oak Pikachu') ? 12 : lead);
  if (row.name === 'Forest trainer talk') expect(entry.levels.enemyLevel).toBe(6);
  if (row.name.includes('Lab rival')) expect(entry.levels.enemyLevel).toBe(5);
  expect(entry.capture!.slots.filter(slot => slot.slot > 0 && slot.slot < 15)).toHaveLength(row.map === 'Route22' ? 2 : host.gameMap.mapData!.npcs.length + (row.map === 'OaksLab' ? 1 : 0));
  const capture = entry.capture!, frozen = capture.sprites.map(sprite => [...sprite.indices]);
  if (row.map === 'Route22') expect(capture.slots.filter(slot => slot.slot === 1 || slot.slot === 2).every(slot => !slot.visible)).toBe(true);
  if (row.map === 'OaksLab') expect(capture.slots.find(slot => slot.slot === 6)).toEqual({ slot: 6, occupied: true, visible: false });
  if (row.map === 'PalletTown') expect(getScriptNpcs().find(npc => npc.data.id === 'prof_script')!.data.textId).toBe(1);
  for (let tick = 1; tick <= row.duration; tick++) {
    await step();
    expect(host.state).toBe('battle_transition');
    expect(transfer).toHaveBeenCalledTimes(tick + 2);
    if (tick === 5) expect(entry.screen!.visibleSprites).toEqual(row.survivor ? [0, row.survivor] : [0]);
    if (tick === 20) {
      const before = transfer.mock.calls.length; host.renderBattleEntry(); host.renderBattleEntry();
      expect(transfer).toHaveBeenCalledTimes(before); expect(mapRender).toHaveBeenCalledOnce();
      expect(capture.sprites.map(sprite => [...sprite.indices])).toEqual(frozen);
    }
    if (tick < row.duration) { expect(init).not.toHaveBeenCalled(); expect(demoLoad).not.toHaveBeenCalled(); }
  }
  expect(entry.initialising).toBe(true); expect(entry.screen!.black).toBe(true);
  const demo = row.name.includes('old man') || row.name.includes('Oak Pikachu');
  expect(init).toHaveBeenCalledTimes(demo ? 0 : 1); expect(demoLoad).toHaveBeenCalledTimes(demo ? 3 : 0);
  for (let wait = 0; wait < 4; wait++) {
    await step(); host.renderBattleEntry(); expect(host.state).toBe('battle_transition');
    const black = [...capture.palette[3], 255];
    expect([...output.pixel(0, 0)]).toEqual(black); expect([...output.pixel(100, 70)]).toEqual(black);
    expect(entry.screen!.visibleSprites).toEqual([]);
  }
  expect(frame - e).toBe(row.duration + 6);
  ready.resolve(); await vi.waitFor(() => expect(host.state).toBe(demo ? 'catch_demo' : 'battle'));
  expect(host.battleEntry).toBeNull(); expect(host.textBox.active).toBe(false);
  expect(requests.filter(request => request.song === song && request.frame >= e)).toEqual([{ frame: e + 1, song }]);
  expect(host.player.isMoving).toBe(false);
  if (!demo) expect(host.battle).toBeInstanceOf(Battle);
});

it('CP5: a wild entry cancels the warp song still waiting for the door sound', async () => {
  await world('Route1', 5, 5); // real warp loader queues Route1's routes1 song
  await audio.playMusic('pallettown');
  await audio.playSFX('go_outside');
  expect(audio.isSoundFinished()).toBe(false);
  const mapMusic = vi.spyOn(audio, 'playDefaultMusicFadeOutCurrent');
  const data = host.gameMap.mapData!;
  let grass: { x: number; y: number } | undefined;
  for (let y = 4; y < data.height * 4 - 4 && !grass; y += 2) for (let x = 4; x < data.width * 4 - 4; x += 2) {
    if (host.gameMap.isGrassTile(x, y)) { grass = { x, y }; break; }
  }
  expect(grass).toBeDefined();
  host.player.setTilePosition(grass!.x, grass!.y); host.player.direction = 'down';
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(Battle.prototype, 'init').mockResolvedValue();
  await step(); await step(); // establish a stopped pass, independent of the previous case's last direction
  expect(audio.isSoundFinished()).toBe(false);
  await untilEntry([host.overworldDeps().player.direction === 'left' ? 'right' : 'left']); // turn during the 40-frame door sound
  const e = frame;
  expect(e).toBeLessThan(40); expect(stops[stops.length - 1]).toBe(e);
  expect(mapMusic).not.toHaveBeenCalled();
  expect(audio.isSoundFinished()).toBe(true); // battle's stop has cut the door sound
  for (let i = 0; i < 180; i++) await step(); // transition, readiness and the 88-update map fade window
  expect(host.state).toBe('battle');
  expect(mapMusic).not.toHaveBeenCalled();
  expect(requests.filter(request => request.frame >= e)).toEqual([{ frame: e + 1, song: 'wildbattle' }]);
  expect(starts.filter(start => start.frame >= e)).toEqual([{ frame: e + 1 }]);
});

it('the real Lab script loads entering Oak in cartridge slot 6 before gameplay can proceed', async () => {
  await world('OaksLab', 5, 10, []);
  host.startScript(buildOaksLabIntroScript());
  for (let i = 0; i < 500 && !getScriptNpcs().some(npc => npc.data.id === 'prof_enter'); i++) await step();
  const oak = getScriptNpcs().find(npc => npc.data.id === 'prof_enter');
  expect(oak?.data.textId).toBe(6);
  expect(renderer.getLoadedRawImageData('/gfx/sprites/prof.png').height).toBe(96);
});

it('loads choice data at boot, preloads all battle music after unlock and retires the old overlay', () => {
  const source = readFileSync(resolve(__dirname, 'main.ts'), 'utf8');
  const boot = source.slice(source.indexOf('async function init()'), source.indexOf('/** The single save write'));
  expect(boot).toContain('loadBattleTransitionData()');
  expect(boot).toContain("['wildbattle', 'trainerbattle', 'gymleaderbattle', 'finalbattle']");
  expect(boot.indexOf('await resumeAudio()')).toBeLessThan(boot.indexOf("['wildbattle'"));
  expect(source).not.toMatch(/startWildBattleTransition|function startBattleTransition|renderBattleTransitionOverlay|updateBattleTransition/);
  expect(source).not.toMatch(/playMusic\(['"](?:wildbattle|trainerbattle)['"]\)/);
  expect(() => renderer.getLoadedRawImageData('/unloaded-transition-sheet.png')).toThrow('not preloaded');
});
