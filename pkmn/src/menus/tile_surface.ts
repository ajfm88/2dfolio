// Shared tile writers (home/text.asm, print_bcd.asm and window.asm).
import { tokenizeGlyphs } from '../text/charmap';
import { LEVEL_GLYPH } from './menu_glyph_ids';

export type TileCell = string | number | null;
export interface TileSurface {
  at(x: number, y: number): TileCell;
  put(x: number, y: number, value: TileCell): void;
}

/** WRAM cursor bytes, including the old tile and the stored cursor address. */
export interface MenuCursorState {
  topX: number;
  topY: number;
  rowStep?: 1 | 2;
  item: number;
  lastItem: number;
  tileBehind: TileCell;
  location: { x: number; y: number } | null;
}

export function placeMenuCursor(surface: TileSurface, state: MenuCursorState): void {
  const step = state.rowStep ?? 2;
  const oldY = state.topY + step * state.lastItem;
  if (surface.at(state.topX, oldY) === '▶') surface.put(state.topX, oldY, state.tileBehind);
  const y = state.topY + step * state.item;
  const tile = surface.at(state.topX, y);
  if (tile !== '▶') state.tileBehind = tile;
  surface.put(state.topX, y, '▶');
  state.location = { x: state.topX, y };
  state.lastItem = state.item;
}

export function eraseMenuCursor(surface: TileSurface, state: MenuCursorState): void {
  if (state.location) surface.put(state.location.x, state.location.y, ' ');
}

export function placeUnfilledArrowMenuCursor(surface: TileSurface, state: MenuCursorState): void {
  if (state.location) surface.put(state.location.x, state.location.y, '▷');
}

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

export function textBoxBorder(surface: TileSurface, x: number, y: number, innerH: number, innerW: number): void {
  surface.put(x, y, '┌');
  for (let i = 0; i < innerW; i++) surface.put(x + 1 + i, y, '─');
  surface.put(x + innerW + 1, y, '┐');
  for (let row = 0; row < innerH; row++) {
    surface.put(x, y + 1 + row, '│');
    for (let i = 0; i < innerW; i++) surface.put(x + 1 + i, y + 1 + row, ' ');
    surface.put(x + innerW + 1, y + 1 + row, '│');
  }
  const bottom = y + innerH + 1;
  surface.put(x, bottom, '└');
  for (let i = 0; i < innerW; i++) surface.put(x + 1 + i, bottom, '─');
  surface.put(x + innerW + 1, bottom, '┘');
}

export function placeString(surface: TileSurface, x: number, y: number, text: string, rowStep: 1 | 2 = 2): void {
  const body = text.endsWith('@') ? text.slice(0, -1) : text;
  const lines = body.split('<NEXT>');
  for (let line = 0; line < lines.length; line++) {
    let col = x;
    for (const glyph of tokenizeGlyphs(lines[line])) surface.put(col++, y + line * rowStep, glyph);
  }
}

export function clearArea(surface: TileSurface, x: number, y: number, height: number, width: number): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) surface.put(x + col, y + row, ' ');
  }
}

export function writeBcd(surface: TileSurface, x: number, y: number, value: number, flags: BcdWrite): void {
  let suppress = flags.suppressZero;
  let col = x;
  const write = (glyph: string) => { surface.put(col, y, glyph); col++; };
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

export function writeNumber(surface: TileSurface, x: number, y: number, value: number, flags: NumberWrite): void {
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
    surface.put(col, y, digit);
    col++;
    past = true;
  }
}

export function printLevel(surface: TileSurface, x: number, y: number, level: number): void {
  if (level < 100) surface.put(x, y, LEVEL_GLYPH);
  placeString(surface, level < 100 ? x + 1 : x, y, String(level));
}
