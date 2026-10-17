import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenTiles, addBcd } from './screen_tiles';
import { BgTransfer } from '../text/bg_transfer';
import { TextBox } from '../text/textbox';

vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: vi.fn(), loadTileset: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });

function row(tiles: ScreenTiles, y: number, from = 0, to = 20): string {
  let text = '';
  for (let x = from; x < to; x++) text += tiles.at(x, y) ?? '.';
  return text;
}

describe('menu screen tiles', () => {
  it('draws a text-box border and blanks its interior', () => {
    const tiles = new ScreenTiles();
    tiles.textBoxBorder(7, 9, 1, 11);
    expect(row(tiles, 9, 7, 20)).toBe('┌───────────┐');
    expect(row(tiles, 10, 7, 20)).toBe('│           │');
    expect(row(tiles, 11, 7, 20)).toBe('└───────────┘');
    expect(tiles.at(6, 10)).toBeNull();
  });

  it('places glyphs, and <NEXT> moves down two rows', () => {
    const tiles = new ScreenTiles();
    tiles.placeString(2, 1, 'BUY<NEXT>SELL@');
    expect(tiles.at(2, 1)).toBe('B');
    expect(tiles.at(4, 1)).toBe('Y');
    expect(tiles.at(2, 3)).toBe('S');
    expect(tiles.at(5, 3)).toBe('L');
    expect(tiles.at(2, 2)).toBeNull();
  });

  it('BCD and number writers skip suppressed cells instead of blanking them', () => {
    const tiles = new ScreenTiles();
    tiles.put(12, 10, 'X');
    tiles.put(13, 10, 'X');
    tiles.put(14, 10, 'X');
    tiles.writeBcd(12, 10, 300, { bytes: 3, suppressZero: true, leftAlign: false, moneySign: true });
    expect(tiles.at(12, 10)).toBe('X');
    expect(tiles.at(13, 10)).toBe('X');
    expect(tiles.at(14, 10)).toBe('X');
    expect(row(tiles, 10, 15, 19)).toBe('¥300');
    tiles.put(9, 10, 'X');
    tiles.put(10, 10, 'Y');
    tiles.writeNumber(9, 10, 1, { digits: 2, leadingZeroes: false });
    expect(tiles.at(9, 10)).toBe('X');
    expect(tiles.at(10, 10)).toBe('1');
    tiles.put(9, 11, 'X');
    tiles.put(10, 11, 'Y');
    tiles.writeNumber(9, 11, 0, { digits: 2, leadingZeroes: false });
    expect(tiles.at(9, 11)).toBe('X');
    expect(tiles.at(10, 11)).toBe('0');
    tiles.writeNumber(9, 10, 1, { digits: 2, leadingZeroes: true });
    expect(row(tiles, 10, 9, 11)).toBe('01');
    expect(addBcd(999999, 1)).toBe(999999);
  });

  it('Buffer1 round-trips the logical map and the message box without restarting the text', () => {
    const tiles = new ScreenTiles();
    const box = new TextBox();
    box.open();
    box.print({ text: 'HI' }, { box: 'keep', noDelay: true });
    tiles.put(4, 2, 'M');
    const saved = tiles.save(box);
    expect(box.phase).toBe('waiting');
    expect(box.isTextComplete).toBe(true);
    tiles.put(4, 2, 'Z');
    box.print({ text: 'NO' }, { box: 'keep', noDelay: true });
    box.hideDisplay();
    const transfer = new BgTransfer();
    transfer.tick();
    const enabledLog: boolean[] = [];
    let enabled = true;
    Object.defineProperty(transfer, 'enabled', {
      configurable: true,
      get: () => enabled,
      set: (value: boolean) => { enabledLog.push(value); enabled = value; },
    });
    tiles.restore(saved, box, transfer);
    expect(enabledLog).toEqual([false, true]);
    expect(transfer.nextPortion).toBe(1);
    expect(tiles.at(4, 2)).toBe('M');
    expect(tiles.visibleAt(4, 2)).toBeNull();
    expect(box.saveScreen()).toEqual(saved.text);
    expect(box.saveScreen().border).toBe(true);
    expect(box.phase).toBe('waiting');
    expect(box.isTextComplete).toBe(true);
    expect(box.isComplete).toBe(true);
    const again = new BgTransfer();
    again.enabled = false;
    tiles.restore(saved, box, again);
    expect(again.enabled).toBe(true);
  });

  it('retains a departed overlay scanout without changing logical cells or the BG portion', () => {
    const start = new ScreenTiles(), bag = new ScreenTiles(), transfer = new BgTransfer();
    start.put(11, 2, '▶'); start.present(transfer);
    bag.put(4, 4, 'B'); bag.present(new BgTransfer());
    const shown = bag.saveVisibleTiles(); bag.reset();
    start.restoreVisibleTiles(shown);
    expect(start.at(4, 4)).toBeNull(); expect(start.visibleAt(4, 4)).toBe('B');
    expect(start.visibleAt(11, 2)).toBe('▶'); expect(transfer.nextPortion).toBe(1);
    start.present(transfer); start.present(transfer); start.present(transfer);
    expect(start.visibleAt(4, 4)).toBeNull();
  });

  it('a disabled transfer shows nothing new and does not advance, then thirds run in order', () => {
    const tiles = new ScreenTiles();
    const transfer = new BgTransfer();
    tiles.put(0, 0, 'A');
    tiles.put(0, 6, 'B');
    tiles.put(0, 12, 'C');
    transfer.enabled = false;
    for (let frame = 0; frame < 10; frame++) tiles.present(transfer);
    expect(tiles.visibleAt(0, 0)).toBeNull();
    expect(tiles.visibleAt(0, 6)).toBeNull();
    expect(tiles.visibleAt(0, 12)).toBeNull();
    expect(transfer.nextPortion).toBe(0);
    transfer.enabled = true;
    tiles.present(transfer);
    expect(tiles.visibleAt(0, 0)).toBe('A');
    expect(tiles.visibleAt(0, 6)).toBeNull();
    tiles.present(transfer);
    expect(tiles.visibleAt(0, 6)).toBe('B');
    expect(tiles.visibleAt(0, 12)).toBeNull();
    tiles.present(transfer);
    expect(tiles.visibleAt(0, 12)).toBe('C');
    expect(tiles.visibleAt(0, 0)).toBe('A');
    expect(transfer.nextPortion).toBe(0);
  });
});
