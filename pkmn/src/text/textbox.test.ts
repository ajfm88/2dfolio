import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextBox, initTextSystem, setTextSpeed } from './textbox';
import { MapDialogue } from './map_dialogue';
import { isHeld, isPressed, syncJoypadRead } from '../input';
import { drawTile, fillRect } from '../renderer';
import { playSFX, isSoundFinished } from '../audio';
import { charToTile } from './charmap';
import { uiTiles } from '../renderer/ui_tiles';
import { textBgTransfer } from './bg_transfer';
import { CloseSequence } from './close_sequence';
import { loadTextPrograms } from './program_data';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
const font = { width: 128 }; const extra = { width: 128 };
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: vi.fn(async () => font), loadTileset: vi.fn(async () => extra) }));
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(isSoundFinished).mockReturnValue(true); vi.mocked(isHeld).mockReturnValue(false);
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
    down(null); tick(box, 1); expect(box.active).toBe(true); tick(box, 6); expect(box.active).toBe(true);
    tick(box, 1); expect(box.active).toBe(false); // 5 + 2W, detached minimal walking set W=1
  });
  it('B bypasses the A hold and closes after the full walking reload', () => {
    const box = new TextBox(); box.show('A', { mode: 'displayTextID' }); tick(box, 21);
    down('b'); tick(box, 1); tick(box, 7); expect(box.active).toBe(false);
    expect(playSFX).not.toHaveBeenCalled();
  });
  it('prompt uses its beeping wait and then a separate silent DisplayTextID wait', () => {
    const box = new TextBox(); box.show('A<PROMPT>', { mode: 'displayTextID' }); tick(box, 24);
    down('a'); box.update(); expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');
    expect(box.isTextComplete).toBe(true); tick(box, 4); expect(box.active).toBe(true);
    down(null); box.update(); expect(box.active).toBe(true);
    down('b'); box.update(); tick(box, 7); expect(box.active).toBe(false);
    expect(playSFX).toHaveBeenCalledTimes(1);
  });
  it('a press held during the opening is consumed by letter delay, not mistaken for close', () => {
    const box = new TextBox(); box.show('A', { mode: 'displayTextID' }); tick(box, 10);
    down('b'); tick(box, 30); expect(box.active).toBe(true);
    down(null); box.update(); down('b'); tick(box, 8); expect(box.active).toBe(false);
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

describe('standalone no-text-delay PrintText (A5b7a)', () => {
  it('keeps Delay3 but places the entire program without letter reads, then retains its transfer', () => {
    const box = new TextBox();
    const transfer = vi.spyOn(textBgTransfer, 'tick');
    try {
      box.printStandalone({ program: 'PotionText' }, { noDelay: true,
        bindings: { nameBuffer: 'PIKACHU', hpDifference: 123 } });
      expect(box.active).toBe(true); expect(box.isComplete).toBe(false);
      tick(box, 2);
      expect(box.isComplete).toBe(false); expect(syncJoypadRead).not.toHaveBeenCalled();
      box.update();
      expect(box.isComplete).toBe(true); expect(box.isTextComplete).toBe(true);
      expect(syncJoypadRead).not.toHaveBeenCalled();
      tick(box, 3);
      expect(tiles(box, 112)).toEqual('PIKACHU'.split('').map(charToTile));
      expect(tiles(box, 128)).toEqual('recovered by 123!'.split('').filter(ch => ch !== ' ').map(charToTile));
      expect(transfer).toHaveBeenCalledTimes(6);
      const beforeRender = transfer.mock.calls.length;
      box.render(); box.render(); expect(transfer).toHaveBeenCalledTimes(beforeRender);
      expect(box.active).toBe(true); expect(playSFX).not.toHaveBeenCalled();
    } finally { transfer.mockRestore(); }
  });

  it('preserves the default standalone letter delay used by Oak speech', () => {
    setTextSpeed('medium');
    const box = new TextBox(); box.printStandalone({ text: 'AB<DONE>' });
    tick(box, 2); expect(syncJoypadRead).not.toHaveBeenCalled();
    box.update(); expect(syncJoypadRead).toHaveBeenCalledTimes(1);
    expect(box.isComplete).toBe(false);
    tick(box, 5); expect(box.isComplete).toBe(false);
    box.update(); expect(box.isComplete).toBe(true);
  });

  it('no-delay still waits for a committed program sound, without Joypad reads or an extra return frame', () => {
    const box = new TextBox(); vi.mocked(isSoundFinished).mockReturnValue(false);
    box.printStandalone({ program: 'OaksLabReceivedText' }, { noDelay: true, bindings: { nameBuffer: 'PIKACHU' } });
    tick(box, 2); expect(playSFX).not.toHaveBeenCalled();
    box.update(); expect(playSFX).toHaveBeenCalledExactlyOnceWith('get_key_item');
    expect(box.isComplete).toBe(false);
    down('a'); tick(box, 8); expect(box.isComplete).toBe(false);
    expect(syncJoypadRead).not.toHaveBeenCalled();
    vi.mocked(isSoundFinished).mockReturnValue(true); box.update();
    expect(box.isComplete).toBe(true); expect(box.active).toBe(true);
    expect(playSFX).toHaveBeenCalledTimes(1); expect(syncJoypadRead).not.toHaveBeenCalled();
  });

  it('reuses the screen and actual-read history across repeated calls, including a release during Delay3', () => {
    const box = new TextBox(); down('b');
    box.printStandalone({ text: 'A<PROMPT>' }, { noDelay: true });
    tick(box, 6); // held at construction cannot accept the first prompt
    expect(box.isComplete).toBe(false); expect(playSFX).not.toHaveBeenCalled();
    down(null); box.update(); down('b'); box.update();
    expect(box.isComplete).toBe(true); expect(playSFX).toHaveBeenCalledTimes(1);
    const screen = Reflect.get(box, 'screen') as object;
    const reads = vi.mocked(syncJoypadRead).mock.calls.length;
    box.printStandalone({ text: 'B<PROMPT>' }, { noDelay: true });
    down(null); tick(box, 2); down('b'); box.update();
    expect(syncJoypadRead).toHaveBeenCalledTimes(reads); // no read during the second Delay3
    expect(Reflect.get(box, 'screen')).toBe(screen);
    tick(box, 5); // the intervening release was never read; B is still held in history
    expect(box.isComplete).toBe(false); expect(playSFX).toHaveBeenCalledTimes(1);
    down(null); box.update(); down('b'); box.update();
    expect(box.isComplete).toBe(true); expect(playSFX).toHaveBeenCalledTimes(2);
    expect(box.active).toBe(true);
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
    down(null); expect(dialogue.update()).toBe(false);
    for (let frame = 0; frame < 6; frame++) expect(dialogue.update()).toBe(false);
    expect(dialogue.update()).toBe(true);
    expect(music).toHaveBeenCalledTimes(seen ? 0 : 1); expect(playSFX).not.toHaveBeenCalled();
  });
  it('an ordinary map dialogue omits the nested PrintText delay', () => {
    const box = new TextBox(); const dialogue = new MapDialogue(box); const completed = vi.fn();
    dialogue.show('A', { onTextComplete: completed });
    for (let i = 0; i < 20; i++) dialogue.update(); expect(completed).not.toHaveBeenCalled();
    dialogue.update(); expect(completed).toHaveBeenCalledTimes(1);
  });
});

describe('retained DisplayTextID session and exact close (A5b4)', () => {
  it.each([7, 9, 11, 13, 15, 17, 23])('closes in exactly %i frames, with coverage and one final sprite update', cost => {
    const sprites = vi.fn();
    const box = new TextBox({ closeFrames: () => cost, updateSprites: sprites });
    box.open(); expect(box.phase).toBe('opening'); tick(box, 20); expect(box.isComplete).toBe(true);
    box.print({ text: 'A' }, { box: 'keep' }); tick(box, 1);
    const transfer = vi.spyOn(textBgTransfer, 'tick');
    const reads = vi.mocked(syncJoypadRead).mock.calls.length;
    box.finish({ outerWait: false }); expect(box.closing).toBe(true);
    const afterHold = vi.mocked(syncJoypadRead).mock.calls.length;
    expect(afterHold).toBe(reads + 1);
    for (let frame = 1; frame <= cost; frame++) {
      box.update(); uiTiles.clear(); vi.mocked(fillRect).mockClear(); box.render();
      expect(box.active).toBe(frame < cost);
      expect(uiTiles.tileAt(18, 16)).toBe(frame < cost ? 0x60 : 0);
      expect(fillRect).not.toHaveBeenCalled();
      expect(sprites).toHaveBeenCalledTimes(frame === cost ? 1 : 0);
    }
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(syncJoypadRead).toHaveBeenCalledTimes(afterHold);
    tick(box, 10); expect(sprites).toHaveBeenCalledTimes(1);
    expect(box.phase).toBe('closed'); transfer.mockRestore();
  });

  it('new clears the four rows and waits three frames; keep preserves the buffer and writes immediately', () => {
    const box = new TextBox(); box.open(); tick(box, 20);
    box.print({ text: 'ABCDE' }, { box: 'keep' }); tick(box, 5); tick(box, 3);
    expect(tiles(box, 112)).toHaveLength(5);
    box.print({ text: 'Z' }, { box: 'keep' }); tick(box, 3);
    expect(tiles(box, 112)).toEqual(['Z', 'B', 'C', 'D', 'E'].map(charToTile));
    box.print({ text: 'Q' }, { box: 'new' }); tick(box, 2);
    expect(box.isTextComplete).toBe(false);
    tick(box, 1); expect(box.isTextComplete).toBe(false);
    tick(box, 3); expect(tiles(box, 112)).toEqual([charToTile('Q')]);
  });

  it('show equals open, keep-print and finish for the same input/frame trace', () => {
    const a = new TextBox(), b = new TextBox();
    a.show('A', { mode: 'displayTextID' }); b.open();
    tick(a, 20); tick(b, 20); b.print({ text: 'A' }, { box: 'keep' });
    a.update(); b.update(); b.finish({ outerWait: true });
    expect(a.isTextComplete).toBe(true); expect(b.isTextComplete).toBe(true);
    down('b'); a.update(); b.update();
    expect(a.closing).toBe(true); expect(b.closing).toBe(true);
    for (let frame = 0; frame < 7; frame++) { a.update(); b.update(); expect(a.active).toBe(b.active); }
  });

  it('autoBox=false creates a borderless opening; spriteUpdate/PrintText hooks stay explicit', () => {
    const hook = vi.fn(); const box = new TextBox({ closeFrames: () => 11, updateSprites: vi.fn(), printTextSprites: hook });
    box.open({ autoBox: false, spriteUpdate: false }); box.render();
    expect(uiTiles.tileAt(18, 16)).toBe(0); tick(box, 20);
    box.print({ text: 'A' }, { box: 'keep' }); expect(hook).not.toHaveBeenCalled(); tick(box, 1);
    box.print({ text: 'B' }, { box: 'new' }); expect(hook).toHaveBeenCalledTimes(1);
    box.render(); expect(uiTiles.tileAt(18, 16)).toBe(0x60);
  });

  it('an in-place CloseTextDisplay (TownMapText) keeps the session for Hold and a full-reload close', () => {
    const sprites = vi.fn(); const reloads: (string | undefined)[] = [];
    const box = new TextBox({ closeFrames: reload => { reloads.push(reload); return reload === 'full' ? 14 : 9; }, updateSprites: sprites });
    box.open(); tick(box, 20); box.print({ text: 'A' }, { box: 'keep' }); tick(box, 3);
    box.closeInPlace(); expect(box.closing).toBe(true);
    tick(box, 8); expect(sprites).not.toHaveBeenCalled(); tick(box, 1);
    expect(sprites).toHaveBeenCalledOnce(); expect(box.isComplete).toBe(true);
    expect(box.active).toBe(true); expect(box.closing).toBe(false); expect(box.uiTileAt(0, 12)).toBe(0);
    uiTiles.clear(); box.render(); expect(uiTiles.tileAt(0, 12)).toBe(0); // the window stays off
    box.finish({ outerWait: false, reload: 'full' }); // Hold: A is up
    tick(box, 13); expect(box.active).toBe(true); tick(box, 1);
    expect(box.active).toBe(false); expect(sprites).toHaveBeenCalledTimes(2);
    expect(reloads).toEqual([undefined, 'full']);
  });

  it('the pure close counter has no extra terminal frame or repeated callback', () => {
    const sprites = vi.fn(); const close = new CloseSequence(23, sprites);
    expect(close.firstFrame).toBe(true);
    for (let frame = 1; frame < 23; frame++) { close.advance(); expect(close.complete).toBe(false); }
    expect(sprites).not.toHaveBeenCalled(); close.advance(); expect(close.complete).toBe(true);
    close.advance(); expect(sprites).toHaveBeenCalledTimes(1);
  });

  it('the source 23-frame assertion catches an in-memory off-by-one close mutation', () => {
    const sprites = vi.fn(); const mutated = new CloseSequence(24, sprites);
    for (let i = 0; i < 23; i++) mutated.advance();
    expect(() => expect(sprites).toHaveBeenCalledTimes(1)).toThrow();
  });

  it('the closing coverage assertion catches a dropped cover call in memory', () => {
    const box = new TextBox(); box.open(); tick(box, 20); box.finish({ outerWait: false }); box.update();
    const cover = vi.spyOn(uiTiles, 'cover').mockImplementation(() => {});
    try { uiTiles.clear(); box.render(); expect(() => expect(uiTiles.tileAt(18, 16)).toBe(0x60)).toThrow(); }
    finally { cover.mockRestore(); }
  });

  it('the immediate keep-print assertion catches an in-memory extra PrintText Delay3', () => {
    const box = new TextBox(); box.open(); tick(box, 20); vi.mocked(syncJoypadRead).mockClear();
    const print = box.print.bind(box);
    const mutation = vi.spyOn(box, 'print').mockImplementation((source, opts) => print(source, { ...opts, box: 'new' }));
    try {
      box.print({ text: 'A' }, { box: 'keep' });
      expect(() => expect(syncJoypadRead).toHaveBeenCalledTimes(1)).toThrow();
    } finally { mutation.mockRestore(); }
  });
});
