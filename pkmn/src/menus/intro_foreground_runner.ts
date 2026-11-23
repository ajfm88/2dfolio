// Opening foreground timing, checkpoint 1 (note 134): composes a typed foreground instruction stream, the reviewed
// VBlank/STAT handler streams and one shared state over the reviewed IntroCpu and IntroDisplayClock. UNUSED: no Boot,
// main, movie program or audio caller imports this file. It is a timing owner, not an emulator: it never decodes an
// opcode, never reads a ROM and invents no hardware rule. Dispatch, HALT, EI/DI/RETI, register timing and dot
// accounting all stay inside IntroCpu / IntroDisplayClock.
//
// One dot clock (the display's). step() is the unit of progress, and nothing is split inside it:
//   1. an owed handler instruction (IME is off, no interrupt is sampled inside a handler), else
//   2. at an instruction boundary: the CPU samples pending interrupts (IntroCpu.interrupt). A dispatch is one step; the
//      handler it selects then runs one instruction per step through its RETI and the boundary is sampled again, so a
//      second pending request can run before the foreground resumes, else
//   3. the foreground generator is resumed with the COMPLETED reply of its previous step and its next step executes
//      (one instruction, one HALT, or one aggregate).
// The foreground generator is therefore never resumed before the handlers that intervene have finished: it cannot
// sample owner state (shared fields, an audio forecast) that a handler is about to change. All pause/resume state is in
// this object and the generator, so running in chunks of any size gives the trace of one continuous run.
//
// Aggregates (a GDMA stall, an audio callee) are not instructions: the display advances their whole dot count with the
// CPU blocked, once, and their state effect runs once after it. They require IME effectively off (IME off and no EI
// pending), because a dispatch inside a stall is not a modelled behaviour.
//
// Shared state is ONE object (IntroSharedState): the wait flag, frame counter, joy input, copy size and the rest are
// read and written only through it, by the foreground's reads/stores and by the handler streams' semantic effects, so no
// owner keeps a second copy. Shadow OAM (what foreground stores write), the DMA snapshot (a copy taken at the DMA's
// start) and the OAM the display currently scans are three different arrays.
import {
  INTRO_DOTS_PER_CYCLE, INTRO_IF_VBLANK, INTRO_OAM_BYTES, type IntroDisplayInterrupt,
} from './intro_display_clock';
import { INTRO_IF_STORE_TRAILING_DOTS, type IntroCpu } from './intro_cpu';
import { introLcdcSteps, introVBlankSteps, type IntroHandlerStep, type IntroVBlankInputs } from './intro_handler_timing';
import type {
  IntroForegroundStep, IntroHelperAudio, IntroHelperGdma, IntroHelperInsn, IntroHelperReply, IntroHelperSources,
} from './intro_helper_timing';

export type IntroRunnerOwner = 'foreground' | 'vblank' | 'stat';
export type IntroAudioPredictor = 'setup' | 'movie';
export type IntroAudioPublication = NonNullable<IntroHelperInsn['publishes']>;

/** Everything below is plain data so two traces can be compared with toEqual. */
export type IntroRunnerEvent =
  | { kind: 'insn'; owner: IntroRunnerOwner; start: number; end: number; cycles: number; op?: string; routine?: string }
  | { kind: 'read'; owner: IntroRunnerOwner; dot: number; field: string; value: number }
  | { kind: 'store'; owner: IntroRunnerOwner; dot: number; field: string; value: number }
  | { kind: 'effect'; owner: IntroRunnerOwner; dot: number; name: string; field?: string; value?: number }
  | { kind: 'interrupt'; vector: 'vblank' | 'stat'; start: number; end: number; pendingBefore: number; pendingAfter: number }
  | { kind: 'halt'; start: number; end: number; result: 'retry' | 'woke' }
  | { kind: 'gdma'; owner: IntroRunnerOwner; start: number; end: number; which: 1 | 2 }
  | { kind: 'audio'; owner: IntroRunnerOwner; start: number; end: number; cycles: number; predictor: IntroAudioPredictor }
  | { kind: 'oam-latch'; completion: number; dot: number }
  | { kind: 'finish'; dot: number }
  | { kind: 'fault'; dot: number; message: string };

