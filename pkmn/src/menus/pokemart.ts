// DisplayPokemartDialogue_ (engine/events/pokemart.asm).
// One frame per update. PrintText uses the display's text box. Joypad is read at most once.

import { playSFX, isSoundFinished } from '../audio';
import { isKeyItem, type Bag } from '../items';
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import type { TextBindings } from '../text/text_runner';
import { ListMenu } from './list_menu';
import { MenuInput } from './menu_input';
import { QuantityMenu } from './quantity_menu';
import { addBcd, type ScreenSnapshot, type ScreenTiles } from './screen_tiles';
import { YesNoMenu } from './yes_no_menu';

const MONEY = { bytes: 3, suppressZero: true, leftAlign: false, moneySign: true } as const;
/** IsItemHM: HM01–HM05. None of them are in the item table yet. */
const HM_ITEMS = new Set(['HM01', 'HM02', 'HM03', 'HM04', 'HM05']);

let listScrollOffset = 0;

/** wListScrollOffset. The Mart saves it on entry and restores it at .done. */
export function getListScrollOffset(): number { return listScrollOffset; }
export function setListScrollOffset(value: number): void { listScrollOffset = value; }

type AfterPrint = 'thankYou' | 'saveAndReturn' | 'back' | 'loop' | 'buyList' | 'sellList' | 'yesno' | 'buyLoop';

interface Purchase {
  id: string;
  name: string;
  index: number;
  quantity: number;
  total: number;
}

export class PokemartSession {
  private savedOffset = 0;
  private snapshot: ScreenSnapshot | null = null;
  private menu: MenuInput | null = null;
  private list: ListMenu | null = null;
  private quantity: QuantityMenu | null = null;
  private yesNo: YesNoMenu | null = null;
  private purchase: Purchase | null = null;
  private trading: 'buy' | 'sell' = 'buy';
  private sound: 'waitCurrent' | 'playing' | null = null;
  private soundAfter: 'bought' | 'sold' = 'bought';
  private printing = false;
  private textLive = false;
  private after: AfterPrint | null = null;
  private cursor: { x: number; y: number } | null = null;
  private finished = false;

  constructor(
    private readonly tiles: ScreenTiles,
    private readonly textBox: TextBox,
    private readonly transfer: BgTransfer,
    private readonly bag: Bag,
    private readonly money: { get(): number; set(amount: number): void },
    private readonly stock: readonly string[],
    private readonly onSprites: () => void,
  ) {}

  /** True on frames after a PrintText has been started, so the text box advances once. */
  get advanceText(): boolean { return this.printing && this.textLive; }

  /** The greeting's PrintText has returned. This frame's VBlank already ran. */
  enter(): void {
    this.savedOffset = listScrollOffset;
    this.onSprites();
    this.loop();
  }

  copyThird(third: number): void { this.tiles.copyShownThird(third); }

  /** YES/NO draws immediately. The session writes nothing under it while it is up. */
  renderOverlay(): void { this.yesNo?.render(); }

  /**
   * One frame after entry. True when .done has restored the offset and returned,
   * on the frame ThankYou's program returns.
   */
  frame(readJoypad: () => void, pressSound: () => void): boolean {
    if (this.finished) return true;
    if (this.printing) {
      if (!this.textBox.isComplete) return false;
      this.printing = false;
      this.textLive = false;
      const next = this.after;
      this.after = null;
      this.afterPrint(next);
      return this.finished;
    }
    if (this.sound) {
      this.advanceSound();
      return false;
    }
    if (this.yesNo) {
      this.advanceYesNo(readJoypad);
      return false;
    }
    if (this.quantity) {
      this.advanceQuantity(readJoypad);
      return false;
    }
    if (this.list) {
      this.advanceList(readJoypad, pressSound);
      return false;
    }
    if (!this.menu) return false;
    const hit = this.menu.update(readJoypad, pressSound);
    this.drawCursor(hit ? '▷' : '▶');
    if (!hit) return false;
    const item = this.menu.item;
    this.menu = null;
    // DoBuySellQuitMenu tests A first: A+B in one frame chooses the cursor's item.
    if ((hit.includes('b') && !hit.includes('a')) || item === 2) {
      this.print('PokemartThankYouText', 'thankYou');
      return false;
    }
    if (item === 0) {
      this.trading = 'buy';
      this.print('PokemartBuyingGreetingText', 'buyList');
      return false;
    }
    if (this.bag.items.length === 0) {
      this.print('PokemartItemBagEmptyText', 'saveAndReturn');
      return false;
    }
    this.print('PokemonSellingGreetingText', 'sellList');
    return false;
  }

