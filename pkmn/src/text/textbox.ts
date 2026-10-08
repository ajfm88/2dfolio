import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { substituteNames } from '../core/player_state';
import { fillRect, drawTile, loadFont, loadTileset } from '../renderer';
import { isPressed, isHeld, syncJoypadRead } from '../input';
import { charToTile, extraCharToTile } from './charmap';
import { TextPrinter, TEXT_A, TEXT_B } from './text_printer';
import { textBgTransfer } from './bg_transfer';
import { playSFX, isSoundFinished } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';

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

/** text_end inside text_asm, or PromptText (home/text.asm). */
export type TextBoxEnd = 'none' | 'prompt';
export type TextBoxMode = 'legacy' | 'displayTextID' | 'printText';
export interface TextBoxOptions {
  end?: TextBoxEnd;
  mode?: TextBoxMode;
  /** TalkToTrainer calls PrintText inside the DisplayTextID opening. */
  printText?: boolean;
}

export class TextBox {
  private _active = false;
  private complete = false;
  private textComplete = false;
  private finalWait = false;
  private printer: TextPrinter | null = null;
  private run: Generator<void> | null = null;
  private frame = 0;
  private mode: TextBoxMode = 'legacy';
  private visible = Array<string>(20 * 6).fill(' ');

  get active(): boolean { return this._active; }
  /** The text's own terminator returned, before DisplayTextID's outer wait. */
  get isTextComplete(): boolean { return this.textComplete; }
  get isComplete(): boolean { return this.complete; }
  get isWaitingForInput(): boolean { return this.finalWait || !!this.printer?.waiting; }
  get hasMorePages(): boolean { return !this.finalWait && !!this.printer?.hasMore; }
  dismiss(): void { this._active = false; this.run = null; }

  show(text: string, opts: TextBoxOptions = {}): void {
    this.mode = opts.mode ?? 'legacy';
    this._active = true; this.complete = false; this.textComplete = false;
    this.finalWait = false; this.frame = 0; this.printer = null;
    this.visible.fill(' ');
    let message = substituteNames(text);
    // Explicit A1b endings take precedence; legacy battle/script strings cannot
    // acquire new waits from the map extractor's terminator.
    if (opts.end || this.mode === 'legacy') message = message.replace(/<(PROMPT|DONE)>$/, '');
    if (opts.end === 'prompt') message += '<PROMPT>';
    const joy = this.buttons();
    this.run = this.display(message, opts, joy);
    this.run.next();
  }
  private buttons(): number { return (isHeld('a') ? TEXT_A : 0) | (isHeld('b') ? TEXT_B : 0); }
  private *delay(frames: number): Generator<void> { for (let i = 0; i < frames; i++) yield; }
  private *display(text: string, opts: TextBoxOptions, joy: number): Generator<void> {
    if (this.mode === 'displayTextID') yield* this.delay(20);
    else if (this.mode === 'printText') yield* this.delay(3);
    else yield;
    if (opts.printText) yield* this.delay(3);
    this.printer = new TextPrinter(text, {
      buttons: () => this.buttons(), speed: () => textSpeed,
      soundFinished: isSoundFinished, beep: () => { playSFX('press_ab'); },
      joypadRead: syncJoypadRead,
    }, joy);
    while (!this.printer.complete) { yield; this.printer.advance(); }
    this.textComplete = true;
    if (opts.end || this.mode === 'printText') { this.complete = true; return; }
    this.finalWait = true;
    if (this.mode === 'displayTextID') {
      yield* this.printer.waitButton(false);
      yield* this.printer.holdA();
      // CloseTextDisplay's hWY write is visible after its DelayFrame.
      yield;
    } else {
      // The legacy caller's dismissal remains its existing press/beep behavior.
      while (!isPressed('a') && !isPressed('b')) yield;
      playSFX('press_ab');
    }
    this.finalWait = false; this._active = false;
  }
  /** One VBlank. Also called during retained script text's sound/button waits. */
  updateDisplay(): void {
    if (!this._active) return;
    if ((this.mode !== 'displayTextID' || this.frame >= 20) && textBgTransfer.tick() && this.printer)
      this.visible = this.printer.buffer.slice();
  }
  update(): void {
    if (!this._active) return;
    this.updateDisplay();
    this.frame++;
    if (!this.complete) this.run?.next();
  }
  render(): void {
    if (!this._active || !fontCanvas) return;
    // DisplayTextIDInit's font-loaded UpdateSprites sees the logical border at T,
    // even though the window does not become visible until render T+3 (scanout T+4).
    uiTiles.cover(BOX_X, BOX_Y, GB_WIDTH, BOX_HEIGHT * TILE_SIZE);
    if (this.mode === 'displayTextID' && this.frame < 3) return;
    fillRect(BOX_X, BOX_Y, GB_WIDTH, BOX_HEIGHT * TILE_SIZE, 0);
    drawTileBorder(BOX_X, BOX_Y, BOX_WIDTH, BOX_HEIGHT);
    for (let row = 1; row <= 4; row++) {
      for (let col = 1; col <= BOX_TEXT_WIDTH; col++) {
        const glyph = this.visible[row * 20 + col];
        const extra = extraCharToTile(glyph);
        const tile = extra >= 0 ? extra : charToTile(glyph);
        const canvas = extra >= 0 ? borderCanvas : fontCanvas;
        if (tile >= 0 && canvas) drawTile(canvas, tile, col * TILE_SIZE, BOX_Y + row * TILE_SIZE);
      }
    }
  }
}
