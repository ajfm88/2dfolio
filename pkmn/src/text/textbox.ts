import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { substituteNames } from '../core/player_state';
import { fillRect, drawTile, loadFont, loadTileset } from '../renderer';
import { isPressed, isHeld } from '../input';
import { charToTile } from './charmap';
import { playSFX } from '../audio';

// Text box dimensions (in tiles)
// Original Game Boy: TextBoxBorder with b=4 (inner height) + 2 border rows = 6 tiles total
// Text placed at rows 2 and 4 (coord hl, 1, 14 and coord hl, 1, 16 for box starting at row 12)
const BOX_WIDTH = 20;     // full screen width
const BOX_TEXT_WIDTH = 18; // interior text area (minus borders)
const BOX_HEIGHT = 6;     // border + 4 inner rows + border (matches assembly)

// Position: bottom of screen (row 12 of 18 = y=96)
const BOX_X = 0;
const BOX_Y = GB_HEIGHT - BOX_HEIGHT * TILE_SIZE; // 144 - 48 = 96

// Text speed: frames per character (matching assembly wOptions & $F)
// FAST=1, MEDIUM=3, SLOW=5. Default is MEDIUM.
// Holding A/B reduces to 1 frame per character (not instant).
const TEXT_DELAY_FAST = 1;
const TEXT_DELAY_MEDIUM = 3;
const TEXT_DELAY_SLOW = 5;
let textSpeed = TEXT_DELAY_MEDIUM;

/** Set text speed: 'fast' (1), 'medium' (3), or 'slow' (5) frames per character. */
export function setTextSpeed(speed: 'fast' | 'medium' | 'slow'): void {
  textSpeed = speed === 'fast' ? TEXT_DELAY_FAST : speed === 'slow' ? TEXT_DELAY_SLOW : TEXT_DELAY_MEDIUM;
}

/** Get current text speed setting name. */
export function getTextSpeed(): 'fast' | 'medium' | 'slow' {
  if (textSpeed <= TEXT_DELAY_FAST) return 'fast';
  if (textSpeed >= TEXT_DELAY_SLOW) return 'slow';
  return 'medium';
}

let fontCanvas: HTMLCanvasElement | null = null;
let borderCanvas: HTMLCanvasElement | null = null;

// Border tile indices in font_extra.png (charmap $79-$7E, loaded at tile $60)
const BORDER_TL = 25;  // ┌ top-left corner
const BORDER_H  = 26;  // ─ horizontal
const BORDER_TR = 27;  // ┐ top-right corner
const BORDER_V  = 28;  // │ vertical
const BORDER_BL = 29;  // └ bottom-left corner
const BORDER_BR = 30;  // ┘ bottom-right corner

export async function initTextSystem(): Promise<void> {
  fontCanvas = await loadFont('/gfx/font/font.png');
  // Border tiles use the current area palette (like map tiles) — not the 1-bit font loader.
  // loadTileset remaps the 2bpp grayscale to palette colors, matching the original Game Boy.
  borderCanvas = await loadTileset('/gfx/font/font_extra.png');
}

/** Reload the border tileset for the current palette (call after palette changes). */
export async function reloadBorderTiles(): Promise<void> {
  borderCanvas = await loadTileset('/gfx/font/font_extra.png');
}

/** Draw a tile-based border box at any position (reusable for battle text, menus, etc.).
 *  widthTiles and heightTiles include the border tiles themselves. */
export function drawTileBorder(x: number, y: number, widthTiles: number, heightTiles: number): void {
  if (!borderCanvas) return;
  // Top row
  drawTile(borderCanvas, BORDER_TL, x, y);
  for (let i = 1; i < widthTiles - 1; i++) {
    drawTile(borderCanvas, BORDER_H, x + i * TILE_SIZE, y);
  }
  drawTile(borderCanvas, BORDER_TR, x + (widthTiles - 1) * TILE_SIZE, y);
  // Middle rows
  for (let row = 1; row < heightTiles - 1; row++) {
    drawTile(borderCanvas, BORDER_V, x, y + row * TILE_SIZE);
    drawTile(borderCanvas, BORDER_V, x + (widthTiles - 1) * TILE_SIZE, y + row * TILE_SIZE);
  }
  // Bottom row
  drawTile(borderCanvas, BORDER_BL, x, y + (heightTiles - 1) * TILE_SIZE);
  for (let i = 1; i < widthTiles - 1; i++) {
    drawTile(borderCanvas, BORDER_H, x + i * TILE_SIZE, y + (heightTiles - 1) * TILE_SIZE);
  }
  drawTile(borderCanvas, BORDER_BR, x + (widthTiles - 1) * TILE_SIZE, y + (heightTiles - 1) * TILE_SIZE);
}

