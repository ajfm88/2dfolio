// A5b7g1 CP1: coverage replacing the retired explicit-ending/legacy cases:
// - "none returns ... no input": textbox.test.ts "PrintText alone waits three frames and
//   returns while retaining the box" and "keeps Delay3 but places the entire program ...".
// - "prompt ... protects three frames ... accepts a/b once": text_printer.test.ts
//   "cont protects three frames, accepts the pending press and scrolls 5 + 5";
//   textbox.test.ts "prompt uses its beeping wait and then a separate silent DisplayTextID wait".
// - "prompt remembers the button ... sound": text_printer.test.ts
//   "sound wait retains the accepted button and performs no joypad reads".
// - "none retains intermediate cont/para paging": text_printer.test.ts "para clears all four
//   inside rows, holds 20 frames, then starts row 14" and the cont case above;
//   text_runner.test.ts "FAR resumes its parent after child %s, with the same cursor".
// - "legacy text still beeps and dismisses": the invented legacy close is removed;
//   its source prompt/beep is covered by the textbox prompt case above and its silent
//   close by "HoldTextDisplayOpen stays while A is held ..." below.
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
import { loadTextPrograms } from '../text/program_data';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false),
  isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn(), readJoypad: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true), isSfxPlaying: vi.fn(() => false) }));
vi.mock('../debug', () => ({ isNoClip: () => false }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(),
  loadFont: vi.fn(async () => ({ width: 128 })), loadTileset: vi.fn(async () => ({ width: 128 })),
  loadSprite: vi.fn(async () => ({ height: 96 })), drawSprite: vi.fn() }));

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
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

function openPrinted(deps: ScriptDeps): void {
  deps.textBox.open();
  for (let frame = 0; frame < 20; frame++) deps.textBox.update();
  deps.textBox.print({ program: 'WhatText' }, { noDelay: true });
  for (let frame = 0; frame < 3; frame++) deps.textBox.update();
  expect(deps.textBox.isComplete).toBe(true);
}

function arrow(box: TextBox): boolean {
  // A snapshot after the next bottom-third transfer, independent of its phase.
  for (let frame = 0; frame < 3; frame++) box.updateDisplay();
  vi.mocked(drawTile).mockClear(); box.render();
  return vi.mocked(drawTile).mock.calls.some(call => call[1] === charToTile('▼') && call[2] === 144 && call[3] === 128);
}

describe('blocking text script routines', () => {
  it.each(['closed', 'standalone'] as const)('textButtonWait rejects a %s box without synchronizing input', state => {
    const deps = scene();
    if (state === 'standalone') deps.textBox.printStandalone({ program: 'WhatText' });
    initScript([{ type: 'textButtonWait' }]); vi.mocked(syncJoypadRead).mockClear();
    expect(() => updateScript(deps, false)).toThrow('textButtonWait requires an open display');
    expect(syncJoypadRead).not.toHaveBeenCalled();
  });
  it.each([false, true])('sound plays once and returns on the sound-finished frame (waitForCurrent=%s)', waitForCurrent => {
    const deps = scene(); const moved = vi.spyOn(deps.player, 'update');
    const after = vi.fn();
    initScript([{ type: 'displayOpen' }, { type: 'sound', name: 'get_item1', waitForCurrent },
      { type: 'callback', fn: after }]);
    vi.mocked(isSoundFinished).mockReturnValue(false);
    updateScript(deps, false);
    for (let frame = 0; frame < 20; frame++) updateScript(deps, false);
    updateScript(deps, true); updateScript(deps, false);
    expect(playSFX).toHaveBeenCalledTimes(waitForCurrent ? 0 : 1);
    if (waitForCurrent) {
      vi.mocked(isSoundFinished).mockReturnValueOnce(true); updateScript(deps, true);
      expect(playSFX).toHaveBeenCalledExactlyOnceWith('get_item1');
    }
    expect(getActiveScript()?.index).toBe(1); expect(after).not.toHaveBeenCalled();
    vi.mocked(isSoundFinished).mockReturnValue(true);
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' });
    expect(after).toHaveBeenCalledOnce();
    expect(moved).not.toHaveBeenCalled(); expect(syncJoypadRead).not.toHaveBeenCalled(); // sound waits own no reads
  });
  it.each(['a', 'b'])('silent textButtonWait accepts %s without an arrow or beep', button => {
    const deps = scene(); openPrinted(deps);
    initScript([{ type: 'textButtonWait' }, { type: 'displayClose', outerWait: false }]);
    updateScript(deps, true); expect(deps.textBox.active).toBe(true); expect(arrow(deps.textBox)).toBe(false);
    vi.mocked(isHeld).mockImplementation(key => key === button);
    expect(updateScript(deps, false)).toBeNull();
    if (button === 'a') { vi.mocked(isHeld).mockReturnValue(false); updateScript(deps, false); }
    for (let frame = 0; frame < 6; frame++) expect(updateScript(deps, false)).toBeNull();
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' }); // detached W=1, seven close frames
    expect(playSFX).not.toHaveBeenCalled(); expect(syncJoypadRead).toHaveBeenCalled();
  });
  it('HoldTextDisplayOpen stays while A is held, then waits the full seven-frame reload', () => {
    const deps = scene(); openPrinted(deps);
    initScript([{ type: 'displayClose', outerWait: false }]); vi.mocked(isHeld).mockImplementation(key => key === 'a');
    updateScript(deps, true); updateScript(deps, false); expect(deps.textBox.active).toBe(true);
    vi.mocked(isHeld).mockReturnValue(false);
    expect(updateScript(deps, false)).toBeNull();
    for (let frame = 0; frame < 6; frame++) expect(updateScript(deps, false)).toBeNull();
    expect(updateScript(deps, false)).toEqual({ type: 'scriptEnded' }); expect(deps.textBox.active).toBe(false);
  });
  it('HideObject saves its key, hides the live object and removes its collision availability', () => {
    const deps = scene(); deps.npcs.push(new Npc({ id: 'potion1', sprite: 'poke_ball', x: 0, y: 1, movement: 'stay', dialogue: '', object: true }));
    initScript([{ type: 'displayOpen' }, { type: 'hideObject', map: 'ViridianForest', npcId: 'potion1' },
      { type: 'printText', program: 'WhatText' }]);
    updateScript(deps, false);
    for (let frame = 0; frame < 19; frame++) updateScript(deps, false);
    updateScript(deps, true);
    expect(getAllHiddenObjects()).toEqual(['ViridianForest:potion1']); expect(deps.npcs[0].hidden).toBe(true);
    expect(spriteTable(deps.player, deps.npcs)[1].available).toBe(false);
    expect(deps.textBox.active).toBe(true);
  });
  it('retained text keeps UiEntry open across commands; an unterminated script dismisses it', () => {
    const deps = scene(); const ui = new UiEntry();
    initScript([{ type: 'displayOpen' }, { type: 'printText', program: 'WhatText', noDelay: true },
      { type: 'printText', program: 'WhatText', noDelay: true }]);
    updateScript(deps, true); expect(ui.opened(deps.textBox.active)).toBe(true);
    const print = vi.spyOn(deps.textBox, 'print');
    let ended = false;
    for (let frame = 1; frame < 100 && !ended; frame++) {
      ended = updateScript(deps, false)?.type === 'scriptEnded';
      expect(ui.opened(deps.textBox.active)).toBe(false);
      if (!ended) expect(deps.textBox.active).toBe(true);
    }
    expect(print).toHaveBeenCalledTimes(2);
    expect(ended).toBe(true); expect(deps.textBox.active).toBe(false);
  });
});
