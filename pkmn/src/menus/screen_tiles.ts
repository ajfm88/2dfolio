// wTileMap for menus (home/tilemap.asm, home/text.asm TextBoxBorder, home/print_bcd.asm).
// null means no menu wrote that cell: rows 0–11 show the map, rows 12–17 show the TextBox.
// A visible copy changes only when a third is transferred (home/vcopy.asm).

import { tokenizeGlyphs } from '../text/charmap';
import type { BgTransfer } from '../text/bg_transfer';
import type { TextBox, TextBoxScreen } from '../text/textbox';

export const SCREEN_WIDTH = 20;
export const SCREEN_HEIGHT = 18;

export interface ScreenSnapshot {
  logical: (string | null)[];
  text: TextBoxScreen;
}

/** A menu layer without an active TextBox (the START display's Buffer2). */
export type ScreenTileSnapshot = readonly (string | null)[];

export interface BcdWrite {
  bytes: number;
  /** BIT_LEADING_ZEROES: suppressed cells are skipped, not blanked. */
  suppressZero: boolean;
  leftAlign: boolean;
  moneySign: boolean;
}

export interface NumberWrite {
  digits: number;
  /** PrintNumber's BIT_LEADING_ZEROES. Set: write the zeros. Clear: skip them. */
  leadingZeroes: boolean;
}

const BCD_CAP = 999999;

/** 3-byte AddBCD, saturated at $999999 (each byte $99). */
export function addBcd(total: number, addend: number): number {
  return Math.min(BCD_CAP, total + addend);
}

/** quantity × unit price by repeated 3-byte BCD addition. */
export function multiplyBcd(unitPrice: number, quantity: number): number {
  let total = 0;
  for (let i = 0; i < quantity; i++) total = addBcd(total, unitPrice);
  return total;
}

export class ScreenTiles {
  private readonly logical: (string | null)[] = Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(null);
  private readonly shown: (string | null)[] = Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(null);

  at(x: number, y: number): string | null { return this.cell(this.logical, x, y); }
  visibleAt(x: number, y: number): string | null { return this.cell(this.shown, x, y); }

  put(x: number, y: number, glyph: string | null): void {
    if (x < 0 || y < 0 || x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT) return;
    this.logical[y * SCREEN_WIDTH + x] = glyph;
  }

  /** TextBoxBorder: c×b box at (x, y). c is the interior width, b the interior height. */
  textBoxBorder(x: number, y: number, innerH: number, innerW: number): void {
    this.put(x, y, '┌');
    for (let i = 0; i < innerW; i++) this.put(x + 1 + i, y, '─');
    this.put(x + innerW + 1, y, '┐');
    for (let row = 0; row < innerH; row++) {
      this.put(x, y + 1 + row, '│');
      for (let i = 0; i < innerW; i++) this.put(x + 1 + i, y + 1 + row, ' ');
      this.put(x + innerW + 1, y + 1 + row, '│');
    }
    const bottom = y + innerH + 1;
    this.put(x, bottom, '└');
    for (let i = 0; i < innerW; i++) this.put(x + 1 + i, bottom, '─');
    this.put(x + innerW + 1, bottom, '┘');
  }

  /** PlaceString. `<NEXT>` advances two rows and returns to this x. `@` ends the string. */
  placeString(x: number, y: number, text: string): void {
    const body = text.endsWith('@') ? text.slice(0, -1) : text;
    const lines = body.split('<NEXT>');
    for (let line = 0; line < lines.length; line++) {
      let col = x;
      for (const glyph of tokenizeGlyphs(lines[line])) this.put(col++, y + line * 2, glyph);
    }
  }

