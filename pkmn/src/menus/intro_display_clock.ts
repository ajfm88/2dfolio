// Opening checkpoint-12b2c2-1 (note 129): the movie's display/CPU alignment policy, in dots. UNUSED: no Boot, main,
// movie program or audio caller imports this file. It derives, from independent pinned-SameBoy observation (notes/129-
// opening-checkpoint-12b2c2-1/cpu-lcd-research.json), when the LCD's lines, STAT/LY readings and the two interrupt
// requests happen relative to a CPU LCDC write. It is not a PPU, not a renderer and not an instruction interpreter.
//
// Units. A "dot" is a T-cycle: four per machine cycle (CGB normal speed). The checkpoint-12b2c1 movie clock counts
// whole machine cycles and cannot place a request on the half machine cycle the LCD start produces (65662 dots after
// the enabling write is 16415.5 cycles), so this component keeps dots until the CPU samples.
//
// What the observations fix (all relative to the dot of the CPU store's effect, `epoch`, p = dots since epoch):
// - A CPU store to LCDC/STAT takes effect at the START of the instruction's last machine cycle: four dots remain
//   (CPU_STORE_TRAILING_DOTS). `ldh [n],a`, `ld [nn],a` and `ld [hl],a` give identical PPU timelines.
// - An LCDC write that sets bit 7 of an LCD that was off restarts the PPU: LY 0, mode 0, no request, and the first
//   VBlank request at p = 65662 = 144 x 456 - 2 (not 65664), then every 70224 dots. IF bits already pending survive
//   both disabling and re-enabling; LY and the STAT mode read 0 while the LCD is off.
// - Visible line L of frame k (B = 70224 k): LY becomes L at B + 456 L - 4 (L >= 1); mode 2 one dot later, mode 3 at
//   +80, mode 0 one dot before the mode-0 STAT request R(L). R(L) = B + 250 + 456 L + extra(L), where extra is the
//   fine scroll (SCX & 7) + 6 for a triggered window (7 at WX 0 with a fine scroll) + the object costs below. The enabling frame's line 0 differs: R
//   = 252 + (SCX & 7) (+6 window), no object scan, and its mode 0 reads before dot 79 do not count as an interrupt state.
//   Frames >= 1: line 0 follows the general formula and LY 0 / mode 2 begin at B - 455 / B - 3.
// - VBlank: LY 144 at B + 65659, LY 145..153 every 456 dots after, LY 0 at B + 69769, mode 1 from B + 65662 to B + 70221.
// - The mode-0 STAT interrupt is a level. It rises naturally at R(L) (when the enable bit is set), and it is high until
//   the line's window end; a STAT write that sets bit 3 while the level could be high (readable mode 0 from R(L) - 1 to
//   the window end) raises the request AT the write, otherwise at R(L). Clearing bit 3 or turning the LCD off drops it.
// - The CPU accepts a request at the first instruction boundary at or after the request dot (boundary dot >= request).
//   Dispatch itself is five machine cycles (not modelled here: the owner advances it).
//
// Supported hardware state (everything else throws, never defaults): LCDC bits 0 (BG) and 1 (OBJ) set, sprite size
// 8x8 or 8x16, any BG/window map or tile-data select; window off, or on with WY/WX as measured; SCX any, OAM any 40
// objects. Register changes while a visible line is in mode 2 or 3, and OAM DMAs near a line's scan, are refused (their effect
// is unmeasured or only partly measured); unit 2/3 must prove them unreachable or extend this file with a measurement.
export const INTRO_DOTS_PER_CYCLE = 4;
export const DISPLAY_LINE_DOTS = 456;
export const DISPLAY_FRAME_DOTS = 70224;
export const DISPLAY_VISIBLE_LINES = 144;
export const DISPLAY_FIRST_VBLANK_DOT = 65662;
/** Dots left in a store instruction after its write takes effect. */
export const CPU_STORE_TRAILING_DOTS = 4;
/** First mode-0 request of the enabling frame's line 0 with SCX 0, an empty object set and no window. */
export const DISPLAY_FIRST_LINE_REQUEST_DOT = 252;
/** Steady mode-0 request: B + 250 + 456 L + extra. */
export const DISPLAY_STEADY_REQUEST_BASE = 250;
export const INTRO_OAM_BYTES = 160;
/** OAM DMA from its FF46 write to its last byte, measured: 642 dots. */
export const DISPLAY_OAM_DMA_DOTS = 642;
/** A visible line's OAM scan, from its mode-2 start. */
export const DISPLAY_SCAN_DOTS = 84;
export const DISPLAY_DMA_MARGIN_DOTS = 12;

