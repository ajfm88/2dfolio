import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSchoolBlackboardScript, buildSchoolNotebookScript, getHiddenEventScript } from './hidden_events';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { initScript, updateScript, getActiveScript, renderScriptMenu } from '../script/script_controller';
import type { ScriptDeps } from '../script/script_controller';
import type { ScriptCommand } from '../script/types';
import { GameMap } from '../overworld/map';
import { Player } from '../overworld/player';
import { Npc } from '../overworld/npc';
import { PikachuFollower } from '../pikachu/pikachu_follower';
import { Bag } from '../items';
import { createPokemon, loadBattleData } from '../battle';
import { restoreFlags } from '../events';
import { setJoyIgnore } from '../input/joy_ignore';
import { isHeld, isPassPressed, syncJoypadRead, readJoypad } from '../input';
import { playSFX } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';
import { mapCloseFrames } from '../overworld/sprite_sets';
import type { MapSpriteSetsFile } from '../rom/extractors/map_sprite_sets';
import { createOverworldState, updateOverworld } from '../overworld/overworld_controller';
import { drawBox, drawText } from '../menus/menu_render';
import type { GameButton } from '../core';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: () => false,
  readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, playMusic: vi.fn(), isMusicChannelActive: () => false }));
vi.mock('../debug', () => ({ isNoClip: () => false, isNoEncounters: () => true }));
vi.mock('../menus/menu_render', () => ({ drawBox: vi.fn(), drawText: vi.fn(), drawChar: vi.fn() }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), drawSprite: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }), loadSprite: async () => ({ width: 16, height: 96 }) }));
const dataDir = resolve(__dirname, '../../data');
const mapData = JSON.parse(readFileSync(resolve(dataDir, 'maps/ViridianSchoolHouse.json'), 'utf8'));
const spriteSets = JSON.parse(readFileSync(resolve(dataDir, 'map_sprite_sets.json'), 'utf8')) as MapSpriteSetsFile;
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); });
beforeEach(() => { vi.clearAllMocks(); restoreFlags([]); setJoyIgnore('none'); setTextSpeed('fast'); uiTiles.clear();
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false); });

/** The school with the player at (3,5) under the notebook, as a migrated display's host sees it. */
function scene() {
  const gameMap = new GameMap(); gameMap.mapData = structuredClone(mapData);
  const player = new Player(); player.setTilePosition(6, 10); player.direction = 'up';
  const npcs = gameMap.mapData!.npcs.map(n => new Npc({ ...n }));
  const follower = new PikachuFollower(); follower.visible = false;
  const close = vi.fn();
  const textBox = new TextBox({ closeFrames: () => mapCloseFrames(spriteSets, 'ViridianSchoolHouse', { x: 3, y: 5 }), updateSprites: close });
  const deps: ScriptDeps = { gameMap, player, npcs, playerParty: [createPokemon(25, 5)!], playerBag: new Bag(),
    pikachuFollower: follower, textBox };
  return { deps, close, gameMap, player, npcs };
}

const screenOf = (box: TextBox) => Reflect.get(box, 'screen') as { buffer: string[]; waiting: boolean };

