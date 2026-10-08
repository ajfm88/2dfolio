import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { isPressed, isHeld, syncJoypadRead } from '../input';
import { isSoundFinished, playSFX } from '../audio';
import { drawTile } from '../renderer';
import { charToTile } from '../text/charmap';
import { initScript, updateScript, getActiveScript } from './script_controller';
import type { ScriptDeps } from './script_controller';
import { Player } from '../overworld/player';
import { GameMap } from '../overworld/map';
import { Npc } from '../overworld/npc';
import { spriteTable } from '../overworld/sprites';
import { Bag } from '../items';
import { getAllHiddenObjects, restoreHiddenObjects } from '../events';
import { UiEntry } from '../overworld/ui_entry';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false),
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), isSfxPlaying: vi.fn(() => false) }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(),
  loadFont: vi.fn(async () => ({ width: 128 })), loadTileset: vi.fn(async () => ({ width: 128 })),
  loadSprite: vi.fn(async () => ({ height: 96 })), drawSprite: vi.fn() }));

beforeAll(initTextSystem);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isHeld).mockReturnValue(false);
  vi.mocked(isPressed).mockReturnValue(false);
  vi.mocked(isSoundFinished).mockReturnValue(true);
  restoreHiddenObjects([]);
  setTextSpeed('fast');
});

function scene(): ScriptDeps {
  const gameMap = new GameMap();
  gameMap.mapData = { name: 'ViridianForest', width: 10, height: 10, tileset: 'FOREST', blocks: [],
    borderBlock: 0, connections: [], warps: [], signs: [], npcs: [] };
  return { textBox: new TextBox(), player: new Player(), gameMap, npcs: [], playerBag: new Bag(), playerParty: [] };
}

function type(box: TextBox): void {
  for (let frame = 0; frame < 200 && !box.isWaitingForInput && !box.isComplete; frame++) box.update();
}

function arrow(box: TextBox): boolean {
  // A snapshot after the next bottom-third transfer, independent of its phase.
  for (let frame = 0; frame < 3; frame++) box.updateDisplay();
  vi.mocked(drawTile).mockClear(); box.render();
  return vi.mocked(drawTile).mock.calls.some(call => call[1] === charToTile('▼') && call[2] === 144 && call[3] === 128);
}

describe('TextBox text_end and PromptText', () => {
  it('none returns with a drawn box and reads no input after the final character', () => {
    const box = new TextBox(); box.show('YELLOW found\nPOTION!', { end: 'none' }); type(box);
    expect(box.isComplete).toBe(true); expect(box.active).toBe(true);
    vi.mocked(isHeld).mockClear(); vi.mocked(isPressed).mockClear();
    box.update(); expect(isHeld).not.toHaveBeenCalled(); expect(isPressed).not.toHaveBeenCalled();
    expect(playSFX).not.toHaveBeenCalled(); expect(arrow(box)).toBe(false);
    box.show('Next'); expect(box.isComplete).toBe(false);
  });
  it.each(['a', 'b'])('prompt draws the final arrow, protects three frames, then accepts %s once', button => {
    const box = new TextBox(); box.show('Here you go!', { end: 'prompt' }); type(box);
    expect(arrow(box)).toBe(true);
    vi.mocked(isHeld).mockImplementation(key => key === button);
    for (let i = 0; i < 2; i++) { box.update(); expect(box.isComplete).toBe(false); }
    box.update(); box.update();
    expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
    expect(box.isComplete).toBe(true); expect(box.active).toBe(true); expect(arrow(box)).toBe(false);
  });
  it('prompt remembers the button while waiting for current sound', () => {
    const box = new TextBox(); box.show('Here you go!', { end: 'prompt' }); type(box);
    for (let i = 0; i < 3; i++) box.update();
    vi.mocked(isSoundFinished).mockReturnValue(false); vi.mocked(isHeld).mockImplementation(key => key === 'a');
    box.update(); vi.mocked(isHeld).mockReturnValue(false); box.update();
    expect(box.isComplete).toBe(false); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isSoundFinished).mockReturnValue(true); box.update();
    expect(box.isComplete).toBe(true); expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
  });
  it('none retains intermediate cont/para paging and only completes on the final page', () => {
    const box = new TextBox(); box.show('one\ntwo\nthree\ffour\nfive', { end: 'none' }); type(box);
    expect(box.isComplete).toBe(false); expect(arrow(box)).toBe(true);
    vi.mocked(isHeld).mockImplementation(key => key === 'a');
    for (let frame = 0; frame < 3; frame++) box.update();
    vi.mocked(isHeld).mockReturnValue(false); type(box);
    expect(box.isComplete).toBe(false);
    vi.mocked(isHeld).mockImplementation(key => key === 'b');
    for (let frame = 0; frame < 3; frame++) box.update();
    vi.mocked(isHeld).mockReturnValue(false); type(box);
    expect(box.isComplete).toBe(true); expect(box.active).toBe(true);
    expect(vi.mocked(playSFX).mock.calls).toEqual([['press_ab'], ['press_ab']]);
  });
  it('legacy text still beeps and dismisses on the press', () => {
    const box = new TextBox(); box.show('Hello'); type(box);
    expect(box.isWaitingForInput).toBe(true); expect(arrow(box)).toBe(false);
    vi.mocked(isPressed).mockImplementation(key => key === 'a'); box.update();
    expect(box.active).toBe(false); expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
  });
});

