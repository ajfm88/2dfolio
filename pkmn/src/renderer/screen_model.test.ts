// Screen-model merge checkpoint-01 (note 86): the shared tile-map core, before any model uses it.
import { beforeEach, describe, expect, it } from 'vitest';
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { TileMap, VideoCopyQueue, captureTextBox, SCREEN_CELLS, THIRD_CELLS } from './screen_model';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

/** A standalone-PrintText stand-in: only the two members captureTextBox reads. */
function printer(active: boolean, border: boolean, fill = (index: number) => `c${index}`): TextBox {
  const buffer = Array.from({ length: 6 * 20 }, (_, index) => fill(index));
  return { active, saveScreen: () => ({ buffer, border }) } as unknown as TextBox;
}

describe('TileMap', () => {
  it('starts both copies from the initializer and hands out copies, not its arrays', () => {
    const map = new TileMap<number>(index => index);
    expect(SCREEN_CELLS).toBe(360);
    expect(map.cells).toEqual(Array.from({ length: 360 }, (_, index) => index));
    expect(map.visibleCells).toEqual(map.cells);
    (map.cells as number[])[0] = 99;
    (map.visibleCells as number[])[1] = 99;
    expect(map.get(0)).toBe(0);
    expect(map.visibleAt(1, 0)).toBe(1);
  });

  it('drops off-screen coordinate writes; reads outside are null; pointer writes are raw', () => {
    const map = new TileMap<string>(() => ' ');
    map.put(-1, 0, 'a'); map.put(20, 0, 'a'); map.put(0, -1, 'a'); map.put(0, 18, 'a');
    expect(map.cells.every(cell => cell === ' ')).toBe(true);
    expect([map.at(20, 0), map.at(0, 18), map.visibleAt(-1, 0)]).toEqual([null, null, null]);
    map.put(19, 17, 'z');
    expect(map.get(359)).toBe('z');
    map.set(21, 'p');
    expect(map.at(1, 1)).toBe('p');
    expect(map.visibleAt(1, 1)).toBe(' ');
  });

  it('fill changes only wTileMap; fillShown only the shown copy', () => {
    const map = new TileMap<string>(() => 'a');
    map.fill('b');
    expect(map.cells.every(cell => cell === 'b') && map.visibleCells.every(cell => cell === 'a')).toBe(true);
    map.fillShown('c');
    expect(map.cells.every(cell => cell === 'b') && map.visibleCells.every(cell => cell === 'c')).toBe(true);
  });

  it('copies nothing while automatic transfer is disabled', () => {
    const map = new TileMap<number>(() => 0);
    map.fill(5);
    textBgTransfer.enabled = false;
    expect(map.transferThird()).toBeNull();
    expect(map.visibleCells.every(cell => cell === 0)).toBe(true);
    expect(textBgTransfer.nextPortion).toBe(0);
  });

  it.each([0, 1, 2])('copies exactly third %i (six rows) and leaves the tick to the caller', third => {
    const map = new TileMap<number>(() => -1);
    for (let index = 0; index < 360; index++) map.set(index, index);
    for (let i = 0; i < third; i++) textBgTransfer.tick();
    expect(map.transferThird()).toBe(third);
    expect(textBgTransfer.nextPortion).toBe(third);
    map.visibleCells.forEach((cell, index) => {
      const inThird = index >= third * THIRD_CELLS && index < (third + 1) * THIRD_CELLS;
      expect(cell).toBe(inThird ? index : -1);
    });
  });

  it('sends a third to a destination writer in wTileMap order instead of the shown copy', () => {
    const map = new TileMap<number>(index => index);
    map.fill(7);
    map.set(140, 8);
    textBgTransfer.tick();
    const writes: [number, number][] = [];
    expect(map.transferThird((index, cell) => writes.push([index, cell]))).toBe(1);
    expect(writes.map(([index]) => index)).toEqual(Array.from({ length: 120 }, (_, i) => 120 + i));
    expect(writes.find(([index]) => index === 140)).toEqual([140, 8]);
    expect(map.visibleCells).toEqual(Array.from({ length: 360 }, (_, index) => index));
  });
});

describe('VideoCopyQueue', () => {
  function run(total: number, immediate = false) {
    const queue = new VideoCopyQueue('busy');
    const written: number[] = [], perFrame: number[] = [];
    const copy = queue.copy(total, index => written.push(index), immediate);
    let frames = 0;
    for (let step = copy.next(); !step.done; step = copy.next()) {
      frames++;
      expect(textBgTransfer.enabled).toBe(false);
      const before = written.length; queue.service(); perFrame.push(written.length - before);
    }
    return { queue, written, perFrame, frames };
  }

  it.each([[49, 7, [8, 8, 8, 8, 8, 8, 1]], [30, 4, [8, 8, 8, 6]], [3, 1, [3]], [8, 2, [8, 0]]] as const)(
    'copies %i tiles over floor(n/8)+1 = %i serviced frames, eight a frame', (total, frames, perFrame) => {
      const result = run(total);
      expect(result.frames).toBe(frames);
      expect(result.perFrame).toEqual(perFrame);
      expect(result.written).toEqual(Array.from({ length: total }, (_, index) => index));
      expect(result.queue.active).toBe(false);
    });

  it.each([true, false])('restores the caller transfer byte (%s) on return', enabled => {
    textBgTransfer.enabled = enabled;
    run(49);
    expect(textBgTransfer.enabled).toBe(enabled);
  });

  it('with the LCD off writes every tile at once, yields nothing and restores the byte', () => {
    const result = run(49, true);
    expect(result.frames).toBe(0);
    expect(result.written).toHaveLength(49);
    expect(textBgTransfer.enabled).toBe(true);
  });

  it('refuses a second copy while one is queued, with the model message; service outside a copy is a no-op', () => {
    const queue = new VideoCopyQueue('Battle VRAM copy already in progress');
    queue.service();
    const first = queue.copy(49, () => {});
    first.next();
    expect(queue.active).toBe(true);
    expect(() => queue.copy(3, () => {}).next()).toThrow('Battle VRAM copy already in progress');
    expect(queue.active).toBe(true);
    first.return(undefined);
    expect(queue.active).toBe(false);
    expect(textBgTransfer.enabled).toBe(true);
  });
});

describe('captureTextBox', () => {
  it('ignores an inactive or borderless message box', () => {
    const map = new TileMap<string | number>(() => 0);
    captureTextBox(map);
    captureTextBox(map, printer(false, true));
    captureTextBox(map, printer(true, false));
    expect(map.cells.every(cell => cell === 0)).toBe(true);
  });

  it('draws TextBoxBorder(0, 12, 4, 18) and copies only the printer interior', () => {
    const map = new TileMap<string | number>(() => 0);
    captureTextBox(map, printer(true, true));
    const row = (y: number) => Array.from({ length: 20 }, (_, x) => map.at(x, y));
    expect(row(12)).toEqual(['┌', ...Array(18).fill('─'), '┐']);
    expect(row(17)).toEqual(['└', ...Array(18).fill('─'), '┘']);
    for (let y = 13; y <= 16; y++)
      expect(row(y)).toEqual(['│', ...Array.from({ length: 18 }, (_, x) => `c${(y - 12) * 20 + x + 1}`), '│']);
    expect(map.cells.slice(0, 12 * 20).every(cell => cell === 0)).toBe(true);
    expect(map.visibleCells.every(cell => cell === 0)).toBe(true);
  });
});