/** Runs a script frame by frame: fresh B presses answer text waits, `answers` the yes/no menus in order. */
function trace(s: ReturnType<typeof scene>, commands: ScriptCommand[], answers: ('yes' | 'no')[]) {
  let frame = 0, firstRead = -1, closing = -1, closeEnd = -1;
  const printed: { program: string; frame: number }[] = [];
  const menus: { frame: number; firstRead: number }[] = [];
  const arrowsDuring: Record<string, string[]> = {};
  const box = s.deps.textBox; let seen: ScriptCommand | null = null;
  const finish = vi.spyOn(box, 'finish');
  const print = box.print.bind(box);
  vi.spyOn(box, 'print').mockImplementation((source, options) => {
    if ('program' in source) printed.push({ program: source.program, frame });
    print(source, options);
  });
  initScript(commands); updateScript(s.deps, false);
  for (frame = 1; frame < 8000 && getActiveScript(); frame++) {
    const reads = vi.mocked(syncJoypadRead).mock.calls.length;
    const menuReads = vi.mocked(readJoypad).mock.calls.length;
    const menu = menus.length - 1;
    vi.mocked(isHeld).mockImplementation(k => k === 'b' && frame % 2 === 0 && box.isWaitingForInput);
    vi.mocked(isPassPressed).mockImplementation(k => menu >= 0 && k === (answers[menu] === 'yes' ? 'a' : 'b'));
    updateScript(s.deps, frame % 2 === 0);
    if (firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > reads) firstRead = frame;
    if (menu >= 0 && menus[menu].firstRead < 0 && vi.mocked(readJoypad).mock.calls.length > menuReads) menus[menu].firstRead = frame;
    const script = getActiveScript(); const cmd = script?.commands[script.index];
    if (cmd?.type === 'yesNoChoice' && cmd !== seen) { seen = cmd; menus.push({ frame, firstRead: -1 }); }
    const current = printed[printed.length - 1]?.program;
    if (current && box.active) (arrowsDuring[current] ??= []).push(screenOf(box).buffer[98]);
    if (closing < 0 && box.closing) closing = frame;
    if (closing >= 0 && closeEnd < 0 && !box.active) closeEnd = frame;
  }
  expect(getActiveScript()).toBeNull();
  return { printed, menus, firstRead, closing, closeEnd, arrowsDuring, finish };
}