export function getFontCanvas(): HTMLCanvasElement | null {
  return fontCanvas;
}

export function getBorderCanvas(): HTMLCanvasElement | null {
  return borderCanvas;
}

/** Word-wrap a single line to fit BOX_TEXT_WIDTH characters. */
function wrapLine(line: string): string[] {
  if (line.length <= BOX_TEXT_WIDTH) return [line];
  const words = line.split(' ');
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= BOX_TEXT_WIDTH) {
      current += ' ' + word;
    } else {
      result.push(current);
      current = word;
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

/**
 * Process text into display lines.
 * - \n = explicit line break (assembly `line` / `cont`)
 * - \f = paragraph break (assembly `para` — clears the text box)
 * - Long lines without \n are word-wrapped automatically.
 *
 * Returns an array of lines. Paragraph breaks are represented as null entries.
 */
function processText(text: string): (string | null)[] {
  const paragraphs = text.split('\f');
  const result: (string | null)[] = [];
  for (let pi = 0; pi < paragraphs.length; pi++) {
    if (pi > 0) result.push(null); // paragraph break marker
    const explicitLines = paragraphs[pi].split('\n');
    for (const line of explicitLines) {
      result.push(...wrapLine(line));
    }
  }
  return result;
}

export class TextBox {
  // Lines to display. null = paragraph break (clear box).
  private lines: (string | null)[] = [];
  private topLine = 0;          // index of the line shown on row 1
  private charIndex = 0;        // characters revealed on the SECOND line of current view
  private firstLineRevealed = false; // true once line 1 is fully typed
  private frameCount = 0;
  private _active = false;
  private waitingForInput = false;
  private blinkTimer = 0;

  get active(): boolean { return this._active; }
  get isWaitingForInput(): boolean { return this.waitingForInput; }
  get hasMorePages(): boolean { return this.hasMore(); }
  dismiss(): void { this._active = false; }

  show(text: string): void {
    this.lines = processText(substituteNames(text));
    this.topLine = 0;
    this.charIndex = 0;
    this.firstLineRevealed = false;
    this.frameCount = 0;
    this._active = true;
    this.waitingForInput = false;
  }

  /** Get the two display lines for the current view position. */
  private getDisplayLines(): [string, string] {
    const line1 = this.lines[this.topLine];
    const line2 = this.topLine + 1 < this.lines.length ? this.lines[this.topLine + 1] : null;
    return [
      (line1 !== null && line1 !== undefined) ? line1 : '',
      (line2 !== null && line2 !== undefined) ? line2 : '',
    ];
  }

  /** Check if there are more lines after the current 2-line view. */
  private hasMore(): boolean {
    return this.topLine + 2 < this.lines.length;
  }

  update(): void {
    if (!this._active) return;

    if (this.waitingForInput) {
      this.blinkTimer++;
      if (isPressed('a') || isPressed('b')) {
        playSFX('press_ab');
        if (!this.hasMore()) {
          // No more lines — close
          this._active = false;
          return;
        }

        // Advance: scroll by 1 line (like `cont` in the original)
        this.topLine++;
        this.charIndex = 0;
        this.frameCount = 0;
        this.waitingForInput = false;

        if (this.lines[this.topLine] === null) {
          // Current line1 IS the paragraph break — skip past null, type fresh
          this.topLine++;
          this.firstLineRevealed = false;
        } else if (this.topLine + 1 < this.lines.length && this.lines[this.topLine + 1] === null) {
          // Line2 is a paragraph break — skip ahead to clear box
          this.topLine += 2;
          this.firstLineRevealed = false;
        } else {
          // Normal scroll: line 1 was already visible, only type new line 2
          this.firstLineRevealed = true;
        }
      }
      return;
    }

    // Reveal characters — holding A or B reduces delay to 1 frame per char
    // (assembly: PrintLetterDelay checks A/B held → DelayFrame → skip remaining delay)
    const held = isHeld('a') || isHeld('b');
    const delay = held ? 1 : textSpeed;
    this.frameCount++;
    if (this.frameCount >= delay) {
      this.frameCount = 0;

      const [line1, line2] = this.getDisplayLines();

      if (!this.firstLineRevealed) {
        // Typing line 1
        this.charIndex++;
        if (this.charIndex >= line1.length) {
          this.firstLineRevealed = true;
          this.charIndex = 0;
        }
      } else {
        // Typing line 2
        this.charIndex++;
        if (this.charIndex >= line2.length) {
          this.waitingForInput = true;
          this.blinkTimer = 0;
        }
      }
    }
  }

  render(): void {
    if (!this._active || !fontCanvas) return;

    // Draw text box background (lightest color)
    fillRect(BOX_X, BOX_Y, GB_WIDTH, BOX_HEIGHT * TILE_SIZE, 0);

    // Draw tile-based border from font_extra.png (matches original Game Boy textbox)
    if (borderCanvas) {
      // Top row: ┌ + 18× ─ + ┐
      drawTile(borderCanvas, BORDER_TL, BOX_X, BOX_Y);
      for (let i = 1; i < BOX_WIDTH - 1; i++) {
        drawTile(borderCanvas, BORDER_H, BOX_X + i * TILE_SIZE, BOX_Y);
      }
      drawTile(borderCanvas, BORDER_TR, BOX_X + (BOX_WIDTH - 1) * TILE_SIZE, BOX_Y);

      // Middle rows: │ + (white interior) + │
      for (let row = 1; row < BOX_HEIGHT - 1; row++) {
        drawTile(borderCanvas, BORDER_V, BOX_X, BOX_Y + row * TILE_SIZE);
        drawTile(borderCanvas, BORDER_V, BOX_X + (BOX_WIDTH - 1) * TILE_SIZE, BOX_Y + row * TILE_SIZE);
      }

      // Bottom row: └ + 18× ─ + ┘
      drawTile(borderCanvas, BORDER_BL, BOX_X, BOX_Y + (BOX_HEIGHT - 1) * TILE_SIZE);
      for (let i = 1; i < BOX_WIDTH - 1; i++) {
        drawTile(borderCanvas, BORDER_H, BOX_X + i * TILE_SIZE, BOX_Y + (BOX_HEIGHT - 1) * TILE_SIZE);
      }
      drawTile(borderCanvas, BORDER_BR, BOX_X + (BOX_WIDTH - 1) * TILE_SIZE, BOX_Y + (BOX_HEIGHT - 1) * TILE_SIZE);
    }

    const [line1, line2] = this.getDisplayLines();
    const textX = BOX_X + TILE_SIZE;

    // Render line 1 (row 2 of box, matching assembly coord hl, 1, 14)
    const line1Len = this.firstLineRevealed ? line1.length : this.charIndex;
    this.renderLine(line1, textX, BOX_Y + TILE_SIZE * 2, line1Len);

    // Render line 2 (row 4 of box, matching assembly coord hl, 1, 16)
    if (this.firstLineRevealed) {
      const line2Len = this.waitingForInput ? line2.length : this.charIndex;
      this.renderLine(line2, textX, BOX_Y + TILE_SIZE * 4, line2Len);
    }

    // Draw blinking ▼ prompt arrow when waiting for input and there's more text
    // Assembly ref: HandleDownArrowBlinkTiming at hlcoord 18, 16
    if (this.waitingForInput && this.hasMore()) {
      const BLINK_HALF_PERIOD = 16; // frames per blink state (~0.27s on, ~0.27s off)
      const visible = Math.floor(this.blinkTimer / BLINK_HALF_PERIOD) % 2 === 0;
      if (visible) {
        const arrowTile = charToTile('▼');
        if (arrowTile >= 0) {
          const arrowX = 18 * TILE_SIZE;          // column 18 (assembly: ldcoord_a 18, 16)
          const arrowY = BOX_Y + TILE_SIZE * 4;   // row 16 = second text line
          drawTile(fontCanvas!, arrowTile, arrowX, arrowY);
        }
      }
    }
  }

  private renderLine(line: string, x: number, y: number, charCount: number): void {
    if (!fontCanvas) return;
    for (let i = 0; i < charCount && i < line.length; i++) {
      const tileId = charToTile(line[i]);
      if (tileId >= 0) {
        drawTile(fontCanvas, tileId, x + i * TILE_SIZE, y);
      }
    }
  }
}
