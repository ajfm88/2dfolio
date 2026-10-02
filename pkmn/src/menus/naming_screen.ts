// Naming screen — full alphabet grid for entering player/rival names
// Assembly ref: engine/menus/naming_screen.asm
// Layout: label at top, name+underscores at (10,2)-(10,3),
// bordered textbox from (0,4) with alphabet grid inside

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { fillRect, drawTile, loadFont, loadTileset } from '../renderer';
import { isPressed } from '../input';
import { drawTileBorder, getFontCanvas } from '../text';
import { drawText, drawChar } from './menu_render';
import { playSFX } from '../audio';

const MAX_NAME_LENGTH = 7; // PLAYER_NAME_LENGTH - 1 in assembly

// Alphabet grids (from data/text/alphabets.asm)
const UPPER_ROWS: string[] = [
  'ABCDEFGHI',
  'JKLMNOPQR',
  'STUVWXYZ ',
];
const LOWER_ROWS: string[] = [
  'abcdefghi',
  'jklmnopqr',
  'stuvwxyz ',
];
// Shared symbol rows (same for upper/lower)
// Row 3: × ( ) : ; [ ] <PK> <MN>
// Row 4: - ? ! ♂ ♀ / . , [ED]
const SYMBOL_ROW_3 = '\u00D7():;[]\u{E001}\u{E002}';
const SYMBOL_ROW_4 = '-?!\u2642\u2640/.,\0'; // \0 = ED placeholder

const GRID_COLS = 9;
const GRID_ROWS = 5; // 5 rows of characters
const CASE_ROW = 5;  // row index for case toggle

// Tile positions from assembly
const LABEL_X = 1;      // tile column
const LABEL_Y = 1;      // tile row
const NAME_X = 10;      // tile column for name display
const NAME_Y = 2;       // tile row for name
const UNDER_Y = 3;      // tile row for underscores
const BOX_Y = 4;        // tile row for textbox top
const BOX_H = 11;       // total box height in tiles (inner 9 + 2 border)
const GRID_X = 2;       // tile column for first grid char
const GRID_Y = 5;       // tile row for first grid row
const GRID_DX = 2;      // tile spacing between columns
const GRID_DY = 2;      // tile spacing between rows
const CASE_Y = 15;      // tile row for case toggle text

// Underscore tile indices in font_battle_extra.png
// Assembly: LoadHpBarAndStatusTilePatterns loads font_battle_extra.png at VRAM $62
// Tile $76 (index 20) = regular underscore, Tile $77 (index 21) = raised underscore (cursor)
const UNDERSCORE_TILE = 20;      // $76 - $62
const RAISED_UNDERSCORE_TILE = 21; // $77 - $62

// Canvas for underscore tiles (font_battle_extra.png loaded via loadTileset)
let underscoreCanvas: HTMLCanvasElement | null = null;

// ED tile — loaded separately from gfx/font/ED.png
let edTileCanvas: HTMLCanvasElement | null = null;

export async function loadEdTile(): Promise<void> {
  [edTileCanvas, underscoreCanvas] = await Promise.all([
    loadFont('/gfx/font/ED.png'),
    loadTileset('/gfx/font/font_battle_extra.png'),
  ]);
}

export type NamingScreenType = 'player' | 'rival';

export class NamingScreen {
  private type: NamingScreenType = 'player';
  private name = '';
  private cursorRow = 0;
  private cursorCol = 0;
  private uppercase = true;
  private _active = false;
  private _result: string | null = null;

  get active(): boolean { return this._active; }
  get result(): string | null { return this._result; }

  show(type: NamingScreenType): void {
    this.type = type;
    this.name = '';
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.uppercase = true;
    this._active = true;
    this._result = null;
  }

