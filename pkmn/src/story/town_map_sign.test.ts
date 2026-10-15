import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildTownMapSignScript, getHiddenEventScript } from './hidden_events';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript, getScriptFadeAlpha, advanceActiveScript } from '../script/script_controller';
import type { ScriptDeps, ScriptAction } from '../script/script_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createPokemon, loadBattleData } from '../battle';
import { restoreFlags } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { isHeld, isPassPressed, syncJoypadRead } from '../input';
import { playSFX } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';
import { mapCloseFrames, fullReloadCloseFrames } from '../overworld/sprite_sets';
import type { MapSpriteSetsFile } from '../rom/extractors/map_sprite_sets';
import { createOverworldState, updateOverworld } from '../overworld/overworld_controller';
import { loadGameText } from '../text/game_text';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, playMusic: vi.fn(), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));
const dataDir = resolve(__dirname, '../../data');
const json = (path: string): unknown => JSON.parse(readFileSync(resolve(dataDir, path), 'utf8'));
const spriteSets = json('map_sprite_sets.json') as MapSpriteSetsFile;
const HOUSES = [['BluesHouse', 9, 14], ['Route2TradeHouse', 11, 17], ['ViridianNicknameHouse', 13, 22]] as const;
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); await loadGameText(); });
beforeEach(() => { vi.clearAllMocks(); restoreFlags([]); setJoyIgnore('none'); setTextSpeed('fast'); uiTiles.clear();
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); });

/** The house with the player at (3,1) facing the wall map at (3,0). */
function scene(map: string) {
  const gameMap = new GameMap(); gameMap.mapData = structuredClone(json(`maps/${map}.json`)) as GameMap['mapData'];
  gameMap.blockset = json('blockset_house.json') as GameMap['blockset'];
  const player = new Player(); player.setTilePosition(6, 2); player.direction = 'up';
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const follower = new PikachuFollower(); follower.visible = false;
  const updates = vi.fn();
  const step = { x: player.mapStepX, y: player.mapStepY };
  const textBox = new TextBox({ updateSprites: updates,
    closeFrames: reload => reload === 'full' ? fullReloadCloseFrames(spriteSets, map, step) : mapCloseFrames(spriteSets, map, step) });
  const deps: ScriptDeps = { gameMap, player, npcs, playerParty: [createPokemon(25, 5)!], playerBag: new Bag(),
    pikachuFollower: follower, textBox };
  return { deps, updates, gameMap, player };
}

/**
 * Runs TownMapText as main.ts does: the townMap action parks the script for `mapFrames`, then
 * advances it. `exitHeld`: A is still down when the Town Map returns (Hold waits for its release).
 */
function trace(s: ReturnType<typeof scene>, opts: { mapFrames: number; exitHeld: 'a' | 'b'; releaseAfter: number }) {
  const box = s.deps.textBox; const screen = () => Reflect.get(box, 'screen') as { buffer: string[] };
  let frame = 0, firstRead = -1, arrow = -1, beep = -1, townMap = -1, closeIn = -1, firstUpdate = -1, closing2 = -1, end = -1;
  const white: number[] = [];
  const closeInPlace = vi.spyOn(box, 'closeInPlace'); const finish = vi.spyOn(box, 'finish');
  initScript(buildTownMapSignScript()); updateScript(s.deps, false);
  let parked = 0;
  for (frame = 1; frame < 3000 && getActiveScript(); frame++) {
    if (townMap >= 0 && parked < opts.mapFrames) {
      if (++parked === opts.mapFrames) advanceActiveScript();
      continue;
    }
    const reads = vi.mocked(syncJoypadRead).mock.calls.length;
    const beeps = vi.mocked(playSFX).mock.calls.length;
    const holding = townMap >= 0 && frame < townMap + opts.mapFrames + 1 + opts.releaseAfter;
    vi.mocked(isHeld).mockImplementation(k => (holding && k === opts.exitHeld) ||
      (townMap < 0 && k === 'b' && frame % 2 === 0 && box.isWaitingForInput));
    const action: ScriptAction | null = updateScript(s.deps, frame % 2 === 0);
    if (firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > reads) firstRead = frame;
    if (arrow < 0 && screen().buffer[98] === '▼') arrow = frame;
    if (beep < 0 && vi.mocked(playSFX).mock.calls.length > beeps) beep = frame;
    if (getScriptFadeAlpha() === 1) white.push(frame);
    if (action?.type === 'townMap') townMap = frame;
    if (closeIn < 0 && closeInPlace.mock.calls.length) closeIn = frame;
    if (firstUpdate < 0 && s.updates.mock.calls.length === 1) firstUpdate = frame;
    if (closing2 < 0 && finish.mock.calls.length && box.closing) closing2 = frame;
    if (end < 0 && !box.active) end = frame;
  }
  expect(getActiveScript()).toBeNull();
  return { firstRead, arrow, beep, white, townMap, closeIn, firstUpdate, closing2, end, finish };
}

