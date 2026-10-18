// DisplayListMenuID for item, priced and PC Pokemon lists (home/list_menu.asm,
// engine/menus/swap_items.asm). The ▼ is drawn steady; its CPU-paced blink is J2.

import { getItemName, getItemPrice, isKeyItem } from '../items';
import { getCurrentMenuItem, getEmptySlotGeneration, getListScrollOffset } from '../list_state';
import type { BgTransfer } from '../text/bg_transfer';
import { MenuInput } from './menu_input';
import type { ScreenTiles } from './screen_tiles';
import { monDisplayName } from '../pokemon_names';
import { setNoTextDelay } from '../text/text_flags';

const MONEY = { bytes: 3, suppressZero: true, leftAlign: false, moneySign: true } as const;

export interface ListEntry {
  id: string;
  /** Bag stacks. A priced mart list does not use it. */
  count?: number;
}

export interface MonListEntry { name: string; level: number; }
type ListKind = 'items' | 'priced' | 'mons';
/** The $ff CANCEL entry is not stored. SELECT only mutates item lists. */
export type ListMenuConfig = ({ kind: 'items' | 'priced'; entries: ListEntry[] }
  | { kind: 'mons'; entries: MonListEntry[] }) & {
  /** wListScrollOffset. The caller owns it across list visits. */
  offset?: number;
  item?: number;
};

export type ListChoice =
  | { type: 'chosen'; id: string; index: number; name: string; price: number; maxQuantity?: number }
  | { type: 'cancelled' };
export type MonListChoice = { type: 'chosen'; index: number; name: string } | { type: 'cancelled' };
type ListResult<K extends ListKind> = K extends 'mons' ? MonListChoice : ListChoice;

type Phase = 'waitOpen' | 'waitLoop' | 'waitHold' | 'input';

export class ListMenu<K extends ListKind = 'items' | 'priced'> {
  offset: number;
  private readonly menu: MenuInput;
  private phase: Phase = 'waitOpen';
  private wait = 10;
  private mark = 0;
  private pendingSwap = false;
  private cursorAt: { x: number; y: number } | null = null;
  private cursorTile: string | null = ' ';
  private seenEmptySlot = getEmptySlotGeneration();

  constructor(
    private readonly tiles: ScreenTiles,
    private readonly config: ListMenuConfig & { kind: K },
    private readonly transfer: BgTransfer,
  ) {
    this.offset = config.offset ?? 0;
    const count = config.entries.length;
    this.menu = new MenuInput({
      watched: ['a', 'b', 'select'],
      maxItem: count >= 2 ? 2 : 1,
      topX: 5,
      topY: 4,
      item: config.item ?? 0,
      watchOutOfBounds: true,
      repeat: true,
    });
    this.transfer.enabled = false;
    setNoTextDelay(true); // DisplayListMenuID, before drawing the list
    this.tiles.textBoxBorder(4, 2, 9, 14);
  }

  get item(): number { return this.menu.item; }
  get maxItem(): number { return this.menu.config.maxItem; }

  /** One frame. Null until A chooses or B/CANCEL exits. */
  update(readJoypad: () => void, pressSound: () => void): ListResult<K> | null {
    // RemoveItemFromInventory_ zeroes the shared cursor while this list is open.
    const generation = getEmptySlotGeneration();
    if (generation !== this.seenEmptySlot) {
      this.seenEmptySlot = generation;
      this.offset = getListScrollOffset();
      this.menu.item = getCurrentMenuItem();
    }
    if (this.phase !== 'input') {
      this.menu.elapse();
      this.wait--;
      if (this.wait > 0) return null;
      if (this.phase === 'waitHold' && this.pendingSwap) this.applySwap();
      if (this.phase === 'waitLoop') {
        this.phase = 'input';
        this.menu.restart();
        this.drawCursor();
        return null;
      }
      this.beginLoop();
      return null;
    }
    const hit = this.menu.update(readJoypad, pressSound);
    this.drawCursor();
    if (!hit) return null;
    if (hit.includes('a')) return this.choose() as ListResult<K>;
    if (hit.includes('b')) {
      setNoTextDelay(false); // ExitListMenu
      return { type: 'cancelled' } as ListResult<K>;
    }
    if (hit.includes('select')) {
      this.select();
      return null;
    }
    if (hit.includes('down') || hit.includes('up')) {
      this.scroll(hit.includes('down'));
      return null;
    }
    return null;
  }