  update(): 'done' | null {
    if (!this._active) return null;

    // Navigation
    if (isPressed('up')) {
      if (this.cursorRow === 0) {
        this.cursorRow = CASE_ROW;
        this.cursorCol = 0;
      } else {
        this.cursorRow--;
      }
    } else if (isPressed('down')) {
      if (this.cursorRow >= CASE_ROW) {
        this.cursorRow = 0;
      } else if (this.cursorRow === GRID_ROWS - 1) {
        this.cursorRow = CASE_ROW;
        this.cursorCol = 0;
      } else {
        this.cursorRow++;
      }
    } else if (isPressed('left') && this.cursorRow < CASE_ROW) {
      this.cursorCol = this.cursorCol === 0 ? GRID_COLS - 1 : this.cursorCol - 1;
    } else if (isPressed('right') && this.cursorRow < CASE_ROW) {
      this.cursorCol = this.cursorCol === GRID_COLS - 1 ? 0 : this.cursorCol + 1;
    }

    // Start = submit
    if (isPressed('start')) {
      return this.submitName();
    }

    // Select = toggle case
    if (isPressed('select')) {
      this.uppercase = !this.uppercase;
    }

    // A = select character or action
    if (isPressed('a')) {
      playSFX('press_ab');
      if (this.cursorRow >= CASE_ROW) {
        // Case toggle
        this.uppercase = !this.uppercase;
      } else {
        const ch = this.getCharAtCursor();
        if (ch === '\0') {
          // ED button — submit
          return this.submitName();
        } else if (this.name.length < MAX_NAME_LENGTH) {
          this.name += ch;
          // Auto-switch to lowercase after first uppercase character
          if (this.name.length === 1 && this.uppercase) {
            this.uppercase = false;
          }
        }
        // Auto-move to ED when name is full
        if (this.name.length >= MAX_NAME_LENGTH) {
          this.cursorRow = 4;
          this.cursorCol = 8;
        }
      }
    }

    // B = delete last character
    if (isPressed('b')) {
      playSFX('press_ab');
      if (this.name.length > 0) {
        this.name = this.name.slice(0, -1);
      }
    }

    return null;
  }

  private submitName(): 'done' | null {
    if (this.name.length === 0) return null;
    this._result = this.name;
    this._active = false;
    return 'done';
  }

  private getCharAtCursor(): string {
    const grid = this.getGrid();
    if (this.cursorRow >= grid.length) return '\0';
    return grid[this.cursorRow][this.cursorCol] ?? '\0';
  }

  private getGrid(): string[] {
    const letterRows = this.uppercase ? UPPER_ROWS : LOWER_ROWS;
    return [...letterRows, SYMBOL_ROW_3, SYMBOL_ROW_4];
  }

  render(): void {
    if (!this._active) return;
    const fontCanvas = getFontCanvas();
    if (!fontCanvas) return;

    const T = TILE_SIZE;

    // Clear screen
    fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);

    // Label: "YOUR NAME?" or "RIVAL's NAME?"
    const label = this.type === 'player' ? 'YOUR NAME?' : "RIVAL's NAME?";
    drawText(label, LABEL_X * T, LABEL_Y * T);

    // Current name
    if (this.name.length > 0) {
      drawText(this.name, NAME_X * T, NAME_Y * T);
    }

    // Underscores below name — from font_battle_extra.png
    // Assembly: tile $76 = regular underscore, tile $77 = raised underscore (cursor position)
    if (underscoreCanvas) {
      for (let i = 0; i < MAX_NAME_LENGTH; i++) {
        const ux = (NAME_X + i) * T;
        const isCurrentPos = i === this.name.length && this.name.length < MAX_NAME_LENGTH;
        drawTile(underscoreCanvas, isCurrentPos ? RAISED_UNDERSCORE_TILE : UNDERSCORE_TILE, ux, UNDER_Y * T);
      }
    }

    // Bordered text box for alphabet area
    fillRect(0, BOX_Y * T, GB_WIDTH, BOX_H * T, 0);
    drawTileBorder(0, BOX_Y * T, 20, BOX_H);

    // Fill interior white
    fillRect(T, (BOX_Y + 1) * T, 18 * T, (BOX_H - 2) * T, 0);

    // Draw alphabet grid
    const grid = this.getGrid();
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowStr = grid[row];
      for (let col = 0; col < GRID_COLS; col++) {
        const ch = rowStr[col];
        const px = (GRID_X + col * GRID_DX) * T;
        const py = (GRID_Y + row * GRID_DY) * T;
        if (ch === '\0') {
          // ED button: draw the special ED glyph tile
          if (edTileCanvas) {
            drawTile(edTileCanvas, 0, px, py);
          } else {
            drawText('ED', px, py);
          }
        } else {
          drawChar(ch, px, py);
        }
      }
    }

    // Case toggle text below the box
    const caseText = this.uppercase ? 'lower case' : 'UPPER CASE';
    drawText(caseText, GRID_X * T, CASE_Y * T);

    // Draw cursor
    if (this.cursorRow < CASE_ROW) {
      const cx = (GRID_X + this.cursorCol * GRID_DX - 1) * T;
      const cy = (GRID_Y + this.cursorRow * GRID_DY) * T;
      drawChar('\u25B6', cx, cy);
    } else {
      // Cursor on case toggle
      drawChar('\u25B6', (GRID_X - 1) * T, CASE_Y * T);
    }
  }
}
