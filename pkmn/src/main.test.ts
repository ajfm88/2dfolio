// Main's actual state dispatch; Vitest alone exposes lexical bindings (see config).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } });
});
vi.mock('./audio', () => ({ tickAudio: vi.fn(), playSFX: vi.fn(), playMusic: vi.fn(), stopMusic: vi.fn(), isSoundFinished: () => true }));
vi.mock('./debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('./renderer', () => ({
  fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(), getScale: () => 1,
  getCtx: () => ({ drawImage() {} }), getActivePalette: () => 'PALLET',
  setActivePalette: vi.fn(), getMapPalette: () => 'PALLET',
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }),
  loadTilesetTransparent: async () => ({ width: 128 }),
  loadSprite: async () => ({ width: 16, height: 96 }), loadBattleSprite: async () => ({ width: 56 }),
  captureUi: (draw: () => void) => { uiTiles.clear(); draw(); return () => {}; },
}));
import * as main from './main';
import * as input from './input';
import { restoreFlags } from './events';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { initTextSystem, loadGameText } from './text';
import { loadTextPrograms } from './text/program_data';
import { textBgTransfer } from './text/bg_transfer';
import { createPokemon, loadBattleData } from './battle';
import { playSFX } from './audio';
import { uiTiles } from './renderer/ui_tiles';
import { drawTile, fillRect } from './renderer';
import { getBattleAndStartSavedMenuItem, setBattleAndStartSavedMenuItem } from './list_state';
import * as saves from './save';
import type { GameButton } from './core';
import type { StartMenuSession } from './menus/start_menu';
import type { PartyMenu, BagSession, OptionMenu, PokedexMenu, TrainerCard, SaveSession } from './menus';
import type { BattlePokemon } from './battle';
import type { Player, GameMap } from './overworld';
import type { PikachuFollower } from './pikachu';
import type { OverworldDeps } from './overworld';
import type { TextBox } from './text/textbox';
import { setTextSpeed } from './text/textbox';

const host = (main as unknown as { mainTest: {
  gameTick(): void; checkUiEntry(): void; drawUiLayer(): void; openStartMenu(): void;
  restOfPass(deps: OverworldDeps): void; overworldDeps(): OverworldDeps;
  reset(): void; startNewGame(): Promise<void>; loadSavedGame(): Promise<void>;
  readonly state: string; readonly fade: number;
  startMenu: StartMenuSession; partyMenu: PartyMenu; bagMenu: BagSession;
  optionMenu: OptionMenu; pokedexMenu: PokedexMenu; trainerCard: TrainerCard; saveMenu: SaveSession;
  textBox: TextBox;
  playerParty: BattlePokemon[]; player: Player; gameMap: GameMap; pikachuFollower: PikachuFollower;
} }).mainTest;
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
beforeAll(async () => {
  await Promise.all([initTextSystem(), loadGameText(), loadTextPrograms(), loadMapSpriteSets(), loadBattleData()]);
});
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); host.reset(); restoreFlags(['GOT_POKEDEX']);
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); } });
  setTextSpeed('fast');
  host.pikachuFollower.visible = false;
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  for (const key of buttons) input.setKey(key, false);
  input.updateInput(); input.syncJoypadRead();
});

