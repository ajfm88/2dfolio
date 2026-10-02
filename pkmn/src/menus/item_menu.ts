// Overworld item menu — view, use, and toss items from the bag

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { fillRect } from '../renderer';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { drawPartyIcon, loadPartyIcons } from './party_icons';
import { loadPartyTiles, drawTileHpBar, drawLevel } from './party_menu';
import { Bag, getItemName, getItemCategory } from '../items';
import { playSFX } from '../audio';
import type { BattlePokemon } from '../battle';
import { modifyPikachuHappiness } from '../pikachu';
import { getText } from '../text';

type ItemMenuState = 'list' | 'submenu' | 'party_select' | 'toss_qty' | 'toss_confirm' | 'heal_anim' | 'message';
type ItemMenuResult = 'open' | 'closed' | 'use_town_map';

const LINE_H = 16;
const MAX_VISIBLE = 4;


// Healing amounts matching assembly engine/items/item_effects.asm
const HEAL_AMOUNTS: Record<string, number> = {
  POTION: 20,
  SUPER_POTION: 50,
  HYPER_POTION: 200,
  MAX_POTION: 9999,
  FULL_RESTORE: 9999,
};

// Status cures: value = status string to cure, null = cure any
const STATUS_CURES: Record<string, string | null> = {
  ANTIDOTE: 'PSN',
  PARALYZE_HEAL: 'PAR',
  BURN_HEAL: 'BRN',
  ICE_HEAL: 'FRZ',
  AWAKENING: 'SLP',
  FULL_HEAL: null,
  FULL_RESTORE: null,
};

const SUBMENU_ITEMS = ['USE', 'TOSS'] as const;
// Assembly: USE_TOSS_MENU_TEMPLATE = (13,10)→(19,14) = 7×5 tiles
const SUBMENU_W = 7 * TILE_SIZE;
const SUBMENU_X = 13 * TILE_SIZE;

export class ItemMenu {
  private bag!: Bag;
  private party!: BattlePokemon[];
  private state: ItemMenuState = 'list';
  private cursor = 0;
  private scrollOffset = 0;
  private subCursor = 0;
  private partyCursor = 0;
  private tossQty = 1;
  private confirmCursor = 0; // 0=YES, 1=NO
  private messageLines: string[] = [];
  private messageReturnState: ItemMenuState = 'list';
  private selectedItemIndex = -1;

  private frameCounter = 0;
  // Heal animation state (assembly: UpdateHPBar2 increments 1 HP per frame)
  private healMonIndex = -1;
  private healDisplayHp = 0;  // current display HP during animation
  private healTargetHp = 0;   // target HP after healing
  private healDifference = 0; // total HP recovered (for message)
  private healFrameDelay = 0; // 2-frame delay per increment (assembly: DelayFrames 2)

  show(bag: Bag, party: BattlePokemon[]): void {
    this.bag = bag;
    this.party = party;
    this.state = 'list';
    this.cursor = 0;
    this.scrollOffset = 0;
    this.subCursor = 0;
    this.partyCursor = 0;
    this.tossQty = 1;
    this.frameCounter = 0;
    this.messageLines = [];
    loadPartyIcons();
    loadPartyTiles();
    this.selectedItemIndex = -1;
  }

  update(): ItemMenuResult {
    if (this.state === 'message') {
      if (isPressed('a') || isPressed('b')) {
        playSFX('press_ab');
        this.messageLines = [];
        this.healMonIndex = -1;
        if (this.bag.items.length === 0) return 'closed';
        this.state = this.messageReturnState;
        this.clampCursor();
      }
      return 'open';
    }

    switch (this.state) {
      case 'list': return this.updateList();
      case 'submenu': return this.updateSubmenu();
      case 'party_select': return this.updatePartySelect();
      case 'toss_qty': return this.updateTossQty();
      case 'toss_confirm': return this.updateTossConfirm();
      case 'heal_anim': return this.updateHealAnim();
    }
    return 'open';
  }

  private get totalEntries(): number {
    return this.bag.items.length + 1; // items + CANCEL
  }