describe('TownMapText (A5b6 CP3)', () => {
  it('is the source program: far text, text_promptbutton, then the handler', () => {
    expect(getTextPrograms().TownMapText).toEqual([{ op: 'far', program: '_TownMapText' }, { op: 'promptButton' }, { op: 'asm' }]);
    expect(getHiddenEventScript('TOWN_MAP_TEXT')).toEqual(buildTownMapSignScript());
    const commands = buildTownMapSignScript();
    expect(commands.filter(c => c.type === 'wait').map(c => c.type === 'wait' && c.frames)).toEqual([3, 17]);
    expect(commands[commands.length - 1]).toEqual({ type: 'displayClose', outerWait: false, reload: 'full' });
  });

  it.each(HOUSES)('%s: font-loaded close %i, then the full-reload close %i', (map, fontLoaded, full) => {
    expect(mapCloseFrames(spriteSets, map, { x: 3, y: 1 })).toBe(fontLoaded);
    expect(fullReloadCloseFrames(spriteSets, map, { x: 3, y: 1 })).toBe(full);
  });

  it('outdoors, a full-reload close skips the unchanged sprite set: 1 + player 4', () => {
    expect(fullReloadCloseFrames(spriteSets, 'PalletTown', { x: 5, y: 5 })).toBe(5);
  });

  it.each(HOUSES)('%s: +20, ▼ and beep, white 20, the map, white close, Hold, full close', (map, fontLoaded, full) => {
    const s = scene(map); const t = trace(s, { mapFrames: 40, exitHeld: 'a', releaseAfter: 30 });
    expect(t.firstRead).toBe(20); // PrintText_NoCreatingTextBox: no Delay3
    expect(t.arrow).toBeGreaterThan(t.firstRead); // text_promptbutton's ▼
    // GBPalWhiteOutWithDelay3, then the 17-frame font copy, from the beep's tick.
    expect(t.white[0]).toBe(t.beep);
    expect(t.townMap - t.beep).toBe(20);
    expect(t.white.filter(f => f < t.townMap)).toHaveLength(20);
    // Back from DisplayTownMap: CloseTextDisplay in place, white until its trailing UpdateSprites.
    const back = t.townMap + 40 + 1;
    expect(t.closeIn).toBe(back);
    expect(t.firstUpdate - t.closeIn).toBe(fontLoaded);
    expect(t.white.filter(f => f >= back)).toEqual(Array.from({ length: fontLoaded }, (_, i) => back + i));
    // Hold waits for A's release, then the full reload and the second trailing update.
    expect(t.closing2).toBe(back + 30);
    expect(t.end - t.closing2).toBe(full);
    expect(s.updates).toHaveBeenCalledTimes(2);
    expect(t.finish).toHaveBeenCalledExactlyOnceWith({ outerWait: false, reload: 'full' });
  });

  it('a B exit passes Hold at once (B does not hold the display)', () => {
    const s = scene('BluesHouse'); const t = trace(s, { mapFrames: 10, exitHeld: 'b', releaseAfter: 30 });
    expect(t.closing2 - t.firstUpdate).toBe(0);
    expect(t.end - t.closing2).toBe(14);
  });

  it('the wall map tile dispatches the handler, not a text box', () => {
    const s = scene('BluesHouse'); vi.mocked(isPassPressed).mockImplementation(k => k === 'a');
    expect(s.player.checkInteraction(s.gameMap, [])).toEqual({ scriptId: 'TOWN_MAP_TEXT' });
    const action = updateOverworld({ ...s.deps, currentMapName: 'BluesHouse', findNpc: () => undefined,
      pikachuFollower: s.deps.pikachuFollower!, onPokecenterHeal: vi.fn() }, createOverworldState());
    expect(action).toEqual({ type: 'script', commands: buildTownMapSignScript() });
  });
});