export const INTRO_IF_VBLANK = 1;
export const INTRO_IF_STAT = 2;
export type IntroDisplayInterrupt = 1 | 2;

const LCDC_ENABLE = 0x80, LCDC_WINDOW = 0x20, LCDC_SIZE = 0x04, LCDC_OBJ = 0x02, LCDC_BG = 0x01;
const MAX_FETCHED_OBJECTS = 10;
const OBJECT_FETCH_DOTS = 6;
const WINDOW_DOTS = 6;
const VBLANK_LINE_WINDOW_END = DISPLAY_FIRST_VBLANK_DOT - 1;

export interface IntroDisplayRegisters {
  /** The hardware (latched) values, not hSCX and friends. */
  scx: number;
  wy: number;
  wx: number;
  /** rLCDC including bit 7. */
  lcdc: number;
  /** The OAM the LCD scans (what the last DMA left), 160 bytes: Y, X, tile, attributes per object. */
  oam: ArrayLike<number>;
  /** rSTAT bit 3 (mode-0 interrupt select). */
  mode0Enabled: boolean;
  /** IF bits 0-1 carried in from before this component existed. */
  pending: number;
}

function assertByte(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(`Invalid intro display ${name}`);
}

/** The X of the first ten OAM entries whose Y covers `line`, in OAM order (the PPU's per-line selection, before X cuts). */
export function selectedObjectXs(lcdc: number, oam: ArrayLike<number>, line: number): number[] {
  const height = lcdc & LCDC_SIZE ? 16 : 8;
  const xs: number[] = [];
  for (let index = 0; index < 40 && xs.length < MAX_FETCHED_OBJECTS; index++) {
    const row = line + 16 - oam[index * 4];
    if (row >= 0 && row < height) xs.push(oam[index * 4 + 1]);
  }
  return xs;
}

/** Dots a line's mode 3 is stretched by its selected objects. The PPU takes the first ten Y-matching OAM entries,
 *  drops the ones whose X is 168 or more, then fetches by ascending X: 6 dots each plus a background-fetch wait of
 *  max(0, 5 - pixelOffset) once per distinct left-pixel background tile (the wait for X = 0 is always 5). */
export function introObjectExtraDots(scx: number, lcdc: number, oam: ArrayLike<number>, line: number): number {
  const fine = scx & 7;
  const xs = selectedObjectXs(lcdc, oam, line).sort((a, b) => a - b);
  let dots = 0;
  let previous: number | null = null;
  for (const x of xs) {
    if (x >= 168) continue;
    const offset = x - 8 + fine;
    const tile = Math.floor(offset / 8);
    dots += OBJECT_FETCH_DOTS + (tile === previous ? 0 : x === 0 ? 5 : Math.max(0, 5 - (offset & 7)));
    previous = tile;
  }
  return dots;
}