describe('SAVE through main dispatch and real storage', () => {
  it.each([0, 1, 2])('paints the retained SAVE message in the first shared-close frame, offset %i (note 53 M5)', offset => {
    setBattleAndStartSavedMenuItem(4); const r = driver();
    host.openStartMenu(); r.wait(23); r.step('a'); r.wait(45);
    for (let n = 0; !host.textBox.isComplete && n < 1000; n++) r.step();
    r.wait(3 + offset); r.step('a');
    for (let n = 0; host.state === 'save_menu' && n < 1000; n++) r.step();
    expect(host.state).toBe('menu_closing'); expect(host.textBox.active).toBe(true);
    vi.mocked(drawTile).mockClear(); host.textBox.render();
    const message = vi.mocked(drawTile).mock.calls.filter(c => c[3] >= 112 && c[2] > 0 && c[2] < 152);
    expect(message.length).toBeGreaterThan(0);
    vi.mocked(drawTile).mockClear(); vi.mocked(fillRect).mockClear(); host.drawUiLayer();
    expect(vi.mocked(drawTile).mock.calls).toEqual(expect.arrayContaining(message));
    expect(fillRect).toHaveBeenCalledWith(0, 96, 160, 48, 0);
    r.step(); vi.mocked(drawTile).mockClear(); vi.mocked(fillRect).mockClear(); host.drawUiLayer();
    expect(drawTile).not.toHaveBeenCalled(); expect(fillRect).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2])('YES saves once after +25, auto-closes directly and reloads at idle offset %i', async offset => {
    setBattleAndStartSavedMenuItem(4);
    const r = driver(), write = vi.spyOn(saves, 'saveGame');
    host.playerParty.push(createPokemon('PIKACHU', 5)!);
    host.openStartMenu(); r.wait(23); r.step('a'); expect(host.state).toBe('save_menu');
    r.wait(45);
    for (let n = 0; !host.textBox.isComplete && n < 1000; n++) r.step();
    expect(host.textBox.isComplete).toBe(true); r.wait(3 + offset); r.step('a');
    r.wait(24); expect(write).not.toHaveBeenCalled(); r.step(); expect(write).toHaveBeenCalledOnce();
    for (let n = 0; host.state === 'save_menu' && n < 1000; n++) r.step();
    expect(host.state).toBe('menu_closing'); expect(host.startMenu.tiles.at(11, 10)).toBe('▷');
    r.wait(6); expect(host.state).toBe('menu_closing'); r.step(); expect(host.state).toBe('overworld');
    expect(host.textBox.active).toBe(false); // note 53 M1: close must dismiss a released-A SAVE display
    expect(write).toHaveBeenCalledOnce(); expect(playSFX).toHaveBeenCalledWith('save');
    const saved = saves.loadGame()!;
    expect(saved.mapName).toBe('RedsHouse2F'); expect(saved.party[0].speciesName).toBe('Pikachu');
    expect(JSON.stringify(saved)).not.toContain('SavedMenuItem');
    expect([saved.playerX, saved.playerY]).toEqual([host.player.x, host.player.y]);
    await host.loadSavedGame();
    expect([host.player.x, host.player.y]).toEqual([saved.playerX, saved.playerY]);
    expect(host.playerParty[0].species.name).toBe('Pikachu');
  });

  it.each(['b', 'no'] as const)('%s closes straight to the overworld with no save, redisplay or extra copy', answer => {
    setBattleAndStartSavedMenuItem(4); const r = driver(), write = vi.spyOn(saves, 'saveGame');
    host.openStartMenu(); r.wait(23); r.step('a');
    r.wait(45);
    for (let n = 0; !host.textBox.isComplete && n < 1000; n++) r.step();
    r.wait(3);
    if (answer === 'no') { r.step('down'); r.wait(3); }
    r.step(answer === 'b' ? 'b' : 'a');
    r.wait(14); expect(host.state).toBe('save_menu'); r.step(); expect(host.state).toBe('menu_closing');
    r.wait(7); expect(host.state).toBe('overworld'); expect(write).not.toHaveBeenCalled();
    expect(saves.loadGame()).toBeNull();
  });

  it('held A after NO retains restored hollow SAVE until release, then starts the shared close that frame', () => {
    setBattleAndStartSavedMenuItem(4); const r = driver();
    host.openStartMenu(); r.wait(23); r.step('a');
    r.wait(45);
    for (let n = 0; !host.textBox.isComplete && n < 1000; n++) r.step();
    r.wait(3); r.step('down'); r.wait(3); r.step('a');
    for (let n = 0; n < 30; n++) r.step('a');
    expect(host.state).toBe('save_menu'); expect(host.startMenu.tiles.at(11, 10)).toBe('▷');
    expect(host.startMenu.tiles.visibleAt(11, 10)).toBe('▷');
    r.step(); expect(host.state).toBe('menu_closing'); r.wait(7); expect(host.state).toBe('overworld');
  });
});
function driver() {
  const read = vi.spyOn(input, 'readJoypad'), sync = vi.spyOn(input, 'syncJoypadRead');
  const transfer = vi.spyOn(textBgTransfer, 'tick');
  const step = (...held: GameButton[]) => {
    for (const key of buttons) input.setKey(key, held.includes(key));
    input.updateInput();
    const reads = read.mock.calls.length, syncs = sync.mock.calls.length, ticks = transfer.mock.calls.length;
    host.gameTick(); host.checkUiEntry();
    expect(read.mock.calls.length > reads && sync.mock.calls.length > syncs).toBe(false);
    expect(transfer.mock.calls.length - ticks).toBeLessThanOrEqual(1);
  };
  const wait = (n: number) => { for (let i = 0; i < n; i++) step(); };
  return { step, wait, read, sync, transfer };
}

