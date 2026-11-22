// Opening checkpoint-12b2c2-2a (note 130): the movie CPU's control rules over the reviewed display clock. UNUSED: no
// Boot, main, movie program or audio caller imports this file. It is not an instruction interpreter: the owner states
// each instruction's machine cycles (and, for a store, the store's effect); this class only advances the display clock
// and decides interrupt dispatch, HALT, EI, DI and RETI exactly as the pinned SameBoy Core (CGB-E, normal speed) does.
// Evidence: notes/130-opening-checkpoint-12b2c2-2a/cpu-control-research.json (real SM83 code from HRAM/ROM).
//
// Measured rules, in dots (four per machine cycle) relative to instruction boundaries:
// - Dispatch is 20 dots at a boundary where IME is on and IE & IF is nonzero (the first boundary at or after the
//   request, note 129). The vector is chosen 14 dots in: a VBlank requested by then takes the vector from a pending
//   STAT, which stays pending (measured: VBlank 14 dots in switches, 18 does not; requests at +15..+17 cannot occur,
//   because VBlank always lands 2 dots off the CPU's 4-dot grid). Only the chosen bit is acknowledged; IME goes off.
// - HALT (IME on) at boundary h: if an enabled request arrives in (h, h + 4] the CPU does not halt; it dispatches at
//   h + 4 in 20 dots and RETI returns to the HALT, which runs again ('retry'). Otherwise it halts and wakes at the first
//   4-dot step s >= the request; that dispatch takes 24 dots (4 to leave HALT) and RETI returns after the HALT.
// - EI: IME turns on after the following instruction (no dispatch at the boundary right after EI). RETI: 16 dots, IME
//   on at once (a pending request dispatches at the boundary right after it). DI: IME off at once.
// - A CPU store to IF takes effect three dots before its instruction ends; requests at or before that dot are cleared.
//   (LCDC/STAT stores take effect four dots before, CPU_STORE_TRAILING_DOTS.)
//
// Out of scope, refused: HALT with IME off (the HALT bug / non-dispatch wake), DI or HALT or RETI while EI is still
// pending, and any instruction at a boundary where the hardware would dispatch (including after a HALT wake/retry). Interrupt sources other than VBlank and
// STAT are never requested on the opening path (note 130 §2.4: TAC and SC are zeroed by Init and never written there,
// the joypad source is not in IE); IE bits 2-4 are accepted and never fire.
import {
  CPU_STORE_TRAILING_DOTS, INTRO_DOTS_PER_CYCLE, INTRO_IF_STAT, INTRO_IF_VBLANK,
  type IntroDisplayClock, type IntroDisplayInterrupt,
} from './intro_display_clock';

export const INTRO_DISPATCH_DOTS = 20;
export const INTRO_HALT_EXIT_DOTS = 4;
/** Dots into a dispatch at which IF is sampled again for the vector (requests up to and including this dot count). */
export const INTRO_VECTOR_SAMPLE_DOTS = 14;
/** Dots left in a store instruction after its IF write takes effect. */
export const INTRO_IF_STORE_TRAILING_DOTS = 3;
/** The longest SM83 instruction (CALL) is six machine cycles. */
const MAX_INSTRUCTION_CYCLES = 6;

export type IntroHaltResult = 'retry' | 'woke';

export interface IntroCpuState {
  /** rIE (bits 0-4). */
  ie: number;
  ime: boolean;
}

type Owed = null | 'retry' | 'woke';

export class IntroCpu {
  private ieValue: number;
  private imeValue: boolean;
  private eiPending = false;
  private owed: Owed = null;

  constructor(readonly display: IntroDisplayClock, state: IntroCpuState) {
    if (!Number.isInteger(state.ie) || state.ie < 0 || state.ie > 0x1f) throw new RangeError('Invalid intro CPU IE');
    this.ieValue = state.ie;
    this.imeValue = state.ime;
  }

  get ie(): number { return this.ieValue; }
  get ime(): boolean { return this.imeValue; }
  /** EI executed, IME not yet on. */
  get imePending(): boolean { return this.eiPending; }
  /** Absolute dots (the display clock's). */
  get elapsed(): number { return this.display.elapsed; }