/** Everything a visible line adds to the steady mode-3 length: the fine scroll, a triggered window, the objects. */
export function introLineExtraDots(regs: Pick<IntroDisplayRegisters, 'scx' | 'wy' | 'wx' | 'lcdc' | 'oam'>, line: number, scanObjects = true): number {
  let dots = regs.scx & 7;
  if (regs.lcdc & LCDC_WINDOW && regs.wy <= 143 && line >= regs.wy && regs.wx <= 166) {
    // A window start inside a line with selected objects changes the fetch waits in a WX/SCX/X dependent way that is
    // measured but not modelled (note 129 §5); no reachable movie state needs it, so it is refused rather than guessed.
    if (scanObjects && selectedObjectXs(regs.lcdc, regs.oam, line).length) throw new RangeError('Intro display window start with selected objects is unmeasured');
    if (regs.wx !== 166) dots += WINDOW_DOTS + (regs.wx === 0 && (regs.scx & 7) ? 1 : 0);
  }
  if (scanObjects) dots += introObjectExtraDots(regs.scx, regs.lcdc, regs.oam, line);
  return dots;
}

interface LineRecord {
  frame: number;
  line: number;
  /** Dot (since epoch) the mode-2 scan starts. */
  scan: number;
  /** Readable mode 3 start and mode 0 start. */
  mode3: number;
  mode0: number;
  /** The natural request dot and the last dot at which a STAT write may still raise it at once. */
  request: number;
  windowEnd: number;
}

type Action = { at: number; kind: 'scan' | 'rise' | 'fall' | 'vblank'; frame: number; line: number };

/** The display/interrupt-request clock, one LCD epoch at a time. It never executes instructions: the owner advances it
 *  by the dots of whatever the CPU did and asks it for interrupts at completed instruction boundaries. */
export class IntroDisplayClock {
  private time = 0;
  private epoch: number | null = null;
  private ifBits: number;
  private scxValue = 0;
  private wyValue = 0;
  private wxValue = 0;
  private lcdcValue = 0;
  private oamValue: Uint8Array = new Uint8Array(INTRO_OAM_BYTES);
  private mode0 = false;
  private level = false;
  private actions: Action[] = [];
  private current: LineRecord | null = null;
  /** The one running OAM DMA (note 135): the bytes it copied at its start and the absolute dots it started and completes. */
  private dma: { oam: Uint8Array; start: number; completion: number } | null = null;
  /** Completed scheduled DMAs not yet taken by the owner (pure clock state; a fork starts with none). */
  private latched: { completion: number }[] = [];

  constructor(regs: IntroDisplayRegisters) {
    this.ifBits = regs.pending & 3;
    this.scxValue = regs.scx; this.wyValue = regs.wy; this.wxValue = regs.wx;
    this.mode0 = regs.mode0Enabled;
    assertByte(regs.scx, 'SCX'); assertByte(regs.wy, 'WY'); assertByte(regs.wx, 'WX'); assertByte(regs.lcdc, 'LCDC');
    if (regs.oam.length !== INTRO_OAM_BYTES) throw new RangeError('Invalid intro display OAM');
    this.oamValue = Uint8Array.from(regs.oam);
    this.lcdcValue = regs.lcdc & ~LCDC_ENABLE;
    this.requireSupported(regs.lcdc);
    if (regs.lcdc & LCDC_ENABLE) this.startLcd();
  }

  /** Absolute dots advanced so far. */
  get elapsed(): number { return this.time; }
  get lcdOn(): boolean { return this.epoch !== null; }
  /** Dots since the enabling write took effect, or null with the LCD off. */
  get sinceEnable(): number | null { return this.epoch === null ? null : this.time - this.epoch; }
  get pending(): number { return this.ifBits; }
  get mode0Enabled(): boolean { return this.mode0; }
  get lcdc(): number { return this.lcdcValue | (this.epoch === null ? 0 : LCDC_ENABLE); }

