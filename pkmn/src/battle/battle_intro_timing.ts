// Unused A5e checkpoint-03b. Raster barriers, not a CPU-cycle clock or a second VBlank owner.
import type { BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { Frame, Program } from './battle_menu_context';

/** ram/hram.asm: hSCX/hSCY precede the existing hWY ($FFB0). Views of existing HRAM. */
export const INTRO_SCROLL = { hSCX: 0xffae, hSCY: 0xffaf } as const;
export interface IntroScanout {
  /** Freeze visible rows before CPU work at this boundary; clamp the exclusive end to144. */
  to(line: number): void;
  /** Seal the completed raster and start a new row accumulator. No transfer, OAM or audio tick. */
  endFrame(): void;
  /** EnableLCD restarts LY at0; discard/reset the partial accumulator, without an extra VBlank. */
  restart(): void;
}

export class BattleIntroTiming {
  private ly: number;
  private masked = false;
  private physicalX: number;
  constructor(readonly state: BattleState, readonly screen: BattleScreen, entryLine: number,
    private readonly scanout: IntroScanout) {
    if (!Number.isInteger(entryLine) || entryLine < 0 || entryLine > 153) throw new Error('intro entry LY out of range');
    this.ly = entryLine; this.physicalX = screen.scx;
  }
  get line(): number { return this.ly; }
  get vblankMasked(): boolean { return this.masked; }
  get physicalSCX(): number { return this.physicalX; }

  /** Called by the ONE external driver, before its serviced video/audio step (or discarded boundary).
   * Capture the old raster BEFORE latching new scroll, OAM, BG or palette work. */
  boundary(frame: Exclude<Frame, 'session'>): void {
    if (!this.screen.lcdOn) throw new Error('intro boundary requires LCD on');
    if (frame === 'serviced' && this.masked) throw new Error('intro VBlank is masked');
    this.scanout.to(144); this.scanout.endFrame();
    if (frame === 'serviced') {
      this.physicalX = this.state.mem[INTRO_SCROLL.hSCX];
      this.screen.scy = this.state.mem[INTRO_SCROLL.hSCY];
    }
    this.screen.scx = this.physicalX;
    this.screen.scxSplit = this.screen.scxAfterSplit = null;
    this.ly = 144;
  }

  /** Source waits test LY equality. A wait crosses at most one LY144 boundary; it is not always a frame.
   * CPU-only work costs no scanlines in this existing presentation model. */
  *until(line: 64 | 96 | 145): Program {
    if (!this.screen.lcdOn) throw new Error('intro raster wait requires LCD on');
    const distance = (line - this.ly + 154) % 154;
    const toVblank = this.ly < 144 ? 144 - this.ly : 154 - this.ly + 144;
    if (distance >= toVblank && distance !== 0) yield this.masked ? 'held' : 'serviced';
    // A destination inside VBlank adds no visible rows. In particular144→145 must not draw a future raster.
    if (line < 144) this.scanout.to(line);
    this.ly = line;
  }

  /** home/lcd.asm: clear IF/mask IE.VBlank, wait for LY145, disable LCD, restore prior mask. */
  *disableLCD(): Program {
    const prior = this.masked; this.masked = true;
    try { yield* this.until(145); this.screen.lcdOn = false; }
    finally { this.masked = prior; }
  }
  enableLCD(): void {
    if (this.screen.lcdOn) throw new Error('intro LCD already enabled');
    this.screen.lcdOn = true; this.ly = 0; this.scanout.restart();
  }
  /** core.asm:74–82. Keep physical rSCX distinct from the captured top-band metadata and hSCX. */
  writeSplitX(value: number): void {
    if (this.ly !== 64 && this.ly !== 96) throw new Error('intro SCX write outside raster barrier');
    this.physicalX = value & 255;
    if (this.ly === 64) this.screen.scxSplit = this.physicalX;
    else this.screen.scxAfterSplit = this.physicalX;
  }
}