  private updateList(): ItemMenuResult {
    if (isPressed('up')) {
      if (this.cursor > 0) {
        this.cursor--;
        if (this.cursor < this.scrollOffset) this.scrollOffset = this.cursor;
      }
    } else if (isPressed('down')) {
      if (this.cursor < this.totalEntries - 1) {
        this.cursor++;
        if (this.cursor >= this.scrollOffset + MAX_VISIBLE) {
          this.scrollOffset = this.cursor - MAX_VISIBLE + 1;
        }
      }
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.cursor >= this.bag.items.length) {
        return 'closed';
      }
      this.selectedItemIndex = this.cursor;
      this.subCursor = 0;
      this.state = 'submenu';
    } else if (isPressed('b')) {
      playSFX('press_ab');
      return 'closed';
    }
    return 'open';
  }

  private updateSubmenu(): ItemMenuResult {
    if (isPressed('up')) {
      this.subCursor = (this.subCursor - 1 + SUBMENU_ITEMS.length) % SUBMENU_ITEMS.length;
    } else if (isPressed('down')) {
      this.subCursor = (this.subCursor + 1) % SUBMENU_ITEMS.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      const action = SUBMENU_ITEMS[this.subCursor];
      const item = this.bag.items[this.selectedItemIndex];
      if (!item) { this.state = 'list'; return 'open'; }

      if (action === 'USE') {
        if (ItemMenu.DIRECT_USE_ITEMS.has(item.id)) {
          // Direct-use items open their own UI (assembly: ItemUseTownMap → DisplayTownMap)
          if (item.id === 'TOWN_MAP') return 'use_town_map';
        } else if (this.isUsableOverworld(item.id)) {
          this.partyCursor = 0;
          this.state = 'party_select';
        } else {
          this.messageLines = ["Can't use that", "here."];
          this.messageReturnState = 'list';
          this.state = 'message';
        }
      } else if (action === 'TOSS') {
        // Key items cannot be tossed (assembly: TossItem checks item type)
        if (getItemCategory(item.id) === 'key') {
          this.messageLines = ["That's too", "important to toss!"];
          this.messageReturnState = 'list';
          this.state = 'message';
        } else {
          this.tossQty = 1;
          this.state = 'toss_qty';
        }
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'list';
    }
    return 'open';
  }

  private updatePartySelect(): ItemMenuResult {
    if (isPressed('up')) {
      this.partyCursor = (this.partyCursor - 1 + this.party.length) % this.party.length;
    } else if (isPressed('down')) {
      this.partyCursor = (this.partyCursor + 1) % this.party.length;
    } else if (isPressed('a')) {
      this.useItemOnMon(this.partyCursor);
    } else if (isPressed('b')) {
      this.state = 'list';
    }
    return 'open';
  }

  private updateTossQty(): ItemMenuResult {
    const item = this.bag.items[this.selectedItemIndex];
    if (!item) { this.state = 'list'; return 'open'; }

    if (isPressed('up')) {
      if (this.tossQty < item.count) this.tossQty++;
    } else if (isPressed('down')) {
      if (this.tossQty > 1) this.tossQty--;
    } else if (isPressed('a')) {
      this.confirmCursor = 0;
      this.state = 'toss_confirm';
    } else if (isPressed('b')) {
      this.state = 'submenu';
    }
    return 'open';
  }

  private updateTossConfirm(): ItemMenuResult {
    if (isPressed('up') || isPressed('down')) {
      this.confirmCursor = this.confirmCursor === 0 ? 1 : 0;
    } else if (isPressed('a')) {
      if (this.confirmCursor === 0) {
        // YES — toss the item
        const item = this.bag.items[this.selectedItemIndex];
        if (!item) { this.state = 'list'; return 'open'; }
        const name = getItemName(item.id);
        this.bag.remove(item.id, this.tossQty);
        this.messageLines = [`Threw away`, `${this.tossQty} ${name}.`];
        this.messageReturnState = 'list';
        this.state = 'message';
      } else {
        // NO — back to item list
        this.state = 'list';
      }
    } else if (isPressed('b')) {
      this.state = 'list';
    }
    return 'open';
  }

  // Items usable directly from bag (no party select needed)
  // Assembly: engine/items/item_effects.asm ItemUseTownMap
  private static readonly DIRECT_USE_ITEMS = new Set(['TOWN_MAP']);

  private isUsableOverworld(itemId: string): boolean {
    return getItemCategory(itemId) === 'medicine' || ItemMenu.DIRECT_USE_ITEMS.has(itemId);
  }

  private useItemOnMon(monIndex: number): void {
    const item = this.bag.items[this.selectedItemIndex];
    if (!item) { this.state = 'list'; return; }

    const mon = this.party[monIndex];

    // Assembly bug: happiness triggers BEFORE checking if the item has any effect
    // (engine/items/item_effects.asm:941 — fires right after target selection)
    if (mon.species.id === 25) modifyPikachuHappiness('USEDITEM');

    // Check if this is an HP-healing item that should animate
    const healAmount = HEAL_AMOUNTS[item.id];
    if (healAmount !== undefined) {
      if (mon.currentHp >= mon.maxHp || mon.currentHp === 0) {
        this.messageLines = ["It won't have", "any effect."];
        this.messageReturnState = 'party_select';
        this.state = 'message';
        return;
      }
      // Start heal animation (assembly: UpdateHPBar2)
      const oldHp = mon.currentHp;
      const newHp = Math.min(oldHp + healAmount, mon.maxHp);
      this.healMonIndex = monIndex;
      this.healDisplayHp = oldHp;
      this.healTargetHp = newHp;
      this.healDifference = newHp - oldHp;
      this.healFrameDelay = 0;
      // Don't update mon.currentHp yet — animation will do it
      this.bag.remove(item.id);
      this.state = 'heal_anim';
      return;
    }

    // FULL_RESTORE HP healing also animates
    if (item.id === 'FULL_RESTORE' && mon.currentHp > 0 && mon.currentHp < mon.maxHp) {
      const oldHp = mon.currentHp;
      this.healMonIndex = monIndex;
      this.healDisplayHp = oldHp;
      this.healTargetHp = mon.maxHp;
      this.healDifference = mon.maxHp - oldHp;
      this.healFrameDelay = 0;
      // Cure status immediately
      if (mon.status) {
        mon.status = null;
        mon.sleepTurns = 0;
        mon.toxicCounter = 0;
        mon.badlyPoisoned = false;
      }
      this.bag.remove(item.id);
      this.state = 'heal_anim';
      return;
    }

    // Non-HP items (status cures, revive, etc.)
    const result = this.applyItem(item.id, mon);
    if (result.success) {
      this.bag.remove(item.id);
      this.messageReturnState = 'list';
    } else {
      this.messageReturnState = 'party_select';
    }
    this.messageLines = result.message;
    this.state = 'message';
  }

  // Assembly: UpdateHPBar2 — animate HP bar 1 HP per ~2 frames
  private updateHealAnim(): ItemMenuResult {
    this.healFrameDelay++;
    if (this.healFrameDelay >= 2) {
      this.healFrameDelay = 0;
      if (this.healDisplayHp < this.healTargetHp) {
        this.healDisplayHp++;
        // Update the mon's actual HP so the bar renders correctly
        this.party[this.healMonIndex].currentHp = this.healDisplayHp;
      }
    }
    if (this.healDisplayHp >= this.healTargetHp) {
      // Animation done — show recovery message (assembly: PotionText)
      const mon = this.party[this.healMonIndex];
      const name = mon.nickname.toUpperCase();
      this.messageLines = [`${name}`, `recovered by ${this.healDifference}!`];
      this.messageReturnState = 'list';
      this.state = 'message';
    }
    return 'open';
  }

  // Apply non-HP items (HP healing is handled via heal_anim in useItemOnMon)
  private applyItem(itemId: string, mon: BattlePokemon): { success: boolean; message: string[] } {
    const name = mon.nickname.toUpperCase();

    // REVIVE: only works on fainted
    if (itemId === 'REVIVE') {
      if (mon.currentHp > 0) {
        return { success: false, message: ["It won't have", "any effect."] };
      }
      mon.currentHp = Math.floor(mon.maxHp / 2);
      return { success: true, message: [`${name}'s HP`, "was restored!"] };
    }

    // All other medicine fails on fainted mon
    if (mon.currentHp === 0) {
      return { success: false, message: ["It won't have", "any effect."] };
    }

    // FULL_RESTORE with only status (no HP damage) — cure status only
    if (itemId === 'FULL_RESTORE') {
      if (!mon.status) {
        return { success: false, message: ["It won't have", "any effect."] };
      }
      mon.status = null;
      mon.sleepTurns = 0;
      mon.toxicCounter = 0;
      mon.badlyPoisoned = false;
      return { success: true, message: [`${name} was`, "cured!"] };
    }

    // Status cures
    const targetStatus = STATUS_CURES[itemId];
    if (targetStatus !== undefined) {
      if (!mon.status || (targetStatus !== null && mon.status !== targetStatus)) {
        return { success: false, message: ["It won't have", "any effect."] };
      }
      mon.status = null;
      mon.sleepTurns = 0;
      mon.toxicCounter = 0;
      mon.badlyPoisoned = false;
      return { success: true, message: [`${name} was`, "cured!"] };
    }

    return { success: false, message: ["It won't have", "any effect."] };
  }

  private clampCursor(): void {
    const max = this.totalEntries - 1;
    if (this.cursor > max) this.cursor = Math.max(0, max);
    if (this.cursor < this.scrollOffset) this.scrollOffset = this.cursor;
    if (this.cursor >= this.scrollOffset + MAX_VISIBLE) {
      this.scrollOffset = this.cursor - MAX_VISIBLE + 1;
    }
  }

  // --- Rendering ---

  // Item list box: assembly LIST_MENU_BOX = (4,2)→(19,12) = 16×11 tiles
  // Fixed size regardless of item count, matching original Game Boy layout.
  private get listBoxX(): number { return 4 * TILE_SIZE; }
  private get listBoxY(): number { return 2 * TILE_SIZE; }
  private get listBoxW(): number { return 16 * TILE_SIZE; }
  private get listBoxH(): number { return 11 * TILE_SIZE; }

  render(): void {
    if (this.state === 'party_select') {
      this.renderPartySelect();
      return;
    }
    if (this.state === 'heal_anim') {
      this.renderPartySelect();
      return;
    }
    if (this.state === 'message' && this.messageReturnState === 'party_select') {
      this.renderPartySelect();
      this.renderMessage();
      return;
    }
    if (this.state === 'message' && this.healMonIndex >= 0) {
      this.renderPartySelect();
      this.renderMessage();
      return;
    }
    this.renderItemList();
    if (this.state === 'submenu') {
      this.renderSubmenu();
    }
    if (this.state === 'toss_qty') {
      this.renderSubmenu();
      this.renderTossQty();
    }
    if (this.state === 'toss_confirm') {
      this.renderTossQty();
      this.renderTossConfirm();
    }
    if (this.messageLines.length > 0) {
      this.renderMessage();
    }
  }

  private renderItemList(): void {
    const bx = this.listBoxX;
    const by = this.listBoxY;
    const bw = this.listBoxW;
    const bh = this.listBoxH;
    drawBox(bx, by, bw, bh);

    const visibleCount = Math.min(MAX_VISIBLE, this.totalEntries);
    const textX = bx + 2 * TILE_SIZE;

    for (let i = 0; i < visibleCount; i++) {
      const idx = this.scrollOffset + i;
      if (idx >= this.totalEntries) break;

      const y = by + TILE_SIZE + i * LINE_H;

      if (idx < this.bag.items.length) {
        const item = this.bag.items[idx];
        drawText(getItemName(item.id), textX, y);
        // Key items don't show count (assembly: no ×count for key items in bag)
        if (getItemCategory(item.id) !== 'key') {
          const countStr = '\u00D7' + String(item.count).padStart(2, ' ');
          drawText(countStr, bx + bw - (countStr.length + 1) * TILE_SIZE, y);
        }
      } else {
        drawText('CANCEL', textX, y);
      }

      if (idx === this.cursor) {
        drawText('\u25B6', bx + TILE_SIZE, y);
      }
    }

    // Scroll indicators
    if (this.scrollOffset > 0) {
      drawText('\u25B2', bx + bw - 2 * TILE_SIZE, by + TILE_SIZE);
    }
    if (this.scrollOffset + MAX_VISIBLE < this.totalEntries) {
      drawText('\u25BC', bx + bw - 2 * TILE_SIZE, by + TILE_SIZE + (visibleCount - 1) * LINE_H);
    }
  }

  private renderSubmenu(): void {
    // Assembly: box (13,10)→(19,14) = 5 tiles tall, text at (15,11), cursor at (14,11)
    const subH = 5 * TILE_SIZE;
    const subY = 10 * TILE_SIZE;

    drawBox(SUBMENU_X, subY, SUBMENU_W, subH);

    for (let i = 0; i < SUBMENU_ITEMS.length; i++) {
      const y = (11 + i * 2) * TILE_SIZE;
      drawText(SUBMENU_ITEMS[i], 15 * TILE_SIZE, y);
      if (i === this.subCursor) {
        drawText('\u25B6', 14 * TILE_SIZE, y);
      }
    }
  }

  private renderTossQty(): void {
    // Assembly: DisplayChooseQuantityMenu — content at hlcoord(15,9) size 1×3
    // Border: tile col 14 to screen right edge (col 19), 3 tiles tall
    const boxX = 14 * TILE_SIZE;
    const boxY = 8 * TILE_SIZE;
    const boxW = GB_WIDTH - boxX;
    const boxH = 3 * TILE_SIZE;

    drawBox(boxX, boxY, boxW, boxH);
    drawText('\u00D7' + String(this.tossQty).padStart(2, '0'), 16 * TILE_SIZE, 9 * TILE_SIZE);
  }

  private renderPartySelect(): void {
    this.frameCounter++;
    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    const ENTRY_H = 16;

    for (let i = 0; i < this.party.length; i++) {
      const mon = this.party[i];
      const y = i * ENTRY_H;
      const hpRatio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 0;

      // Party icon — selected mon animates
      const frame = i === this.partyCursor ? this.frameCounter : 0;
      drawPartyIcon(mon.species.id, TILE_SIZE, y, frame, hpRatio);

      // Cursor
      if (i === this.partyCursor) {
        drawText('\u25B6', 0, y);
      }

      // Name at column 3
      drawText(mon.nickname.toUpperCase(), 3 * TILE_SIZE, y);

      // Level at column 13
      drawLevel(mon.level, 13 * TILE_SIZE, y);

      // Status at column 17
      if (mon.status) {
        drawText(mon.status, 17 * TILE_SIZE, y);
      }

      // Tile-based HP bar on second line
      const hpY = y + TILE_SIZE;
      drawTileHpBar(4 * TILE_SIZE, hpY, mon.currentHp, mon.maxHp);

      // HP numbers right-aligned
      const hpCurrent = String(mon.currentHp).padStart(3, ' ');
      const hpMax = String(mon.maxHp).padStart(3, ' ');
      const hpText = `${hpCurrent}/${hpMax}`;
      drawText(hpText, GB_WIDTH - (hpText.length + 1) * TILE_SIZE, hpY);
    }

    // Bottom text box (rows 12-17)
    drawBox(0, 12 * TILE_SIZE, GB_WIDTH, 6 * TILE_SIZE);
    drawText('Use item on which', TILE_SIZE, 14 * TILE_SIZE);
    drawText(getText('ITEM_USE_ON_WHICH_MON'), TILE_SIZE, 16 * TILE_SIZE);
  }

  private renderTossConfirm(): void {
    // Assembly: "Is it OK to toss ITEM?" in bottom message box + YES/NO menu
    const item = this.bag.items[this.selectedItemIndex];
    const name = item ? getItemName(item.id) : '';

    // Standard bottom message box: row 12, 6 tiles tall (assembly: hlcoord 0,12 size 18×4)
    const msgY = 12 * TILE_SIZE;
    const msgH = 6 * TILE_SIZE;
    drawBox(0, msgY, GB_WIDTH, msgH);
    drawText('Is it OK to toss', TILE_SIZE, 14 * TILE_SIZE);
    drawText(`${name}?`, TILE_SIZE, 16 * TILE_SIZE);

    // YES/NO box: assembly hlcoord(14,7) content 4×3 → border 6×5 tiles
    const ynX = 14 * TILE_SIZE;
    const ynY = 7 * TILE_SIZE;
    drawBox(ynX, ynY, 6 * TILE_SIZE, 5 * TILE_SIZE);
    drawText('YES', 16 * TILE_SIZE, 8 * TILE_SIZE);
    drawText('NO', 16 * TILE_SIZE, 10 * TILE_SIZE);
    drawText('\u25B6', 15 * TILE_SIZE, (8 + this.confirmCursor * 2) * TILE_SIZE);
  }

  private renderMessage(): void {
    // Standard bottom message box: row 12, 6 tiles tall
    const msgY = 12 * TILE_SIZE;
    const msgH = 6 * TILE_SIZE;
    drawBox(0, msgY, GB_WIDTH, msgH);
    for (let i = 0; i < this.messageLines.length; i++) {
      drawText(this.messageLines[i], TILE_SIZE, 14 * TILE_SIZE + i * LINE_H);
    }
  }
}
