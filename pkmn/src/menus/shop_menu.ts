// Pokémart shop menu — buy items from a clerk
// Layout matches original assembly: menu top-left, money top-right, clerk text bottom
// Assembly ref: engine/events/pokemart.asm, data/text_boxes.asm

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { fillRect } from '../renderer';
import { Bag, getItemName, getItemPrice, BAG_ITEM_CAPACITY } from '../items';
import { playSFX } from '../audio';

type ShopState = 'buy_sell' | 'buying' | 'buy_confirm' | 'selling' | 'sell_confirm' | 'done';
type ShopResult = 'open' | 'closed';

const LINE_H = 16; // 2 tiles per line (matches original text line spacing)

export class ShopMenu {
  private state: ShopState = 'buy_sell';
  private items: string[] = [];       // shop inventory (for buying)
  private cursor = 0;
  private buySellCursor = 0; // 0=BUY, 1=SELL, 2=QUIT
  private scrollOffset = 0;
  private quantity = 1;
  private bag!: Bag;
  private money = 0;
  private onMoneyChange: ((delta: number) => void) | null = null;

  // Non-blocking text at bottom — shown alongside BUY/SELL/QUIT menu
  private clerkText: string[] = [];
  // Blocking message overlay — requires A/B to dismiss
  private messageLines: string[] = [];
  private messageNextState: ShopState | null = null;
  // Frame counter for blinking scroll arrow
  private frameCounter = 0;

  // Max visible items in the list
  private readonly maxVisible = 4;

  show(shopItems: string[], bag: Bag, money: number, onMoneyChange: (delta: number) => void): void {
    this.items = shopItems;
    this.bag = bag;
    this.money = money;
    this.onMoneyChange = onMoneyChange;
    this.state = 'buy_sell';
    this.buySellCursor = 0;
    this.cursor = 0;
    this.scrollOffset = 0;
    this.quantity = 1;
    this.messageLines = [];
    this.messageNextState = null;
    // Assembly: _PokemartGreetingText — shown with menu (non-blocking)
    this.clerkText = ['Hi there!', 'May I help you?'];
  }

  /** Show a blocking message overlay that transitions to nextState when dismissed. */
  private showMessage(lines: string[], nextState: ShopState): void {
    this.messageLines = lines;
    this.messageNextState = nextState;
  }

  /** Get the sellable items from the player's bag. */
  private get sellableItems(): { id: string; count: number }[] {
    return this.bag.items.filter(i => getItemPrice(i.id) > 0);
  }

  update(): ShopResult {
    this.frameCounter++;

    // Blocking message: wait for A/B dismiss
    if (this.messageLines.length > 0) {
      if (isPressed('a') || isPressed('b')) {
        playSFX('press_ab');
        const next = this.messageNextState;
        this.messageLines = [];
        this.messageNextState = null;
        if (next === 'done') {
          this.state = 'done';
          return 'closed';
        }
        if (next) this.state = next;
      }
      return 'open';
    }

    switch (this.state) {
      case 'buy_sell':    return this.updateBuySell();
      case 'buying':      return this.updateBuying();
      case 'buy_confirm': return this.updateBuyConfirm();
      case 'selling':     return this.updateSelling();
      case 'sell_confirm':return this.updateSellConfirm();
      default:            return 'closed';
    }
  }

  private updateBuySell(): ShopResult {
    if (isPressed('up')) {
      this.buySellCursor = (this.buySellCursor - 1 + 3) % 3;
    } else if (isPressed('down')) {
      this.buySellCursor = (this.buySellCursor + 1) % 3;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.buySellCursor === 0) {
        // Assembly: _PokemartBuyingGreetingText — persists at bottom while browsing
        this.cursor = 0;
        this.scrollOffset = 0;
        this.clerkText = ['Take your time.'];
        this.state = 'buying';
      } else if (this.buySellCursor === 1) {
        if (this.sellableItems.length === 0) {
          // Assembly: _PokemartItemBagEmptyText
          this.showMessage(["You don't have", 'anything to sell.'], 'buy_sell');
        } else {
          // Assembly: _PokemonSellingGreetingText — persists at bottom while browsing
          this.cursor = 0;
          this.scrollOffset = 0;
          this.clerkText = ['What would you', 'like to sell?'];
          this.state = 'selling';
        }
      } else {
        // Assembly: _PokemartThankYouText
        this.showMessage(['Thank you!'], 'done');
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.showMessage(['Thank you!'], 'done');
    }
    return 'open';
  }

  private updateBuying(): ShopResult {
    const totalEntries = this.items.length + 1;

    if (isPressed('up')) {
      if (this.cursor > 0) {
        this.cursor--;
        if (this.cursor < this.scrollOffset) this.scrollOffset = this.cursor;
      }
    } else if (isPressed('down')) {
      if (this.cursor < totalEntries - 1) {
        this.cursor++;
        if (this.cursor >= this.scrollOffset + this.maxVisible) {
          this.scrollOffset = this.cursor - this.maxVisible + 1;
        }
      }
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.cursor >= this.items.length) {
        // Assembly: _PokemartAnythingElseText — non-blocking, back to menu
        this.clerkText = ['Is there anything', 'else I can do?'];
        this.state = 'buy_sell';
      } else {
        this.quantity = 1;
        this.state = 'buy_confirm';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.clerkText = ['Is there anything', 'else I can do?'];
      this.state = 'buy_sell';
    }
    return 'open';
  }