describe('blocking text script routines', () => {
  it.each([false, true])('sound plays once and returns on the sound-finished frame (waitForCurrent=%s)', waitForCurrent => {
    const deps = scene(); const moved = vi.spyOn(deps.player, 'update');
    initScript([{ type: 'sound', name: 'get_item1', waitForCurrent }, { type: 'closeText' }]);
    vi.mocked(isSoundFinished).mockReturnValue(false);
    updateScript(deps, true); updateScript(deps, false);
    expect(playSFX).toHaveBeenCalledTimes(waitForCurrent ? 0 : 1);
    if (waitForCurrent) {
      vi.mocked(isSoundFinished).mockReturnValueOnce(true); updateScript(deps, true);
      expect(playSFX).toHaveBeenCalledExactlyOnceWith('get_item1');
    }
    expect(getActiveScript()?.index).toBe(0);
    vi.mocked(isSoundFinished).mockReturnValue(true);
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' });
    expect(moved).not.toHaveBeenCalled(); expect(syncJoypadRead).toHaveBeenCalled();
  });
  it.each(['a', 'b'])('silent textButtonWait accepts %s without an arrow or beep', button => {
    const deps = scene(); deps.textBox.show('No room', { end: 'none' }); type(deps.textBox);
    initScript([{ type: 'textButtonWait' }, { type: 'closeText' }]);
    updateScript(deps, true); expect(deps.textBox.active).toBe(true); expect(arrow(deps.textBox)).toBe(false);
    vi.mocked(isPressed).mockImplementation(key => key === button);
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' });
    expect(playSFX).not.toHaveBeenCalled(); expect(syncJoypadRead).toHaveBeenCalled();
  });
  it('HoldTextDisplayOpen stays while A is held and closes on the first released frame', () => {
    const deps = scene(); deps.textBox.show('found', { end: 'none' }); type(deps.textBox);
    initScript([{ type: 'closeText' }]); vi.mocked(isHeld).mockImplementation(key => key === 'a');
    updateScript(deps, true); updateScript(deps, false); expect(deps.textBox.active).toBe(true);
    vi.mocked(isHeld).mockReturnValue(false);
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' }); expect(deps.textBox.active).toBe(false);
  });
  it('HideObject saves its key, hides the live object and removes its collision availability', () => {
    const deps = scene(); deps.npcs.push(new Npc({ id: 'potion1', sprite: 'poke_ball', x: 0, y: 1, movement: 'stay', dialogue: '', object: true }));
    initScript([{ type: 'hideObject', map: 'ViridianForest', npcId: 'potion1' }, { type: 'text', message: 'found', end: 'none' }]);
    updateScript(deps, true);
    expect(getAllHiddenObjects()).toEqual(['ViridianForest:potion1']); expect(deps.npcs[0].hidden).toBe(true);
    expect(spriteTable(deps.player, deps.npcs)[1].available).toBe(false);
    expect(deps.textBox.active).toBe(true);
  });
  it('retained text keeps UiEntry open across commands; an unterminated script dismisses it', () => {
    const deps = scene(); const ui = new UiEntry();
    initScript([{ type: 'text', message: 'A', end: 'none' }, { type: 'text', message: 'B', end: 'none' }]);
    updateScript(deps, true); expect(ui.opened(deps.textBox.active)).toBe(true);
    for (let frame = 0; frame < 3; frame++) { updateScript(deps, false); expect(ui.opened(deps.textBox.active)).toBe(false); }
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' }); expect(deps.textBox.active).toBe(false);
  });
});
