import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextBox, initTextSystem, setTextSpeed } from './textbox';
import { MapDialogue } from './map_dialogue';
import { isHeld, isPressed, syncJoypadRead } from '../input';
import { drawTile, fillRect } from '../renderer';
import { playSFX } from '../audio';
import { charToTile } from './charmap';
import { uiTiles } from '../renderer/ui_tiles';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
const font = { width: 128 }; const extra = { width: 128 };
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: vi.fn(async () => font), loadTileset: vi.fn(async () => extra) }));
beforeAll(initTextSystem);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(isHeld).mockReturnValue(false);
  vi.mocked(isPressed).mockReturnValue(false); setTextSpeed('fast'); uiTiles.clear(); });
function down(button: 'a' | 'b' | null): void { vi.mocked(isHeld).mockImplementation(key => key === button); }
function tick(box: TextBox, frames: number): void { for (let i = 0; i < frames; i++) box.update(); }
function tiles(box: TextBox, y: number): number[] {
  vi.mocked(drawTile).mockClear(); box.render();
  return vi.mocked(drawTile).mock.calls.filter(call => call[0] === font && call[3] === y).map(call => call[1]);
}
describe('DisplayTextID and PrintText integration', () => {
  it('registers the logical border at T, renders it at T+3 and places text at T+20', () => {
    const box = new TextBox(); down('a'); box.show('AB', { mode: 'displayTextID' }); box.render();
    expect(uiTiles.tileAt(18, 16)).toBe(0x60); expect(fillRect).not.toHaveBeenCalled();
    tick(box, 2); box.render(); expect(fillRect).not.toHaveBeenCalled();
    tick(box, 1); box.render(); expect(fillRect).toHaveBeenCalled();
    tick(box, 16); expect(syncJoypadRead).not.toHaveBeenCalled(); expect(tiles(box, 112)).toEqual([]);
    tick(box, 1); expect(syncJoypadRead).toHaveBeenCalledTimes(1); expect(tiles(box, 112)).toEqual([]);
    for (let frame = 21; frame <= 23; frame++) { box.update(); if (frame === 23) expect(tiles(box, 112)).toContain(charToTile('A')); }
  });
  it('done is silent, has no arrow, and a held opening A requires release and new press', () => {
    const box = new TextBox(); down('a'); box.show('A', { mode: 'displayTextID' }); tick(box, 40);
    expect(box.isTextComplete).toBe(true); expect(box.isWaitingForInput).toBe(true);
    expect(tiles(box, 128)).not.toContain(charToTile('▼')); expect(playSFX).not.toHaveBeenCalled();
    down(null); tick(box, 1); expect(box.active).toBe(true);
    down('a'); tick(box, 5); expect(box.active).toBe(true);
    down(null); tick(box, 1); expect(box.active).toBe(true); tick(box, 1); expect(box.active).toBe(false);
  });
  it('B bypasses the A hold and closes after CloseTextDisplay DelayFrame', () => {
    const box = new TextBox(); box.show('A', { mode: 'displayTextID' }); tick(box, 21);
    down('b'); tick(box, 1); tick(box, 1); expect(box.active).toBe(false);
    expect(playSFX).not.toHaveBeenCalled();
  });
  it('prompt uses its beeping wait and then a separate silent DisplayTextID wait', () => {
    const box = new TextBox(); box.show('A<PROMPT>', { mode: 'displayTextID' }); tick(box, 24);
    down('a'); box.update(); expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
    expect(box.isTextComplete).toBe(true); tick(box, 4); expect(box.active).toBe(true);
    down(null); box.update(); expect(box.active).toBe(true);
    down('b'); box.update(); box.update(); expect(box.active).toBe(false);
    expect(playSFX).toHaveBeenCalledTimes(1);
  });
  it('a press held during the opening is consumed by letter delay, not mistaken for close', () => {
    const box = new TextBox(); box.show('A', { mode: 'displayTextID' }); tick(box, 10);
    down('b'); tick(box, 30); expect(box.active).toBe(true);
    down(null); box.update(); down('b'); tick(box, 2); expect(box.active).toBe(false);
  });
  it('PrintText alone waits three frames and returns while retaining the box', () => {
    const box = new TextBox(); box.show('A', { mode: 'printText' }); tick(box, 2);
    expect(syncJoypadRead).not.toHaveBeenCalled(); box.update(); expect(syncJoypadRead).toHaveBeenCalledTimes(1);
    box.update(); expect(box.isComplete).toBe(true); expect(box.active).toBe(true);
  });
  it('explicit text_end overrides an extracted prompt, and reads no input after return', () => {
    const box = new TextBox(); box.show('A<PROMPT>', { end: 'none' }); tick(box, 2);
    expect(box.isComplete).toBe(true); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isHeld).mockClear(); tick(box, 5); expect(isHeld).not.toHaveBeenCalled();
  });
  it('explicit prompt wins once, even when the string already has PROMPT', () => {
    const box = new TextBox(); box.show('A<PROMPT>', { end: 'prompt' }); tick(box, 5);
    down('b'); box.update(); expect(box.isComplete).toBe(true); expect(playSFX).toHaveBeenCalledTimes(1);
  });
  it('legacy strips the map terminator and preserves dismissal on the pressed edge', () => {
    const box = new TextBox(); box.show('A<PROMPT>'); tick(box, 2);
    expect(box.isWaitingForInput).toBe(true); expect(playSFX).not.toHaveBeenCalled();
    vi.mocked(isPressed).mockImplementation(key => key === 'a'); box.update();
    expect(box.active).toBe(false); expect(playSFX).toHaveBeenCalledTimes(1);
  });
  it('retained text keeps transferring its final glyph, including contractions', () => {
    const box = new TextBox(); box.show("It's", { end: 'none' }); tick(box, 4);
    expect(box.isComplete).toBe(true); tick(box, 3);
    expect(tiles(box, 112)).toEqual([charToTile('I'), charToTile('t'), charToTile("'s")]);
  });
  it('extra-font glyphs draw from the extra sheet at consecutive tile positions', () => {
    const box = new TextBox(); box.show('…“”\uE001\uE002', { end: 'none' }); tick(box, 10);
    vi.mocked(drawTile).mockClear(); box.render();
    const glyphs = vi.mocked(drawTile).mock.calls.filter(call => call[3] === 112 && call[2] > 0 && call[2] < 152);
    expect(glyphs.map(call => [call[0] === extra ? 'extra' : 'font', call[1], call[2]]))
      .toEqual([['extra', 21, 8], ['extra', 18, 16], ['extra', 19, 24], ['font', 97, 32], ['font', 98, 40]]);
  });
  it('rendering never advances the printer or transfer phase', () => {
    const box = new TextBox(); box.show('ABCDE', { end: 'none' }); tick(box, 2);
    const expected = tiles(box, 112); for (let i = 0; i < 10; i++) expect(tiles(box, 112)).toEqual(expected);
    expect(box.isComplete).toBe(false);
  });
});