describe('ViridianSchoolNotebook on one display (A5b6 CP1)', () => {
  it('is source programs only: four pages, three turn-page questions, no outer wait', () => {
    const commands = buildSchoolNotebookScript();
    const flat = (list: ScriptCommand[]): ScriptCommand[] =>
      list.flatMap(c => [c, ...(c.type === 'yesNoChoice' ? [...flat(c.yes), ...flat(c.no)] : [])]);
    const all = flat(commands);
    expect(commands[0]).toEqual({ type: 'displayOpen', autoBox: true });
    expect(commands[commands.length - 1]).toEqual({ type: 'displayClose', outerWait: false });
    expect(all.filter(c => c.type === 'printText').map(c => c.type === 'printText' && c.program)).toEqual([
      'ViridianSchoolNotebookText1', 'TurnPageText', 'ViridianSchoolNotebookText2', 'TurnPageText',
      'ViridianSchoolNotebookText3', 'TurnPageText', 'ViridianSchoolNotebookText4', 'ViridianSchoolNotebookText5']);
    expect(all.some(c => ['text', 'yesNo', 'textButtonWait', 'closeText'].includes(c.type))).toBe(false);
    expect(all.filter(c => c.type === 'yesNoChoice').every(c => c.type === 'yesNoChoice' && c.no.length === 0)).toBe(true);
    expect(getHiddenEventScript('VIRIDIAN_SCHOOL_NOTEBOOK')).toEqual(commands);
  });

  it.each([1, 2, 3])('NO at question %i: menu +3 / 15, then Hold and the 13-frame close with no outer wait', stop => {
    const s = scene();
    const answers = [...Array<'yes'>(stop - 1).fill('yes'), 'no' as const];
    const t = trace(s, buildSchoolNotebookScript(), answers);
    const pages = ['ViridianSchoolNotebookText1', 'ViridianSchoolNotebookText2', 'ViridianSchoolNotebookText3'];
    expect(t.printed.map(p => p.program)).toEqual(pages.slice(0, stop).flatMap(p => [p, 'TurnPageText']));
    expect(t.firstRead).toBe(23); // DisplayTextIDInit 20 + PrintText's Delay3
    expect(t.menus).toHaveLength(stop);
    for (const menu of t.menus) expect(menu.firstRead - menu.frame).toBe(3);
    // The NO tail's 15th frame returns into TextScriptEnd, Hold (A released) and CloseTextDisplay.
    expect(t.closing - t.menus[stop - 1].firstRead).toBe(15);
    expect(t.closeEnd - t.closing).toBe(13);
    expect(t.finish).toHaveBeenCalledExactlyOnceWith({ outerWait: false });
    expect(s.close).toHaveBeenCalledOnce();
    expect(s.deps.textBox.displayRevision).toBe(1);
  });

  it('YES three times: pages 2-4, the girl with text_waitbutton (no ▼), then Hold and close', () => {
    const s = scene(); const t = trace(s, buildSchoolNotebookScript(), ['yes', 'yes', 'yes']);
    expect(t.printed.map(p => p.program)).toEqual(['ViridianSchoolNotebookText1', 'TurnPageText',
      'ViridianSchoolNotebookText2', 'TurnPageText', 'ViridianSchoolNotebookText3', 'TurnPageText',
      'ViridianSchoolNotebookText4', 'ViridianSchoolNotebookText5']);
    // Each page is a new PrintText: the YES branch's first print is the menu's 15th frame.
    for (let i = 0; i < 3; i++) expect(t.printed[2 * i + 2].frame - t.menus[i].firstRead).toBe(15);
    expect(t.arrowsDuring.ViridianSchoolNotebookText5.every(tile => tile !== '▼')).toBe(true);
    expect(t.arrowsDuring.ViridianSchoolNotebookText4).toContain('▼'); // its prompt
    expect(t.closeEnd - t.closing).toBe(13);
    expect(t.finish).toHaveBeenCalledExactlyOnceWith({ outerWait: false });
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'press_ab').length).toBeGreaterThan(0);
  });

  it('the girl closes on the frame her waitbutton returns (no outer wait)', () => {
    const s = scene(); const box = s.deps.textBox;
    initScript([{ type: 'displayOpen' }, { type: 'printText', program: 'ViridianSchoolNotebookText5' },
      { type: 'displayClose', outerWait: false }]);
    updateScript(s.deps, false);
    let waited = -1, closing = -1;
    for (let frame = 1; frame < 400 && closing < 0; frame++) {
      const pressing = waited >= 0;
      vi.mocked(isHeld).mockImplementation(k => k === 'a' && pressing && frame === waited + 1);
      updateScript(s.deps, false);
      if (waited < 0 && screenOf(box).waiting) waited = frame;
      if (box.closing) closing = frame;
    }
    expect(waited).toBeGreaterThan(0);
    expect(screenOf(box).buffer[98]).toBe(' ');
    // The press arrives at waited+1; A is still down for Hold, which reads it released at +2.
    expect(closing).toBe(waited + 2);
  });

  it('the hidden event dispatches the migrated builder in the A-press tick', () => {
    const s = scene();
    vi.spyOn(s.player, 'checkInteraction').mockReturnValue({ scriptId: 'VIRIDIAN_SCHOOL_NOTEBOOK' });
    const action = updateOverworld({ ...s.deps, currentMapName: 'ViridianSchoolHouse', findNpc: () => undefined,
      pikachuFollower: s.deps.pikachuFollower!, onPokecenterHeal: vi.fn() }, createOverworldState());
    expect(action).toEqual({ type: 'script', commands: buildSchoolNotebookScript() });
  });

  it('the school close costs 13 (W 4), as note 23 lists it', () => {
    expect(mapCloseFrames(spriteSets, 'ViridianSchoolHouse', { x: 3, y: 5 })).toBe(13);
  });
});