  private beginLoop(): void {
    this.cursorAt = null;
    this.pendingSwap = false;
    this.transfer.enabled = false;
    this.printEntries();
    this.transfer.enabled = true;
    this.phase = 'waitLoop';
    this.wait = 3;
  }

  private printEntries(): void {
    const entries = this.config.entries;
    this.tiles.clearArea(5, 3, 9, 14);
    let cancelShown = false;
    for (let row = 0; row < 4; row++) {
      const index = this.offset + row;
      const y = 4 + row * 2;
      if (index >= entries.length) {
        this.tiles.placeString(6, y, 'CANCEL');
        cancelShown = true;
        break;
      }
      const entry = entries[index];
      if ('level' in entry) {
        this.tiles.placeString(6, y, monDisplayName({ nickname: entry.name }));
        this.tiles.printLevel(14, y + 1, entry.level);
        continue;
      }
      this.tiles.placeString(6, y, getItemName(entry.id));
      if (this.config.kind === 'priced') {
        this.tiles.writeBcd(11, y + 1, getItemPrice(entry.id), MONEY);
      } else if (!isKeyItem(entry.id)) {
        this.tiles.put(14, y + 1, '×');
        this.tiles.writeNumber(15, y + 1, entry.count ?? 1, { digits: 2, leadingZeroes: false });
      }
      if (this.mark === index + 1) this.tiles.put(5, y, '▷');
    }
    if (!cancelShown) this.tiles.put(18, 11, '▼');
  }

  private drawCursor(): void {
    const cursor = this.menu.cursor;
    if (this.cursorAt && (this.cursorAt.x !== cursor.x || this.cursorAt.y !== cursor.y)) {
      this.tiles.put(this.cursorAt.x, this.cursorAt.y, this.cursorTile);
    }
    if (!this.cursorAt || this.cursorAt.x !== cursor.x || this.cursorAt.y !== cursor.y) {
      this.cursorTile = this.tiles.at(cursor.x, cursor.y);
      this.cursorAt = { x: cursor.x, y: cursor.y };
    }
    this.tiles.put(cursor.x, cursor.y, '▶');
  }

  private choose(): ListChoice | MonListChoice {
    setNoTextDelay(false); // .storeChosenEntry and A on CANCEL -> ExitListMenu
    const cursor = this.menu.cursor;
    this.tiles.put(cursor.x, cursor.y, '▷');
    const index = this.offset + this.menu.item;
    const entry = this.config.entries[index];
    if (!entry) return { type: 'cancelled' };
    if ('level' in entry) return { type: 'chosen', index, name: monDisplayName({ nickname: entry.name }) };
    const choice: ListChoice = {
      type: 'chosen', id: entry.id, index, name: getItemName(entry.id), price: getItemPrice(entry.id),
    };
    if (this.config.kind === 'items') choice.maxQuantity = entry.count ?? 1;
    return choice;
  }

  private scroll(down: boolean): void {
    if (down) {
      if (this.offset + 3 <= this.config.entries.length) this.offset++;
    } else if (this.offset > 0) {
      this.offset--;
    }
    this.beginLoop();
  }

  private select(): void {
    if (this.config.kind !== 'items') {
      this.beginLoop();
      return;
    }
    const index = this.offset + this.menu.item;
    if (index >= this.config.entries.length) {
      this.beginLoop();
      return;
    }
    const oneBased = index + 1;
    if (this.mark === 0) {
      this.mark = oneBased;
      this.phase = 'waitHold';
      this.wait = 20;
      return;
    }
    if (this.mark === oneBased) {
      this.beginLoop();
      return;
    }
    this.pendingSwap = true;
    this.phase = 'waitHold';
    this.wait = 20;
  }

  private applySwap(): void {
    if (this.config.kind !== 'items') return;
    const entries = this.config.entries;
    const first = this.mark - 1;
    const second = this.offset + this.menu.item;
    const a = entries[first];
    const b = entries[second];
    this.mark = 0;
    this.pendingSwap = false;
    if (!a || !b || !('id' in a) || !('id' in b)) return;
    if (a.id !== b.id) {
      entries[first] = b;
      entries[second] = a;
      return;
    }
    const sum = (a.count ?? 1) + (b.count ?? 1);
    if (sum < 100) {
      b.count = sum;
      entries.splice(first, 1);
      this.offset = 0;
      this.menu.item = 0;
      if (entries.length <= 1) this.menu.config.maxItem = 1;
      return;
    }
    b.count = 99;
    a.count = sum - 99;
  }
}