  private afterPrint(next: AfterPrint | null): void {
    if (next === 'thankYou') {
      this.onSprites();
      listScrollOffset = this.savedOffset;
      this.finished = true;
      return;
    }
    if (next === 'saveAndReturn') {
      const saved = this.tiles.save(this.textBox);
      this.tiles.restore(saved, this.textBox, this.transfer);
      this.drawMoney();
      this.print('PokemartAnythingElseText', 'loop');
      return;
    }
    if (next === 'back') {
      this.returnToMain();
      return;
    }
    if (next === 'loop') this.loop();
    else if (next === 'buyList') this.openBuyList();
    else if (next === 'sellList') this.openSellList();
    else if (next === 'yesno') this.openYesNo();
    else if (next === 'buyLoop') this.buyLoop();
  }

  private advanceSound(): void {
    if (this.sound === 'waitCurrent') {
      if (!isSoundFinished()) return;
      playSFX('purchase');
      this.sound = 'playing';
    }
    if (!isSoundFinished()) return;
    this.sound = null;
    if (this.soundAfter === 'sold') {
      const sale = this.purchase;
      if (sale) this.bag.removeAt(sale.index, sale.quantity);
      this.sellLoop();
      return;
    }
    this.print('PokemartBoughtItemText', 'buyLoop');
  }

  private advanceYesNo(readJoypad: () => void): void {
    const answer = this.yesNo?.update(readJoypad);
    if (!answer) return;
    this.yesNo = null;
    if (answer === 'no') {
      this.relist();
      return;
    }
    if (this.trading === 'sell') this.confirmSell();
    else this.confirmBuy();
  }

  private advanceQuantity(readJoypad: () => void): void {
    const choice = this.quantity?.update(readJoypad);
    if (!choice || !this.purchase) return;
    this.quantity = null;
    if (choice.type === 'cancelled') {
      this.relist();
      return;
    }
    this.purchase = { ...this.purchase, quantity: choice.quantity, total: choice.total };
    if (this.trading === 'sell') {
      this.print('PokemartTellSellPriceText', 'yesno', { money: choice.total });
      return;
    }
    this.print('PokemartTellBuyPriceText', 'yesno', {
      stringBuffer: this.purchase.name, money: choice.total,
    });
  }

  private advanceList(readJoypad: () => void, pressSound: () => void): void {
    const choice = this.list?.update(readJoypad, pressSound);
    if (this.list) listScrollOffset = this.list.offset;
    if (!choice) return;
    this.list = null;
    if (choice.type === 'cancelled') {
      this.returnToMain();
      return;
    }
    if (this.trading === 'sell' && (isKeyItem(choice.id) || HM_ITEMS.has(choice.id))) {
      this.print('PokemartUnsellableItemText', 'back');
      return;
    }
    this.purchase = {
      id: choice.id, name: choice.name, index: choice.index, quantity: 1, total: choice.price,
    };
    this.quantity = new QuantityMenu(this.tiles, {
      priced: true,
      max: this.trading === 'sell' ? choice.maxQuantity ?? 1 : 99,
      unitPrice: choice.price,
      halve: this.trading === 'sell',
    });
  }

  /** Add to the bag first. Money and the purchase sound follow only if that succeeds. */
  private confirmBuy(): void {
    const buy = this.purchase;
    if (!buy) return;
    if (this.money.get() < buy.total) {
      this.print('PokemartNotEnoughMoneyText', 'back');
      return;
    }
    if (!this.bag.add(buy.id, buy.quantity)) {
      this.print('PokemartItemBagFullText', 'back');
      return;
    }
    this.money.set(this.money.get() - buy.total);
    this.soundAfter = 'bought';
    this.sound = 'waitCurrent';
    this.advanceSound();
  }

