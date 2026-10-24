// Main's actual state dispatch; Vitest alone exposes lexical bindings (see config).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } });
});
// Map-music CP3: main's map-music entries (DF, six passes, restores, blackout stop) are facade calls.
vi.mock('./audio', () => ({ setMasterVolume: vi.fn(), tickAudio: vi.fn(), playSFX: vi.fn(), playMusic: vi.fn(), stopMusic: vi.fn(), isSoundFinished: vi.fn(() => true), isSfxPlaying: () => false,
  playMusicNew: vi.fn(), playDefaultMusic: vi.fn(), playDefaultMusicFadeOutCurrent: vi.fn(), restoreNurseMusic: vi.fn(), updateMusic6Times: vi.fn(),
  fadeOutAndStopMusic: vi.fn(), isAudioFadingOut: vi.fn(() => false), stopAllSounds: vi.fn(),
  isMusicChannelActive: vi.fn(() => false), preloadMusic: vi.fn(async () => {}) }));
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
vi.mock('./battle', async importOriginal => {
  const actual = await importOriginal<typeof import('./battle')>();
  return { ...actual, updateCatchDemo: vi.fn(actual.updateCatchDemo) }; // passthrough; one test scripts its end
});
vi.mock('./battle/battle_ui', async importOriginal => {
  const actual = await importOriginal<typeof import('./battle/battle_ui')>();
  return { ...actual, createSilhouette: () => ({ width: 1, height: 1 }) as never }; // no canvas in node
});
import { loadStatusScreenAssets } from './menus/status_screen';
import { Battle } from './battle/battle';
import * as main from './main';
import * as input from './input';
import { restoreFlags } from './events';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { initTextSystem, loadGameText } from './text';
import { loadTextPrograms } from './text/program_data';
import { textBgTransfer } from './text/bg_transfer';
import { createPokemon, loadBattleData, updateCatchDemo } from './battle';
import { playSFX, isSoundFinished, playDefaultMusicFadeOutCurrent, playDefaultMusic, playMusicNew, restoreNurseMusic, updateMusic6Times,
  stopMusic, stopAllSounds, fadeOutAndStopMusic, isAudioFadingOut } from './audio';
import { isNoMapMusic, setNoMapMusic } from './audio/audio_flags';
import { Bag } from './items';
import { uiTiles } from './renderer/ui_tiles';
import { drawTile, fillRect, drawFadeOverlay, drawSprite } from './renderer';
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
import { disablePikachuFollowing, enablePikachuFollowing, isPikachuFollowingDisabled } from './pikachu/pikachu_following';
import type { ScriptCommand } from './script/types';
import * as scriptModule from './script';
import { pokemonToBoxed } from './pokemon_storage';
import { getMenuSessionTiles } from './script/script_controller';
import { pikachuEmotionPhase, pikachuEmotionNumber, pikachuEmotionBubble, clearPikachuEmotion } from './pikachu/pikachu_emotion';
import { TextBox as RealTextBox } from './text/textbox';
import * as partyIcons from './menus/party_icons';
import { loadTileset } from './renderer';
import { setPartyAndBillsSavedMenuItem } from './list_state';
import { pikachuAnimScriptFor } from './pikachu/pikachu_happiness';
import { drawZzzBubble } from './renderer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const host = (main as unknown as { mainTest: {
  gameTick(): void; checkUiEntry(): void; drawUiLayer(): void; openStartMenu(): void;
  renderPikachuEmotionScene(): void;
  restOfPass(deps: OverworldDeps): void; overworldDeps(): OverworldDeps;
  reset(): void; startNewGame(): Promise<void>; loadSavedGame(): Promise<void>;
  handleWarpLoad(map: string, warp: number): Promise<void>; handleBlackoutWarp(): void;
  connectToMap(map: string, direction: 'north' | 'south', offset: number): Promise<void>;
  finishFade(): Promise<void>; startScript(commands: ScriptCommand[]): void;
  state: string; readonly mapName: string; mainMenu: { update(): unknown }; readonly fade: number; readonly bag: Bag; battle: Battle | null;
  startMenu: StartMenuSession; partyMenu: PartyMenu; bagMenu: BagSession;
  optionMenu: OptionMenu; pokedexMenu: PokedexMenu; trainerCard: TrainerCard; saveMenu: SaveSession;
  textBox: TextBox;
  mapNpcs: [];
  playerParty: BattlePokemon[]; player: Player; gameMap: GameMap; pikachuFollower: PikachuFollower;
} }).mainTest;
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
beforeAll(async () => {
  await Promise.all([initTextSystem(), loadGameText(), loadTextPrograms(), loadMapSpriteSets(), loadBattleData(), loadStatusScreenAssets()]);
});
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); host.reset(); restoreFlags(['GOT_POKEDEX']);
  enablePikachuFollowing();
  clearPikachuEmotion(); setPartyAndBillsSavedMenuItem(0);
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); } });
  setTextSpeed('fast');
  host.pikachuFollower.visible = false;
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  for (const key of buttons) input.setKey(key, false);
  input.updateInput(); input.syncJoypadRead();
});