describe('map trainer dialogue used by main.ts', () => {
  it.each([false, true])('starts meet music at completed PrintText, then returns only after close (seen=%s)', seen => {
    const box = new TextBox(); const dialogue = new MapDialogue(box); const music = vi.fn();
    dialogue.show('AB', { trainer: true, onTextComplete: seen ? undefined : music });
    for (let frame = 1; frame <= 24; frame++) { expect(dialogue.update()).toBe(false); expect(music).not.toHaveBeenCalled(); }
    expect(dialogue.update()).toBe(false); expect(music).toHaveBeenCalledTimes(seen ? 0 : 1);
    expect(box.isTextComplete).toBe(true);
    down('a'); for (let frame = 0; frame < 4; frame++) expect(dialogue.update()).toBe(false);
    down(null); expect(dialogue.update()).toBe(false); expect(dialogue.update()).toBe(true);
    expect(music).toHaveBeenCalledTimes(seen ? 0 : 1); expect(playSFX).not.toHaveBeenCalled();
  });
  it('an ordinary map dialogue omits the nested PrintText delay', () => {
    const box = new TextBox(); const dialogue = new MapDialogue(box); const completed = vi.fn();
    dialogue.show('A', { onTextComplete: completed });
    for (let i = 0; i < 20; i++) dialogue.update(); expect(completed).not.toHaveBeenCalled();
    dialogue.update(); expect(completed).toHaveBeenCalledTimes(1);
  });
});
