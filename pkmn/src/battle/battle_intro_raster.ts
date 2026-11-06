// A5e checkpoint-04b. Row capture for one intro frame. The renderer is injected;
// this module imports neither the renderer nor main (note 79 §4.4). The session imports it.
import type { IntroScanout } from './battle_intro_timing';

const WIDTH = 160;
const HEIGHT = 144;
const ROW = WIDTH * 4;

/** CGB LCD-off colour. RGB15 $7FFF → gbcCorrect(31,31,31). Note 79 §8.1. */
export const LCD_OFF_RGB = [255, 255, 255] as const;

/** Bookkeeping plus an optional 160×144 RGBA copy of the rows frozen so far. Sealed frames are not kept. */
export class IntroRasterCapture implements IntroScanout {
  private readonly buffer = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  private row = 0;
  /** 'off' after DisableLCD; 'blank' is the skipped first frame after EnableLCD; 'on' is 04a's compose. */
  private lcd: 'on' | 'off' | 'blank' = 'on';
  constructor(private readonly render: (() => Uint8ClampedArray) | null) {}
  get cursor(): number { return this.row; }

  to(line: number): void {
    const end = Math.min(line, HEIGHT);
    if (end < this.row) throw new Error('intro capture went backwards');
    if (end > this.row && this.render) {
      const pixels = this.render();
      const start = this.row * ROW;
      this.buffer.set(pixels.subarray(start, end * ROW), start);
    }
    this.row = end;
  }

  endFrame(): void {
    this.row = 0;
    if (this.lcd === 'blank') this.lcd = 'on';
  }
  restart(): void { this.row = 0; this.lcd = 'blank'; }
  off(): void { this.row = 0; this.lcd = 'off'; }

  /** Rows [0, cursor) from the frozen buffer; the rest stay the caller's live render.
   * No renderer, or a cursor still at 0, returns that live render itself.
   * LCD-off and the skipped first frame are white (note 79 §8.1). */
  compose(live: Uint8ClampedArray): Uint8ClampedArray {
    if (this.lcd === 'off' || this.lcd === 'blank') {
      const white = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
      white.fill(255);
      return white;
    }
    if (!this.render || this.row === 0) return live;
    const out = live.slice();
    out.set(this.buffer.subarray(0, this.row * ROW), 0);
    return out;
  }
}