  /** Pure time: every request whose dot is at or before the new time becomes pending. A running OAM DMA completes at its
   *  absolute dot in chronological order with the display actions: a completion due at or before an action's dot (including a
   *  scan at the same dot) is processed first, through the same overlap guard as latchOam, with the clock at that dot. */
  advance(dots: number): void {
    if (!Number.isSafeInteger(dots) || dots < 0 || !Number.isSafeInteger(this.time + dots)) throw new RangeError('Invalid intro display dot duration');
    const target = this.time + dots;
    for (;;) {
      const dma = this.dma;
      const next = this.epoch === null ? undefined : this.actions[0];
      const nextAt = next ? this.epoch! + next.at : Infinity;
      if (dma && dma.completion <= target && dma.completion <= nextAt) {
        this.time = Math.max(this.time, dma.completion);
        this.applyLatch(dma.oam, dma.completion - dma.start);
        this.dma = null;
        this.latched.push({ completion: dma.completion });
        continue;
      }
      if (next && nextAt <= target) { this.actions.shift(); this.run(next); continue; }
      break;
    }
    this.time = target;
  }

  /** Begin an OAM DMA now: the bytes are copied at this dot, the latch is scheduled DISPLAY_OAM_DMA_DOTS later on this clock. */
  startOamDma(oam: ArrayLike<number>): void {
    if (oam.length !== INTRO_OAM_BYTES) throw new RangeError('Invalid intro display OAM');
    if (this.dma) throw new RangeError('Intro OAM DMA started while another is running');
    this.dma = { oam: Uint8Array.from(oam), start: this.time, completion: this.time + DISPLAY_OAM_DMA_DOTS };
  }
  /** The running DMA (a copy), or null. */
  get oamDma(): { oam: Uint8Array; start: number; completion: number } | null {
    return this.dma ? { oam: Uint8Array.from(this.dma.oam), start: this.dma.start, completion: this.dma.completion } : null;
  }
  /** The OAM the LCD scans (a copy). */
  get oam(): Uint8Array { return Uint8Array.from(this.oamValue); }
  /** Scheduled DMAs completed since the last call, oldest first. */
  takeOamCompletions(): { completion: number }[] { const out = this.latched; this.latched = []; return out; }

  /** IF write by the CPU (bits 0-1). Pending requests are not cleared by anything else but acknowledgement. */
  writePending(value: number): void { this.ifBits = value & 3; }

  /** rSTAT bit 3. Setting it while the level may be high raises the request at this write. */
  writeMode0Select(enabled: boolean): void {
    this.mode0 = enabled;
    if (!enabled) { this.level = false; return; }
    // Rewriting $08 over $08 counts too: the reference raises the request at such a store at the first readable mode-0 dot.
    if (this.epoch === null || this.level) return;
    const record = this.current;
    const p = this.time - this.epoch;
    if (record && p >= record.mode0 && p <= record.windowEnd) { this.ifBits |= INTRO_IF_STAT; this.level = true; }
  }

  /** A CPU store to rLCDC (all eight bits). Bit 7 off->on starts the LCD; on->off stops it and keeps IF. */
  writeLcdc(value: number): void {
    assertByte(value, 'LCDC');
    const on = (value & LCDC_ENABLE) !== 0;
    if (!on) {
      if (this.epoch !== null) { this.epoch = null; this.actions = []; this.current = null; this.level = false; }
      this.lcdcValue = value;
      return;
    }
    this.requireSupported(value);
    if (this.epoch === null) { this.lcdcValue = value & ~LCDC_ENABLE; this.startLcd(); return; }
    if ((value & ~LCDC_ENABLE) === this.lcdcValue) return;
    this.requireQuiet('LCDC');
    this.lcdcValue = value & ~LCDC_ENABLE;
  }

