import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { substituteNames } from '../core/player_state';
import { fillRect, drawTile, loadFont, loadTileset } from '../renderer';
import { isHeld, syncJoypadRead } from '../input';
import { charToTile, extraCharToTile } from './charmap';
import { TextScreen, TEXT_A, TEXT_B, TEXT_BUFFER_SIZE } from './text_printer';
import { TextProgramRunner } from './text_runner';
import type { TextBindings, TextReturn, TextRunnerOptions } from './text_runner';
import { getTextPrograms } from './program_data';
import { CloseSequence } from './close_sequence';
import { setOpeningSpriteUpdates } from '../overworld/ui_entry';
import { textBgTransfer } from './bg_transfer';
import { loadMenuGlyphs } from '../menus/menu_glyphs';
import { playSFX, isSoundFinished } from '../audio';
import { uiTiles } from '../renderer/ui_tiles';
import type { CloseReload } from '../overworld/sprite_sets';

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
  await loadMenuGlyphs();
}

/** Reload the border tileset for the current palette (call after palette changes). */
export async function reloadBorderTiles(): Promise<void> {
  borderCanvas = await loadTileset('/gfx/font/font_extra.png');
  await loadMenuGlyphs();
}

/** Select a preloaded palette variant without asynchronous work in a frame program. */
export function useBorderTiles(canvas: HTMLCanvasElement): void { borderCanvas = canvas; }

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

type TextBoxMode = 'displayTextID' | 'printText';
export interface TextBoxOptions {
  /** TalkToTrainer calls PrintText inside the DisplayTextID opening. */
  printText?: boolean;
  autoBox?: boolean;
  program?: string;
}

export interface TextDisplayHost {
  /** Optional private owner, used by battle text; field callers retain the facade. */
  sound?: { play(name: string): void; finished(): boolean; beep(): void };
  /** CloseTextDisplay's cost on the current map; 'full' once BIT_FONT_LOADED is clear. */
  closeFrames(reload?: CloseReload): number;
  updateSprites(): void;
  /** Hook only: PrintText's own font-loaded UpdateSprites remains J2. */
  printTextSprites?(): void;
  cry?(species: string): void;
}
export type DisplayPhase = 'opening' | 'printing' | 'waiting' | 'holding' | 'closing' | 'closed';
/** Retained message-box tiles (wTileMap rows 12–17) and whether the border is up. */
export interface TextBoxScreen {
  buffer: string[];
  border: boolean;
}
export type TextSource = { text: string } | { program: string };

export class TextBox {
  private _active = false;
  private complete = false;
  private textComplete = false;
  private finalWait = false;
  private screen: TextScreen | null = null;
  private run: Generator<void> | null = null;
  private frame = 0;
  private mode: TextBoxMode = 'displayTextID';
  private revision = 0;
  private visible = Array<string>(20 * 6).fill(' ');
  private _phase: DisplayPhase = 'closed';
  private border = true;
  private closeSequence: CloseSequence | null = null;
  /** After an in-place CloseTextDisplay: no window, no AutoBgMapTransfer (TownMapText). */
  private windowOff = false;
  private host: TextDisplayHost;
  private closeStart: (() => void) | null = null;
  textReturn: TextReturn = 'returned';

  constructor(host: TextDisplayHost = { closeFrames: () => 7, updateSprites: () => {} }) {
    // Detached boxes default to the minimal walking set (Pikachu + player).
    // main.ts supplies the actual current-map host for every in-game display.
    this.host = host;
  }

