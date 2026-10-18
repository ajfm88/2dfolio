// Actual hidden-event -> script-controller dispatch with the real input module.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { (globalThis as unknown as { window: unknown }).window = { addEventListener() {} }; });
import { loadStatusScreenAssets } from '../menus/status_screen';
import { drawFadeOverlay } from '../renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { initScript, updateScript, getMenuSessionTiles, isScriptMenuFullScreen, renderMenuSession } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import { getHiddenEventScript } from './hidden_events';
import { updateOverworld, createOverworldState } from '../overworld/overworld_controller';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import * as input from '../input';
import type { GameButton, Direction } from '../core';
import { restoreFlags } from '../events';
import { playSFX, isSoundFinished } from '../audio';
import { setCurrentMenuItem, setListScrollOffset } from '../list_state';
import { setNoTextDelay } from '../text/text_flags';
import { createPokemon, loadBattleData } from '../battle/data';
import { pokemonToBoxed } from '../pokemon_storage';
import { updateSprites } from '../overworld/sprites';

vi.mock('../audio', () => ({ setMasterVolume: vi.fn(), playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), playMusic: vi.fn(), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../renderer', () => ({ drawFadeOverlay: vi.fn(), getMonsterPalette: () => 'YELLOWMON', loadBattleSprite: async () => ({ width: 40, height: 40 }), fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), getScale: () => 1, getCtx: () => ({ drawImage() {} }),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));
const BUTTONS: GameButton[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'];
let soundFrames = 0;
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); await loadStatusScreenAssets(); });
beforeEach(() => {
  setNoTextDelay(false);
  vi.restoreAllMocks(); vi.clearAllMocks(); soundFrames = 0;
  vi.mocked(isSoundFinished).mockImplementation(() => soundFrames === 0);
  vi.mocked(playSFX).mockImplementation(() => { soundFrames = 4; return Promise.resolve(); });
  restoreFlags(['GOT_POKEDEX']); setCurrentMenuItem(0); setListScrollOffset(0);
  setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  for (const key of BUTTONS) input.setKey(key, false); input.updateInput(); input.readJoypad();
});

function world(generic = false, facing: Direction = 'up') {
  const name = generic ? 'ViridianPokecenter' : 'RedsHouse2F';
  const map = new GameMap(); map.mapData = JSON.parse(readFileSync(resolve(__dirname, `../../data/maps/${name}.json`), 'utf8'));
  const hidden = map.mapData!.hiddenEvents!.find(e => e.scriptId === (generic ? 'POKECENTER_PC' : 'RED_PC'))!;
  const player = new Player(); player.setTilePosition(hidden.x * 2, hidden.y * 2 + 2); player.direction = facing;
  const follower = new PikachuFollower();
  const box = new TextBox({ closeFrames: () => generic ? 17 : 7, updateSprites: () => updateSprites([], map, player, follower) });
  const deps: ScriptDeps = { textBox: box, player, gameMap: map, npcs: [], playerParty: [], playerBag: new Bag(), pcItems: [{ id: 'POTION', count: 2 }],
    pikachuFollower: follower, pcStorage: { party: [], boxes: Array.from({ length: 12 }, () => []),
      getCurrentBox: () => 0, setCurrentBox: () => {}, deserialize: saved => {
        const mon = createPokemon(saved.speciesName, saved.level, saved.nickname)!;
        mon.currentHp = saved.currentHp; mon.status = saved.status; mon.moves = structuredClone(saved.moves); return mon;
      }, hasFlag: flag => flag === 'GOT_POKEDEX',
      saveGame: vi.fn(), isPikachuFollowingDisabled: () => false } };
  deps.pcStorage!.party = deps.playerParty;
  input.setKey('a', true); input.updateInput(); input.readJoypad();
  const action = updateOverworld({ ...deps, pikachuFollower: deps.pikachuFollower!, currentMapName: name, findNpc: () => undefined }, createOverworldState());
  return { deps, box, action };
}