  /** AddAmountSoldToMoney: money, then the MONEY box, then the sound. The slot goes after it. */
  private confirmSell(): void {
    const sale = this.purchase;
    if (!sale) return;
    this.money.set(addBcd(this.money.get(), sale.total));
    this.drawMoney();
    this.soundAfter = 'sold';
    this.sound = 'waitCurrent';
    this.advanceSound();
  }

  private loop(): void {
    listScrollOffset = 0;
    this.list = null;
    this.quantity = null;
    this.yesNo = null;
    this.drawMoney();
    this.tiles.textBoxBorder(0, 0, 5, 9);
    this.tiles.placeString(2, 1, 'BUY<NEXT>SELL<NEXT>QUIT');
    this.menu = new MenuInput({ watched: ['a', 'b'], maxItem: 2, topX: 1, topY: 1 });
    this.cursor = null;
    this.drawCursor('▶');
  }

  private openBuyList(): void {
    this.snapshot = this.tiles.save(this.textBox);
    this.buyLoop();
  }

  private openYesNo(): void {
    this.yesNo = new YesNoMenu();
    this.yesNo.show({ actualRead: true });
  }

  /** Restore the buy greeting, redraw the current money, and reopen the list at the top row. */
  private buyLoop(): void {
    if (!this.snapshot) return;
    this.list = null;
    this.quantity = null;
    this.yesNo = null;
    this.tiles.restore(this.snapshot, this.textBox, this.transfer);
    this.drawMoney();
    this.list = new ListMenu(this.tiles, {
      kind: 'priced',
      entries: this.stock.map(id => ({ id })),
      offset: listScrollOffset,
      item: 0,
    }, this.transfer);
  }

  /** .returnToMain from a list cancel or a failed buy. The empty-bag path saves first. */
  private returnToMain(): void {
    if (!this.snapshot) return;
    this.list = null;
    this.quantity = null;
    this.yesNo = null;
    this.tiles.restore(this.snapshot, this.textBox, this.transfer);
    this.drawMoney();
    this.print('PokemartAnythingElseText', 'loop');
  }

  private openSellList(): void {
    this.trading = 'sell';
    this.snapshot = this.tiles.save(this.textBox);
    this.sellLoop();
  }

  /** The bag list. Offset is kept; the cursor returns to the top visible row. */
  private sellLoop(): void {
    if (!this.snapshot) return;
    this.trading = 'sell';
    this.list = null;
    this.quantity = null;
    this.yesNo = null;
    this.tiles.restore(this.snapshot, this.textBox, this.transfer);
    this.drawMoney();
    this.list = new ListMenu(this.tiles, {
      kind: 'items',
      entries: this.bag.items,
      offset: listScrollOffset,
      item: 0,
    }, this.transfer);
  }

  private relist(): void {
    if (this.trading === 'sell') this.sellLoop();
    else this.buyLoop();
  }

  private drawMoney(): void {
    this.tiles.textBoxBorder(11, 0, 1, 7);
    this.tiles.placeString(13, 0, 'MONEY');
    this.tiles.clearArea(13, 1, 1, 6);
    this.tiles.writeBcd(12, 1, this.money.get(), MONEY);
  }

  private drawCursor(glyph: '▶' | '▷'): void {
    const next = this.menu?.cursor ?? this.cursor;
    if (!next) return;
    if (this.cursor && (this.cursor.x !== next.x || this.cursor.y !== next.y)) {
      this.tiles.put(this.cursor.x, this.cursor.y, ' ');
    }
    this.tiles.put(next.x, next.y, glyph);
    this.cursor = { x: next.x, y: next.y };
  }

  private print(program: string, after: AfterPrint, bindings?: TextBindings): void {
    // A new message box takes rows 12–17 back from the list's bottom border.
    this.tiles.release(0, 12, 6, 20);
    this.textBox.print({ program }, { box: 'new', bindings });
    this.printing = true;
    this.textLive = true;
    this.after = after;
  }
}