describe('checkpoint-02 main storage callback', () => {
  it('the live party SWITCH moves each stat-exp tuple with its Pokemon', () => {
    const a = createPokemon('RATTATA', 10)!, b = createPokemon('PIDGEY', 10)!;
    const first = a.statExp = [1, 2, 3, 4, 5], second = b.statExp = [65535, 256, 63002, 0, 1];
    host.playerParty.push(a, b); setBattleAndStartSavedMenuItem(1);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(23);
    r.step('a'); r.step(); r.step('a'); r.step();
    r.step('down'); r.step(); r.step('a');
    expect(host.playerParty).toEqual([b, a]);
    expect(host.playerParty[0].statExp).toBe(second); expect(host.playerParty[1].statExp).toBe(first);
    expect(host.playerParty.map(mon => mon.statExp)).toEqual([[65535, 256, 63002, 0, 1], [1, 2, 3, 4, 5]]);
  });

  it('old and new boxes deserialize with independent stat-exp arrays and the unchanged EXP reset', async () => {
    await host.gameMap.load('PewterPokecenter');
    const update = vi.spyOn(scriptModule, 'updateScript');
    host.startScript([]); host.gameTick();
    const storage = update.mock.calls[0][0].pcStorage!;
    const boxed = pokemonToBoxed(createPokemon('RATTATA', 10)!); boxed.exp = 1234;
    delete boxed.statExp;
    const a = storage.deserialize(boxed)!, b = storage.deserialize(boxed)!;
    expect(a.statExp).toEqual([0, 0, 0, 0, 0]); expect(b.statExp).toEqual([0, 0, 0, 0, 0]);
    a.statExp[0] = 5; expect(b.statExp[0]).toBe(0); expect(boxed.statExp).toBeUndefined();
    boxed.statExp = [1, 256, 63002, 64517, 65535];
    const c = storage.deserialize(boxed)!;
    expect(c.statExp).toEqual(boxed.statExp); expect(c.statExp).not.toBe(boxed.statExp);
    c.statExp[0] = 999; expect(boxed.statExp[0]).toBe(1);
    expect([a.exp, b.exp, c.exp]).toEqual([1000, 1000, 1000]);
    expect([c.maxHp, c.attack, c.speed]).toEqual([a.maxHp, a.attack, a.speed]);
  });
});