  writeScx(value: number): void { assertByte(value, 'SCX'); this.requireQuiet('SCX'); this.scxValue = value; }
  writeWy(value: number): void { assertByte(value, 'WY'); this.requireQuiet('WY'); this.wyValue = value; }
  writeWx(value: number): void { assertByte(value, 'WX'); this.requireQuiet('WX'); this.wxValue = value; }
  /** A finished OAM DMA (`dmaDots` from its start write to the last byte): the next scan sees this copy. Hardware OAM
   *  changes only this way in the movie. A DMA that is active around a visible line's OAM scan blanks that line's objects
   *  (measured: a DMA finishing 2 dots before the scan already does, one finishing 10 dots before does not, one started 4
   *  dots before it does, one started 8 dots after it does not); the exact per-entry rule is not modelled, so any DMA whose
   *  span comes within 12 dots of a scan window is refused. */
  latchOam(oam: ArrayLike<number>, dmaDots = DISPLAY_OAM_DMA_DOTS): void { this.applyLatch(oam, dmaDots); }

  private applyLatch(oam: ArrayLike<number>, dmaDots: number): void {
    if (oam.length !== INTRO_OAM_BYTES) throw new RangeError('Invalid intro display OAM');
    if (!Number.isSafeInteger(dmaDots) || dmaDots < 0) throw new RangeError('Invalid intro display DMA duration');
    if (this.epoch !== null) {
      const p = this.time - this.epoch, start = p - dmaDots;
      const record = this.current;
      const nextScan = this.actions.find(a => a.kind === 'scan');
      if ((record && record.scan + DISPLAY_SCAN_DOTS + DISPLAY_DMA_MARGIN_DOTS > start) || (nextScan && nextScan.at - DISPLAY_DMA_MARGIN_DOTS < p))
        throw new RangeError('Intro display OAM DMA overlapping a visible line scan is unmeasured');
    }
    this.oamValue = Uint8Array.from(oam);
  }

  /** Readable LY at the current dot (0 with the LCD off). */
  readLy(): number {
    if (this.epoch === null) return 0;
    return lyAt(this.time - this.epoch);
  }

  /** Readable STAT mode bits at the current dot (0 with the LCD off). */
  readMode(): number {
    if (this.epoch === null) return 0;
    const q = (this.time - this.epoch) % DISPLAY_FRAME_DOTS;
    if (q >= DISPLAY_FIRST_VBLANK_DOT && q < DISPLAY_FRAME_DOTS - 3) return 1;
    const record = this.current;
    if (!record) return 0;
    const p = this.time - this.epoch;
    if (p < record.mode3) return record.frame === 0 && record.line === 0 ? 0 : 2;
    return p < record.mode0 ? 3 : 0;
  }

  /** Sample at a completed instruction boundary: the highest-priority request enabled by `enabled`, acknowledged.
   *  The owner passes ime=false inside handlers; time and requests keep running either way. */
  takeInterrupt(enabled: number, ime = true): IntroDisplayInterrupt | null {
    if (!ime) return null;
    const mask = this.ifBits & enabled & 3;
    const kind = mask & INTRO_IF_VBLANK ? INTRO_IF_VBLANK : mask & INTRO_IF_STAT ? INTRO_IF_STAT : null;
    if (kind !== null) this.ifBits &= ~kind;
    return kind;
  }

  /** Dots until a request in `enabled` is pending, assuming no register write meanwhile (a halted CPU makes none);
   *  null if none can occur (LCD off, or only a disabled source). */
  dotsUntilRequest(enabled: number): number | null {
    if (this.ifBits & enabled & 3) return 0;
    if (this.epoch === null) return null;
    const probe = this.fork();
    for (let step = 0; step < 4000; step++) {
      const next = probe.actions[0];
      if (!next) return null;
      probe.advance(Math.max(0, next.at + this.epoch - probe.time));
      if (probe.ifBits & enabled & 3) return probe.time - this.time;
    }
    return null;
  }

