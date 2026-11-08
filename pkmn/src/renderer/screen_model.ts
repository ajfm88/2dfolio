// The tile-map core shared by IntroScreen, TransitionScreen and BattleScreen (DECISIONS #104, note 86).
// wTileMap (the CPU's 20 × 18 cells) and the cells VBlank has shown; AutoBgMapTransfer's thirds
// (home/vcopy.asm); CopyVideoData's eight tiles per serviced VBlank (home/copy2.asm:41-103); and the
// standalone PrintText capture of the message box. The models own their registers, VRAM, OAM and order.
import { textBgTransfer } from '../text/bg_transfer';
import type { TextBox } from '../text/textbox';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../menus/screen_tiles';
import { textBoxBorder } from '../menus/tile_surface';

export const SCREEN_CELLS = SCREEN_WIDTH * SCREEN_HEIGHT;
/** AutoBgMapTransfer copies six rows per VBlank. */
export const THIRD_CELLS = 6 * SCREEN_WIDTH;

/** wTileMap and the shown copy. Only transferThird moves cells from one to the other. */
export class TileMap<C> {
  private readonly logical: C[];
  private readonly shown: C[];

  constructor(initial: (index: number) => C) {
    this.logical = Array.from({ length: SCREEN_CELLS }, (_, index) => initial(index));
    this.shown = this.logical.slice();
  }

  get cells(): readonly C[] { return this.logical.slice(); }
  get visibleCells(): readonly C[] { return this.shown.slice(); }
  at(x: number, y: number): C | null { return inside(x, y) ? this.logical[y * SCREEN_WIDTH + x] : null; }
  visibleAt(x: number, y: number): C | null { return inside(x, y) ? this.shown[y * SCREEN_WIDTH + x] : null; }
  /** A CPU write by coordinates. Off-screen writes are dropped. */
  put(x: number, y: number, value: C): void {
    if (inside(x, y)) this.logical[y * SCREEN_WIDTH + x] = value;
  }
  /** A CPU write through a wTileMap pointer. The caller owns any pointer outside 0–359. */
  get(index: number): C { return this.logical[index]; }
  set(index: number, value: C): void { this.logical[index] = value; }
  fill(value: C): void { this.logical.fill(value); }
  /** Scanout already blank on its own clock (naming's cleared window). */
  fillShown(value: C): void { this.shown.fill(value); }

  /**
   * AutoBgMapTransfer's copy, without the tick: the third it copies now, or null while disabled. By default the
   * cells go to the shown copy; a destination writer receives each wTileMap index instead (BattleScreen's BG0).
   */
  transferThird(destination?: (index: number, cell: C) => void): number | null {
    if (!textBgTransfer.enabled) return null;
    const third = textBgTransfer.nextPortion;
    const start = third * THIRD_CELLS;
    for (let index = start; index < start + THIRD_CELLS; index++) {
      if (destination) destination(index, this.logical[index]);
      else this.shown[index] = this.logical[index];
    }
    return third;
  }
}

/** CopyVideoData: eight tiles per serviced VBlank, floor(n/8)+1 frames; none with the LCD off. */
export class VideoCopyQueue {
  private job: { write: (index: number) => void; next: number; total: number } | null = null;

  constructor(private readonly busyMessage: string) {}

  get active(): boolean { return this.job !== null; }

  /** Disables automatic transfer for the copy and restores the caller's byte on return, as the ROM does. */
  *copy(total: number, write: (index: number) => void, immediate = false): Generator<void> {
    if (this.job) throw new Error(this.busyMessage);
    const enabled = textBgTransfer.enabled;
    textBgTransfer.enabled = false;
    try {
      if (immediate) {
        for (let index = 0; index < total; index++) write(index);
        return;
      }
      this.job = { write, next: 0, total };
      const frames = Math.floor(total / 8) + 1;
      for (let frame = 0; frame < frames; frame++) yield;
    } finally {
      this.job = null;
      textBgTransfer.enabled = enabled;
    }
  }

  /** The VBlank half: up to eight more tiles. */
  service(): void {
    if (!this.job) return;
    const end = Math.min(this.job.total, this.job.next + 8);
    while (this.job.next < end) this.job.write(this.job.next++);
  }
}

/**
 * Standalone PrintText's message box into wTileMap: TextBoxBorder(0, 12, 4, 18), then the printer's inner 4 × 18.
 * The printer buffer holds spaces at the border positions, so the border is drawn, not copied (note 66 §10).
 */
export function captureTextBox(map: TileMap<string | number>, box?: TextBox): void {
  if (!box?.active) return;
  const snapshot = box.saveScreen();
  if (!snapshot.border) return;
  textBoxBorder({ at: (x, y) => map.at(x, y), put: (x, y, value) => { if (value !== null) map.put(x, y, value); } }, 0, 12, 4, 18);
  for (let row = 1; row <= 4; row++) for (let col = 1; col <= 18; col++)
    map.put(col, 12 + row, snapshot.buffer[row * 20 + col]);
}

function inside(x: number, y: number): boolean {
  return x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT;
}
