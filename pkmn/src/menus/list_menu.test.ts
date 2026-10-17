import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListMenu, type ListEntry } from './list_menu';
import { ScreenTiles } from './screen_tiles';
import { BgTransfer } from '../text/bg_transfer';
import { removeFromInventoryAt, type ItemStack } from '../items';
import {
  getBagSavedMenuItem, getCurrentMenuItem, getListScrollOffset, getSavedListScrollOffset,
  setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset,
} from '../list_state';
import { isHeld, isPassPressed } from '../input';
import type { GameButton } from '../core';
import { LEVEL_GLYPH } from './menu_glyphs';
import { getNoTextDelay, setNoTextDelay } from '../text/text_flags';

vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isHeld: vi.fn(() => false) }));

function row(tiles: ScreenTiles, y: number, from: number, to: number): string {
  let text = '';
  for (let x = from; x < to; x++) text += tiles.at(x, y) ?? '.';
  return text;
}
function potions(count: number): ListEntry[] {
  return Array.from({ length: count }, () => ({ id: 'POTION' }));
}

function rig(config: ConstructorParameters<typeof ListMenu>[1]) {
  const tiles = new ScreenTiles();
  const transfer = new BgTransfer();
  const menu = new ListMenu(tiles, config, transfer);
  let pressed: GameButton[] = [];
  let held: GameButton[] = [];
  const read = vi.fn(() => {
    const seen = pressed;
    const down = held;
    pressed = [];
    vi.mocked(isPassPressed).mockImplementation(key => seen.includes(key));
    vi.mocked(isHeld).mockImplementation(key => down.includes(key));
  });
  const sound = vi.fn();
  return {
    tiles, transfer, menu, read, sound,
    hold: (...keys: GameButton[]) => { held = keys; },
    press: (...keys: GameButton[]) => { pressed = keys; held = keys; },
    frame: () => menu.update(read, sound),
    frames: (n: number) => { for (let i = 0; i < n; i++) menu.update(read, sound); },
  };
}

beforeEach(() => {
  setNoTextDelay(false);
  vi.mocked(isPassPressed).mockReset();
  vi.mocked(isHeld).mockReset();
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isHeld).mockReturnValue(false);
});