  private fork(): IntroDisplayClock {
    const copy = new IntroDisplayClock({
      scx: this.scxValue, wy: this.wyValue, wx: this.wxValue, lcdc: this.lcdcValue,
      oam: this.oamValue, mode0Enabled: this.mode0, pending: this.ifBits,
    });
    copy.time = this.time; copy.epoch = this.epoch; copy.level = this.level;
    copy.actions = this.actions.map(a => ({ ...a }));
    copy.current = this.current ? { ...this.current } : null;
    copy.dma = this.dma ? { oam: Uint8Array.from(this.dma.oam), start: this.dma.start, completion: this.dma.completion } : null;
    return copy;
  }

  private requireSupported(lcdc: number): void {
    if (!(lcdc & LCDC_BG) || !(lcdc & LCDC_OBJ)) throw new RangeError('Intro display timing is measured only with the BG and objects on');
  }

  private requireQuiet(what: string): void {
    if (this.epoch === null) return;
    const record = this.current;
    const p = this.time - this.epoch;
    if (record && p >= record.scan && p < record.mode0) throw new RangeError(`Intro display ${what} change during a visible line's mode 2/3 is unmeasured`);
  }

  private startLcd(): void {
    this.epoch = this.time;
    this.actions = [{ at: 0, kind: 'scan', frame: 0, line: 0 }, { at: DISPLAY_FIRST_VBLANK_DOT, kind: 'vblank', frame: 0, line: 0 }];
    this.current = null;
    this.level = false;
    this.run(this.actions.shift()!);
  }

  private insert(action: Action): void {
    let at = this.actions.length;
    while (at > 0 && this.actions[at - 1].at > action.at) at--;
    this.actions.splice(at, 0, action);
  }

  private run(action: Action): void {
    const base = action.frame * DISPLAY_FRAME_DOTS;
    switch (action.kind) {
      case 'scan': {
        const { line, frame } = action;
        const first = frame === 0 && line === 0;
        const extra = introLineExtraDots({ scx: this.scxValue, wy: this.wyValue, wx: this.wxValue, lcdc: this.lcdcValue, oam: this.oamValue }, line, !first);
        const request = first ? DISPLAY_FIRST_LINE_REQUEST_DOT + extra : base + DISPLAY_STEADY_REQUEST_BASE + DISPLAY_LINE_DOTS * line + extra;
        const scan = first ? 0 : base + DISPLAY_LINE_DOTS * line - 3;
        const record: LineRecord = {
          frame, line, scan, mode3: first ? 79 : scan + 80, mode0: request - 1, request,
          windowEnd: line === 143 ? base + VBLANK_LINE_WINDOW_END : base + DISPLAY_LINE_DOTS * (line + 1) - 8,
        };
        this.current = record;
        this.insert({ at: record.request, kind: 'rise', frame, line });
        this.insert({ at: record.windowEnd + 1, kind: 'fall', frame, line });
        // the next line's scan (or the next frame's line 0, which starts three dots before B)
        if (line < 143) this.insert({ at: base + DISPLAY_LINE_DOTS * (line + 1) - 3, kind: 'scan', frame, line: line + 1 });
        return;
      }
      case 'rise':
        if (this.mode0 && !this.level) { this.ifBits |= INTRO_IF_STAT; this.level = true; }
        return;
      case 'fall': this.level = false; return;
      case 'vblank':
        this.ifBits |= INTRO_IF_VBLANK;
        this.insert({ at: base + DISPLAY_FRAME_DOTS - 3, kind: 'scan', frame: action.frame + 1, line: 0 });
        this.insert({ at: base + DISPLAY_FRAME_DOTS + DISPLAY_FIRST_VBLANK_DOT, kind: 'vblank', frame: action.frame + 1, line: 0 });
        return;
    }
  }
}

/** LY at p dots after the enabling write (p >= 0). */
export function lyAt(p: number): number {
  const q = p % DISPLAY_FRAME_DOTS;
  if (q >= 69769) return 0;
  if (q >= 65659) return 144 + Math.floor((q - 65659) / DISPLAY_LINE_DOTS);
  return q < 452 ? 0 : Math.floor((q + 4) / DISPLAY_LINE_DOTS);
}