function run(generic = false) {
  const { deps, box, action } = world(generic);
  expect(action?.type).toBe('script');
  if (action?.type !== 'script') throw new Error('PC hidden event failed');
  let frame = 0; let ended = false;
  const print = vi.spyOn(box, 'print'); const open = vi.spyOn(box, 'open'); const finish = vi.spyOn(box, 'finish');
  const transfer = vi.spyOn(textBgTransfer, 'tick');
  const read = vi.spyOn(input, 'readJoypad'); const sync = vi.spyOn(input, 'syncJoypadRead');
  initScript(action.commands); updateScript(deps, true);
  const step = (...keys: GameButton[]) => {
    frame++; if (soundFrames > 0) soundFrames--;
    for (const key of BUTTONS) input.setKey(key, keys.includes(key)); input.updateInput();
    const ticks = transfer.mock.calls.length; const reads = read.mock.calls.length; const syncs = sync.mock.calls.length;
    const closing = box.closing;
    const result = updateScript(deps, frame % 2 === 0); ended = result?.type === 'scriptEnded';
    const delta = transfer.mock.calls.length - ticks;
    expect(delta, `VBlank ${frame}`).toBeLessThanOrEqual(1);
    if (frame > 20 && !closing && !ended) expect(delta, `missing VBlank ${frame}`).toBe(1);
    expect(read.mock.calls.length > reads && sync.mock.calls.length > syncs, `two Joypad owners ${frame}`).toBe(false);
  };
  const frames = (n: number) => { for (let i = 0; i < n; i++) step(); };
  const until = (pred: () => boolean, limit = 2000) => {
    for (let i = 0; i < limit && !pred(); i++) {
      if (box.isWaitingForInput && i % 8 === 0) step('a'); else step();
    }
    expect(pred(), `timeout ${frame}`).toBe(true);
  };
  return { deps, box, step, frames, until, print, open, finish, read, sync, transfer, time: () => frame, ended: () => ended };
}

