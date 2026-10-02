// Player's PC menu — withdraw, deposit, and toss items from PC storage
// Assembly ref: engine/menus/players_pc.asm, data/text/text_3.asm

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import {
  Bag, getItemName, isKeyItem, isTossable,
  addToInventory, removeFromInventory,
  BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY,
} from '../items';
import type { ItemStack } from '../items';
import { playSFX } from '../audio';

type PcState =
  | 'main_menu'
  | 'withdraw' | 'withdraw_qty'
  | 'deposit' | 'deposit_qty'
  | 'toss' | 'toss_qty' | 'toss_confirm'
  | 'message';

type PcResult = 'open' | 'closed';

const LINE_H = 16;
const MAX_VISIBLE = 4;

const MAIN_MENU_ITEMS = ['WITHDRAW ITEM', 'DEPOSIT ITEM', 'TOSS ITEM', 'LOG OFF'] as const;

export class PcMenu {
  private state: PcState = 'main_menu';
  private bag!: Bag;
  private pcItems!: ItemStack[];
  private mainCursor = 0;
  private listCursor = 0;
  private scrollOffset = 0;
  private quantity = 1;
  private selectedItemId = '';
  private selectedItemMax = 1;
  private frameCounter = 0;

  private bottomText: string[] = [];
  private messageLines: string[] = [];
  private messageNextState: PcState | null = null;

  private yesNoCursor = 0;

  show(bag: Bag, pcItems: ItemStack[]): void {
    this.bag = bag;
    this.pcItems = pcItems;
    this.state = 'main_menu';
    this.mainCursor = 0;
    this.listCursor = 0;
    this.scrollOffset = 0;
    this.quantity = 1;
    this.messageLines = [];
    this.messageNextState = null;
    this.bottomText = ['What do you want', 'to do?'];
  }

  update(): PcResult {
    this.frameCounter++;

    // Blocking message: wait for A/B dismiss
    if (this.messageLines.length > 0) {
      if (isPressed('a') || isPressed('b')) {
        playSFX('press_ab');
        const next = this.messageNextState;
        this.messageLines = [];
        this.messageNextState = null;
        if (next) this.state = next;
      }
      return 'open';
    }

    switch (this.state) {
      case 'main_menu':    return this.updateMainMenu();
      case 'withdraw':     return this.updateWithdraw();
      case 'withdraw_qty': return this.updateWithdrawQty();
      case 'deposit':      return this.updateDeposit();
      case 'deposit_qty':  return this.updateDepositQty();
      case 'toss':         return this.updateToss();
      case 'toss_qty':     return this.updateTossQty();
      case 'toss_confirm': return this.updateTossConfirm();
      default:             return 'open';
    }
  }

  // --- Update methods ---

  private updateMainMenu(): PcResult {
    if (isPressed('up')) {
      this.mainCursor = (this.mainCursor - 1 + MAIN_MENU_ITEMS.length) % MAIN_MENU_ITEMS.length;
    } else if (isPressed('down')) {
      this.mainCursor = (this.mainCursor + 1) % MAIN_MENU_ITEMS.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.mainCursor === 0) {
        // WITHDRAW
        this.resetListCursor();
        this.bottomText = ['What do you want', 'to withdraw?'];
        this.state = 'withdraw';
      } else if (this.mainCursor === 1) {
        // DEPOSIT
        this.resetListCursor();
        this.bottomText = ['What do you want', 'to deposit?'];
        this.state = 'deposit';
      } else if (this.mainCursor === 2) {
        // TOSS
        this.resetListCursor();
        this.bottomText = ['What do you want', 'to toss away?'];
        this.state = 'toss';
      } else {
        // LOG OFF
        return 'closed';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      return 'closed';
    }
    return 'open';
  }

