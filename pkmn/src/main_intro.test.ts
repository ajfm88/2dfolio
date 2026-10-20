// Main's actual state dispatch; Vitest alone exposes lexical bindings (see config).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  Object.assign(globalThis, { window: { addEventListener() {} }, localStorage: { getItem: () => null } });
});
// Observe audio requests while running the real speech, dispatch and map loader.
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
import * as main from './main';
import * as input from './input';
import { TextBox, initTextSystem, setTextSpeed } from './text/textbox';
import { loadTextPrograms } from './text/program_data';
import { textBgTransfer } from './text/bg_transfer';
import { getSpriteIndex, setSpriteIndex } from './overworld/sprite_index';
import { uiTiles } from './renderer/ui_tiles';
import { loadMapSpriteSets } from './overworld/sprite_sets';
import { stopMusic, playMusic, playSFX, fadeOutAndStopMusic, playDefaultMusicFadeOutCurrent, updateMusic6Times } from './audio';
import type { OakSpeech } from './menus/oak_speech';
import { MainMenu } from './menus/main_menu';
import type { NamingScreen } from './menus/naming_screen';
import type { GameMap, Player } from './overworld';
import type { GameButton } from './core';
import { readFileSync } from 'node:fs';

const host = (main as unknown as { mainTest: {
  gameTick(): void; reset(): void; state: string; readonly fade: number; readonly introMapReady: boolean;
  mainMenu: { update(): unknown; show(saved: boolean): void; saveTiles(): readonly string[] }; oakSpeech: OakSpeech; namingScreen: NamingScreen; gameMap: GameMap; player: Player;
} }).mainTest;
const buttons: GameButton[] = ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right'];
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadMapSpriteSets(); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); host.reset(); setTextSpeed('fast');
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  buttons.forEach(key => input.setKey(key, false)); input.updateInput(); input.syncJoypadRead();
});
function step(keys: GameButton[] = []) {
  buttons.forEach(key => input.setKey(key, keys.includes(key))); input.updateInput(); host.gameTick();
}

