// Opening movie time/interrupt-request component. No CPU interpreter, handler implementation or frame owner.
export const INTRO_FRAME_CYCLES = 17556;
export const INTRO_LINE_CYCLES = 114;
export const INTRO_VBLANK_CYCLE = 144 * INTRO_LINE_CYCLES;
export type IntroInterrupt = 1 | 2;
export interface IntroClockState {
  phase: number;
  lcdOn: boolean;
  mode0Enabled: boolean;
  pending: number;
  /** Caller-supplied first mode-0 cycle of each visible line. No guessed/default PPU transfer duration. */
  mode0Cycles: readonly number[];
}

/** Count machine cycles and coalesced VBlank/mode-0 STAT requests. The owner completes a native instruction
 * and its semantic effect BEFORE asking takeInterrupt. While IME is off (including inside handlers), pass
 * false or do not ask. Dispatch, handler work, DMA stalls, EI delay and HALT wake-up are explicitly external.
 * This component has no default handler duration, no audio tick and no production caller yet. */
export class IntroMovieClock {
  private time = 0;
  private ppu: number;
  private lcd: boolean;
  private mode0: boolean;
  private requested: number;
  private readonly edges: readonly number[];
  constructor(state: IntroClockState) {
    if (!Number.isSafeInteger(state.phase) || state.phase < 0 || state.phase >= INTRO_FRAME_CYCLES)
      throw new RangeError('Invalid intro LCD phase');
    if (state.mode0Cycles.length !== 144 || Array.from(state.mode0Cycles).some(n => !Number.isInteger(n) || n < 0 || n >= INTRO_LINE_CYCLES))
      throw new RangeError('Invalid intro mode-0 edge profile');
    this.edges = state.mode0Cycles.slice();
    this.ppu = state.phase; this.lcd = state.lcdOn; this.mode0 = state.mode0Enabled; this.requested = state.pending & 3;
  }
  get elapsed(): number { return this.time; }
  get phase(): number { return this.ppu; }
  get pending(): number { return this.requested; }
  get lcdOn(): boolean { return this.lcd; }
  get mode0Enabled(): boolean { return this.mode0; }
  setMode0Enabled(enabled: boolean): void { this.mode0 = enabled; }
  /** CPU write to IF's two supported bits. LCD off/masking does not implicitly clear pending requests. */
  writePending(value: number): void { this.requested = value & 3; }
  setLcd(on: boolean): void {
    if (on && !this.lcd) this.ppu = 0;
    this.lcd = on;
  }
  advance(cycles: number): void {
    if (!Number.isSafeInteger(cycles) || cycles < 0 || !Number.isSafeInteger(this.time + cycles))
      throw new RangeError('Invalid intro machine-cycle duration');
    this.time += cycles;
    if (!this.lcd || cycles === 0) return;
    if (cycles >= this.untilVBlank()) this.requested |= 1;
    if (this.mode0 && cycles >= this.untilMode0()) this.requested |= 2;
    this.ppu = (this.ppu + cycles % INTRO_FRAME_CYCLES) % INTRO_FRAME_CYCLES;
  }
  /** Interrupt priority/acknowledgement only. The owner advances the five dispatch cycles separately. */
  takeInterrupt(enabled: number, ime = true): IntroInterrupt | null {
    if (!ime) return null;
    const mask = this.requested & enabled & 3;
    const kind = mask & 1 ? 1 : mask & 2 ? 2 : null;
    if (kind !== null) this.requested &= ~kind;
    return kind;
  }
  /** Time to an enabled pending/future request; a HALT owner supplies its own wake/instruction costs. */
  cyclesUntilRequest(enabled: number): number | null {
    if (this.requested & enabled & 3) return 0;
    if (!this.lcd) return null;
    const candidates: number[] = [];
    if (enabled & 1) candidates.push(this.untilVBlank());
    if ((enabled & 2) && this.mode0) candidates.push(this.untilMode0());
    return candidates.length ? Math.min(...candidates) : null;
  }
  private untilVBlank(): number {
    const delta = INTRO_VBLANK_CYCLE - this.ppu;
    return delta > 0 ? delta : delta + INTRO_FRAME_CYCLES;
  }
  private untilMode0(): number {
    let line = Math.floor(this.ppu / INTRO_LINE_CYCLES);
    let edge = line < 144 ? line * INTRO_LINE_CYCLES + this.edges[line] : INTRO_FRAME_CYCLES + this.edges[0];
    if (edge <= this.ppu) { line++; edge = line < 144 ? line * INTRO_LINE_CYCLES + this.edges[line] : INTRO_FRAME_CYCLES + this.edges[0]; }
    return edge - this.ppu;
  }
}
