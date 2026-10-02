// Bill's PC menu — Pokemon Storage System
// Assembly ref: engine/pokemon/bills_pc.asm, data/text/text_3.asm
//
// Menu: WITHDRAW PKMn / DEPOSIT PKMn / RELEASE PKMn / CHANGE BOX / SEE YA!
// 12 boxes, 20 Pokemon per box.

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import type { BattlePokemon } from '../battle';
import { playSFX } from '../audio';
import { getText } from '../text';

// --- Constants ---

export const NUM_BOXES = 12;
export const MONS_PER_BOX = 20;
const MAX_PARTY = 6;

const LINE_H = 16;
const MAX_VISIBLE = 4;

// \uE001 = <PK> glyph, \uE002 = <MN> glyph (mapped in charmap.ts)
const PKMN = '\uE001\uE002';
const MAIN_MENU_ITEMS = [
  `WITHDRAW ${PKMN}`,
  `DEPOSIT ${PKMN}`,
  `RELEASE ${PKMN}`,
  'CHANGE BOX',
  'SEE YA!',
] as const;

// --- Types ---

export interface BoxedPokemon {
  speciesName: string;
  nickname: string;
  level: number;
  currentHp: number;
  maxHp: number;
  moves: { id: string; pp: number; maxPp: number }[];
  status: 'PSN' | 'BRN' | 'FRZ' | 'PAR' | 'SLP' | null;
  atkDV: number;
  defDV: number;
  spdDV: number;
  spcDV: number;
  exp: number;
  otName?: string;
  otId?: number;
}

type BillsState =
  | 'main_menu'
  | 'withdraw_list' | 'withdraw_confirm'
  | 'deposit_list' | 'deposit_confirm'
  | 'release_list' | 'release_confirm'
  | 'change_box'
  | 'message';

type BillsResult = 'open' | 'closed';

// --- Helpers ---

export function pokemonToBoxed(mon: BattlePokemon): BoxedPokemon {
  return {
    speciesName: mon.species.name,
    nickname: mon.nickname,
    level: mon.level,
    currentHp: mon.currentHp,
    maxHp: mon.maxHp,
    moves: mon.moves.map(m => ({ id: m.id, pp: m.pp, maxPp: m.maxPp })),
    status: mon.status,
    atkDV: mon.atkDV,
    defDV: mon.defDV,
    spdDV: mon.spdDV,
    spcDV: mon.spcDV,
    exp: mon.exp,
    otName: mon.otName,
    otId: mon.otId,
  };
}

// --- Menu class ---

export class BillsPcMenu {
  private state: BillsState = 'main_menu';
  private party!: BattlePokemon[];
  private boxes!: BoxedPokemon[][];
  private currentBox = 0;
  private mainCursor = 0;
  private listCursor = 0;
  private scrollOffset = 0;
  private boxCursor = 0;
  private frameCounter = 0;

  private yesNoCursor = 0;
  private selectedIndex = -1;

  private bottomText: string[] = [];
  private messageLines: string[] = [];
  private messageNextState: BillsState | null = null;

  // Callback to deserialize boxed pokemon back into BattlePokemon
  private deserializeFn!: (boxed: BoxedPokemon) => BattlePokemon | null;

  show(
    party: BattlePokemon[],
    boxes: BoxedPokemon[][],
    currentBox: number,
    deserializeFn: (boxed: BoxedPokemon) => BattlePokemon | null,
  ): void {
    this.party = party;
    this.boxes = boxes;
    this.currentBox = currentBox;
    this.deserializeFn = deserializeFn;
    this.state = 'main_menu';
    this.mainCursor = 0;
    this.listCursor = 0;
    this.scrollOffset = 0;
    this.messageLines = [];
    this.messageNextState = null;
    this.bottomText = ['What do you want', 'to do?'];
  }

  /** Returns the current box index (so main.ts can track it). */
  getCurrentBox(): number {
    return this.currentBox;
  }

