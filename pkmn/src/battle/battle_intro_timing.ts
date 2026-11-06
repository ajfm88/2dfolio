// A5e checkpoint-04a. Raster barriers, not a CPU-cycle clock or a second VBlank owner.
import type { BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { Frame, Program } from './battle_menu_context';

/** ram/hram.asm: hSCX/hSCY precede the existing hWY ($FFB0). Views of existing HRAM. */
export const INTRO_SCROLL = { hSCX: 0xffae, hSCY: 0xffaf } as const;

/** The CPU resumes after the VBlank handler, not at the LY144 line where the interrupt starts.
 * Dispatch, the scroll latch, the six early-out copies and hDMARoutine's 40-iteration wait are
 * already past two 114-cycle scanlines (home/vblank.asm, engine/gfx/oam_dma.asm; note 79 §2.1),
 * so the return is LY146 or later. Every value from 146 to 153 is equivalent for this Program's
 * targets (64, 96 and 145). */
export const POST_VBLANK_LY = 146;

export interface IntroScanout {
  /** Freeze visible rows before CPU work at this boundary; clamp the exclusive end to144. */
  to(line: number): void;
  /** Seal the completed raster and start a new row accumulator. No transfer, OAM or audio tick. */
  endFrame(): void;
  /** EnableLCD restarts LY at0; discard/reset the partial accumulator, without an extra VBlank. */
  restart(): void;
  /** LCD turned off. Optional so a hand-built scanout can omit it. */
  off?(): void;
}

export class BattleIntroTiming {
  private ly: number;
  private physicalX: number;
  constructor(readonly state: BattleState, readonly screen: BattleScreen, entryLine: number,
    private readonly scanout: IntroScanout) {
    if (!Number.isInteger(entryLine) || entryLine < 0 || entryLine > 153) throw new Error('intro entry LY out of range');
    this.ly = entryLine; this.physicalX = screen.scx;
  }
  get line(): number { return this.ly; }
  get physicalSCX(): number { return this.physicalX; }

  /** Called by the ONE external driver, before its serviced video/audio step.
   * Capture the old raster BEFORE latching new scroll, OAM, BG or palette work. */
  boundary(frame: Exclude<Frame, 'session'>): void {
    if (frame === 'dark') {
      if (this.screen.lcdOn) throw new Error('dark frame with LCD on');
      return;
    }
    if (!this.screen.lcdOn) throw new Error('intro boundary requires LCD on');
    this.scanout.to(144); this.scanout.endFrame();
    if (frame === 'serviced') {
      this.physicalX = this.state.mem[INTRO_SCROLL.hSCX];
      this.screen.scy = this.state.mem[INTRO_SCROLL.hSCY];
    }
    this.screen.scx = this.physicalX;
    this.screen.scxSplit = this.screen.scxAfterSplit = null;
    // No raster wait follows a held boundary in this Program, so that anchor stays LY144.
    this.ly = frame === 'serviced' ? POST_VBLANK_LY : 144;
  }

  /** Source waits test LY equality. A wait crosses at most one LY144 boundary; it is not always a frame.
   * CPU-only work costs no scanlines in this existing presentation model. */
  *until(line: 64 | 96 | 145): Program {
    if (!this.screen.lcdOn) throw new Error('intro raster wait requires LCD on');
    const distance = (line - this.ly + 154) % 154;
    const toVblank = this.ly < 144 ? 144 - this.ly : 154 - this.ly + 144;
    if (distance >= toVblank && distance !== 0) yield 'serviced';
    // A destination inside VBlank adds no visible rows. In particular144→145 must not draw a future raster.
    if (line < 144) this.scanout.to(line);
    this.ly = line;
  }

  /** home/lcd.asm: clear rIF, mask IE.VBlank, wait for LY==145, turn the LCD off, restore rIE.
   * IF latches the request while it is masked; restoring IE services that pending VBlank
   * (note 79 §2.2). The driver's ordinary serviced boundary is that one frame. */
  *disableLCD(): Program {
    yield* this.until(145);
    this.screen.lcdOn = false;
    this.scanout.off?.();
  }
  /** note 79 §8.2. One dark tick per counted LCD-off frame. DIV still advances on the port clock. */
  *lcdOff(frames: number): Program {
    if (this.screen.lcdOn) throw new Error('intro LCD-off span requires LCD off');
    for (let left = frames; left > 0; left--) yield 'dark';
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