  /** ClearScreenArea: c×b spaces at (x, y). */
  clearArea(x: number, y: number, height: number, width: number): void {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) this.put(x + col, y + row, ' ');
    }
  }

  /** Give those cells back to the map or the message box. */
  release(x: number, y: number, height: number, width: number): void {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) this.put(x + col, y + row, null);
    }
  }

  /** PrintBCDNumber. Suppressed cells are skipped; an all-zero right-aligned value backs up one. */
  writeBcd(x: number, y: number, value: number, flags: BcdWrite): void {
    let suppress = flags.suppressZero;
    let col = x;
    const write = (glyph: string) => { this.put(col, y, glyph); col++; };
    if (flags.moneySign && !suppress) write('¥');
    for (const digit of String(value).padStart(flags.bytes * 2, '0')) {
      if (suppress && digit === '0') {
        if (!flags.leftAlign) col++;
        continue;
      }
      if (suppress && flags.moneySign) write('¥');
      suppress = false;
      write(digit);
    }
    if (suppress) {
      if (!flags.leftAlign) col--;
      if (flags.moneySign) write('¥');
      write('0');
    }
  }

  /** PrintNumber, one byte. A leading zero is skipped, never blanked. The ones digit is always written. */
  writeNumber(x: number, y: number, value: number, flags: NumberWrite): void {
    let col = x;
    let past = false;
    const digits = String(value).padStart(flags.digits, '0').slice(-flags.digits);
    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i] ?? '0';
      const ones = i === digits.length - 1;
      const zero = digit === '0' && !past;
      if (zero && !flags.leadingZeroes && !ones) {
        col++;
        continue;
      }
      this.put(col, y, digit);
      col++;
      past = true;
    }
  }

  /** Drop every cell. The map and the message box show through again. */
  reset(): void {
    this.logical.fill(null);
    this.shown.fill(null);
  }

  /** Copy one transferred third. The caller owns the single VBlank tick. */
  copyShownThird(third: number): void {
    const y0 = third * (SCREEN_HEIGHT / 3);
    for (let y = y0; y < y0 + SCREEN_HEIGHT / 3; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) this.shown[y * SCREEN_WIDTH + x] = this.logical[y * SCREEN_WIDTH + x];
    }
  }

  /**
   * One VBlank. While the transfer is disabled, nothing is copied and the portion holds.
   * Thirds are rows 0–5, 6–11, then 12–17.
   */
  present(transfer: BgTransfer): void {
    if (!transfer.enabled) {
      transfer.tick();
      return;
    }
    const third = transfer.nextPortion;
    transfer.tick();
    this.copyShownThird(third);
  }

  /** SaveScreenTilesToBuffer1, including the message box's retained tiles and border. */
  save(textBox: TextBox): ScreenSnapshot {
    return { logical: this.logical.slice(), text: textBox.saveScreen() };
  }

  saveTiles(): ScreenTileSnapshot { return this.logical.slice(); }

  /** Retain scanout across a caller switch while tile copies stop automatic transfer. */
  saveVisibleTiles(): ScreenTileSnapshot { return this.shown.slice(); }
  restoreVisibleTiles(saved: ScreenTileSnapshot): void {
    if (saved.length !== this.shown.length) throw new Error('invalid visible tile snapshot');
    for (let i = 0; i < saved.length; i++) if (saved[i] !== null) this.shown[i] = saved[i];
  }

  /** Logical copy only; visible thirds still belong to the caller's transfer. */
  restoreTiles(saved: ScreenTileSnapshot): void {
    if (saved.length !== this.logical.length) throw new Error('invalid screen tile snapshot');
    for (let i = 0; i < this.logical.length; i++) this.logical[i] = saved[i];
  }

  /** LoadScreenTilesFromBuffer1: transfer off, copy both, transfer on. The portion does not move. */
  restore(saved: ScreenSnapshot, textBox: TextBox, transfer: BgTransfer): void {
    transfer.enabled = false;
    this.restoreTiles(saved.logical);
    textBox.restoreScreen(saved.text);
    transfer.enabled = true;
  }

  private cell(map: readonly (string | null)[], x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT) return null;
    return map[y * SCREEN_WIDTH + x];
  }
}