  get active(): boolean { return this._active; }
  get phase(): DisplayPhase { return this._phase; }
  get closing(): boolean { return this._phase === 'closing'; }
  /** CloseTextDisplay has left the first frame: the window is no longer drawn. */
  get hidesWindow(): boolean {
    return this._phase === 'closing' && !!this.closeSequence && !this.closeSequence.firstFrame;
  }
  get displaySession(): boolean { return this.mode === 'displayTextID'; }
  /** A new DisplayTextID can begin in the same tick that the prior display closes. */
  get displayRevision(): number { return this.revision; }
  /** The text's own terminator returned, before DisplayTextID's outer wait. */
  get isTextComplete(): boolean { return this.textComplete; }
  get isComplete(): boolean { return this.complete; }
  get isWaitingForInput(): boolean { return this.finalWait || !!this.screen?.waiting; }
  get hasMorePages(): boolean { return !this.finalWait && !!this.screen?.hasMore; }
  /** The actual retained rectangle, independent of the previous rendered UI snapshot. */
  uiTileAt(x: number, y: number): number {
    return this.active && this.border && x >= 0 && x < BOX_WIDTH && y >= BOX_Y / TILE_SIZE && y < GB_HEIGHT / TILE_SIZE ? 0x60 : 0;
  }
  hideDisplay(): void {
    if (!this.active || !this.displaySession) throw new Error('LoadCurrentMapView requires an open display');
    this.border = false;
  }
  /** LoadScreenTilesFromBuffer1 back to the empty box saved after DisplayTextIDInit; the
   *  BG transfer shows it as it shows any write. */
  clearInterior(): void {
    if (!this.active || !this.screen) throw new Error('restoring the saved box requires an open display');
    this.screen.clearInterior(); this.screen.resetCursor();
  }
  /** wTileMap rows 12–17 and the border flag. Tiles only: the program, cursor and phase stay. */
  saveScreen(): TextBoxScreen {
    if (!this.active || !this.screen) throw new Error('saving the screen requires an open display');
    return { buffer: this.screen.buffer.slice(), border: this.border };
  }
  /** Writes a saved message box back. Does not restart a finished program or replay a prompt. */
  restoreScreen(saved: TextBoxScreen): void {
    if (!this.active || !this.screen) throw new Error('restoring the screen requires an open display');
    if (saved.buffer.length !== TEXT_BUFFER_SIZE) throw new Error('screen snapshot has the wrong size');
    for (let i = 0; i < TEXT_BUFFER_SIZE; i++) this.screen.buffer[i] = saved.buffer[i];
    this.border = saved.border;
  }
  restoreFacingAtClose(fn: () => void): void { this.closeStart = fn; }
  dismiss(): void { this._active = false; this.run = null; this._phase = 'closed'; this.closeSequence = null; }