describe('DisplayListMenuID', () => {
  it.each([1, 9, 10, 99, 100])('prints a mon name and source LV/digits for level %i', level => {
    const menu = rig({ kind: 'mons', entries: [{ name: 'Sparky', level }] });
    expect(getNoTextDelay()).toBe(true);
    menu.frames(15);
    expect(row(menu.tiles, 4, 6, 12)).toBe('SPARKY');
    expect(row(menu.tiles, 5, 14, 18)).toBe(level < 100 ? `${LEVEL_GLYPH}${level}`.padEnd(4) : '100 ');
    expect(row(menu.tiles, 6, 6, 12)).toBe('CANCEL');
    menu.press('a');
    expect(menu.frame()).toEqual({ type: 'chosen', index: 0, name: 'SPARKY' });
    expect(getNoTextDelay()).toBe(false);
  });

  it('SELECT redraws mons without swapping; scrolling and cancel clear the shared delay flag', () => {
    const entries = ['One', 'Two', 'Three', 'Four'].map((name, i) => ({ name, level: i + 1 }));
    const original = structuredClone(entries);
    const menu = rig({ kind: 'mons', entries, item: 2 });
    menu.frames(15); menu.press('select'); menu.frame();
    expect(getNoTextDelay()).toBe(true);
    menu.frames(6); menu.press('down'); menu.frame();
    expect(menu.menu.offset).toBe(1);
    menu.frames(6);
    expect(row(menu.tiles, 4, 6, 9)).toBe('TWO');
    expect(entries).toEqual(original);
    menu.press('b');
    expect(menu.frame()).toEqual({ type: 'cancelled' });
    expect(getNoTextDelay()).toBe(false);
  });

  it.each(['items', 'priced'] as const)('%s clears no-text-delay on selection and the CANCEL row', kind => {
    for (const item of [0, 1]) {
      const menu = rig({ kind, entries: [{ id: 'POTION', count: 1 }], item });
      expect(getNoTextDelay()).toBe(true);
      menu.frames(15); menu.press('a');
      expect(menu.frame()?.type).toBe(item === 0 ? 'chosen' : 'cancelled');
      expect(getNoTextDelay()).toBe(false);
    }
  });

  it('lays out priced and bag lists, with ▼ only when CANCEL is off screen', () => {
    const priced = rig({ kind: 'priced', entries: [{ id: 'POTION' }, { id: 'ANTIDOTE' }] });
    expect(priced.transfer.enabled).toBe(false);
    expect(row(priced.tiles, 2, 4, 20)).toBe('┌──────────────┐');
    priced.frames(10);
    expect(priced.transfer.enabled).toBe(true);
    expect(row(priced.tiles, 4, 6, 12)).toBe('POTION');
    expect(row(priced.tiles, 5, 11, 18)).toBe('   ¥300');
    expect(row(priced.tiles, 6, 6, 14)).toBe('ANTIDOTE');
    expect(row(priced.tiles, 7, 11, 18)).toBe('   ¥100');
    expect(row(priced.tiles, 8, 6, 12)).toBe('CANCEL');
    expect(priced.tiles.at(18, 11)).not.toBe('▼');

    const more = rig({ kind: 'priced', entries: potions(4) });
    more.frames(10);
    expect(more.tiles.at(18, 11)).toBe('▼');
    expect(more.tiles.at(6, 10)).toBe('P');

    const bag = rig({
      kind: 'items',
      entries: [{ id: 'TOWN_MAP', count: 1 }, { id: 'POTION', count: 5 }, { id: 'POKE_BALL', count: 12 }],
    });
    bag.frames(10);
    expect(row(bag.tiles, 4, 6, 14)).toBe('TOWN MAP');
    expect(bag.tiles.at(14, 5)).toBe(' ');
    expect(row(bag.tiles, 6, 6, 12)).toBe('POTION');
    expect(row(bag.tiles, 7, 14, 17)).toBe('× 5');
    expect(row(bag.tiles, 8, 6, 12)).toBe('POKE B');
    expect(row(bag.tiles, 9, 14, 17)).toBe('×12');
  });

  it('the cursor reaches only the third row, and the first read is 16 frames in', () => {
    const menu = rig({ kind: 'priced', entries: potions(10) });
    menu.frames(12);
    expect(menu.tiles.at(5, 4)).not.toBe('▶');
    menu.frame();
    expect(menu.tiles.at(5, 4)).toBe('▶');
    expect(menu.read).not.toHaveBeenCalled();
    menu.frames(2);
    expect(menu.read).not.toHaveBeenCalled();
    menu.press('down');
    menu.frame();
    expect(menu.read).toHaveBeenCalledTimes(1);
    expect(menu.menu.item).toBe(1);
    expect(menu.tiles.at(5, 6)).toBe('▶');
    menu.frames(2);
    menu.press('down');
    menu.frame();
    expect(menu.menu.item).toBe(2);
    expect(menu.tiles.at(5, 8)).toBe('▶');
    menu.frames(2);
    menu.press('down');
    menu.frame();
    expect(menu.menu.item).toBe(2);
  });

  it('scrolls on Down at the third row for 3, 4 and 10 items, and not for 1 or 2', () => {
    const offsetAfterDown = (count: number) => {
      const menu = rig({
        kind: 'priced',
        entries: potions(count),
        item: count >= 2 ? 2 : 1,
      });
      menu.frames(15);
      menu.press('down');
      menu.frame();
      return menu.menu.offset;
    };
    expect(offsetAfterDown(1)).toBe(0);
    expect(offsetAfterDown(2)).toBe(0);
    expect(offsetAfterDown(3)).toBe(1);
    expect(offsetAfterDown(4)).toBe(1);
    expect(offsetAfterDown(10)).toBe(1);
  });

  it('a fresh Down scrolls at once, arms 30, then repeats every 6 frames', () => {
    const menu = rig({ kind: 'priced', entries: potions(10), item: 2 });
    menu.frames(15);
    menu.press('down');
    const scrolls: number[] = [];
    for (let frame = 1; frame <= 45; frame++) {
      const before = menu.menu.offset;
      menu.frame();
      if (menu.menu.offset !== before) scrolls.push(frame);
    }
    // Press frame, then hJoy7's 30, then the list's 6-frame reprint (longer than the short delay of 5).
    expect(scrolls.slice(0, 4)).toEqual([1, 31, 37, 43]);
  });

  it('a held A or B at the repeat point re-arms 5, so the next Down is not immediate', () => {
    const nextDown = (extra: 'a' | 'b') => {
      const menu = rig({ kind: 'priced', entries: potions(10), item: 2 });
      menu.frames(15);
      menu.press('down');
      const scrolls: number[] = [];
      for (let frame = 1; frame <= 30; frame++) {
        const before = menu.menu.offset;
        menu.frame();
        if (menu.menu.offset !== before) scrolls.push(frame);
      }
      expect(scrolls).toEqual([1]);
      menu.hold('down', extra);
      const frozen = menu.menu.offset;
      menu.frame();
      expect(menu.menu.offset).toBe(frozen);
      menu.hold('down');
      const next: number[] = [];
      for (let frame = 32; frame <= 40; frame++) {
        const before = menu.menu.offset;
        menu.frame();
        if (menu.menu.offset !== before) next.push(frame);
      }
      return next[0] ?? -1;
    };
    expect(nextDown('a')).toBe(36);
    expect(nextDown('b')).toBe(36);
  });

  it('A draws ▷ and chooses, CANCEL and an empty list and B exit, with no select on CANCEL', () => {
    const buy = rig({ kind: 'priced', entries: [{ id: 'POTION' }] });
    buy.frames(15);
    buy.press('a');
    expect(buy.frame()).toEqual({
      type: 'chosen', id: 'POTION', index: 0, name: 'POTION', price: 300,
    });
    expect(buy.tiles.at(5, 4)).toBe('▷');
    expect(buy.sound).toHaveBeenCalledOnce();

    const cancel = rig({ kind: 'priced', entries: [{ id: 'POTION' }], item: 1 });
    cancel.frames(15);
    cancel.press('a');
    expect(cancel.frame()).toEqual({ type: 'cancelled' });
    expect(cancel.tiles.at(5, 6)).toBe('▷');

    const empty = rig({ kind: 'items', entries: [] });
    empty.frames(15);
    empty.press('a');
    expect(empty.frame()).toEqual({ type: 'cancelled' });

    const back = rig({ kind: 'items', entries: [{ id: 'POTION', count: 2 }] });
    back.frames(15);
    back.press('b');
    expect(back.frame()).toEqual({ type: 'cancelled' });
    expect(back.sound).toHaveBeenCalledOnce();
  });

  it('SELECT marks, ignores itself and CANCEL, swaps, merges under 100, and splits at 100', () => {
    const entries: ListEntry[] = [{ id: 'POTION', count: 2 }, { id: 'ANTIDOTE', count: 3 }];
    const menu = rig({ kind: 'items', entries });
    menu.frames(15);
    menu.press('select');
    menu.frame();
    expect(menu.sound).not.toHaveBeenCalled();
    menu.frames(19);
    expect(menu.tiles.at(5, 4)).not.toBe('▷');
    menu.frame();
    expect(menu.tiles.at(5, 4)).toBe('▷');
    menu.frames(6);
    menu.press('select');
    menu.frame();
    expect(entries.map(entry => entry.id)).toEqual(['POTION', 'ANTIDOTE']);
    menu.frames(6);
    menu.press('down');
    menu.frame();
    menu.frames(2);
    menu.press('select');
    menu.frame();
    expect(menu.sound).not.toHaveBeenCalled();
    menu.frames(20);
    expect(entries.map(entry => entry.id)).toEqual(['ANTIDOTE', 'POTION']);

    const same: ListEntry[] = [{ id: 'POTION', count: 40 }, { id: 'POTION', count: 50 }];
    const merge = rig({ kind: 'items', entries: same, item: 1 });
    merge.frames(15);
    merge.press('select');
    merge.frame();
    merge.frames(26);
    merge.press('up');
    merge.frame();
    merge.frames(2);
    merge.press('select');
    merge.frame();
    merge.frames(20);
    expect(same).toEqual([{ id: 'POTION', count: 90 }]);
    expect(merge.menu.offset).toBe(0);
    expect(merge.menu.item).toBe(0);
    expect(merge.menu.maxItem).toBe(1);

    // Mark the top visible row, move to the next row of the same item, and merge while scrolled.
    const scrolled: ListEntry[] = [
      { id: 'ANTIDOTE', count: 1 },
      { id: 'POTION', count: 40 },
      { id: 'POTION', count: 50 },
      { id: 'BURN_HEAL', count: 1 },
    ];
    const scrolledMerge = rig({ kind: 'items', entries: scrolled, offset: 1, item: 0 });
    scrolledMerge.frames(15);
    scrolledMerge.press('select');
    scrolledMerge.frame();
    scrolledMerge.frames(26);
    scrolledMerge.press('down');
    scrolledMerge.frame();
    scrolledMerge.frames(2);
    scrolledMerge.press('select');
    expect(scrolledMerge.menu.offset).toBe(1);
    expect(scrolledMerge.menu.item).toBe(1);
    scrolledMerge.frame();
    scrolledMerge.frames(20);
    expect(scrolled).toEqual([
      { id: 'ANTIDOTE', count: 1 },
      { id: 'POTION', count: 90 },
      { id: 'BURN_HEAL', count: 1 },
    ]);
    expect(scrolledMerge.menu.offset).toBe(0);
    expect(scrolledMerge.menu.item).toBe(0);

    const heavy: ListEntry[] = [{ id: 'POTION', count: 60 }, { id: 'POTION', count: 50 }];
    const split = rig({ kind: 'items', entries: heavy });
    split.frames(15);
    split.press('select');
    split.frame();
    split.frames(26);
    split.press('down');
    split.frame();
    split.frames(2);
    split.press('select');
    split.frame();
    split.frames(20);
    expect(heavy).toEqual([{ id: 'POTION', count: 11 }, { id: 'POTION', count: 99 }]);
    expect(split.menu.offset).toBe(0);

    const cancel = rig({ kind: 'items', entries: [{ id: 'POTION', count: 1 }], item: 1 });
    cancel.frames(15);
    cancel.press('select');
    cancel.frame();
    cancel.frames(6);
    expect(cancel.menu.item).toBe(1);
    expect(cancel.read).toHaveBeenCalledTimes(2);
  });

  it('an emptied slot resets the open list cursor and the shared scroll', () => {
    const entries: ItemStack[] = [
      { id: 'POTION', count: 1 },
      { id: 'ANTIDOTE', count: 2 },
      { id: 'BURN_HEAL', count: 1 },
      { id: 'AWAKENING', count: 1 },
    ];
    setListScrollOffset(1);
    setCurrentMenuItem(1);
    setBagSavedMenuItem(2);
    setSavedListScrollOffset(4);
    const menu = rig({ kind: 'items', entries, offset: 1, item: 1 });
    removeFromInventoryAt(entries, 0, 1);
    expect(getListScrollOffset()).toBe(0);
    expect(getCurrentMenuItem()).toBe(0);
    expect(getBagSavedMenuItem()).toBe(0);
    expect(getSavedListScrollOffset()).toBe(0);
    menu.frame();
    expect(menu.menu.offset).toBe(0);
    expect(menu.menu.item).toBe(0);

    const partial: ItemStack[] = [{ id: 'POTION', count: 3 }, { id: 'ANTIDOTE', count: 1 }];
    setListScrollOffset(1);
    setCurrentMenuItem(1);
    setBagSavedMenuItem(2);
    setSavedListScrollOffset(4);
    const staying = rig({ kind: 'items', entries: partial, offset: 1, item: 1 });
    removeFromInventoryAt(partial, 0, 1);
    staying.frame();
    expect(partial[0]?.count).toBe(2);
    expect(staying.menu.offset).toBe(1);
    expect(staying.menu.item).toBe(1);
    expect(getListScrollOffset()).toBe(1);
    expect(getSavedListScrollOffset()).toBe(4);
    expect(getBagSavedMenuItem()).toBe(2);
    expect(getCurrentMenuItem()).toBe(1);
  });
});
