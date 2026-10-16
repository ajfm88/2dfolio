import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuantityMenu } from './quantity_menu';
import { ScreenTiles } from './screen_tiles';
import { isPassPressed } from '../input';
import { playSFX } from '../audio';
import type { GameButton } from '../core';

vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false) }));
vi.mock('../audio', () => ({ playSFX: vi.fn() }));

function row(tiles: ScreenTiles, y: number): string {
  let text = '';
  for (let x = 0; x < 20; x++) text += tiles.at(x, y) ?? '.';
  return text;
}

function rig(config: ConstructorParameters<typeof QuantityMenu>[1]) {
  const tiles = new ScreenTiles();
  const menu = new QuantityMenu(tiles, config);
  let next: GameButton[] = [];
  const read = vi.fn(() => { const seen = next; next = []; vi.mocked(isPassPressed).mockImplementation(k => seen.includes(k)); });
  return {
    tiles, menu, read,
    press: (...keys: GameButton[]) => { next = keys; },
    frame: () => menu.update(read),
  };
}

beforeEach(() => { vi.mocked(isPassPressed).mockReset(); vi.mocked(isPassPressed).mockReturnValue(false); vi.mocked(playSFX).mockClear(); });

describe('DisplayChooseQuantityMenu', () => {
  it('draws both layouts, with the priced total and a floored odd half', () => {
    const priced = rig({ priced: true, max: 99, unitPrice: 300 });
    expect(priced.read).not.toHaveBeenCalled();
    expect(priced.menu.quantity).toBe(1);
    expect(priced.menu.total).toBe(300);
    expect(row(priced.tiles, 9)).toBe('.......┌───────────┐');
    expect(row(priced.tiles, 10)).toBe('.......│×01    ¥300│');
    expect(row(priced.tiles, 11)).toBe('.......└───────────┘');
    priced.press('up'); priced.frame();
    expect(priced.menu.quantity).toBe(2);
    expect(priced.menu.total).toBe(600);
    expect(row(priced.tiles, 10)).toBe('.......│×02    ¥600│');

    const halved = rig({ priced: true, max: 99, unitPrice: 15, halve: true });
    expect(halved.menu.total).toBe(7);
    expect(row(halved.tiles, 10).slice(12, 19)).toBe('     ¥7');
    halved.press('up'); halved.frame(); halved.press('up'); halved.frame();
    expect(halved.menu.quantity).toBe(3);
    expect(halved.menu.total).toBe(22);

    const plain = rig({ priced: false, max: 99 });
    expect(plain.menu.total).toBe(0);
    expect(row(plain.tiles, 9)).toBe('...............┌───┐');
    expect(row(plain.tiles, 10)).toBe('...............│×01│');
    expect(row(plain.tiles, 11)).toBe('...............└───┘');
  });

  it('wraps 1↔99 and 1↔a stack, and the first read is the first frame', () => {
    const big = rig({ priced: true, max: 99, unitPrice: 300 });
    expect(big.read).not.toHaveBeenCalled();
    big.press('down'); expect(big.frame()).toBeNull();
    expect(big.read).toHaveBeenCalledTimes(1);
    expect(big.menu.quantity).toBe(99);
    expect(big.menu.total).toBe(29700);
    expect(row(big.tiles, 10)).toBe('.......│×99  ¥29700│');
    big.press('up'); big.frame();
    expect(big.menu.quantity).toBe(1);
    expect(big.menu.total).toBe(300);

    const stack = rig({ priced: true, max: 4, unitPrice: 200, halve: true });
    stack.press('down'); stack.frame();
    expect(stack.menu.quantity).toBe(4);
    expect(stack.menu.total).toBe(400);
    stack.press('up'); stack.frame();
    expect(stack.menu.quantity).toBe(1);
    expect(stack.menu.total).toBe(100);
  });

  it('reads only new presses, and A or B returns on that read with no sound', () => {
    const menu = rig({ priced: false, max: 99 });
    menu.press('up'); menu.frame();
    expect(menu.menu.quantity).toBe(2);
    menu.frame();
    expect(menu.menu.quantity).toBe(2);
    expect(menu.read).toHaveBeenCalledTimes(2);

    menu.press('a', 'up');
    expect(menu.frame()).toEqual({ type: 'chosen', quantity: 2, total: 0 });
    expect(playSFX).not.toHaveBeenCalled();

    const cancel = rig({ priced: true, max: 99, unitPrice: 300 });
    cancel.press('b');
    expect(cancel.frame()).toEqual({ type: 'cancelled' });
    expect(cancel.menu.quantity).toBe(1);
    expect(playSFX).not.toHaveBeenCalled();
  });
});