describe('PC hidden events on the production script dispatch', () => {
  it.each([0, 1, 2])('StatusScreen on the actual PC host: one BG tick and white until Q+6/read Q+9, offset %i', offset => {
    const r = run(true);
    r.deps.playerParty.push(createPokemon('PIKACHU', 5)!, createPokemon('RATTATA', 5)!);
    const tiles = () => getMenuSessionTiles()!;
    r.until(() => tiles()?.at(1, 2) === '▶'); r.frames(3); r.step('a');
    r.until(() => tiles()?.at(2, 2) === 'W' && tiles()?.at(1, 2) === '▶'); r.frames(3 + offset);
    r.step('down'); r.frames(3); r.step('a'); r.frames(16); r.step('a'); r.frames(3);
    r.step('down'); r.frames(3); const before = tiles().save(r.box); r.step('a');
    expect(isScriptMenuFullScreen()).toBe(true);
    const reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length;
    const ticks = r.transfer.mock.calls.length;
    r.frames(26); expect(r.transfer).toHaveBeenCalledTimes(ticks + 26);
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.sync).toHaveBeenCalledTimes(syncs);
    renderMenuSession(); expect(drawFadeOverlay).not.toHaveBeenCalled(); // S+26 page 1, picture still copying
    r.step(); expect(r.read).toHaveBeenCalledTimes(reads + 1);
    r.step('b'); r.frames(3); r.step('b'); const q = r.time();
    expect(isScriptMenuFullScreen()).toBe(true);
    vi.mocked(drawFadeOverlay).mockClear(); renderMenuSession(); expect(drawFadeOverlay).toHaveBeenCalledWith(1);
    r.frames(3); expect(tiles().save(r.box)).toEqual(before);
    const n = r.read.mock.calls.length;
    for (let i = 4; i < 6; i++) {
      r.step(); vi.mocked(drawFadeOverlay).mockClear(); renderMenuSession();
      expect(drawFadeOverlay).toHaveBeenCalledWith(1); expect(isScriptMenuFullScreen()).toBe(true);
    }
    r.step(); expect(r.time()).toBe(q + 6); expect(isScriptMenuFullScreen()).toBe(false);
    vi.mocked(drawFadeOverlay).mockClear(); renderMenuSession(); expect(drawFadeOverlay).not.toHaveBeenCalled();
    expect(tiles().at(10, 14)).toBe('▶');
    r.frames(2); expect(r.read).toHaveBeenCalledTimes(n); r.step(); expect(r.time()).toBe(q + 9);
    expect(r.read).toHaveBeenCalledTimes(n + 1);
    expect(r.transfer).toHaveBeenCalledTimes(ticks + r.time() - (q - 32));
  });

  it.each([0, 1, 2])('Bill deposit/withdraw honors one-frame taps at idle offset %i and reconciles before result glyphs', offset => {
    const r = run(true);
    restoreFlags(['GOT_POKEDEX', 'BATTLED_RIVAL_IN_OAKS_LAB']);
    r.deps.playerParty.push(createPokemon('PIKACHU', 5)!, createPokemon('RATTATA', 5)!);
    const follower = r.deps.pikachuFollower!;
    follower.visible = true; follower.spawn(r.deps.player.x, r.deps.player.y, 'up');
    const menu = () => getMenuSessionTiles();
    const billMain = () => menu()?.at(2, 2) === 'W' && menu()?.at(1, 2) === '▶';
    r.until(() => menu()?.at(1, 2) === '▶'); r.frames(3); r.step('a'); r.until(billMain); r.frames(3 + offset);
    r.step('down'); r.frames(3); r.step('a'); r.frames(16); r.step('a'); r.frames(3); r.step('a');
    expect(r.deps.playerParty).toHaveLength(1); expect(r.deps.pcStorage!.boxes[0]).toHaveLength(1);
    expect(follower.visible).toBe(false); // result PrintText, before its first glyph
    expect(r.box.saveScreen().buffer.every(c => c === ' ')).toBe(true);
    r.until(() => menu()?.at(1, 4) === '▶' && !r.box.isWaitingForInput); r.frames(3);
    r.step('up'); r.frames(3); r.step('a'); r.frames(16); r.step('a'); r.frames(3); r.step('a');
    expect(r.deps.playerParty).toHaveLength(2); expect(r.deps.pcStorage!.boxes[0]).toHaveLength(0);
    expect(follower.visible).toBe(true); expect(follower.collisionSprite(r.deps.player.x, r.deps.player.y).available).toBe(false);
    r.until(billMain); r.frames(3);
    const ticks = r.transfer.mock.calls.length, reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length;
    renderMenuSession(); renderMenuSession();
    expect([r.transfer.mock.calls.length, r.read.mock.calls.length, r.sync.mock.calls.length]).toEqual([ticks, reads, syncs]);
    r.step('b'); r.frames(3); r.step('b'); r.until(r.ended);
    expect([follower.mapStepX, follower.mapStepY]).toEqual([r.deps.player.mapStepX, r.deps.player.mapStepY]);
    expect(follower.collisionSprite(r.deps.player.x, r.deps.player.y).available).toBe(false);
  });

  it('Change Box delegates the real save callback after switching, through hidden-event/controller input', () => {
    const r = run(true); const storage = r.deps.pcStorage!; let current = 0;
    storage.getCurrentBox = () => current; storage.setCurrentBox = value => { current = value; };
    storage.boxes[0].push(pokemonToBoxed(createPokemon('RATTATA', 5)!));
    vi.mocked(storage.saveGame).mockImplementation(() => { expect(current).toBe(1); expect(storage.boxes[0]).toHaveLength(1); });
    const tiles = () => getMenuSessionTiles();
    r.until(() => tiles()?.at(1, 2) === '▶'); r.frames(3); r.step('a');
    r.until(() => tiles()?.at(2, 2) === 'W' && tiles()?.at(1, 2) === '▶'); r.frames(3);
    for (let i = 0; i < 3; i++) { r.step('down'); r.frames(3); } r.step('a');
    r.until(() => r.box.isComplete); r.frames(3); r.step('a'); r.frames(15);
    r.until(() => tiles()?.at(12, 1) === '▶'); r.frames(3); r.step('down'); r.frames(3); r.step('a');
    r.until(() => vi.mocked(storage.saveGame).mock.calls.length === 1);
    expect(playSFX).toHaveBeenCalledWith('save');
  });

  it.each([false, true])('facing-up PC dispatch (generic=%s) opens once, first print +20 / glyph +23', generic => {
    const r = run(generic);
    expect(r.box.uiTileAt(1, 12) > 0).toBe(!generic);
    r.frames(19); expect(r.print).not.toHaveBeenCalled();
    r.step(); expect(r.print).toHaveBeenCalledTimes(1);
    expect(r.box.saveScreen().buffer[41]).toBe(' ');
    r.frames(2); expect(r.box.saveScreen().buffer[41]).toBe(' ');
    r.step(); expect(r.box.saveScreen().buffer[41]).not.toBe(' ');
    expect(r.open).toHaveBeenCalledTimes(1);
  });

  it('hidden event requires the cartridge facing', () => {
    expect(world(false, 'down').action).toBeNull();
    expect(world(true, 'down').action).toBeNull();
  });

  it.each([0, 1, 2])('a single-frame menu tap at idle offset %s is read, with one text/transfer owner', offset => {
    const r = run(); r.until(() => getMenuSessionTiles()?.at(1, 2) === '▶'); r.frames(3 + offset);
    r.step('a');
    expect(r.print.mock.calls.some(([source]) => 'program' in source && source.program === 'WhatToWithdrawText')).toBe(true);
    // PlayerPC's first branch is instant; after the list, nine glyphs type
    // between PrintText Delay3 and DisplayChooseQuantityMenu's first read.
    r.frames(19); r.step('a'); r.frames(13); r.step('a');
    expect(r.deps.pcItems![0].count).toBe(1);
    expect(r.deps.playerBag.items).toEqual([{ id: 'POTION', count: 1 }]);
    r.until(() => getMenuSessionTiles()?.at(5, 4) === '▶'); r.frames(3);
    r.step('b'); r.frames(6); r.step('b');
    r.until(r.ended);
    expect(r.finish).toHaveBeenCalledWith({ outerWait: false, reload: undefined });
    expect(r.open).toHaveBeenCalledTimes(1);
    expect(getMenuSessionTiles()).toBeNull();
  });

  it('spends turn-off wait without reads, then Holds A and closes without an outer wait', () => {
    const r = run(); r.until(() => getMenuSessionTiles()?.at(1, 2) === '▶'); r.frames(3);
    r.step('b'); const reads = r.read.mock.calls.length; const syncs = r.sync.mock.calls.length;
    r.frames(3); expect(r.read.mock.calls.length).toBe(reads); expect(r.sync.mock.calls.length).toBe(syncs);
    r.step('a'); // sound ends: HoldTextDisplayOpen sees A held
    expect(r.box.phase).toBe('holding'); r.frames(2); // A released, so closing starts
    r.until(r.ended);
    expect(r.finish).toHaveBeenCalledTimes(1);
  });

  it('Bill retained menu renders without advancing a frame and resumes the same display', () => {
    const r = run(true); r.until(() => getMenuSessionTiles()?.at(1, 2) === '▶'); r.frames(3); r.step('a');
    r.until(() => getMenuSessionTiles()?.at(2, 2) === 'W' && getMenuSessionTiles()?.at(1, 2) === '▶'); r.frames(3);
    expect(isScriptMenuFullScreen()).toBe(false);
    const ticks = r.transfer.mock.calls.length;
    renderMenuSession(); renderMenuSession();
    expect(r.transfer.mock.calls.length).toBe(ticks);
    r.step(); r.step('b'); r.frames(3);
    expect(isScriptMenuFullScreen()).toBe(false); expect(r.open).toHaveBeenCalledTimes(1);
    r.step('b'); r.until(r.ended);
    expect(r.finish).toHaveBeenCalledWith({ outerWait: false, reload: undefined });
  });

  it('entry envelopes have no invented outer dismissal', () => {
    expect(getHiddenEventScript('RED_PC')).toEqual([{ type: 'displayOpen', autoBox: true }, { type: 'pc', mode: 'direct' }, { type: 'displayClose', outerWait: false }]);
    expect(getHiddenEventScript('POKECENTER_PC')).toEqual([{ type: 'displayOpen', autoBox: false }, { type: 'pc', mode: 'generic' }, { type: 'displayClose', outerWait: false }]);
  });
});