  private updateBuyConfirm(): ShopResult {
    const price = getItemPrice(this.items[this.cursor]);

    if (isPressed('up')) {
      const maxAffordable = price > 0 ? Math.floor(this.money / price) : 99;
      if (this.quantity < Math.min(99, maxAffordable)) this.quantity++;
    } else if (isPressed('down')) {
      if (this.quantity > 1) this.quantity--;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      const total = price * this.quantity;
      if (total > this.money) {
        // Assembly: _PokemartNotEnoughMoneyText
        this.messageLines = ["You don't have", 'enough money.'];
        this.state = 'buying';
      } else {
        // Check bag capacity before buying (assembly: AddItemToInventory)
        const alreadyInBag = this.bag.items.some(i => i.id === this.items[this.cursor]);
        if (!alreadyInBag && this.bag.items.length >= BAG_ITEM_CAPACITY) {
          this.messageLines = ["You can't carry", 'any more items.'];
          this.state = 'buying';
        } else {
          this.money -= total;
          this.onMoneyChange?.(-total);
          this.bag.add(this.items[this.cursor], this.quantity);
          // Assembly: _PokemartBoughtItemText
          this.messageLines = ['Here you are!', 'Thank you!'];
          this.state = 'buying';
        }
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'buying';
    }
    return 'open';
  }

  private updateSelling(): ShopResult {
    const sellItems = this.sellableItems;
    const totalEntries = sellItems.length + 1; // +1 for CANCEL

    if (isPressed('up')) {
      if (this.cursor > 0) {
        this.cursor--;
        if (this.cursor < this.scrollOffset) this.scrollOffset = this.cursor;
      }
    } else if (isPressed('down')) {
      if (this.cursor < totalEntries - 1) {
        this.cursor++;
        if (this.cursor >= this.scrollOffset + this.maxVisible) {
          this.scrollOffset = this.cursor - this.maxVisible + 1;
        }
      }
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.cursor >= sellItems.length) {
        this.clerkText = ['Is there anything', 'else I can do?'];
        this.state = 'buy_sell';
      } else {
        this.quantity = 1;
        this.state = 'sell_confirm';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.clerkText = ['Is there anything', 'else I can do?'];
      this.state = 'buy_sell';
    }
    return 'open';
  }

  private updateSellConfirm(): ShopResult {
    const sellItems = this.sellableItems;
    const item = sellItems[this.cursor];
    if (!item) { this.state = 'selling'; return 'open'; }

    if (isPressed('up')) {
      if (this.quantity < Math.min(99, item.count)) this.quantity++;
    } else if (isPressed('down')) {
      if (this.quantity > 1) this.quantity--;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      const sellPrice = Math.floor(getItemPrice(item.id) / 2);
      const total = sellPrice * this.quantity;
      this.bag.remove(item.id, this.quantity);
      this.money += total;
      this.onMoneyChange?.(total);
      const name = getItemName(item.id);
      this.messageLines = [`Sold ${name}`, `for ¥${total}!`];
      // Reset cursor if items list changed
      if (this.cursor >= this.sellableItems.length) {
        this.cursor = Math.max(0, this.sellableItems.length - 1);
      }
      this.state = this.sellableItems.length > 0 ? 'selling' : 'buy_sell';
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'selling';
    }
    return 'open';
  }

  // ── Rendering ─────────────────────────────────────────────────

  render(): void {
    // Money box — top-right
    this.renderMoneyBox();

    if (this.state === 'buy_sell' && this.messageLines.length === 0) {
      // Main menu view: BUY/SELL/QUIT (top-left) + clerk text (bottom)
      this.renderBuySell();
      this.renderClerkText();
    } else if (this.state === 'buying' || this.state === 'buy_confirm') {
      // Draw BUY/SELL/QUIT behind, then clerk text, then item list on top
      this.renderBuySell();
      this.renderClerkText();
      this.renderItemList(this.items.map(id => ({
        name: getItemName(id),
        detail: '¥' + String(getItemPrice(id)),
      })));
      if (this.state === 'buy_confirm') {
        this.renderQuantityBox(getItemPrice(this.items[this.cursor]));
      }
    } else if (this.state === 'selling' || this.state === 'sell_confirm') {
      this.renderBuySell();
      this.renderClerkText();
      this.renderItemList(this.sellableItems.map(i => ({
        name: getItemName(i.id),
        detail: 'x' + String(i.count),
      })));
      if (this.state === 'sell_confirm') {
        const item = this.sellableItems[this.cursor];
        if (item) {
          this.renderQuantityBox(Math.floor(getItemPrice(item.id) / 2));
        }
      }
    }

    // Blocking message overlay at bottom
    if (this.messageLines.length > 0) {
      this.renderBottomTextBox(this.messageLines);
    }
  }

  /** Money box at top-right.
   *  Assembly: MONEY_BOX_TEMPLATE at (11,0)→(19,2) = 9 wide × 3 tall.
   *  "MONEY" drawn ON the top border at tile (13,0).
   *  Value at tile (12,1) with ¥ prefix. */
  private renderMoneyBox(): void {
    const boxX = 11 * TILE_SIZE; // tile column 11
    const boxW = 9 * TILE_SIZE;
    const boxH = 3 * TILE_SIZE;
    drawBox(boxX, 0, boxW, boxH);
    // "MONEY" label on top border — clear white behind it, then draw text
    const labelX = 13 * TILE_SIZE; // tile column 13
    fillRect(labelX, 0, 5 * TILE_SIZE, TILE_SIZE, 0); // white bg over border
    drawText('MONEY', labelX, 0);
    // Currency + amount at tile (12, 1)
    drawText('¥' + String(this.money), 12 * TILE_SIZE, TILE_SIZE);
  }

  /** BUY/SELL/QUIT menu at top-left.
   *  Assembly: BUY_SELL_QUIT_MENU_TEMPLATE at (0,0)→(10,6) = 11 wide × 7 tall.
   *  Text at (2,1), items at rows 1/3/5. */
  private renderBuySell(): void {
    const boxW = 11 * TILE_SIZE;
    const boxH = 7 * TILE_SIZE;
    drawBox(0, 0, boxW, boxH);

    const labels = ['BUY', 'SELL', 'QUIT'];
    for (let i = 0; i < labels.length; i++) {
      // Items at tile rows 1, 3, 5 (each 2 tiles apart)
      const y = (1 + i * 2) * TILE_SIZE;
      drawText(labels[i], 2 * TILE_SIZE, y);
      if (i === this.buySellCursor) {
        drawText('\u25B6', TILE_SIZE, y);
      }
    }
  }

  /** Non-blocking clerk dialogue at the bottom of the screen. */
  private renderClerkText(): void {
    if (this.clerkText.length === 0) return;
    this.renderBottomTextBox(this.clerkText);
  }

  /** Full-width text box at the bottom (standard 6-tile-tall textbox).
   *  Assembly: TextBoxBorder height=6 at row 12. */
  private renderBottomTextBox(lines: string[]): void {
    const boxH = 6 * TILE_SIZE; // standard text box: 6 tiles (border + 4 inner + border)
    const boxY = GB_HEIGHT - boxH; // 144-48 = 96 (tile row 12)
    drawBox(0, boxY, GB_WIDTH, boxH);
    for (let i = 0; i < lines.length; i++) {
      // Text at 1 tile in from left, rows 14 and 16 in original (2 tiles below border)
      drawText(lines[i], TILE_SIZE, boxY + 2 * TILE_SIZE + i * LINE_H);
    }
  }

  private renderItemList(entries: { name: string; detail: string }[]): void {
    // Assembly: item list at (3,2)→(19,11), overlaps BUY/SELL/QUIT behind
    const listX = 3 * TILE_SIZE;  // tile column 3 — leaves "SE"/"QU" visible on left
    const listY = 2 * TILE_SIZE;  // tile row 2
    const listH = 10 * TILE_SIZE; // 10 tiles: rows 2-11 (above text box at row 12)
    const listW = GB_WIDTH - listX; // from column 3 to right edge

    drawBox(listX, listY, listW, listH);

    const totalEntries = entries.length + 1; // +1 for CANCEL
    const visibleCount = Math.min(this.maxVisible, totalEntries);

    for (let i = 0; i < visibleCount; i++) {
      const idx = this.scrollOffset + i;
      if (idx >= totalEntries) break;

      const y = listY + TILE_SIZE + i * LINE_H;

      if (idx < entries.length) {
        drawText(entries[idx].name, listX + 2 * TILE_SIZE, y);
        const detail = entries[idx].detail;
        drawText(detail, listX + listW - (detail.length + 1) * TILE_SIZE, y);
      } else {
        drawText('CANCEL', listX + 2 * TILE_SIZE, y);
      }

      if (idx === this.cursor) {
        drawText('\u25B6', listX + TILE_SIZE, y);
      }
    }

    // Blinking scroll indicator (down arrow when more items below)
    // Original blinks ~16 frames on / 16 frames off
    if (this.scrollOffset + this.maxVisible < totalEntries) {
      if (this.frameCounter % 32 < 16) {
        drawText('\u25BC', listX + listW - 2 * TILE_SIZE, listY + listH - LINE_H);
      }
    }
  }

  private renderQuantityBox(unitPrice: number): void {
    const total = unitPrice * this.quantity;

    const boxW = 10 * TILE_SIZE;
    const boxY = GB_HEIGHT - 5 * TILE_SIZE;
    const boxX = GB_WIDTH - boxW;

    drawBox(boxX, boxY, boxW, 5 * TILE_SIZE);
    drawText('x' + String(this.quantity).padStart(2, '0'), boxX + TILE_SIZE, boxY + TILE_SIZE);
    drawText('¥' + String(total), boxX + TILE_SIZE, boxY + 3 * TILE_SIZE);
  }
}