interface AudioForecast { cycles: number; version: number; predictor: IntroAudioPredictor }

export type IntroRunnerStepKind = 'interrupt' | 'handler' | 'foreground' | 'halt' | 'aggregate' | 'finish' | 'done';

/** The audio owner behind the runner. forecast() is the callee's cost for the NEXT update from the owner's current
 *  state; update() performs that update. `version` must change on every update, so a forecast captured before an
 *  intervening update is detected as stale. */
export interface IntroAudioOwner {
  readonly version: number;
  forecast(predictor: IntroAudioPredictor): number;
  update(predictor: IntroAudioPredictor): void;
  /** Foreground PlayMusic stores, forwarded at their measured write point. */
  publish?(kind: IntroAudioPublication, field: string, value: number, dot: number): void;
  selectPredictor?(): IntroAudioPredictor;
}

/** The 20 inputs introVBlankSteps reads at its first instruction, in a state with nothing pending. */
export const INTRO_VBLANK_INPUT_KEYS: readonly (keyof IntroVBlankInputs)[] = [
  'wDisableVBlankWYUpdate', 'hAutoBGTransferEnabled', 'hAutoBGTransferPortion', 'hVBlankCopyBGSource',
  'hRedrawRowOrColumnMode', 'hVBlankCopySize', 'hVBlankCopyDoubleSize', 'hTileAnimations', 'wUpdateSpritesEnabled',
  'wIgnoreInputCounter', 'wStatusFlags5', 'wReachedMaxInGameTime', 'wStatusFlags6', 'hDisableJoypadPolling',
  'hVBlankOccurred', 'hFrameCounter', 'wAudioFadeOutControl', 'wStatusFlags2', 'wLowHealthAlarm', 'wPrinterConnectionOpen',
];

/** A quiet VBlank domain: every input the handler stream accepts, nothing pending, plus the registers it copies. */
export function introQuietSharedFields(): Record<string, number> {
  const fields: Record<string, number> = {};
  for (const key of INTRO_VBLANK_INPUT_KEYS) fields[key] = 0;
  fields.wUpdateSpritesEnabled = 0xff;
  fields.hSCX = 0; fields.hSCY = 0; fields.hWY = 0;
  fields.hJoyInput = 0;
  fields.hLCDCPointer = 0;
  return fields;
}

const SHADOW_OAM = /^shadowOam\.(\d+)$/;

function assertByte(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(`Invalid intro shared ${what}`);
}

/** The one owner of every shared field. Unknown fields are refused on both sides (no silent zero). */
export class IntroSharedState {
  private readonly fields = new Map<string, number>();
  /** What foreground stores to shadowOam.N have written. Not what the display scans, not the DMA snapshot. */
  readonly shadowOam = new Uint8Array(INTRO_OAM_BYTES);
  /** The owner that last wrote each field (diagnostics for traces). */
  readonly lastWriter = new Map<string, IntroRunnerOwner | 'init'>();

  constructor(initial: Record<string, number>) {
    for (const [name, value] of Object.entries(initial)) {
      assertByte(value, name);
      this.fields.set(name, value);
      this.lastWriter.set(name, 'init');
    }
  }