describe('V2c CP3 through main load paths and storage callback', () => {
  it('new game clears following-disabled after loading the real bedroom map', async () => {
    disablePikachuFollowing(); await host.startNewGame();
    expect(host.gameMap.mapData?.name).toBe('RedsHouse2F');
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('CONTINUE clears following-disabled after restoring a real save in Pewter', async () => {
    vi.spyOn(saves, 'loadGame').mockReturnValue({ version: 1, mapName: 'PewterPokecenter',
      playerX: 80, playerY: 48, playerDirection: 'down', party: [], bag: [], money: 3000,
      defeatedTrainers: [], eventFlags: [] });
    disablePikachuFollowing(); await host.loadSavedGame();
    expect(host.gameMap.mapData?.name).toBe('PewterPokecenter');
    expect([host.player.x, host.player.y]).toEqual([80, 48]);
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('the Pokécenter door through handleWarpLoad clears the flag', async () => {
    await host.gameMap.load('PewterPokecenter');
    const door = host.gameMap.mapData!.warps[0];
    expect(door.destMap).toBe('PewterCity');
    disablePikachuFollowing(); await host.handleWarpLoad(door.destMap, door.destWarpId);
    expect(host.gameMap.mapData?.name).toBe('PewterCity');
    expect(isPikachuFollowingDisabled()).toBe(false);
  });

  it('handleBlackoutWarp runs its real fade callback and map load without waking', async () => {
    await host.gameMap.load('PewterPokecenter');
    disablePikachuFollowing(); host.handleBlackoutWarp();
    expect(host.state).toBe('transition'); expect(isPikachuFollowingDisabled()).toBe(true);
    await host.finishFade();
    expect(host.gameMap.mapData?.name).toBe('PalletTown');
    expect(host.pikachuFollower.visible).toBe(false);
    expect(isPikachuFollowingDisabled()).toBe(true);
    await host.finishFade(); expect(host.state).toBe('overworld');
    expect(isPikachuFollowingDisabled()).toBe(true);
  });

  it('a real Route2 → Pewter connection retains following-disabled', async () => {
    await host.gameMap.load('Route2'); host.player.setTilePosition(10, 0);
    const connection = host.gameMap.mapData!.connections.find(c => c.direction === 'north')!;
    expect(connection.mapName).toBe('PewterCity');
    disablePikachuFollowing(); await host.connectToMap(connection.mapName, 'north', connection.offset);
    expect(host.gameMap.mapData?.name).toBe('PewterCity'); expect(host.state).toBe('overworld');
    expect(host.player.y).toBe(host.gameMap.height * 32 - 16);
    expect(isPikachuFollowingDisabled()).toBe(true);
  });

  it('Bill’s DEPOSIT prints SleepingPikachuText2 using main’s live storage callback', async () => {
    await host.startNewGame(); await host.handleWarpLoad('PewterPokecenter', 0);
    expect(host.gameMap.mapData?.name).toBe('PewterPokecenter');
    // Complete the entry transition, then enter the real script/PC host.
    await host.finishFade();
    host.playerParty.push(createPokemon('PIKACHU', 5)!, createPokemon('RATTATA', 5)!);
    const printed: string[] = []; const print = host.textBox.print.bind(host.textBox);
    vi.spyOn(host.textBox, 'print').mockImplementation((source, opts) => {
      if ('program' in source) printed.push(source.program); print(source, opts);
    });
    const r = driver(); host.startScript([{ type: 'displayOpen' }, { type: 'pc', mode: 'generic' },
      { type: 'displayClose', outerWait: false }]);
    const until = (predicate: () => boolean) => {
      for (let i = 0; i < 2000 && !predicate(); i++) {
        r.step(...(host.textBox.isWaitingForInput && i % 4 === 0 ? ['a'] as const : []));
      }
      expect(predicate(), printed.join(', ')).toBe(true);
    };
    until(() => getMenuSessionTiles()?.at(1, 2) === '▶'); r.wait(4); r.step('a'); // SOMEONE's PC
    until(() => getMenuSessionTiles()?.at(2, 4) === 'D'); r.wait(5); // Bill's main menu: DEPOSIT row
    r.step('down'); r.wait(3); r.step('a'); r.wait(20);
    // Set the flag AFTER entering storage, proving the callback reads the live bit.
    disablePikachuFollowing(); r.step('a');
    until(() => printed.includes('SleepingPikachuText2'));
    expect(host.playerParty.map(p => p.species.id)).toEqual([25, 19]);
    expect(printed).not.toContain('MonWasStoredText');
  });
});

describe('StatusScreen through main party and battle dispatch', () => {
  it.each([0, 1, 2])('START → POKéMON reveals R+19 and first reads R+22 with one owner, offset %i', offset => {
    host.playerParty.push(createPokemon('PIKACHU', 5)!);
    setBattleAndStartSavedMenuItem(1);
    const r = driver(); host.openStartMenu(); r.wait(23 + offset); r.step('a');
    const reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length, ticks = r.transfer.mock.calls.length;
    expect(host.partyMenu.paletteWhite).toBe(true);
    for (let frame = 1; frame <= 21; frame++) {
      r.step(...(frame === 21 ? ['b'] as const : [])); expect(host.partyMenu.paletteWhite).toBe(frame < 19);
      expect(r.read).toHaveBeenCalledTimes(reads); expect(r.sync).toHaveBeenCalledTimes(syncs);
      expect(r.transfer).toHaveBeenCalledTimes(ticks + frame);
      if (frame < 19) {
        vi.mocked(drawFadeOverlay).mockClear(); host.partyMenu.render();
        expect(drawFadeOverlay).toHaveBeenCalledWith(1);
        expect(r.transfer).toHaveBeenCalledTimes(ticks + frame);
      }
    }
    // B held only since R+21 is accepted on the first actual read, R+22.
    r.step('b'); expect(host.state).toBe('start_menu');
    expect(r.read).toHaveBeenCalledTimes(reads + 1); expect(r.sync).toHaveBeenCalledTimes(syncs);
    expect(r.transfer).toHaveBeenCalledTimes(ticks + 22);
  });

  it('main presents medicine white/reveal on R+19 and P+51, with first reads R+22 and P+54', () => {
    const mon = createPokemon('RATTATA', 5)!;
    host.playerParty.push(mon); host.bag.items = [{ id: 'POTION', count: 2 }];
    setBattleAndStartSavedMenuItem(2);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a');
    r.wait(16); r.step('a'); r.wait(3); r.step('a'); // USE = R
    expect(host.bagMenu.medicineOpen).toBe(true); expect(host.fade).toBe(1);
    const reads = r.read.mock.calls.length, ticks = r.transfer.mock.calls.length;
    for (let frame = 1; frame <= 22; frame++) {
      r.step(); expect(host.fade, `R+${frame}`).toBe(frame < 19 ? 1 : 0);
      expect(r.read).toHaveBeenCalledTimes(reads + (frame === 22 ? 1 : 0));
      expect(r.transfer).toHaveBeenCalledTimes(ticks + frame);
    }
    r.step('b'); expect(host.fade).toBe(1); // P
    const returningReads = r.read.mock.calls.length, returningTicks = r.transfer.mock.calls.length;
    for (let frame = 1; frame <= 54; frame++) {
      r.step(); expect(host.fade, `P+${frame}`).toBe(frame < 51 ? 1 : 0);
      expect(r.read).toHaveBeenCalledTimes(returningReads + (frame === 54 ? 1 : 0));
      expect(r.transfer).toHaveBeenCalledTimes(returningTicks + frame);
    }
    expect(host.bag.items).toEqual([{ id: 'POTION', count: 2 }]);
    expect(mon.currentHp).toBe(mon.maxHp);
  });
  it.each(['overworld', 'battle', 'forced'] as const)('runs both pages and returns to the same mon in %s mode', mode => {
    const party = [createPokemon('PIKACHU', 5)!, createPokemon('RATTATA', 5)!];
    host.playerParty.push(...party); const r = driver();
    let menu = host.partyMenu;
    if (mode === 'overworld') {
      setBattleAndStartSavedMenuItem(1); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(23);
      expect(host.state).toBe('party_menu');
    } else {
      const battle = new Battle(party[0], createPokemon('PIDGEY', 5)!, party, new Bag(), new Set(), 'ASH');
      Reflect.set(battle, 'state', mode === 'forced' ? 'forced_switch' : 'choose_pokemon');
      menu = Reflect.get(battle, 'partyMenu') as PartyMenu;
      menu.showForBattle(party, 0, mode === 'forced'); host.battle = battle;
    }
    r.step('down'); r.step(); r.step('a'); r.step(); r.step('down'); r.step(); r.step('a');
    expect(menu.statusScreenActive).toBe(true);
    const selected = Reflect.get(menu, 'cursor'); expect(selected).toBe(1);
    const read = r.read.mock.calls.length, sync = r.sync.mock.calls.length, ticks = r.transfer.mock.calls.length;
    r.wait(26); expect(r.read).toHaveBeenCalledTimes(read); expect(r.sync).toHaveBeenCalledTimes(sync);
    expect(r.transfer).toHaveBeenCalledTimes(ticks + 26);
    r.step(); expect(r.read).toHaveBeenCalledTimes(read + 1);
    r.step('b'); r.wait(3); expect(menu.statusScreenActive).toBe(true);
    r.step('b'); r.wait(2); expect(menu.statusScreenActive).toBe(true);
    r.step(); expect(menu.statusScreenActive).toBe(false);
    expect(Reflect.get(menu, 'state')).toBe('list'); expect(Reflect.get(menu, 'cursor')).toBe(selected);
    expect(r.transfer).toHaveBeenCalledTimes(ticks + 35);
    if (mode === 'overworld') {
      const before = r.read.mock.calls.length, synced = r.sync.mock.calls.length;
      expect(menu.paletteWhite).toBe(true); r.wait(18); expect(menu.paletteWhite).toBe(true);
      r.step(); expect(menu.paletteWhite).toBe(false); // Q+22 = C+19
      r.wait(2); expect(r.read).toHaveBeenCalledTimes(before);
      r.step(); expect(r.read).toHaveBeenCalledTimes(before + 1); // Q+25 = C+22
      expect(r.sync).toHaveBeenCalledTimes(synced);
      expect(Reflect.get(menu, 'cursor')).toBe(selected);
      expect(r.transfer).toHaveBeenCalledTimes(ticks + 57);
    }
  });
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

describe('V2c CP4 through main', () => {
  async function talk(mapName = 'PewterPokecenter', disabled = true, status: BattlePokemon['status'] = null) {
    const face = { clearRect: vi.fn(), drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width: 40, height: 40, getContext: () => face }) });
    await host.startNewGame();
    restoreFlags(['BATTLED_RIVAL_IN_OAKS_LAB', 'GOT_POKEDEX']);
    await host.handleWarpLoad(mapName, 0); await host.finishFade();
    const mon = createPokemon('PIKACHU', 5)!; mon.status = status; host.playerParty.push(mon);
    host.player.setTilePosition(10, 8); host.player.direction = 'up';
    const p = host.pikachuFollower; await p.loadSprite(); p.visible = true; p.spawn(host.player.x, host.player.y, 'down');
    p.direction = 'left'; p.showStandingImage('left');
    if (disabled) disablePikachuFollowing();
    const r = driver();
    input.setKey('a', true); input.updateInput(); input.readJoypad();
    host.restOfPass(host.overworldDeps()); host.checkUiEntry();
    expect(host.state).toBe('pikachu_emotion');
    await Promise.resolve();
    return { p, mon, r, face };
  }

  it('runs no-turn, 61-frame ZZZ, border, all 100 portrait ticks, SHOWMAPVIEW, wake, facing restore and close', async () => {
    const s = await talk(); const { p, r, face } = s;
    expect(pikachuEmotionNumber()).toBe(26); expect(p.direction).toBe('left');
    const movement = vi.spyOn(p, 'startMovement'); const normal = vi.spyOn(p, 'updateSprite');
    const npcs = host.overworldDeps().npcs;
    const npcUpdates = npcs.map(npc => vi.spyOn(npc, 'update'));
    const npcPositions = npcs.map(npc => [npc.x, npc.y, npc.direction]);
    const font = p.fontLoadedUpdate.bind(p);
    const covered = vi.spyOn(p, 'fontLoadedUpdate');
    const reads = r.read.mock.calls.length, syncs = r.sync.mock.calls.length;
    r.step('a'); expect(pikachuEmotionPhase()).toBe('bubble'); expect(pikachuEmotionBubble()).toBe(p);
    host.renderPikachuEmotionScene();
    expect(drawZzzBubble).toHaveBeenCalledExactlyOnceWith(p.x - host.player.getCameraX(), p.y - host.player.getCameraY() - 4);
    for (let frame = 1; frame <= 60; frame++) {
      r.step('a'); expect(pikachuEmotionPhase()).toBe('bubble');
      expect(p.direction).toBe('left'); expect(p.imageVisible).toBe(true);
      expect(pikachuEmotionBubble()).toBe(p);
    }
    expect(covered).not.toHaveBeenCalled(); expect(normal).not.toHaveBeenCalled(); expect(movement).not.toHaveBeenCalled();
    for (const update of npcUpdates) expect(update).not.toHaveBeenCalled();
    expect(npcs.map(npc => [npc.x, npc.y, npc.direction])).toEqual(npcPositions);
    expect(r.read).toHaveBeenCalledTimes(reads); expect(r.sync).toHaveBeenCalledTimes(syncs);
    r.step('a'); expect(pikachuEmotionBubble()).toBeNull(); expect(pikachuEmotionPhase()).toBe('border');
    r.wait(2); expect(covered).not.toHaveBeenCalled(); r.step(); expect(covered).toHaveBeenCalledOnce();
    expect(uiTiles.tileAt(6, 5)).toBe(0x60); expect(p.imageVisible).toBe(false);
    r.wait(3); expect(pikachuEmotionPhase()).toBe('portrait');
    const script = pikachuAnimScriptFor(pikachuEmotionNumber()!);
    const expectedFrames = [{ overlay: null, ticks: 20 }, { overlay: 0, ticks: 8 }, { overlay: null, ticks: 20 },
      { overlay: 0, ticks: 8 }, { overlay: 1, ticks: 8 }, { overlay: 2, ticks: 100 }];
    expect(script.frames).toEqual(expectedFrames); expect(script.duration).toBe(100);
    expect(script.overlays.map(o => [o.x, o.y])).toEqual([[0, 0], [0, 0], [0, 0]]);
    const asmPath = resolve(__dirname, '../../refs/pokeyellow/data/pikachu/pikachu_pic_objects.asm');
    if (existsSync(asmPath)) {
      const asm = readFileSync(asmPath, 'utf8').split('PikaPicAnimBGFrames_32:')[1].split('pikaframeend')[0];
      const frames = Array.from(asm.matchAll(/pikaframedelay\s+(\d+)|pikaframe PikaAnimTilemap_(\d+),\s*(\d+)/g), m =>
        m[1] ? { overlay: null, ticks: Number(m[1]) } : { overlay: Number(m[2]) - 9, ticks: Number(m[3]) });
      expect(script.frames).toEqual(frames);
    }
    expect(loadTileset).toHaveBeenCalledWith('/gfx/pikachu/unknown_e5000.png');
    for (const id of ['e50af', 'e7b83', 'e7d13']) expect(loadTileset).toHaveBeenCalledWith(`/gfx/pikachu/unknown_${id}.png`);
    const exitUpdates: boolean[] = [];
    covered.mockImplementation(ctx => {
      exitUpdates.push(isPikachuFollowingDisabled());
      expect(ctx.ui.tileAt(6, 5)).toBe(0); font(ctx);
    });
    for (let tick = 1; tick <= 100; tick++) {
      face.drawImage.mockClear(); r.wait(3);
      const draws = face.drawImage.mock.calls;
      const image = draws[draws.length - 1]?.[0] as { url: string };
      expect(draws[draws.length - 1].slice(1)).toEqual([0, 0]);
      const expected = tick >= 64 ? 'e7d13' : tick >= 56 ? 'e7b83' : tick >= 48 || (tick >= 20 && tick < 28) ? 'e50af' : 'e5000';
      expect(image.url, `portrait tick ${tick}`).toBe(`/gfx/pikachu/unknown_${expected}.png`);
      expect(isPikachuFollowingDisabled()).toBe(true);
      expect(pikachuEmotionPhase()).toBe(tick === 100 ? 'mapview' : 'portrait');
    }
    expect(exitUpdates).toEqual([true]); expect(uiTiles.tileAt(6, 5)).toBe(0);
    const facing = vi.spyOn(p, 'setLiveFacing');
    r.wait(2); expect(isPikachuFollowingDisabled()).toBe(true);
    r.step(); expect(isPikachuFollowingDisabled()).toBe(false); expect(pikachuEmotionPhase()).toBe('closing');
    expect(facing).toHaveBeenLastCalledWith('down'); // player xor 4, image still left
    vi.mocked(drawSprite).mockClear(); p.render(0, 0);
    expect(vi.mocked(drawSprite).mock.calls[0][2]).toBe(32); // live write never paints the down image
    r.step(); expect(facing).toHaveBeenLastCalledWith('left'); expect(p.direction).toBe('left');
    r.wait(17); expect(host.state).toBe('pikachu_emotion'); expect(normal).not.toHaveBeenCalled();
    r.step(); expect(host.state).toBe('overworld'); expect(normal).toHaveBeenCalledOnce();
    expect(p.direction).toBe('left'); expect(pikachuEmotionPhase()).toBeNull();
    const position = [p.x, p.y];
    for (let frame = 0; frame < 20; frame++) r.step('right');
    expect([p.x, p.y]).not.toEqual(position); // the ordinary main pass follows again
  });

  it.each(['SLP', 'PSN'] as const)('Pewter asleep overrides status %s through actual talk dispatch', async status => {
    const s = await talk('PewterPokecenter', true, status);
    expect(pikachuEmotionNumber()).toBe(26); s.r.step(); expect(pikachuEmotionPhase()).toBe('bubble');
  });

  it.each([
    ['ViridianPokecenter', true, 'SLP', 11], ['ViridianPokecenter', true, 'PSN', 28],
    ['PewterPokecenter', false, 'SLP', 11], ['PewterPokecenter', false, 'PSN', 28],
  ] as const)('%s disabled=%s status=%s keeps emotion %i', async (map, disabled, status, emotion) => {
    const s = await talk(map, disabled, status); expect(pikachuEmotionNumber()).toBe(emotion);
    s.r.step(); expect(pikachuEmotionPhase()).toBe('border'); expect(pikachuEmotionBubble()).toBeNull();
  });

  it.each(['a', 'b'] as const)('a fresh portrait %s still runs SHOWMAPVIEW and the wake/close sequence', async key => {
    const { r, p } = await talk(); r.wait(68); expect(pikachuEmotionPhase()).toBe('portrait');
    r.step(key); expect(pikachuEmotionPhase()).toBe('mapview'); expect(isPikachuFollowingDisabled()).toBe(true);
    r.wait(3); expect(isPikachuFollowingDisabled()).toBe(false); r.wait(19);
    expect(host.state).toBe('overworld'); expect(p.direction).toBe('left');
  });

  function party(pikaSlot = 0) {
    const mon = createPokemon('PIKACHU', 5)!, other = createPokemon('RATTATA', 5)!;
    host.playerParty.push(...(pikaSlot === 0 ? [mon, other] : [other, mon]));
    disablePikachuFollowing(); return { mon, other };
  }
  function openParty(cursor = 0) {
    setPartyAndBillsSavedMenuItem(cursor); setBattleAndStartSavedMenuItem(1);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(22);
    expect(host.state).toBe('party_menu'); return r;
  }
  function finishSleepPrompt(r: ReturnType<typeof driver>, box: TextBox) {
    for (let frame = 0; frame < 200 && !box.isWaitingForInput; frame++) r.step();
    expect(box.isWaitingForInput).toBe(true); r.wait(3); r.step('b');
    for (let frame = 0; frame < 80 && host.state === 'party_menu'; frame++) r.step();
    expect(host.state).toBe('start_menu'); expect(host.partyMenu.chosenIndex).toBe(-1);
    expect(Reflect.get(host.partyMenu, 'switchFrom')).toBe(-1);
  }

  it.each([0, 1])('START rejects sleeping starter in row %i with its real prompt and cancellation; only that icon is absent', slot => {
    party(slot); const r = openParty(slot);
    const icons = vi.spyOn(partyIcons, 'drawPartyIcon'); host.partyMenu.render();
    expect(icons.mock.calls.map(c => [c[0], c[2]])).toEqual([[19, (1 - slot) * 16]]);
    const prints = vi.spyOn(RealTextBox.prototype, 'printStandalone'); r.step('a');
    expect(prints).toHaveBeenCalledWith({ program: 'PartyMenuText_12cc' }, { noDelay: false });
    expect(host.state).toBe('party_menu'); expect(host.partyMenu.ownsInput).toBe(true);
    const box = Reflect.get(host.partyMenu, 'openingTextBox') as TextBox;
    r.wait(2); expect((Reflect.get(box, 'screen') as { buffer: string[] }).buffer[41]).toBe(' ');
    r.step(); expect((Reflect.get(box, 'screen') as { buffer: string[] }).buffer[41]).toBe('T');
    finishSleepPrompt(r, box);
    expect(isPikachuFollowingDisabled()).toBe(true);
  });

  it('SWITCH to the sleeping starter prints and cancels before any swap, clearing the swap source', () => {
    const { mon, other } = party(); const r = openParty(1); const original = [...host.playerParty];
    r.step('a'); r.step(); r.step('a'); // Rattata's SWITCH
    r.step(); r.step('up'); r.step();
    const print = vi.spyOn(RealTextBox.prototype, 'printStandalone'); r.step('a');
    expect(print).toHaveBeenCalledWith({ program: 'PartyMenuText_12cc' }, { noDelay: false });
    finishSleepPrompt(r, Reflect.get(host.partyMenu, 'openingTextBox') as TextBox);
    expect(host.playerParty).toEqual(original); expect(host.playerParty).toEqual([mon, other]);
  });

  it('awake starter retains its icon and ordinary submenu selection', () => {
    party(); enablePikachuFollowing(); const r = openParty();
    const icons = vi.spyOn(partyIcons, 'drawPartyIcon'); host.partyMenu.render();
    expect(icons.mock.calls.map(c => c[0])).toEqual([25, 19]);
    const print = vi.spyOn(RealTextBox.prototype, 'printStandalone'); r.step('a');
    expect(Reflect.get(host.partyMenu, 'state')).toBe('submenu'); expect(print).not.toHaveBeenCalled();
  });

  it('battle party selection and icons retain their existing behavior even with the field flag set', () => {
    party(); const [pika, rat] = host.playerParty;
    const battle = new Battle(pika, createPokemon('PIDGEY', 5)!, host.playerParty, new Bag(), new Set(), 'ASH');
    Reflect.set(battle, 'state', 'choose_pokemon');
    const menu = Reflect.get(battle, 'partyMenu') as PartyMenu;
    menu.showForBattle([pika, rat], 0, false); host.battle = battle;
    const icons = vi.spyOn(partyIcons, 'drawPartyIcon'); menu.render();
    expect(icons.mock.calls.map(c => c[0])).toEqual([25, 19]);
    const print = vi.spyOn(RealTextBox.prototype, 'printStandalone'); const r = driver(); r.step('a');
    expect(Reflect.get(menu, 'state')).toBe('submenu'); expect(print).not.toHaveBeenCalled();
  });

  it('field medicine prints the sleeping prompt once, cancels back to the bag, and consumes no item/HP', () => {
    const { mon } = party(); mon.currentHp = 1; host.bag.items = [{ id: 'POTION', count: 2 }];
    setBattleAndStartSavedMenuItem(2); const r = driver(); host.openStartMenu(); r.wait(23); r.step('a');
    r.wait(16); r.step('a'); r.wait(3); r.step('a'); r.wait(22);
    const print = vi.spyOn(host.textBox, 'printStandalone'); r.step('a');
    expect(print).toHaveBeenCalledExactlyOnceWith({ program: 'PartyMenuText_12cc' }, { noDelay: false });
    for (let frame = 0; frame < 250 && !host.textBox.isWaitingForInput; frame++) r.step();
    expect(host.textBox.isWaitingForInput).toBe(true); r.wait(3); r.step('b');
    for (let frame = 0; frame < 150 && host.bagMenu.medicineOpen; frame++) r.step();
    expect(host.bagMenu.medicineOpen).toBe(false); expect(host.state).toBe('item_menu');
    expect(mon.currentHp).toBe(1); expect(host.bag.items).toEqual([{ id: 'POTION', count: 2 }]);
    expect(isPikachuFollowingDisabled()).toBe(true);
  });

  it('POKE_FLUTE tripwire: any future overworld use in Pewter must route through emotion 26', async () => {
    await host.startNewGame(); restoreFlags(['BATTLED_RIVAL_IN_OAKS_LAB', 'GOT_POKEDEX']);
    await host.handleWarpLoad('PewterPokecenter', 0); await host.finishFade();
    host.player.setTilePosition(10, 8); host.player.direction = 'up';
    host.pikachuFollower.visible = true; host.pikachuFollower.spawn(host.player.x, host.player.y, 'down');
    party(); host.bag.items = [{ id: 'POKE_FLUTE', count: 1 }]; setBattleAndStartSavedMenuItem(2);
    const r = driver(); host.openStartMenu(); r.wait(23); r.step('a'); r.wait(16); r.step('a'); r.wait(3);
    const print = vi.spyOn(RealTextBox.prototype, 'printStandalone'); r.step('a');
    let woke = false;
    for (let frame = 0; frame < 600; frame++) {
      if (pikachuEmotionNumber() === 26) { woke = true; break; }
      r.step(...(host.textBox.isWaitingForInput && frame % 4 === 0 ? ['a'] as const : []));
    }
    const used = print.mock.calls.length > 0 || host.state !== 'item_menu' || !isPikachuFollowingDisabled()
      || host.bag.items[0]?.count !== 1 || host.bagMenu.medicineOpen;
    expect(!used || woke, 'POKE_FLUTE gained a field use without the Pewter sleeping-Pikachu branch').toBe(true);
  });
});

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
    if (kind === 'party') { r.wait(22); vi.spyOn(host.partyMenu, 'update').mockReturnValue('close'); }
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

describe('Map-music CP3 through the real main paths (note 63 §10)', () => {
  const order = (fn: unknown) => vi.mocked(fn as () => void).mock.invocationCallOrder[0];
  beforeEach(() => { setNoMapMusic(false); });

  it('a door: UpdateMusic6Times first, then DF(10) for the destination map', async () => {
    await host.gameMap.load('PewterPokecenter');
    await host.handleWarpLoad('PewterCity', 0);
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled(); // DECISIONS #68: only once the door sound has finished
    host.gameTick(); // isSoundFinished() is true in this mock
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('cities1', false);
    expect(updateMusic6Times).toHaveBeenCalledOnce();
    expect(order(updateMusic6Times)).toBeLessThan(order(playDefaultMusicFadeOutCurrent));
    expect(stopMusic).not.toHaveBeenCalled(); // the old song keeps playing through the fade
  });

  it('BIT_NO_MAP_MUSIC skips both the six passes and the request at a warp', async () => {
    await host.gameMap.load('PewterPokecenter');
    setNoMapMusic(true);
    await host.handleWarpLoad('PewterCity', 0);
    host.gameTick();
    expect(updateMusic6Times).not.toHaveBeenCalled();
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    expect(isNoMapMusic()).toBe(true);
  });

  it('a connection: DF(10) with no six passes, and it ignores BIT_NO_MAP_MUSIC', async () => {
    await host.gameMap.load('Route2'); host.player.setTilePosition(10, 0);
    const connection = host.gameMap.mapData!.connections.find(c => c.direction === 'north')!;
    setNoMapMusic(true);
    await host.connectToMap(connection.mapName, 'north', connection.offset);
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('cities1', false);
    expect(updateMusic6Times).not.toHaveBeenCalled();
  });

  const finishedBattle = (extra: Record<string, unknown> = {}) => ({
    update() {}, finished: true, caughtPokemon: null, moneyWon: 0, levelsGained: 0, playerPokemonFainted: false,
    carelessTrainerFaint: false, isBlackout: false, playerLost: false, ...extra }) as unknown as Battle;

  it('a battle return: no standalone stop; six passes, then DF with the after-battle reason (c = 8)', () => {
    host.battle = finishedBattle(); host.gameTick();
    expect(host.state).toBe('overworld');
    expect(stopMusic).not.toHaveBeenCalled();
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pallettown', true);
    expect(order(updateMusic6Times)).toBeLessThan(order(playDefaultMusicFadeOutCurrent));
  });

  it('a battle return through the whole evolution queue requests the fade only after the last evolution', () => {
    const mon = createPokemon(25, 5)!; host.playerParty.push(mon);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    host.battle = finishedBattle(); host.gameTick();
    // Whatever the queue holds, nothing asks for the map song before the queue is exhausted.
    if (host.state === 'evolution') expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    else expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pallettown', true);
  });

  it('a battle return with evolutions requests the fade once, only after the whole queue has ended', async () => {
    host.playerParty.push(createPokemon(16, 18)!); // Pidgey L18 evolves
    host.battle = finishedBattle(); host.gameTick();
    expect(host.state).toBe('evolution');
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    for (let i = 0; i < 6000 && host.state === 'evolution'; i++) {
      input.setKey('b', i % 2 === 0); input.setKey('a', i % 2 === 0); input.updateInput(); // B cancels the evolution, A dismisses it
      host.gameTick(); await Promise.resolve();
    }
    input.setKey('b', false); input.setKey('a', false); input.updateInput();
    expect(host.state).not.toBe('evolution');
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pallettown', true);
    expect(order(updateMusic6Times)).toBeLessThan(order(playDefaultMusicFadeOutCurrent));
  });

  it('a catch-demo return requests the after-battle fade and no standalone stop', () => {
    vi.mocked(updateCatchDemo).mockReturnValueOnce({ type: 'ended', savedPalette: 'PALLET' } as never);
    host.state = 'catch_demo'; host.gameTick();
    expect(stopMusic).not.toHaveBeenCalled();
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pallettown', true);
    expect(order(updateMusic6Times)).toBeLessThan(order(playDefaultMusicFadeOutCurrent));
  });

  it('Mom heal: the jingle is a PN request, and her restoration is the PN entry for the map song', async () => {
    vi.mocked(playMusicNew).mockResolvedValue();
    host.startScript([{ type: 'healJingle' }, { type: 'wait', frames: 1 }]);
    for (let i = 0; i < 6; i++) { host.gameTick(); await Promise.resolve(); }
    expect(vi.mocked(playMusicNew).mock.calls).toEqual([['pkmnhealed'], ['pallettown']]);
    expect(playDefaultMusic).not.toHaveBeenCalled(); expect(restoreNurseMusic).not.toHaveBeenCalled();
  });

  it('the nurse machine is followed by the nurse restoration entry, not PlayDefaultMusic', async () => {
    host.playerParty.push(createPokemon(25, 5)!);
    host.startScript([{ type: 'healingMachine' }, { type: 'restoreMapMusic' }, { type: 'wait', frames: 1 }]);
    for (let i = 0; i < 3000 && !vi.mocked(restoreNurseMusic).mock.calls.length; i++) { host.gameTick(); await Promise.resolve(); }
    expect(restoreNurseMusic).toHaveBeenCalledExactlyOnceWith('pallettown');
    expect(playDefaultMusic).not.toHaveBeenCalled();
  });

  it('a warp request still waiting on its door sound is superseded by a blackout, never made later', async () => {
    await host.gameMap.load('PewterPokecenter');
    vi.mocked(isSoundFinished).mockReturnValue(false);
    await host.handleWarpLoad('PewterCity', 0); host.gameTick();
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    host.battle = finishedBattle({ isBlackout: true, playerLost: true }); host.gameTick();
    vi.mocked(isSoundFinished).mockReturnValue(true); host.gameTick();
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalledWith('cities1', false);
  });

  it('a blackout: StopMusic(8), the wait, StopAllSounds, the departed song, then the destination request', async () => {
    await host.gameMap.load('PewterPokecenter');
    await host.handleWarpLoad('PewterPokecenter', 0); // now standing in the Pokécenter (departed song: pokecenter)
    host.gameTick(); // the warp's own request (after its door sound) is made before the blackout begins
    vi.mocked(playDefaultMusicFadeOutCurrent).mockClear(); vi.mocked(updateMusic6Times).mockClear();
    host.battle = finishedBattle({ isBlackout: true, playerLost: true }); host.gameTick();
    expect(fadeOutAndStopMusic).toHaveBeenCalledExactlyOnceWith(8);
    let waits = 0;
    vi.mocked(isAudioFadingOut).mockImplementation(() => waits++ < 2);
    await host.finishFade();
    expect(waits).toBe(3); // polled until StopMusic's fade finished
    expect(stopAllSounds).toHaveBeenCalledOnce();
    const requests = vi.mocked(playDefaultMusicFadeOutCurrent).mock.calls;
    expect(requests).toEqual([['pokecenter', false], ['pallettown', false]]); // departed header, then destination
    const calls = vi.mocked(playDefaultMusicFadeOutCurrent).mock.invocationCallOrder;
    expect(order(fadeOutAndStopMusic)).toBeLessThan(order(stopAllSounds));
    expect(order(stopAllSounds)).toBeLessThan(calls[0]);
    expect(calls[0]).toBeLessThan(order(updateMusic6Times)); expect(order(updateMusic6Times)).toBeLessThan(calls[1]);
  });

  it('CONTINUE: the menu does not stop the title music; the loader fades it into the map song', async () => {
    vi.spyOn(saves, 'loadGame').mockReturnValue({ version: 1, mapName: 'PewterPokecenter',
      playerX: 80, playerY: 48, playerDirection: 'down', party: [], bag: [], money: 3000,
      defeatedTrainers: [], eventFlags: [] });
    host.state = 'main_menu';
    vi.spyOn(host.mainMenu, 'update').mockReturnValue('continue');
    host.gameTick();
    expect(stopMusic).not.toHaveBeenCalled();
    await host.finishFade(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(host.mapName).toBe('PewterPokecenter');
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pokecenter', false);
    expect(order(updateMusic6Times)).toBeLessThan(order(playDefaultMusicFadeOutCurrent));
  });

  it('the script restoreMapMusic command is PlayDefaultMusic for the map, with no fade request', () => {
    host.startScript([{ type: 'restoreMapMusic' }, { type: 'wait', frames: 1 }]);
    for (let i = 0; i < 4; i++) host.gameTick();
    expect(playDefaultMusic).toHaveBeenCalledExactlyOnceWith('pallettown');
    expect(playMusicNew).not.toHaveBeenCalled(); expect(restoreNurseMusic).not.toHaveBeenCalled();
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
  });
});