  /** One instruction of `cycles` machine cycles. `effect`, if given, runs `trailingDots` before the instruction ends
   *  (a store's measured effect point). Interrupts are considered only afterwards, at the boundary: call interrupt(). */
  exec(cycles: number, effect?: () => void, trailingDots = CPU_STORE_TRAILING_DOTS): void {
    if (!Number.isInteger(cycles) || cycles < 1 || cycles > MAX_INSTRUCTION_CYCLES) throw new RangeError('Invalid intro CPU instruction length');
    if (!Number.isInteger(trailingDots) || trailingDots < 1 || trailingDots > INTRO_DOTS_PER_CYCLE) throw new RangeError('Invalid intro CPU store point');
    this.requireRunning();
    const arm = this.takeEi();
    const dots = cycles * INTRO_DOTS_PER_CYCLE;
    if (effect) {
      this.display.advance(dots - trailingDots);
      effect();
      this.display.advance(trailingDots);
    } else {
      this.display.advance(dots);
    }
    if (arm) this.imeValue = true;
  }

  /** `ldh [rIF], a` (3 cycles; `ld [rIF], a` is 4): bits 0-1 replace the pending requests three dots before the end. */
  storeIf(value: number, cycles = 3): void {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('Invalid intro CPU IF value');
    this.exec(cycles, () => this.display.writePending(value & (INTRO_IF_VBLANK | INTRO_IF_STAT)), INTRO_IF_STORE_TRAILING_DOTS);
  }

  /** `ldh [rIE], a`: IE is only consulted at boundaries, so its effect point inside the store does not matter. */
  storeIe(value: number, cycles = 3): void {
    if (!Number.isInteger(value) || value < 0 || value > 0x1f) throw new RangeError('Invalid intro CPU IE');
    this.exec(cycles, () => { this.ieValue = value; });
  }

  di(): void {
    if (this.eiPending) throw new RangeError('Intro CPU DI right after EI is unmeasured');
    this.exec(1);
    this.imeValue = false;
  }

  ei(): void {
    this.exec(1);
    if (!this.imeValue) this.eiPending = true;
  }

  reti(): void {
    if (this.eiPending) throw new RangeError('Intro CPU RETI right after EI is unmeasured');
    this.exec(4);
    this.imeValue = true;
  }

  /** At a completed instruction boundary: dispatch the highest-priority enabled request if IME is on. Advances the
   *  20 dispatch dots (24 when leaving HALT), acknowledges only the chosen bit and turns IME off. */
  interrupt(): IntroDisplayInterrupt | null {
    // After HALT's 'retry' or 'woke' the request is pending with IME on, so a dispatch is always taken here.
    if (!this.imeValue || !(this.display.pending & this.ieValue & 3)) return null;
    const owed = this.owed;
    this.owed = null;
    if (owed === 'woke') this.display.advance(INTRO_HALT_EXIT_DOTS);
    this.display.advance(INTRO_VECTOR_SAMPLE_DOTS);
    const vector = this.display.takeInterrupt(this.ieValue, true);
    if (vector === null) throw new RangeError('Intro CPU dispatch lost its request');
    this.display.advance(INTRO_DISPATCH_DOTS - INTRO_VECTOR_SAMPLE_DOTS);
    this.imeValue = false;
    return vector;
  }

  /** HALT at a boundary that interrupt() already sampled. 'retry': a request arrived during the HALT itself; the next
   *  interrupt() dispatches and the HALT runs again after RETI. 'woke': time advanced to the wake step; the next
   *  interrupt() dispatches with the four dots of leaving HALT, and execution continues after the HALT. */
  halt(): IntroHaltResult {
    if (!this.imeValue) throw new RangeError('Intro CPU HALT with IME off is unmeasured');
    if (this.eiPending) throw new RangeError('Intro CPU HALT right after EI is unmeasured');
    this.requireRunning();
    const enabled = this.ieValue & 3;
    if (this.display.pending & enabled) throw new RangeError('Intro CPU HALT entered with a request the boundary should have taken');
    const until = this.display.dotsUntilRequest(enabled);
    if (until === null) throw new RangeError('Intro CPU HALT with no request to wake it');
    if (until <= INTRO_DOTS_PER_CYCLE) {
      this.display.advance(INTRO_DOTS_PER_CYCLE);
      this.owed = 'retry';
      return 'retry';
    }
    this.display.advance(Math.ceil(until / INTRO_DOTS_PER_CYCLE) * INTRO_DOTS_PER_CYCLE);
    this.owed = 'woke';
    return 'woke';
  }

  private takeEi(): boolean {
    const arm = this.eiPending;
    this.eiPending = false;
    return arm;
  }

  private requireRunning(): void {
    // This also refuses an instruction after HALT's 'retry' or 'woke' before the owed dispatch. The hardware never starts an instruction at a boundary where IME is on and an enabled request is pending.
    if (this.imeValue && this.display.pending & this.ieValue & 3) throw new RangeError('Intro CPU skipped a dispatch at a boundary');
  }
}