describe('ViridianSchoolBlackboard on one display (A5b6 CP2)', () => {
  /** Each queued key list is what one actual menu read sees; text waits get fresh B presses. */
  function board(s: ReturnType<typeof scene>, keys: GameButton[][]) {
    const queue = [...keys]; const box = s.deps.textBox;
    let frame = 0, closing = -1, closeEnd = -1, firstRead = -1;
    const printed: { program: string; frame: number; noDelay: boolean }[] = [];
    const menus: { frame: number; reads: number[] }[] = [];
    const snapshots: { frame: number; box: boolean; cursor: string | null; row: string; row2: string }[] = [];
    let seen: ScriptCommand | null = null;
    vi.mocked(readJoypad).mockImplementation(() => {
      const now = queue.shift() ?? []; menus[menus.length - 1]?.reads.push(frame);
      vi.mocked(isPassPressed).mockImplementation(k => now.includes(k));
    });
    const print = box.print.bind(box);
    vi.spyOn(box, 'print').mockImplementation((source, options) => {
      if ('program' in source) printed.push({ program: source.program, frame, noDelay: !!options?.noDelay });
      print(source, options);
    });
    const finish = vi.spyOn(box, 'finish');
    initScript(buildSchoolBlackboardScript()); updateScript(s.deps, false);
    for (frame = 1; frame < 20000 && getActiveScript(); frame++) {
      const reads = vi.mocked(syncJoypadRead).mock.calls.length;
      vi.mocked(isHeld).mockImplementation(k => k === 'b' && frame % 2 === 0 && box.isWaitingForInput);
      vi.mocked(isPassPressed).mockReturnValue(false);
      updateScript(s.deps, frame % 2 === 0);
      if (firstRead < 0 && vi.mocked(syncJoypadRead).mock.calls.length > reads) firstRead = frame;
      const script = getActiveScript(); const cmd = script?.commands[script.index];
      if (cmd?.type === 'menuInput' && cmd !== seen) { seen = cmd; menus.push({ frame, reads: [] }); }
      vi.mocked(drawBox).mockClear(); vi.mocked(drawText).mockClear(); renderScriptMenu();
      const cursor = vi.mocked(drawText).mock.calls.find(c => c[0] === '▶');
      snapshots.push({ frame, box: vi.mocked(drawBox).mock.calls.length > 0, cursor: cursor ? `${cursor[1] / 8},${cursor[2] / 8}` : null,
        row: screenOf(box).buffer.slice(41, 59).join('').trimEnd(), row2: screenOf(box).buffer.slice(81, 99).join('').trimEnd() });
      if (closing < 0 && box.closing) closing = frame;
      if (closing >= 0 && closeEnd < 0 && !box.active) closeEnd = frame;
    }
    expect(getActiveScript()).toBeNull(); expect(queue).toEqual([]);
    return { printed, menus, snapshots, closing, closeEnd, firstRead, finish };
  }
  const at = (t: ReturnType<typeof board>, frame: number) => t.snapshots.find(x => x.frame === frame)!;

  it('B at once: Text1 (+23), the menu loop, then the saved empty box, Hold and close 13', () => {
    const s = scene(); const t = board(s, [['b']]);
    expect(t.printed.map(p => [p.program, p.noDelay])).toEqual([['ViridianSchoolBlackboardText1', false],
      ['ViridianSchoolBlackboardText2', true]]);
    expect(t.firstRead).toBe(23);
    // .blackboardLoop starts in the tick Text1 returns: box, labels, PrintText Text2 (+3, whole string).
    expect(t.printed[1].frame).toBe(t.menus[0].frame - 3);
    expect(t.menus[0].reads[0] - t.printed[1].frame).toBe(6); // PrintText's Delay3 + HandleMenuInput's
    const loop = at(t, t.printed[1].frame);
    expect(loop.box).toBe(true); expect(loop.cursor).toBeNull(); // the ▶ waits for PlaceMenuCursor
    expect(at(t, t.menus[0].frame)).toMatchObject({ box: true, cursor: '1,2', row: 'Which heading do' });
    // B: SFX_PRESS_AB, LoadScreenTilesFromBuffer1, TextScriptEnd, Hold (A up) and the close, same tick.
    expect(t.closing).toBe(t.menus[0].reads[0]);
    expect(at(t, t.closing)).toMatchObject({ box: false, row: '', row2: '' });
    expect(t.closeEnd - t.closing).toBe(13);
    expect(t.finish).toHaveBeenCalledExactlyOnceWith({ outerWait: false });
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'press_ab').length).toBeGreaterThan(0);
  });

  it('Text2 is typed with BIT_NO_TEXT_DELAY: the whole question lands in one CPU frame', () => {
    const s = scene(); const t = board(s, [['b']]);
    const lines = t.snapshots.filter(x => x.frame >= t.printed[1].frame && x.frame < t.menus[0].frame + 3);
    const firstWrite = lines.find(x => x.row !== '')!;
    expect(firstWrite.frame).toBe(t.printed[1].frame + 3);
    expect(firstWrite).toMatchObject({ row: 'Which heading do', row2: 'you want to read?' });
  });

  it('every heading prints its own program, the burn text from the ROM; QUIT exits', () => {
    const s = scene();
    const t = board(s, [['a'], ['down'], ['a'], ['down'], ['a'], ['right'], ['up'], ['up'], ['a'], ['down'], ['a'], ['down'], ['a']]);
    expect(t.printed.map(p => p.program).filter(p => !p.startsWith('ViridianSchool'))).toEqual([
      'ViridianBlackboardSleepText', 'ViridianBlackboardPoisonText', 'ViridianBlackboardPrlzText',
      'ViridianBlackboardBurnText', 'ViridianBlackboardFrozenText']);
    expect(t.printed.filter(p => !p.program.startsWith('ViridianSchool')).every(p => !p.noDelay)).toBe(true);
    // The heading prints in the A tick (+3 box), with the menu box and its ▶ still drawn.
    const sleep = t.printed.find(p => p.program === 'ViridianBlackboardSleepText')!;
    expect(sleep.frame).toBe(t.menus[0].reads[0]);
    expect(at(t, sleep.frame + 1)).toMatchObject({ box: true, cursor: '1,2' });
    expect(t.closeEnd - t.closing).toBe(13);
  });

  it('RIGHT and LEFT rerun the loop with the same item, even from that column; Up at the top does not wrap', () => {
    const s = scene();
    const t = board(s, [['down'], ['left'], ['right'], ['right'], ['up'], ['up'], ['b']]);
    const text2 = t.printed.filter(p => p.program === 'ViridianSchoolBlackboardText2');
    expect(text2).toHaveLength(4); // the first loop, then LEFT, RIGHT, RIGHT
    expect(t.printed.every(p => p.program.startsWith('ViridianSchool'))).toBe(true); // no heading
    expect(t.menus.map(m => at(t, m.frame).cursor)).toEqual(['1,2', '1,4', '6,4', '6,4']);
    // A column switch: no sound, the loop's PrintText +3 and HandleMenuInput's Delay3 +3.
    expect(t.menus[2].reads[0] - t.menus[1].reads[t.menus[1].reads.length - 1]).toBe(6);
    // Up from item 1 to 0, then Up at the top: no wrap, each re-arming Delay3.
    const last = t.menus[3].reads; expect(last[1] - last[0]).toBe(3); expect(last[2] - last[1]).toBe(3);
    expect(at(t, last[1]).cursor).toBe('6,2'); expect(at(t, last[2] - 1).cursor).toBe('6,2');
  });

  it('dispatches from the hidden event with the migrated builder', () => {
    const s = scene();
    vi.spyOn(s.player, 'checkInteraction').mockReturnValue({ scriptId: 'VIRIDIAN_SCHOOL_BLACKBOARD' });
    const action = updateOverworld({ ...s.deps, currentMapName: 'ViridianSchoolHouse', findNpc: () => undefined,
      pikachuFollower: s.deps.pikachuFollower!, onPokecenterHeal: vi.fn() }, createOverworldState());
    expect(action?.type).toBe('script');
    if (action?.type !== 'script') throw new Error('missing blackboard dispatch');
    expect(action.commands.slice(0, 2)).toEqual([{ type: 'displayOpen', autoBox: true },
      { type: 'printText', program: 'ViridianSchoolBlackboardText1' }]);
  });
});
