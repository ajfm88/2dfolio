// wTileMap for menus (home/tilemap.asm, home/text.asm TextBoxBorder, home/print_bcd.asm).
// null means no menu wrote that cell: rows 0–11 show the map, rows 12–17 show the TextBox.
// A visible copy changes only when a third is transferred (home/vcopy.asm).

import { textBoxBorder, placeString, clearArea, writeBcd, writeNumber, printLevel } from './tile_surface';
import type { BcdWrite, NumberWrite } from './tile_surface';
export type { BcdWrite, NumberWrite } from './tile_surface';
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
  textBoxBorder(x: number, y: number, innerH: number, innerW: number): void { textBoxBorder(this, x, y, innerH, innerW); }

  /** PlaceString. `<NEXT>` advances two rows and returns to this x. `@` ends the string. */
  placeString(x: number, y: number, text: string): void { placeString(this, x, y, text); }

  /** ClearScreenArea: c×b spaces at (x, y). */
  clearArea(x: number, y: number, height: number, width: number): void { clearArea(this, x, y, height, width); }

  /** Give those cells back to the map or the message box. */
  release(x: number, y: number, height: number, width: number): void {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) this.put(x + col, y + row, null);
    }
  }

  /** PrintBCDNumber. Suppressed cells are skipped; an all-zero right-aligned value backs up one. */
  writeBcd(x: number, y: number, value: number, flags: BcdWrite): void { writeBcd(this, x, y, value, flags); }

  /** PrintNumber (1–3 bytes). Suppressed leading cells are skipped; the ones digit is always written. */
  writeNumber(x: number, y: number, value: number, flags: NumberWrite): void { writeNumber(this, x, y, value, flags); }

  /** PrintLevel: left-aligned, with the hundreds digit overwriting <LV> at 100. */
  printLevel(x: number, y: number, level: number): void { printLevel(this, x, y, level); }

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