  private updateWithdraw(): PcResult {
    const totalEntries = this.pcItems.length + 1;
    this.navigateList(totalEntries);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= this.pcItems.length) {
        this.returnToMainMenu();
      } else {
        const item = this.pcItems[this.listCursor];
        if (isKeyItem(item.id)) {
          this.doWithdraw(item.id, 1);
        } else {
          this.selectedItemId = item.id;
          this.selectedItemMax = item.count;
          this.quantity = 1;
          this.state = 'withdraw_qty';
        }
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateWithdrawQty(): PcResult {
    if (isPressed('up')) {
      if (this.quantity < this.selectedItemMax) this.quantity++;
    } else if (isPressed('down')) {
      if (this.quantity > 1) this.quantity--;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      this.doWithdraw(this.selectedItemId, this.quantity);
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'withdraw';
    }
    return 'open';
  }

  private doWithdraw(id: string, count: number): void {
    // Check if bag can hold it
    const alreadyInBag = this.bag.items.some(i => i.id === id);
    if (!alreadyInBag && this.bag.items.length >= BAG_ITEM_CAPACITY) {
      this.showMessage(["You can't carry", 'any more items.'], 'withdraw');
      return;
    }
    this.bag.add(id, count);
    removeFromInventory(this.pcItems, id, count);
    const name = getItemName(id);
    this.showMessage(['Withdrew', `${name}.`], 'withdraw');
    this.clampListCursor(this.pcItems.length + 1);
  }

  private updateDeposit(): PcResult {
    const totalEntries = this.bag.items.length + 1;
    this.navigateList(totalEntries);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= this.bag.items.length) {
        this.returnToMainMenu();
      } else {
        const item = this.bag.items[this.listCursor];
        if (isKeyItem(item.id)) {
          this.doDeposit(item.id, 1);
        } else {
          this.selectedItemId = item.id;
          this.selectedItemMax = item.count;
          this.quantity = 1;
          this.state = 'deposit_qty';
        }
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateDepositQty(): PcResult {
    if (isPressed('up')) {
      if (this.quantity < this.selectedItemMax) this.quantity++;
    } else if (isPressed('down')) {
      if (this.quantity > 1) this.quantity--;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      this.doDeposit(this.selectedItemId, this.quantity);
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'deposit';
    }
    return 'open';
  }

  private doDeposit(id: string, count: number): void {
    if (!addToInventory(this.pcItems, id, count, PC_ITEM_CAPACITY)) {
      this.showMessage(['No room left to', 'store items.'], 'deposit');
      return;
    }
    this.bag.remove(id, count);
    const name = getItemName(id);
    this.showMessage([`${name} was`, 'stored via PC.'], 'deposit');
    this.clampListCursor(this.bag.items.length + 1);
  }

  private updateToss(): PcResult {
    const totalEntries = this.pcItems.length + 1;
    this.navigateList(totalEntries);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= this.pcItems.length) {
        this.returnToMainMenu();
      } else {
        const item = this.pcItems[this.listCursor];
        if (!isTossable(item.id)) {
          this.showMessage(["That's too impor-", 'tant to toss!'], 'toss');
        } else {
          this.selectedItemId = item.id;
          this.selectedItemMax = item.count;
          this.quantity = 1;
          this.state = 'toss_qty';
        }
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateTossQty(): PcResult {
    if (isPressed('up')) {
      if (this.quantity < this.selectedItemMax) this.quantity++;
    } else if (isPressed('down')) {
      if (this.quantity > 1) this.quantity--;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      this.yesNoCursor = 0;
      this.state = 'toss_confirm';
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'toss';
    }
    return 'open';
  }

  private updateTossConfirm(): PcResult {
    if (isPressed('up') || isPressed('down')) {
      this.yesNoCursor = this.yesNoCursor === 0 ? 1 : 0;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.yesNoCursor === 0) {
        // YES
        removeFromInventory(this.pcItems, this.selectedItemId, this.quantity);
        const name = getItemName(this.selectedItemId);
        this.showMessage(['Threw away', `${name}.`], 'toss');
        this.clampListCursor(this.pcItems.length + 1);
      } else {
        this.state = 'toss';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'toss';
    }
    return 'open';
  }

  // --- Helpers ---

  private showMessage(lines: string[], nextState: PcState): void {
    this.messageLines = lines;
    this.messageNextState = nextState;
    if (nextState === 'main_menu') {
      this.bottomText = ['What do you want', 'to do?'];
    }
  }

  private resetListCursor(): void {
    this.listCursor = 0;
    this.scrollOffset = 0;
  }

  private returnToMainMenu(): void {
    this.bottomText = ['What do you want', 'to do?'];
    this.state = 'main_menu';
  }

  private navigateList(totalEntries: number): void {
    if (isPressed('up')) {
      if (this.listCursor > 0) {
        this.listCursor--;
        if (this.listCursor < this.scrollOffset) this.scrollOffset = this.listCursor;
      }
    } else if (isPressed('down')) {
      if (this.listCursor < totalEntries - 1) {
        this.listCursor++;
        if (this.listCursor >= this.scrollOffset + MAX_VISIBLE) {
          this.scrollOffset = this.listCursor - MAX_VISIBLE + 1;
        }
      }
    }
  }

  private clampListCursor(totalEntries: number): void {
    const max = totalEntries - 1;
    if (this.listCursor > max) this.listCursor = Math.max(0, max);
    if (this.listCursor < this.scrollOffset) this.scrollOffset = this.listCursor;
    if (this.listCursor >= this.scrollOffset + MAX_VISIBLE) {
      this.scrollOffset = this.listCursor - MAX_VISIBLE + 1;
    }
  }

  // --- Rendering ---

  render(): void {
    // Main menu box is always drawn as background
    this.renderMainMenuBox();

    const showList = this.state !== 'main_menu' && this.state !== 'message';
    const inItemList =
      this.state === 'withdraw' || this.state === 'withdraw_qty' ||
      this.state === 'deposit' || this.state === 'deposit_qty' ||
      this.state === 'toss' || this.state === 'toss_qty' || this.state === 'toss_confirm';

    if (inItemList || showList) {
      const items = this.getActiveItems();
      this.renderItemList(items);
    }

    if (this.state === 'withdraw_qty' || this.state === 'deposit_qty' || this.state === 'toss_qty') {
      this.renderQuantityBox();
    }

    if (this.state === 'toss_confirm') {
      this.renderQuantityBox();
      this.renderYesNoBox();
    }

    // Bottom text box
    this.renderBottomTextBox(
      this.messageLines.length > 0 ? this.messageLines : this.bottomText,
    );
  }

  /** Assembly: TextBoxBorder at hlcoord 0,0, lb bc, 8, 14 */
  private renderMainMenuBox(): void {
    const boxW = 16 * TILE_SIZE;
    const boxH = 10 * TILE_SIZE;
    drawBox(0, 0, boxW, boxH);

    for (let i = 0; i < MAIN_MENU_ITEMS.length; i++) {
      const y = (2 + i * 2) * TILE_SIZE;
      drawText(MAIN_MENU_ITEMS[i], 2 * TILE_SIZE, y);
      if (i === this.mainCursor && this.state === 'main_menu') {
        drawText('\u25B6', TILE_SIZE, y);
      }
    }
  }

  private getActiveItems(): { name: string; count: number; isKey: boolean }[] {
    const source =
      this.state === 'deposit' || this.state === 'deposit_qty'
        ? this.bag.items
        : this.pcItems;
    return source.map(i => ({
      name: getItemName(i.id),
      count: i.count,
      isKey: isKeyItem(i.id),
    }));
  }

  private renderItemList(entries: { name: string; count: number; isKey: boolean }[]): void {
    const listX = 4 * TILE_SIZE;
    const listY = 2 * TILE_SIZE;
    const listW = GB_WIDTH - listX;
    const listH = 10 * TILE_SIZE;

    drawBox(listX, listY, listW, listH);

    const totalEntries = entries.length + 1; // +1 for CANCEL
    const visibleCount = Math.min(MAX_VISIBLE, totalEntries);

    for (let i = 0; i < visibleCount; i++) {
      const idx = this.scrollOffset + i;
      if (idx >= totalEntries) break;

      const y = listY + TILE_SIZE + i * LINE_H;

      if (idx < entries.length) {
        drawText(entries[idx].name, listX + 2 * TILE_SIZE, y);
        if (!entries[idx].isKey) {
          const countStr = '\u00D7' + String(entries[idx].count).padStart(2, ' ');
          drawText(countStr, listX + listW - (countStr.length + 1) * TILE_SIZE, y);
        }
      } else {
        drawText('CANCEL', listX + 2 * TILE_SIZE, y);
      }

      if (idx === this.listCursor) {
        drawText('\u25B6', listX + TILE_SIZE, y);
      }
    }

    // Scroll indicators
    if (this.scrollOffset > 0) {
      drawText('\u25B2', listX + listW - 2 * TILE_SIZE, listY + TILE_SIZE);
    }
    if (this.scrollOffset + MAX_VISIBLE < totalEntries) {
      if (this.frameCounter % 32 < 16) {
        drawText('\u25BC', listX + listW - 2 * TILE_SIZE, listY + listH - LINE_H);
      }
    }
  }

  private renderQuantityBox(): void {
    const boxW = 6 * TILE_SIZE;
    const boxH = 3 * TILE_SIZE;
    const boxX = GB_WIDTH - boxW - TILE_SIZE;
    const boxY = GB_HEIGHT - 6 * TILE_SIZE - boxH;

    drawBox(boxX, boxY, boxW, boxH);
    drawText('\u00D7' + String(this.quantity).padStart(2, '0'), boxX + TILE_SIZE, boxY + TILE_SIZE);
  }

  private renderYesNoBox(): void {
    const boxW = 6 * TILE_SIZE;
    const boxH = 5 * TILE_SIZE;
    const boxX = GB_WIDTH - boxW;
    const boxY = 7 * TILE_SIZE;

    drawBox(boxX, boxY, boxW, boxH);

    const labels = ['YES', 'NO'];
    for (let i = 0; i < labels.length; i++) {
      const y = boxY + TILE_SIZE + i * LINE_H;
      drawText(labels[i], boxX + 2 * TILE_SIZE, y);
      if (i === this.yesNoCursor) {
        drawText('\u25B6', boxX + TILE_SIZE, y);
      }
    }
  }

  private renderBottomTextBox(lines: string[]): void {
    const boxH = 6 * TILE_SIZE;
    const boxY = GB_HEIGHT - boxH;
    drawBox(0, boxY, GB_WIDTH, boxH);
    for (let i = 0; i < lines.length; i++) {
      drawText(lines[i], TILE_SIZE, boxY + 2 * TILE_SIZE + i * LINE_H);
    }
  }
}