  update(): BillsResult {
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
      case 'main_menu':       return this.updateMainMenu();
      case 'withdraw_list':   return this.updateWithdrawList();
      case 'withdraw_confirm': return this.updateWithdrawConfirm();
      case 'deposit_list':    return this.updateDepositList();
      case 'deposit_confirm': return this.updateDepositConfirm();
      case 'release_list':    return this.updateReleaseList();
      case 'release_confirm': return this.updateReleaseConfirm();
      case 'change_box':      return this.updateChangeBox();
      default:                return 'open';
    }
  }

  // --- Main menu ---

  private updateMainMenu(): BillsResult {
    if (isPressed('up')) {
      this.mainCursor = (this.mainCursor - 1 + MAIN_MENU_ITEMS.length) % MAIN_MENU_ITEMS.length;
    } else if (isPressed('down')) {
      this.mainCursor = (this.mainCursor + 1) % MAIN_MENU_ITEMS.length;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      switch (this.mainCursor) {
        case 0: // WITHDRAW
          if (this.currentBoxMons().length === 0) {
            this.showMessage(getText('PC_NO_MON_HERE').split('\n'), 'main_menu');
          } else if (this.party.length >= MAX_PARTY) {
            this.showMessage(getText('PC_CANT_TAKE_MORE').split('\n'), 'main_menu');
          } else {
            this.resetList();
            this.bottomText = ('Which ' + getText('MENU_POKEMON') + ' do\nyou want?').split('\n');
            this.state = 'withdraw_list';
          }
          break;
        case 1: // DEPOSIT
          if (this.party.length <= 1) {
            this.showMessage(getText('PC_CANT_DEPOSIT_LAST').split('\n'), 'main_menu');
          } else if (this.currentBoxMons().length >= MONS_PER_BOX) {
            this.showMessage(getText('PC_BOX_FULL').split('\n'), 'main_menu');
          } else {
            this.resetList();
            this.bottomText = getText('PC_WHICH_MON_STORE').split('\n');
            this.state = 'deposit_list';
          }
          break;
        case 2: // RELEASE
          if (this.currentBoxMons().length === 0) {
            this.showMessage(getText('PC_NO_MON_HERE').split('\n'), 'main_menu');
          } else {
            this.resetList();
            this.bottomText = getText('PC_WHICH_MON_RELEASE').split('\n');
            this.state = 'release_list';
          }
          break;
        case 3: // CHANGE BOX
          this.boxCursor = this.currentBox;
          this.state = 'change_box';
          break;
        case 4: // SEE YA!
          return 'closed';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      return 'closed';
    }
    return 'open';
  }

  // --- Withdraw ---

  private updateWithdrawList(): BillsResult {
    const box = this.currentBoxMons();
    const total = box.length + 1; // +1 for CANCEL
    this.navigateList(total);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= box.length) {
        this.returnToMainMenu();
      } else {
        this.selectedIndex = this.listCursor;
        this.yesNoCursor = 0;
        this.state = 'withdraw_confirm';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateWithdrawConfirm(): BillsResult {
    if (isPressed('up') || isPressed('down')) {
      this.yesNoCursor = this.yesNoCursor === 0 ? 1 : 0;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.yesNoCursor === 0) {
        // WITHDRAW
        this.doWithdraw();
      } else {
        this.state = 'withdraw_list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'withdraw_list';
    }
    return 'open';
  }

  private doWithdraw(): void {
    const box = this.currentBoxMons();
    const boxed = box[this.selectedIndex];
    if (!boxed) { this.state = 'withdraw_list'; return; }

    if (this.party.length >= MAX_PARTY) {
      this.showMessage(getText('PC_CANT_TAKE_MORE').split('\n'), 'withdraw_list');
      return;
    }

    const mon = this.deserializeFn(boxed);
    if (!mon) { this.state = 'withdraw_list'; return; }

    // Remove from box, add to party
    box.splice(this.selectedIndex, 1);
    this.party.push(mon);

    const name = boxed.nickname.toUpperCase();
    this.showMessage([`Withdrew`, `${name}.`], 'withdraw_list');
    this.clampList(box.length + 1);
  }

  // --- Deposit ---

  private updateDepositList(): BillsResult {
    const total = this.party.length + 1; // +1 for CANCEL
    this.navigateList(total);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= this.party.length) {
        this.returnToMainMenu();
      } else {
        this.selectedIndex = this.listCursor;
        this.yesNoCursor = 0;
        this.state = 'deposit_confirm';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateDepositConfirm(): BillsResult {
    if (isPressed('up') || isPressed('down')) {
      this.yesNoCursor = this.yesNoCursor === 0 ? 1 : 0;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.yesNoCursor === 0) {
        this.doDeposit();
      } else {
        this.state = 'deposit_list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'deposit_list';
    }
    return 'open';
  }

  private doDeposit(): void {
    if (this.party.length <= 1) {
      this.showMessage(getText('PC_CANT_DEPOSIT_LAST').split('\n'), 'deposit_list');
      return;
    }
    const box = this.currentBoxMons();
    if (box.length >= MONS_PER_BOX) {
      this.showMessage(getText('PC_BOX_FULL').split('\n'), 'deposit_list');
      return;
    }

    const mon = this.party[this.selectedIndex];
    if (!mon) { this.state = 'deposit_list'; return; }

    // Remove from party, add to box
    this.party.splice(this.selectedIndex, 1);
    box.push(pokemonToBoxed(mon));

    const name = mon.nickname.toUpperCase();
    const boxNum = this.currentBox + 1;
    this.showMessage([`${name} was`, `stored in Box ${boxNum}.`], 'deposit_list');
    this.clampList(this.party.length + 1);
  }

  // --- Release ---

  private updateReleaseList(): BillsResult {
    const box = this.currentBoxMons();
    const total = box.length + 1;
    this.navigateList(total);

    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.listCursor >= box.length) {
        this.returnToMainMenu();
      } else {
        this.selectedIndex = this.listCursor;
        this.yesNoCursor = 0;
        this.state = 'release_confirm';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  private updateReleaseConfirm(): BillsResult {
    if (isPressed('up') || isPressed('down')) {
      this.yesNoCursor = this.yesNoCursor === 0 ? 1 : 0;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      if (this.yesNoCursor === 0) {
        this.doRelease();
      } else {
        this.state = 'release_list';
      }
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.state = 'release_list';
    }
    return 'open';
  }

  private doRelease(): void {
    const box = this.currentBoxMons();
    const boxed = box[this.selectedIndex];
    if (!boxed) { this.state = 'release_list'; return; }

    const name = boxed.nickname.toUpperCase();
    box.splice(this.selectedIndex, 1);

    this.showMessage([`${name} was`, 'released outside.'], 'release_list');
    this.clampList(box.length + 1);
  }

  // --- Change Box ---

  private updateChangeBox(): BillsResult {
    if (isPressed('left')) {
      this.boxCursor = (this.boxCursor - 1 + NUM_BOXES) % NUM_BOXES;
    } else if (isPressed('right')) {
      this.boxCursor = (this.boxCursor + 1) % NUM_BOXES;
    } else if (isPressed('up')) {
      this.boxCursor = (this.boxCursor - 1 + NUM_BOXES) % NUM_BOXES;
    } else if (isPressed('down')) {
      this.boxCursor = (this.boxCursor + 1) % NUM_BOXES;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      this.currentBox = this.boxCursor;
      this.returnToMainMenu();
    } else if (isPressed('b')) {
      playSFX('press_ab');
      this.returnToMainMenu();
    }
    return 'open';
  }

  // --- Helpers ---

  private currentBoxMons(): BoxedPokemon[] {
    return this.boxes[this.currentBox];
  }

  private showMessage(lines: string[], nextState: BillsState): void {
    this.messageLines = lines;
    this.messageNextState = nextState;
    if (nextState === 'main_menu') {
      this.bottomText = ['What do you want', 'to do?'];
    }
  }

  private returnToMainMenu(): void {
    this.bottomText = ['What do you want', 'to do?'];
    this.state = 'main_menu';
  }

  private resetList(): void {
    this.listCursor = 0;
    this.scrollOffset = 0;
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

  private clampList(totalEntries: number): void {
    const max = totalEntries - 1;
    if (this.listCursor > max) this.listCursor = Math.max(0, max);
    if (this.listCursor < this.scrollOffset) this.scrollOffset = this.listCursor;
    if (this.listCursor >= this.scrollOffset + MAX_VISIBLE) {
      this.scrollOffset = this.listCursor - MAX_VISIBLE + 1;
    }
  }

  // --- Rendering ---

  render(): void {
    // Main menu is always drawn as background
    this.renderMainMenuBox();

    // Item/Pokemon list for withdraw/deposit/release
    const inList =
      this.state === 'withdraw_list' || this.state === 'withdraw_confirm' ||
      this.state === 'deposit_list' || this.state === 'deposit_confirm' ||
      this.state === 'release_list' || this.state === 'release_confirm';

    if (inList) {
      this.renderMonList();
    }

    // Yes/No confirmation
    if (this.state === 'withdraw_confirm' || this.state === 'deposit_confirm' || this.state === 'release_confirm') {
      this.renderYesNoBox();
    }

    if (this.state === 'change_box') {
      // "BOX No." indicator at top-left
      this.renderBoxIndicatorTopLeft();
      // "Choose a PKMn BOX." at bottom (rendered first so box list overlaps it)
      this.renderBottomTextBox(['Choose a', `${PKMN} BOX.`]);
      // Box list on the right (on top of everything)
      this.renderChangeBoxList();
      return;
    }

    // Box number indicator (bottom-right)
    this.renderBoxIndicator();

    // Bottom text box — only when there's a message or when in a list sub-state
    if (this.messageLines.length > 0) {
      this.renderBottomTextBox(this.messageLines);
    } else if (inList) {
      this.renderBottomTextBox(this.bottomText);
    }
  }

  private renderMainMenuBox(): void {
    // Assembly: hlcoord 0,0 / lb bc, 12, 12 → 14 tiles wide, 14 tiles tall
    const boxW = 14 * TILE_SIZE;
    const boxH = (MAIN_MENU_ITEMS.length * 2 + 2) * TILE_SIZE;
    drawBox(0, 0, boxW, boxH);

    for (let i = 0; i < MAIN_MENU_ITEMS.length; i++) {
      const y = (2 + i * 2) * TILE_SIZE;
      drawText(MAIN_MENU_ITEMS[i], 2 * TILE_SIZE, y);
      if (i === this.mainCursor && this.state === 'main_menu') {
        drawText('\u25B6', TILE_SIZE, y);
      }
    }
  }

  private renderMonList(): void {
    const isDeposit = this.state === 'deposit_list' || this.state === 'deposit_confirm';
    const entries = isDeposit ? this.getPartyEntries() : this.getBoxEntries();
    const totalEntries = entries.length + 1; // +1 for CANCEL

    const listX = 4 * TILE_SIZE;
    const listY = 2 * TILE_SIZE;
    const listW = GB_WIDTH - listX;
    const listH = 10 * TILE_SIZE;

    drawBox(listX, listY, listW, listH);

    const visibleCount = Math.min(MAX_VISIBLE, totalEntries);

    for (let i = 0; i < visibleCount; i++) {
      const idx = this.scrollOffset + i;
      if (idx >= totalEntries) break;

      const y = listY + TILE_SIZE + i * LINE_H;

      if (idx < entries.length) {
        const e = entries[idx];
        drawText(e.nickname, listX + 2 * TILE_SIZE, y);
        const lvl = ':L' + e.level;
        drawText(lvl, listX + listW - (lvl.length + 1) * TILE_SIZE, y);
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

  private renderBoxIndicator(): void {
    if (this.state === 'change_box') return; // rendered separately
    const boxNum = this.currentBox + 1;
    const text = `BOX No.${String(boxNum).padStart(2, ' ')}`;
    const boxW = (text.length + 2) * TILE_SIZE;
    const boxH = 4 * TILE_SIZE;
    const boxX = GB_WIDTH - boxW;
    const boxY = GB_HEIGHT - boxH;

    drawBox(boxX, boxY, boxW, boxH);
    drawText(text, boxX + TILE_SIZE, boxY + boxH - 2 * TILE_SIZE);
  }

  private renderBottomTextBox(lines: string[]): void {
    const boxH = 6 * TILE_SIZE;
    const boxY = GB_HEIGHT - boxH;
    drawBox(0, boxY, GB_WIDTH, boxH);
    for (let i = 0; i < lines.length; i++) {
      drawText(lines[i], TILE_SIZE, boxY + 2 * TILE_SIZE + i * LINE_H);
    }
  }

  /** "BOX No. X" small box at top-left (used during CHANGE BOX). */
  private renderBoxIndicatorTopLeft(): void {
    const boxNum = this.currentBox + 1;
    const text = `BOX No.${String(boxNum).padStart(2, ' ')}`;
    const boxW = (text.length + 2) * TILE_SIZE;
    const boxH = 4 * TILE_SIZE;

    drawBox(0, 0, boxW, boxH);
    drawText(text, TILE_SIZE, boxH - 2 * TILE_SIZE);
  }

  /** Compact box list on the right side (used during CHANGE BOX). */
  private renderChangeBoxList(): void {
    // Assembly: box list column on the right, overlaps bottom text
    const colW = 8 * TILE_SIZE;  // "BOX 12" + cursor + borders
    const colX = GB_WIDTH - colW;
    const colH = NUM_BOXES * TILE_SIZE + 2 * TILE_SIZE;
    const colY = 0;

    drawBox(colX, colY, colW, colH);

    for (let i = 0; i < NUM_BOXES; i++) {
      const y = colY + TILE_SIZE + i * TILE_SIZE;
      const num = String(i + 1);
      drawText(`BOX${num.padStart(2, ' ')}`, colX + 2 * TILE_SIZE, y);

      if (i === this.boxCursor) {
        drawText('\u25B6', colX + TILE_SIZE, y);
      }
    }
  }

  // --- Data access ---

  private getBoxEntries(): { nickname: string; level: number }[] {
    return this.currentBoxMons().map(m => ({
      nickname: m.nickname.toUpperCase(),
      level: m.level,
    }));
  }

  private getPartyEntries(): { nickname: string; level: number }[] {
    return this.party.map(m => ({
      nickname: m.nickname.toUpperCase(),
      level: m.level,
    }));
  }
}