  has(field: string): boolean { return this.fields.has(field); }
  read(field: string): number {
    const value = this.fields.get(field);
    if (value === undefined) throw new RangeError(`Intro shared field ${field} is not declared`);
    return value;
  }
  write(field: string, value: number, owner: IntroRunnerOwner): void {
    if (!this.fields.has(field)) throw new RangeError(`Intro shared field ${field} is not declared`);
    assertByte(value, field);
    this.fields.set(field, value);
    this.lastWriter.set(field, owner);
  }
  snapshot(): Record<string, number> {
    return Object.fromEntries([...this.fields.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}

export interface IntroRunnerOptions {
  /** Built over the display clock the runner advances; its IME/IE are the foreground's entry state. */
  cpu: IntroCpu;
  state: IntroSharedState;
  audio: IntroAudioOwner;
  /** The predictor for the VBlank handler's own Audio1_UpdateMusic. Default 'movie'. */
  vblankPredictor?: IntroAudioPredictor;
  /** A pure selector of the VBlank handler's predictor from the shared state (semantic audio readiness), evaluated once at
   *  each service's handler entry; the predictor, cost and audio version it yields are captured for that service. Overrides
   *  `vblankPredictor`. */
  selectVblankPredictor?: (state: IntroSharedState) => IntroAudioPredictor;
  /** hJoyInput's source at ReadJoypad's store. Default 0. */
  joypad?: () => number;
  /** Runs once after a GDMA stall's dots, with the stall's `which`. */
  gdma?: (which: 1 | 2) => void;
  /** Unused since note 135: the visible OAM is the display clock's own. Kept so existing callers still type-check. */
  visibleOam?: ArrayLike<number>;
  /** Also trace every handler instruction (default: only marked ones: routine, store, effect, RETI). */
  fullHandlerTrace?: boolean;
}

export interface IntroRunnerObservation {
  elapsed: number;
  ie: number;
  ime: boolean;
  imePending: boolean;
  pending: number;
  done: boolean;
  fields: Record<string, number>;
  shadowOam: number[];
  dmaSnapshot: number[] | null;
  visibleOam: number[];
}

type ForegroundGen = Generator<IntroForegroundStep, void, IntroHelperReply>;

export class IntroForegroundRunner {
  readonly events: IntroRunnerEvent[] = [];
  readonly state: IntroSharedState;
  readonly cpu: IntroCpu;
  /** Pass these to the stream factory so audio costs are forecast by the runner's owner and checked for freshness. */
  readonly sources: IntroHelperSources;

  private readonly audio: IntroAudioOwner;
  private readonly vblankPredictor: IntroAudioPredictor;
  private readonly selectPredictor: ((state: IntroSharedState) => IntroAudioPredictor) | undefined;
  private readonly joypad: () => number;
  private readonly onGdma: ((which: 1 | 2) => void) | undefined;
  private readonly fullHandlerTrace: boolean;
  private readonly gen: ForegroundGen;
  private started = false;
  private finished = false;
  private failed: string | null = null;
  private reply: IntroHelperReply = 0;
  private handler: Generator<IntroHandlerStep> | null = null;
  private handlerOwner: IntroRunnerOwner = 'vblank';
  private handlerForecast: AudioForecast | null = null;
  private forecast: AudioForecast | null = null;
  /** Completions taken from the clock but not yet traced (their dot is later than the effect being traced). */
  private held: { completion: number }[] = [];

  constructor(options: IntroRunnerOptions, makeStream: (sources: IntroHelperSources) => ForegroundGen) {
    this.cpu = options.cpu;
    this.state = options.state;
    this.audio = options.audio;
    this.vblankPredictor = options.vblankPredictor ?? 'movie';
    this.selectPredictor = options.selectVblankPredictor;
    this.joypad = options.joypad ?? (() => 0);
    this.onGdma = options.gdma;
    this.fullHandlerTrace = options.fullHandlerTrace ?? false;
    this.sources = {
      audioCycles: predictor => {
        const cycles = this.audio.forecast(predictor);
        this.forecast = { cycles, version: this.audio.version, predictor };
        return cycles;
      },
      lcdEnabled: () => this.cpu.display.lcdOn,
    };
    this.gen = makeStream(this.sources);
  }

  get elapsed(): number { return this.cpu.elapsed; }
  get done(): boolean { return this.finished; }
  /** A handler is mid-service (between its dispatch and its RETI). */
  get inHandler(): boolean { return this.handler !== null; }
  /** What the display scans now: the last completed OAM DMA's snapshot. */
  get visibleOam(): Uint8Array { return this.cpu.display.oam; }
  /** A DMA is running: its snapshot and start dot. */
  get dmaInFlight(): { snapshot: Uint8Array; start: number } | null {
    const dma = this.cpu.display.oamDma;
    return dma ? { snapshot: dma.oam, start: dma.start } : null;
  }

  observe(): IntroRunnerObservation {
    return {
      elapsed: this.cpu.elapsed, ie: this.cpu.ie, ime: this.cpu.ime, imePending: this.cpu.imePending,
      pending: this.cpu.display.pending, done: this.finished, fields: this.state.snapshot(),
      shadowOam: [...this.state.shadowOam], dmaSnapshot: this.cpu.display.oamDma ? [...this.cpu.display.oamDma!.oam] : null, visibleOam: [...this.cpu.display.oam],
    };
  }

  /** Advance by one step. A failing step appends a `fault` event and rethrows; the runner stays failed. */
  step(): IntroRunnerStepKind {
    if (this.failed !== null) throw new RangeError(this.failed);
    if (this.finished) return 'done';
    try {
      const kind = this.advance();
      this.flush();
      return kind;
    } catch (error) {
      this.flush();   // completions that succeeded before the fault; the refused one never reaches the log
      const message = error instanceof Error ? error.message : String(error);
      this.failed = message;
      this.events.push({ kind: 'fault', dot: this.cpu.elapsed, message });
      throw error;
    }
  }

  /** Steps until the finish event or `maxSteps`; returns the steps taken. */
  run(maxSteps: number): number {
    let taken = 0;
    while (taken < maxSteps && !this.finished) { this.step(); taken++; }
    return taken;
  }

  /** Steps until the clock reaches `dot` or the stream finishes. A step is never split, so the clock may pass `dot`. */
  runUntil(dot: number): void {
    while (!this.finished && this.cpu.elapsed < dot) this.step();
  }

  runToEnd(limit = 2_000_000): void {
    if (this.run(limit) >= limit && !this.finished) throw new RangeError('Intro foreground runner did not finish');
  }

  private advance(): IntroRunnerStepKind {
    if (this.handler) return this.handlerStep();
    const start = this.cpu.elapsed, before = this.cpu.display.pending;
    const vector = this.cpu.interrupt();
    if (vector !== null) {
      this.flush();
      this.events.push({
        kind: 'interrupt', vector: vector === INTRO_IF_VBLANK ? 'vblank' : 'stat', start, end: this.cpu.elapsed,
        pendingBefore: before, pendingAfter: this.cpu.display.pending,
      });
      this.startHandler(vector);
      return 'interrupt';
    }
    const next = this.started ? this.gen.next(this.reply) : this.gen.next();
    this.started = true;
    if (next.done) {
      this.finished = true;
      this.events.push({ kind: 'finish', dot: this.cpu.elapsed });
      return 'finish';
    }
    const step = next.value;
    if ('kind' in step) return this.aggregate('foreground', step);
    return this.instruction(step);
  }

  // ---- foreground instruction ------------------------------------------------------------------------------------

  private instruction(step: IntroHelperInsn): IntroRunnerStepKind {
    const start = this.cpu.elapsed, end = start + step.cycles * INTRO_DOTS_PER_CYCLE;
    const cpu = this.cpu;
    const increment = step.store?.value === 'increment-read';
    if (step.read && step.store && !increment) throw new RangeError('Intro foreground instruction with both a read and a store is unmodelled');
    let reply: IntroHelperReply = 0;
    const flags = (step.halt ? 1 : 0) + (step.di ? 1 : 0) + (step.ei ? 1 : 0);
    if (flags > 1 || (flags === 1 && (step.read || step.store))) throw new RangeError('Intro foreground instruction mixes control kinds');
    if (step.halt) {
      if (step.cycles !== 1) throw new RangeError('Intro HALT is one machine cycle');
      reply = cpu.halt();
      this.flush();
      this.events.push({ kind: 'halt', start, end: cpu.elapsed, result: reply });
      this.reply = reply;
      return 'halt';
    }
    const events = this.events;
    if (increment) {
      reply = this.incrementLoadedObjects(step, end);
    } else if (step.read) {
      const read = step.read;
      let value = 0;
      cpu.exec(step.cycles, () => {
        this.flush(end - read.trailingDots);
        value = this.readField(read.field);
        events.push({ kind: 'read', owner: 'foreground', dot: end - read.trailingDots, field: read.field, value });
      }, read.trailingDots);
      reply = value;
    } else if (step.store) {
      this.foregroundStore(step, step.store, end);
    } else if (step.di) {
      cpu.di();
    } else if (step.ei) {
      cpu.ei();
    } else {
      cpu.exec(step.cycles);
    }
    this.flush();
    const insn: IntroRunnerEvent = { kind: 'insn', owner: 'foreground', start, end: cpu.elapsed, cycles: step.cycles, op: step.op };
    if (step.routine) insn.routine = step.routine;
    events.push(insn);
    this.reply = reply;
    return 'foreground';
  }

  private incrementLoadedObjects(step: IntroHelperInsn, end: number): number {
    const field = 'wNumLoadedAnimatedObjects';
    if (step.read?.field !== field || step.read.trailingDots !== 8 || step.store?.field !== field ||
        step.store.trailingDots !== 4 || step.publishes) throw new RangeError('Unmeasured intro increment store');
    const storeDot = end - 4;
    let before = 0;
    this.cpu.exec(step.cycles, () => {
      this.flush(storeDot);
      const value = (before + 1) & 255;
      this.state.write(field, value, 'foreground');
      this.events.push({ kind: 'store', owner: 'foreground', dot: storeDot, field, value });
    }, 4, () => {
      const readDot = this.cpu.elapsed;
      this.flush(readDot);
      before = this.state.read(field);
      this.events.push({ kind: 'read', owner: 'foreground', dot: readDot, field, value: before });
    });
    return before;
  }

  private foregroundStore(step: IntroHelperInsn, store: NonNullable<IntroHelperInsn['store']>, end: number): void {
    const value = store.value;
    if (typeof value !== 'number') throw new RangeError(`Intro foreground store to ${store.field} needs a value`);
    assertByte(value, store.field);
    const cpu = this.cpu;
    const dot = end - store.trailingDots;
    switch (store.field) {
      case 'rIF':
        if (store.trailingDots !== INTRO_IF_STORE_TRAILING_DOTS) throw new RangeError('Intro IF store has an unmeasured effect point');
        cpu.storeIf(value, step.cycles);
        this.flush(dot);
        this.events.push({ kind: 'store', owner: 'foreground', dot, field: store.field, value });
        break;
      case 'rIE':
        if (store.trailingDots !== 4) throw new RangeError('Intro IE store has an unmeasured effect point');
        cpu.storeIe(value, step.cycles);
        this.flush(dot);
        this.events.push({ kind: 'store', owner: 'foreground', dot, field: store.field, value });
        break;
      default:
        cpu.exec(step.cycles, () => {
          this.flush(dot);            // a DMA completed before this effect is traced before it
          this.applyStore('foreground', store.field, value);
          if (step.publishes) this.audio.publish?.(step.publishes, store.field, value, dot);
          this.events.push({ kind: 'store', owner: 'foreground', dot, field: store.field, value });
        }, store.trailingDots);
    }
  }

  /** A store the foreground makes that lands in a register or a shared field (not rIF/rIE, which IntroCpu owns). */
  private applyStore(owner: IntroRunnerOwner, field: string, value: number): void {
    const display = this.cpu.display;
    const oam = SHADOW_OAM.exec(field);
    if (oam) {
      const index = Number(oam[1]);
      if (index >= INTRO_OAM_BYTES) throw new RangeError('Intro shadow OAM index out of range');
      this.state.shadowOam[index] = value;
      return;
    }
    switch (field) {
      case 'rLCDC': display.writeLcdc(value); return;
      case 'rSCX': display.writeScx(value); return;
      case 'rWY': display.writeWy(value); return;
      case 'rWX': display.writeWx(value); return;
      case 'rSTAT': display.writeMode0Select((value & 0x08) !== 0); return;
      case 'rDMA': this.startDma(owner); return;
      default:
        // hardware registers the display does not model (palette ports, ROM bank) are timing-only; declared fields are state
        if (this.state.has(field)) this.state.write(field, value, owner);
    }
  }

  private readField(field: string): number {
    const display = this.cpu.display;
    const oam = SHADOW_OAM.exec(field);
    if (oam) return this.state.shadowOam[Number(oam[1])];
    switch (field) {
      case 'rLY': return display.readLy();
      case 'rSTAT': return display.readMode() | (display.mode0Enabled ? 0x08 : 0);
      case 'rLCDC': return display.lcdc;
      case 'rIF': return 0xe0 | display.pending;
      case 'rIE': return this.cpu.ie;
      default: return this.state.read(field);
    }
  }

  // ---- aggregates ------------------------------------------------------------------------------------------------

  private aggregate(owner: IntroRunnerOwner, step: IntroHelperAudio | IntroHelperGdma): IntroRunnerStepKind {
    const cpu = this.cpu;
    if (cpu.ime || cpu.imePending) throw new RangeError('Intro aggregate timing requires IME effectively off');
    const start = cpu.elapsed;
    if (step.kind === 'gdma') {
      if (!Number.isSafeInteger(step.dots) || step.dots < 1) throw new RangeError('Invalid intro GDMA dots');
      cpu.display.advance(step.dots);
      this.flush();
      this.onGdma?.(step.which);
      this.events.push({ kind: 'gdma', owner, start, end: cpu.elapsed, which: step.which });
    } else {
      this.takeForecast(step.cycles, step.predictor, this.forecast);
      this.forecast = null;
      cpu.display.advance(step.cycles * INTRO_DOTS_PER_CYCLE);
      this.flush();
      this.audio.update(step.predictor);
      this.events.push({ kind: 'audio', owner, start, end: cpu.elapsed, cycles: step.cycles, predictor: step.predictor });
    }
    this.reply = 0;
    return 'aggregate';
  }

  /** An audio step's cost must be the forecast the owner gave for THIS call, from the owner's current state. */
  private takeForecast(cycles: number, predictor: IntroAudioPredictor, forecast: AudioForecast | null): void {
    if (!forecast) throw new RangeError('Intro audio call without a fresh forecast');
    if (forecast.predictor !== predictor) throw new RangeError('Intro audio call predictor differs from its forecast');
    if (forecast.cycles !== cycles) throw new RangeError('Intro audio call cost differs from its forecast');
    if (forecast.version !== this.audio.version) throw new RangeError('Intro audio forecast is stale: the audio state changed after it');
  }

  // ---- interrupt handlers ----------------------------------------------------------------------------------------

  private startHandler(vector: IntroDisplayInterrupt): void {
    if (vector === INTRO_IF_VBLANK) {
      const predictor = this.selectPredictor?.(this.state) ?? this.audio.selectPredictor?.() ?? this.vblankPredictor;
      const cycles = this.audio.forecast(predictor);
      this.handlerForecast = { cycles, version: this.audio.version, predictor };
      const inputs = {} as Record<string, number>;
      for (const key of INTRO_VBLANK_INPUT_KEYS) inputs[key] = this.state.read(key);
      this.handler = introVBlankSteps(inputs as unknown as IntroVBlankInputs, cycles);
      this.handlerOwner = 'vblank';
    } else {
      this.handler = introLcdcSteps(this.state.read('hLCDCPointer'));
      this.handlerOwner = 'stat';
    }
  }

  private handlerStep(): IntroRunnerStepKind {
    const owner = this.handlerOwner, cpu = this.cpu, handler = this.handler!;
    const next = handler.next();
    if (next.done) throw new RangeError('Intro handler ended without RETI');
    const step = next.value;
    const start = cpu.elapsed;
    if (step.routine === 'Audio1_UpdateMusic' && !step.store && !step.effect && !step.reti) {
      const predictor = this.handlerForecast?.predictor ?? this.vblankPredictor;
      this.takeForecast(step.cycles, predictor, this.handlerForecast);
      this.handlerForecast = null;
      cpu.display.advance(step.cycles * INTRO_DOTS_PER_CYCLE);
      this.flush();
      this.audio.update(predictor);
      this.events.push({ kind: 'audio', owner, start, end: cpu.elapsed, cycles: step.cycles, predictor });
      this.events.push({ kind: 'insn', owner, start, end: cpu.elapsed, cycles: step.cycles, routine: step.routine });
      return 'handler';
    }
    const dot = start + step.cycles * INTRO_DOTS_PER_CYCLE - 4;
    if (step.reti) {
      if (step.cycles !== 4) throw new RangeError('Intro handler RETI is four machine cycles');
      cpu.reti();
      this.handler = null;
    } else if (step.store || step.effect) {
      cpu.exec(step.cycles, () => this.handlerWrites(owner, step));
    } else {
      cpu.exec(step.cycles);
    }
    const marked = step.routine || step.store || step.effect || step.reti;
    this.flush(dot);
    if (step.store) this.events.push(this.handlerStoreEvent(owner, step, dot));
    if (step.effect) this.events.push(this.handlerEffectEvent(owner, step, dot));
    this.flush();
    if (this.fullHandlerTrace || marked) {
      const insn: IntroRunnerEvent = { kind: 'insn', owner, start, end: cpu.elapsed, cycles: step.cycles };
      if (step.reti) insn.op = 'reti';
      if (step.routine) insn.routine = step.routine;
      this.events.push(insn);
    }
    return 'handler';
  }

  private handlerStoreField(step: IntroHandlerStep): { field: string; value: number } {
    switch (step.store) {
      case 'scx': return { field: 'rSCX', value: this.state.read('hSCX') };
      case 'scy': return { field: 'rSCY', value: this.state.read('hSCY') };
      case 'wy': return { field: 'rWY', value: this.state.read('hWY') };
      case 'dma': return { field: 'rDMA', value: 0 };
      case 'nr50': return { field: 'rNR50', value: 0x77 };
      default: throw new RangeError('Intro handler store is unknown');
    }
  }

  private handlerStoreEvent(owner: IntroRunnerOwner, step: IntroHandlerStep, dot: number): IntroRunnerEvent {
    const { field, value } = this.handlerStoreField(step);
    return { kind: 'store', owner, dot, field, value };
  }

  private handlerEffectEvent(owner: IntroRunnerOwner, step: IntroHandlerStep, dot: number): IntroRunnerEvent {
    const effect = step.effect!;
    const field = effectField(effect);
    return { kind: 'effect', owner, dot, name: effect, field, value: this.state.read(field) };
  }

  /** The write itself, at the step's store point (four dots before the instruction ends). */
  private handlerWrites(owner: IntroRunnerOwner, step: IntroHandlerStep): void {
    if (step.store) {
      const { field, value } = this.handlerStoreField(step);
      this.applyStore(owner, field, value); // rSCY/rNR50 have no display model: timing-only, no state
    }
    switch (step.effect) {
      case undefined: return;
      case 'advance-bg-transfer-portion': {
        const portion = this.state.read('hAutoBGTransferPortion');
        this.state.write('hAutoBGTransferPortion', portion === 0 ? 1 : portion === 1 ? 2 : 0, owner);
        return;
      }
      case 'clear-vblank-occurred': this.state.write('hVBlankOccurred', 0, owner); return;
      case 'decrement-frame-counter': {
        const counter = this.state.read('hFrameCounter');
        if (counter === 0) throw new RangeError('Intro handler decremented a zero frame counter');
        this.state.write('hFrameCounter', counter - 1, owner);
        return;
      }
      case 'consume-copy': this.state.write('hVBlankCopySize', 0, owner); return;
      case 'sample-joypad': this.state.write('hJoyInput', this.joypad(), owner); return;
    }
  }

  // ---- OAM DMA ---------------------------------------------------------------------------------------------------

  /** The rDMA store effect: the display clock copies the shadow bytes now and latches them at start + 642 on its own
   *  clock (note 135), so a scan inside a long step sees the new OAM and the overlap guard runs at the true dot. */
  private startDma(owner: IntroRunnerOwner): void {
    this.cpu.display.startOamDma(this.state.shadowOam);
    this.events.push({ kind: 'effect', owner, dot: this.cpu.elapsed, name: 'oam-dma-start' });
  }

  /** Trace the clock's completed DMAs whose dot is at or before `limit` (default: all), in order. The rest wait, so a
   *  read or store effect earlier than a completion is traced before it. */
  private flush(limit = Infinity): void {
    this.held.push(...this.cpu.display.takeOamCompletions());
    while (this.held.length && this.held[0].completion <= limit) {
      const { completion } = this.held.shift()!;
      this.events.push({ kind: 'oam-latch', completion, dot: completion });
    }
  }
}

function effectField(effect: NonNullable<IntroHandlerStep['effect']>): string {
  switch (effect) {
    case 'advance-bg-transfer-portion': return 'hAutoBGTransferPortion';
    case 'clear-vblank-occurred': return 'hVBlankOccurred';
    case 'decrement-frame-counter': return 'hFrameCounter';
    case 'consume-copy': return 'hVBlankCopySize';
    case 'sample-joypad': return 'hJoyInput';
  }
}