  private reset(mode: TextBoxMode): void {
    this.mode = mode;
    if (mode === 'displayTextID') this.revision++;
    this._active = true; this.complete = false; this.textComplete = false;
    this.finalWait = false; this.frame = 0; this.border = true; this.closeSequence = null; this.windowOff = false;
    this.closeStart = null;
    this.visible.fill(' ');
    this.screen = new TextScreen(this.ports(), this.buttons());
  }
  private ports() {
    return { buttons: () => this.buttons(), speed: () => textSpeed,
      soundFinished: () => this.host.sound ? this.host.sound.finished() : isSoundFinished(),
      beep: () => { if (this.host.sound) this.host.sound.beep(); else playSFX('press_ab'); }, joypadRead: syncJoypadRead,
      playSound: (name: string) => { if (this.host.sound) this.host.sound.play(name); else playSFX(name); },
      cry: (species: string) => { this.host.cry?.(species); } };
  }
  private start(run: Generator<void>): void {
    this.complete = false; this.run = run; this.advance();
  }
  private advance(): void {
    if (this.run?.next().done) { this.complete = true; if (this.active) this._phase = 'waiting'; }
  }
  open(opts: { autoBox?: boolean; spriteUpdate?: boolean } = {}): void {
    this.reset('displayTextID');
    this.start(this.opening(opts));
  }
  private *opening(opts: { autoBox?: boolean; spriteUpdate?: boolean }): Generator<void> {
    this._phase = 'opening'; this.border = opts.autoBox ?? true;
    setOpeningSpriteUpdates(opts.spriteUpdate ?? true);
    yield* this.screen!.delay(20);
  }
  print(source: TextSource, opts: { box?: 'new' | 'keep'; bindings?: TextBindings; noDelay?: boolean } = {}): void {
    if (!this.active || !this.screen) throw new Error('PrintText requires an open display');
    this.textComplete = false;
    this.start(this.printing(source, opts));
  }
  /** Standalone PrintText: border at T, Delay3, then the program; retain its box on return.
   * BIT_NO_TEXT_DELAY skips letter delays only, never Delay3 or native waits. */
  printStandalone(source: TextSource, opts: TextRunnerOptions & { bindings?: TextBindings; noDelay?: boolean } = {}): void {
    if (!this.active || this.mode !== 'printText') this.reset('printText');
    this.textComplete = false;
    this.start(this.printing(source, { box: 'new', ...opts }));
  }
  private *printing(source: TextSource, opts: TextRunnerOptions & { box?: 'new' | 'keep'; bindings?: TextBindings; noDelay?: boolean }): Generator<void> {
    const screen = this.screen!;
    this._phase = 'printing';
    if ((opts.box ?? 'new') === 'new') {
      this.border = true; screen.clearInterior();
      this.host.printTextSprites?.(); // explicitly deferred, no sprite update unless a future caller supplies it
      yield* screen.delay(3);
    }
    screen.resetCursor();
    if ('program' in source) {
      const runner = new TextProgramRunner(screen, getTextPrograms(), this.ports());
      runner.setBattleNames(opts.actors);
      for (const [label, handler] of Object.entries(opts.asm ?? {})) runner.registerAsm(label, handler);
      this.textReturn = yield* runner.run(source.program, opts.bindings, opts.noDelay, opts.asmContinuations);
    } else {
      yield* screen.placeString(substituteNames(source.text), opts.noDelay);
      this.textReturn = 'returned';
    }
    this.textComplete = true;
  }
  waitSilent(): void { this.start(this.silentWait()); }
  private *silentWait(): Generator<void> {
    this._phase = 'waiting'; this.finalWait = true;
    yield* this.screen!.waitButton(false);
    this.finalWait = false;
  }
  finish(opts: { outerWait: boolean; reload?: CloseReload }): void {
    if (!this.active) { this.complete = true; return; }
    this.start(this.finishing(opts.outerWait, opts.reload));
  }
  private *finishing(outerWait: boolean, reload?: CloseReload): Generator<void> {
    if (outerWait) yield* this.silentWait();
    this._phase = 'holding';
    yield* this.screen!.holdA();
    yield* this.runClose(reload);
    this.dismiss();
  }
  private *runClose(reload?: CloseReload): Generator<void> {
    this._phase = 'closing'; this.finalWait = false;
    this.closeStart?.(); this.closeStart = null;
    this.closeSequence = new CloseSequence(this.host.closeFrames(reload), () => this.host.updateSprites());
    while (!this.closeSequence.complete) { yield; this.closeSequence.advance(); }
  }
  /**
   * CloseTextDisplay reached from inside the handler (TownMapText's `jp CloseTextDisplay`): the
   * whole close and its trailing UpdateSprites, after which DisplayTextID still runs Hold and
   * closes again. The window stays off ($90) and AutoBgMapTransfer stays disabled until then.
   */
  closeInPlace(): void {
    if (!this.active || !this.displaySession) throw new Error('CloseTextDisplay requires an open display');
    this.start(this.closingInPlace());
  }
  private *closingInPlace(): Generator<void> {
    yield* this.runClose();
    this.closeSequence = null; this.border = false; this.windowOff = true; this._phase = 'waiting';
  }

  /** DisplayTextID: preserve source terminators, then outer wait/Hold/CloseTextDisplay. */
  show(text: string, opts: TextBoxOptions = {}): void {
    this.reset('displayTextID');
    this.start(this.display(text, opts));
  }
  private buttons(): number { return (isHeld('a') ? TEXT_A : 0) | (isHeld('b') ? TEXT_B : 0); }
  private *display(text: string, opts: TextBoxOptions): Generator<void> {
    yield* this.opening({ autoBox: opts.autoBox });
    yield* this.printing(opts.program ? { program: opts.program } : { text }, { box: opts.printText ? 'new' : 'keep' });
    this.finalWait = true;
    yield* this.finishing(true);
  }
  /** One VBlank. Also called during retained script text's sound/button waits. */
  updateDisplay(): void {
    if (!this._active || this.windowOff) return;
    if (this.closing && !this.closeSequence!.firstFrame) return;
    if ((this.mode !== 'displayTextID' || this.frame >= 20) && textBgTransfer.tick() && this.screen)
      this.visible = this.screen.buffer.slice();
  }
  update(): void {
    if (!this._active) return;
    this.updateDisplay();
    this.frame++;
    if (!this.complete) this.advance();
  }
  render(): void {
    if (!this._active || !fontCanvas || !this.border) return;
    // DisplayTextIDInit's font-loaded UpdateSprites sees the logical border at T,
    // even though the window does not become visible until render T+3 (scanout T+4).
    uiTiles.cover(BOX_X, BOX_Y, GB_WIDTH, BOX_HEIGHT * TILE_SIZE);
    if (this.closing && !this.closeSequence!.firstFrame) return;
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