describe('Intro CP4 through the real main dispatch', () => {
  it('A5d CP2: START writes zero to the text/sprite alias before opening', () => {
    setSpriteIndex(8);
    (host as unknown as { openStartMenu(): void }).openStartMenu();
    expect(getSpriteIndex()).toBe(0); expect(host.state).toBe('start_menu');
  });
  it.each([false, true])('NEW GAME through %s custom-name path, 20/40 holds and the actual map/music loader', async custom => {
    host.state = 'main_menu'; host.mainMenu.show(true); vi.spyOn(host.mainMenu, 'update').mockReturnValue('new_game');
    const sync = vi.spyOn(input, 'syncJoypadRead');
    const start = vi.spyOn(host.oakSpeech, 'start'), load = vi.spyOn(host.oakSpeech, 'load');
    const printFrames: number[] = [], names: string[] = [];
    let frame = 0;
    vi.spyOn(TextBox.prototype, 'printStandalone').mockImplementation(function (this: TextBox, ...args) {
      printFrames.push(frame); return print.apply(this, args);
    });
    const show = vi.spyOn(host.namingScreen, 'show').mockImplementation(target => { names.push(target); });
    // Naming's internal animation/input stays outside this slice; exercise main's real return handoff.
    vi.spyOn(host.namingScreen, 'update').mockReturnValue('done');
    vi.spyOn(host.namingScreen, 'result', 'get').mockImplementation(() => names.length === 1 ? 'RED' : 'GREEN');
    function tick(keys: GameButton[] = []) { frame++; step(keys); }
    step(); // F0: the main menu returns NEW GAME / Skip Intro NO
    const holdReads = sync.mock.calls.length;
    expect(host.state).toBe('intro_entry'); expect(start).not.toHaveBeenCalled(); expect(stopMusic).not.toHaveBeenCalled();
    for (let i = 1; i <= 19; i++) {
      tick(['a']); expect(host.state).toBe('intro_entry'); expect(start).not.toHaveBeenCalled();
      expect(stopMusic).not.toHaveBeenCalled(); expect(host.fade).toBe(0);
    }
    tick(); expect(host.state).toBe('oak_speech'); expect(start).toHaveBeenCalledOnce();
    expect(stopMusic).toHaveBeenCalledOnce(); expect(playMusic).toHaveBeenCalledExactlyOnceWith('routes2');
    expect(load).not.toHaveBeenCalled(); expect(host.mainMenu.update).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledTimes(holdReads);
    const menu = host.mainMenu.saveTiles();
    expect(host.oakSpeech.inspection.visibleCells).toEqual(menu);
    for (let wait = 1; wait <= 3; wait++) {
      const p = textBgTransfer.nextPortion; tick();
      const expected = [...menu];
      for (let third = 0; third < 3; third++) {
        // Every portion already selected by this clear is blank; the rest still contains the menu.
        if ((third - p + 3) % 3 === 0 || wait === 3 || (wait === 2 && third === (p + 2) % 3))
          expected.fill(' ', third * 120, (third + 1) * 120);
      }
      expect(host.oakSpeech.inspection.visibleCells).toEqual(expected);
    }
    const actualLoads: number[] = [], originalLoad = host.gameMap.load.bind(host.gameMap);
    vi.spyOn(host.gameMap, 'load').mockImplementation(async name => { actualLoads.push(frame); return originalLoad(name); });
    let returned = -1;
    for (let i = 0; i < 15000 && host.state !== 'intro_exit'; i++) {
      const snapshot = host.oakSpeech.inspection;
      if (snapshot.stage === 'shrink' && returned < 0) returned = frame;
      tick(snapshot.menu ? custom || snapshot.menu.item > 0 ? ['a'] : ['down']
        : snapshot.text.waiting && !snapshot.text.complete && frame % 2 === 0 ? ['b'] : []);
    }
    expect(host.state).toBe('intro_exit'); expect(frame - returned).toBe(126);
    expect(printFrames[0]).toBe(95); expect(printFrames).toHaveLength(7);
    expect(show).toHaveBeenCalledTimes(custom ? 2 : 0);
    expect(playSFX).toHaveBeenCalledWith('shrink'); expect(fadeOutAndStopMusic).toHaveBeenCalledExactlyOnceWith(10);
    expect(stopMusic).toHaveBeenCalledOnce(); expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    const speechDone = frame;
    const exitReads = sync.mock.calls.length;
    await vi.waitFor(() => expect(host.introMapReady).toBe(true));
    expect(actualLoads).toEqual([speechDone]); expect(host.gameMap.mapData?.name).toBe('RedsHouse2F');
    for (let i = 1; i <= 39; i++) {
      tick(); expect(host.state).toBe('intro_exit'); expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled();
    }
    tick(); expect(frame - returned).toBe(166); expect(host.state).toBe('overworld');
    expect(updateMusic6Times).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledTimes(exitReads);
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledExactlyOnceWith('pallettown', false);
    expect(host.player.direction).toBe('down'); // existing map-entry discrepancy, deliberately unchanged
  });

  it('holds white beyond frame40 if the map loader is late, then makes one music request on a tick', async () => {
    host.state = 'oak_speech'; vi.spyOn(host.oakSpeech, 'update').mockReturnValue({ type: 'done' });
    let finish!: () => void;
    vi.spyOn(host.gameMap, 'load').mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    step(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    for (let i = 0; i < 45; i++) { step(); expect(host.state).toBe('intro_exit'); }
    expect(playDefaultMusicFadeOutCurrent).not.toHaveBeenCalled(); expect(stopMusic).not.toHaveBeenCalled();
    finish(); await vi.waitFor(() => expect(host.introMapReady).toBe(true));
    expect(host.state).toBe('intro_exit'); step(); expect(host.state).toBe('overworld');
    expect(playDefaultMusicFadeOutCurrent).toHaveBeenCalledOnce();
  });

  it('preloads speech and naming assets during boot and keeps canvas overlays after the shade pass', () => {
    const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
    const boot = source.slice(source.indexOf('async function init()'), source.indexOf('/** The single save write'));
    expect(boot).toContain('oakSpeech.load()'); expect(boot).toContain('loadEdTile()');
    expect(boot).toContain("await preloadMusic('routes2')");
    expect(boot.indexOf('await resumeAudio()')).toBeLessThan(boot.indexOf("await preloadMusic('routes2')"));
    const render = source.slice(source.indexOf('function gameLoop('));
    expect(render.indexOf('oakSpeech.render()')).toBeLessThan(render.indexOf('drawUi();'));
    expect(render.indexOf('oakSpeech.render()')).toBeLessThan(render.indexOf('// FPS display toast'));
    expect(render).toContain('state === "main_menu" || state === "intro_entry"');
    expect(render).toContain('state === "intro_exit"');
  });

  it.each([false, true])('hands off the current main-menu tiles with save=%s, without a skip overlay', saved => {
    const menu = new MainMenu(); menu.show(saved);
    const cells = menu.saveTiles(); expect(cells).toHaveLength(360);
    expect(cells[0]).toBe('┌'); expect(cells[14]).toBe('┐');
    const row = (y: number) => cells.slice(y * 20, (y + 1) * 20).join('');
    expect(row(2)).toContain(saved ? 'CONTINUE' : 'NEW GAME');
    expect(row(4)).toContain(saved ? 'NEW GAME' : 'OPTION');
    expect(row(saved ? 7 : 5)[0]).toBe('└');
    expect(cells[41]).toBe('▶'); expect(cells.slice(12 * 20).every(cell => cell === ' ')).toBe(true);
    expect(cells.join('')).not.toContain('Skip intro?');
  });
});
const print = TextBox.prototype.printStandalone;