describe('START through main dispatch', () => {
  it.each([0, 1, 2])('retains the actual bag scanout through all five ITEM copy frames, offset %i (note 53 M6)', offset => {
    setBattleAndStartSavedMenuItem(2);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(16 + offset);
    const underlay = host.startMenu.tiles.saveVisibleTiles();
    const bag = host.bagMenu.tiles.saveVisibleTiles().map((tile, i) => tile ?? underlay[i]);
    expect(bag).not.toEqual(underlay);
    r.step('b'); expect(host.state).toBe('start_menu');
    expect(host.startMenu.tiles.saveVisibleTiles()).toEqual(bag);
    for (let frame = 1; frame <= 5; frame++) {
      r.step(); expect(host.startMenu.tiles.saveVisibleTiles(), `ITEM copy frame ${frame}`).toEqual(bag);
    }
    r.wait(3);
    expect(host.startMenu.tiles.saveVisibleTiles()).toEqual(host.startMenu.tiles.saveTiles());
  });

  it('runs one opening sprite hook and one +20 hook, without an extra UiEntry update', () => {
    const r = driver(); host.pikachuFollower.visible = true;
    const sprites = vi.spyOn(host.pikachuFollower, 'fontLoadedUpdate');
    host.openStartMenu(); host.checkUiEntry();
    expect(sprites).toHaveBeenCalledOnce(); expect(uiTiles.tileAt(10, 0)).toBe(0x60);
    r.wait(19); expect(sprites).toHaveBeenCalledOnce();
    r.step(); expect(sprites).toHaveBeenCalledTimes(2);
    r.wait(10); expect(sprites).toHaveBeenCalledTimes(2);
  });

  it('resets the WRAM cursor on both a new game and a loaded game', async () => {
    setBattleAndStartSavedMenuItem(5); await host.startNewGame();
    expect(getBattleAndStartSavedMenuItem()).toBe(0);
    setBattleAndStartSavedMenuItem(4);
    vi.spyOn(saves, 'loadGame').mockReturnValue({ version: 1, mapName: 'RedsHouse2F',
      playerX: 48, playerY: 32, playerDirection: 'down', party: [], bag: [], money: 3000,
      defeatedTrainers: [], eventFlags: [] });
    await host.loadSavedGame(); expect(getBattleAndStartSavedMenuItem()).toBe(0);
  });

  it.each([0, 1, 2])('opens from the real overworld START read and accepts an idle tap at offset %i', offset => {
    const r = driver();
    input.setKey('start', true); input.updateInput(); input.readJoypad();
    host.restOfPass(host.overworldDeps()); host.checkUiEntry();
    expect(host.state).toBe('start_menu'); expect(playSFX).not.toHaveBeenCalled();
    r.wait(19); expect(playSFX).not.toHaveBeenCalled();
    r.step(); expect(playSFX).toHaveBeenCalledWith('start_menu');
    r.wait(3 + offset); const syncs = r.sync.mock.calls.length;
    r.step('a'); expect(host.state).toBe('dex');
    expect(r.sync).toHaveBeenCalledTimes(syncs);
    expect(host.startMenu.buffer2()[2 * 20 + 11]).toBe('▷');
  });

  it.each(['b', 'start', 'a'] as const)('closes by %s with the private five-frame prefix and unchanged seven-frame shared core', key => {
    const r = driver(); host.openStartMenu(); r.wait(23);
    if (key === 'a') { r.step('up'); r.wait(3); }
    r.step(key); expect(host.state).toBe('start_menu');
    const reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length;
    r.wait(4); expect(host.state).toBe('start_menu');
    r.step(); expect(host.state).toBe('menu_closing');
    r.wait(6); expect(host.state).toBe('menu_closing');
    r.step(); expect(host.state).toBe('overworld');
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.sync).toHaveBeenCalledTimes(syncs);
    expect(vi.mocked(playSFX).mock.calls.filter(([s]) => s === 'press_ab')).toHaveLength(key === 'start' ? 0 : 1);
  });

  it.each(([
    ['dex', 0, 3], ['party', 1, 35], ['item', 2, 5], ['trainer', 3, 20], ['option', 5, 5],
  ] as const).flatMap(([kind, row, waits]) => [0, 1, 2].map(offset => [kind, row, waits, offset] as const)))('runs %s return tail, row %i, %i frames and idle offset %i', async (kind, row, waits, offset) => {
    setBattleAndStartSavedMenuItem(row);
    if (kind === 'party') host.playerParty.push(createPokemon('PIKACHU', 5)!);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a');
    if (kind === 'trainer') await Promise.resolve();
    expect(host.state).toBe({ dex: 'dex', party: 'party_menu', item: 'item_menu', trainer: 'trainer_card', option: 'option_menu' }[kind]);
    // Each existing submenu's own flow is outside the START-side tail. Trigger its
    // actual return branch without conflating internal timing with this audit.
    if (kind === 'dex') vi.spyOn(host.pokedexMenu, 'update').mockReturnValue('closed');
    if (kind === 'party') vi.spyOn(host.partyMenu, 'update').mockReturnValue('close');
    if (kind === 'trainer') vi.spyOn(host.trainerCard, 'update').mockReturnValue(true);
    if (kind === 'option') vi.spyOn(host.optionMenu, 'update').mockReturnValue(true);
    if (kind === 'item') { r.wait(16); } // actual retained list input, no mocked exit
    r.step('b'); expect(host.state).toBe('start_menu');
    const reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length;
    r.wait(waits - 1);
    expect(host.startMenu.tiles.at(11, 2 + row * 2)).toBe('▷');
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.sync).toHaveBeenCalledTimes(syncs);
    if (kind === 'party' || kind === 'trainer') expect(host.fade).toBe(1);
    r.step(); expect(host.startMenu.tiles.at(11, 2 + row * 2)).toBe('▶'); expect(host.fade).toBe(0);
    r.wait(2); expect(r.read).toHaveBeenCalledTimes(reads);
    r.wait(offset); r.step('a'); expect(host.state).not.toBe('start_menu');
    expect(getBattleAndStartSavedMenuItem()).toBe(row);
  });

  it('empty party redraws in the accepting frame and reads +3; render never advances ownership', () => {
    setBattleAndStartSavedMenuItem(1);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a');
    expect(host.state).toBe('start_menu'); expect(host.startMenu.tiles.at(11, 4)).toBe('▶');
    const reads = r.read.mock.calls.length, ticks = r.transfer.mock.calls.length;
    host.drawUiLayer(); host.drawUiLayer();
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.transfer).toHaveBeenCalledTimes(ticks);
    r.wait(2); expect(r.read).toHaveBeenCalledTimes(reads);
    r.step('b'); expect(host.startMenu.closing).toBe(true);
  });

  it('retains START beneath the real bag and dispatches the SAVE session', () => {
    setBattleAndStartSavedMenuItem(2);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(16);
    expect(host.startMenu.tiles.visibleAt(11, 6)).toBe('▷');
    r.step('b'); r.wait(8);
    r.step('down'); r.wait(3); r.step('down'); r.wait(3); r.step('a');
    expect(host.state).toBe('save_menu');
    expect(host.startMenu.tiles.at(11, 10)).toBe('▷');
    expect(textBgTransfer.enabled).toBe(false);
  });
});
