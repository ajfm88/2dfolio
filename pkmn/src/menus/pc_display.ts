// Retained PC PrintText, waits and cursor operations shared by both PC menus.
import { isSoundFinished, playSFX } from '../audio';
import type { TextBox } from '../text/textbox';
import type { TextBindings } from '../text/text_runner';
import type { BgTransfer } from '../text/bg_transfer';
import { getNoTextDelay } from '../text/text_flags';
import type { ScreenTiles } from './screen_tiles';
import type { MenuInput } from './menu_input';

export class PcDisplay {
  protected menu: MenuInput | null = null;
  protected cursor: { x: number; y: number } | null = null;
  protected afterPrint: (() => void) | null = null;
  protected afterSound: (() => void) | null = null;
  protected sound: { name: string; started: boolean; waitCurrent: boolean } | null = null;
  protected delayed: { remaining: number; then: () => void } | null = null;

  constructor(
    readonly tiles: ScreenTiles,
    protected readonly textBox: TextBox,
    protected readonly transfer: BgTransfer,
    protected readonly onSprites: () => void,
  ) {}

  get advanceText(): boolean { return this.afterPrint !== null; }

  /** A continuation returns in this CPU frame; never read menu input again here. */
  protected advancePending(): boolean {
    if (this.delayed) {
      if (--this.delayed.remaining === 0) {
        const next = this.delayed.then; this.delayed = null; next();
      }
    } else if (this.afterPrint) {
      if (this.textBox.isComplete) {
        const next = this.afterPrint; this.afterPrint = null; next();
      }
    } else if (this.sound) this.advanceSound();
    else return false;
    return true;
  }

  protected print(program: string, after: () => void, bindings?: TextBindings): void {
    this.tiles.release(0, 12, 6, 20);
    this.textBox.print({ program }, { bindings, noDelay: getNoTextDelay() });
    // PrintText's font-loaded UpdateSprites: box exists now, before Delay3/glyphs.
    this.onSprites();
    this.afterPrint = after;
  }

  protected waitSound(name: string, after: () => void, waitCurrent = false): void {
    this.sound = { name, started: false, waitCurrent };
    this.afterSound = after; this.advanceSound();
  }

  protected waitCurrentSound(after: () => void): void {
    this.sound = { name: '', started: true, waitCurrent: false };
    this.afterSound = after; this.advanceSound();
  }

  private advanceSound(): void {
    if (!this.sound) return;
    if (!this.sound.started) {
      if (this.sound.waitCurrent && !isSoundFinished()) return;
      playSFX(this.sound.name); this.sound.started = true;
    }
    if (!isSoundFinished()) return;
    this.sound = null;
    const next = this.afterSound; this.afterSound = null; next?.();
  }

  protected drawCursor(glyph: string): void {
    const next = this.menu?.cursor;
    if (!next) return;
    if (this.cursor) this.tiles.put(this.cursor.x, this.cursor.y, ' ');
    this.tiles.put(next.x, next.y, glyph); this.cursor = { ...next };
  }
}
