// Note 137: the Vite development preview host for the original geometric cutscene. UNUSED by the game and absent from the
// production build (the dev page is game/dev/foreground-preview.html; nothing under src/ imports this file). No DOM access at
// module import: mountForegroundPreview(root) is explicit, and the controller is DOM-free so tests inject a scheduler, a clock
// and a render sink.
//
// Ownership. One PreviewSession owns one display clock, CPU, shared state, foreground runner and synthetic audio owner. The
// controller owns pacing: a TickClock at GB_FPS anchored at Start/Replay, an ABSOLUTE dot deadline advanced by one frame per due
// tick (an instruction's overshoot carries into the next target because the deadline never resets to the elapsed dots), one
// scheduled callback chain, and a generation that discards callbacks of an earlier session. Presenting a snapshot only reads: a
// render, resize or input callback never advances the runner.
import { TickClock, GB_FPS } from '../src/core/tick_clock';
import { DISPLAY_FRAME_DOTS, INTRO_OAM_BYTES, IntroDisplayClock } from '../src/menus/intro_display_clock';
import { IntroCpu } from '../src/menus/intro_cpu';
import { IntroForegroundRunner, IntroSharedState } from '../src/menus/intro_foreground_runner';
import {
  PREVIEW_H, PREVIEW_SKIP, PREVIEW_W, PreviewAudio, previewFields, previewPredictor, previewStream, renderPreview,
} from './foreground_preview_scene';

export { PREVIEW_SKIP, PREVIEW_W, PREVIEW_H };
/** The LCD is on and running when a session starts at this dot (an explicit, arbitrary phase). */
export const PREVIEW_PHASE = 4;

export interface PreviewFrame {
  /** Indexed pixels (PREVIEW_W x PREVIEW_H), built from the visible OAM. A fresh buffer each time. */
  raster: Uint8Array;
  /** The runner's absolute dots and the controller's deadline at this snapshot. */
  elapsed: number;
  deadline: number;
  stage: number;
  completed: number;
  services: number;
  audio: { setup: number; movie: number };
  finished: boolean;
}
export type PreviewState = 'idle' | 'running' | 'completed' | 'skipped' | 'fault';
export interface PreviewStatus { state: PreviewState; message?: string }
export interface PreviewSink { present(frame: PreviewFrame): void; status(status: PreviewStatus): void }
export interface PreviewScheduler { request(callback: (now: number) => void): number; cancel(handle: number): void }

/** The host's input: a held byte (a key) plus a one-sample pulse (the Skip button). The runner reads it only at the VBlank
 *  handler's joypad sample; the foreground reads the latched byte through the program. */
export class PreviewInput {
  held = 0;
  private pulse = false;
  press(): void { this.pulse = true; }
  /** The raw byte at a sample dot; consumes the pulse. */
  sample(): number { const value = this.held | (this.pulse ? PREVIEW_SKIP : 0); this.pulse = false; return value; }
  peek(): number { return this.held | (this.pulse ? PREVIEW_SKIP : 0); }
  release(): void { this.pulse = false; }
}

export class PreviewSession {
  readonly display: IntroDisplayClock;
  readonly cpu: IntroCpu;
  readonly state: IntroSharedState;
  readonly audio = new PreviewAudio();
  readonly runner: IntroForegroundRunner;
  closed = false;
  private copied = false;
  private scanned = 0;

  /** `inputAt` replaces the host input with a dot-indexed schedule (tests). */
  constructor(readonly input: PreviewInput, o: { phase?: number; inputAt?: (dot: number) => number } = {}) {
    const phase = o.phase ?? PREVIEW_PHASE;
    this.display = new IntroDisplayClock({ scx: 0, wy: 144, wx: 7, lcdc: 0xe3, oam: new Uint8Array(INTRO_OAM_BYTES), mode0Enabled: false, pending: 0 });
    this.display.advance(phase);
    this.cpu = new IntroCpu(this.display, { ie: 0, ime: true });
    const read = o.inputAt ?? (() => this.input.sample());
    // Held state captured at entry: the program seeds "previous" from it, so a held skip does not end a replay at once.
    this.state = new IntroSharedState(previewFields(o.inputAt ? o.inputAt(phase) : this.input.peek()));
    this.runner = new IntroForegroundRunner({
      cpu: this.cpu, state: this.state, audio: this.audio, joypad: () => read(this.cpu.elapsed), selectVblankPredictor: previewPredictor,
    }, previewStream());
  }

  get elapsed(): number { return this.runner.elapsed; }
  get done(): boolean { return this.runner.done; }
  get finishedState(): 'completed' | 'skipped' | null {
    const f = this.state.read('fFinished'); return f === 1 ? 'completed' : f === 2 ? 'skipped' : null;
  }

  /** Drive the runner until it reaches the absolute `deadline` or finishes. A step is never split, so the clock may pass it. */
  runTo(deadline: number): void {
    while (!this.runner.done && this.runner.elapsed < deadline) this.runner.step();
  }

  /** Read-only: advances nothing. */
  snapshot(deadline: number): PreviewFrame {
    const events = this.runner.events;
    for (; this.scanned < events.length; this.scanned++) {
      const e = events[this.scanned];
      if (e.kind === 'effect' && e.name === 'consume-copy') this.copied = true;
    }
    const services = events.filter(e => e.kind === 'interrupt' && e.vector === 'vblank').length;
    return {
      raster: renderPreview(this.runner.visibleOam, this.copied),
      elapsed: this.runner.elapsed, deadline, stage: this.state.read('fStage'), completed: this.state.read('fIter'), services,
      audio: { ...this.audio.counts }, finished: this.runner.done,
    };
  }

  /** Release the session's input and mark it closed (once). */
  release(): void { if (!this.closed) { this.closed = true; this.input.release(); } }
}

export interface PreviewDeps {
  scheduler: PreviewScheduler;
  /** The wall-clock timebase (ms), performance.now() in the browser. */
  now: () => number;
  sink: PreviewSink;
  fps?: number;
  /** Test hook: a dot-indexed raw input schedule instead of the host input. */
  inputAt?: (dot: number) => number;
  phase?: number;
}

export class ForegroundPreviewController {
  readonly input = new PreviewInput();
  session: PreviewSession | null = null;
  /** Counts of what the preview released and completed, for the lifecycle witnesses. */
  releases = 0;
  sessions = 0;
  private generation = 0;
  private handle: number | null = null;
  private clock: TickClock | null = null;
  private deadline = 0;
  private state: PreviewState = 'idle';

  constructor(private readonly deps: PreviewDeps) {}

  get status(): PreviewState { return this.state; }
  get absoluteDeadline(): number { return this.deadline; }
  get scheduled(): boolean { return this.handle !== null; }

  /** Start or Replay: a fresh session (display, CPU, state, runner, audio) and a fresh pacing timebase. */
  start(): void {
    this.stop();
    const id = ++this.generation;
    const session = new PreviewSession(this.input, { phase: this.deps.phase, inputAt: this.deps.inputAt });
    this.session = session; this.sessions++;
    // The wall-clock timebase starts here: the first due() only anchors (it may report ticks that never ran).
    this.clock = new TickClock(this.deps.fps ?? GB_FPS);
    this.clock.reset(this.deps.now());
    this.deadline = session.elapsed;
    this.setState('running');
    this.deps.sink.present(session.snapshot(this.deadline));
    this.schedule(id);
  }

  /** The Skip control: a fresh press at the next VBlank sample. Never bypasses the timed cleanup. */
  skip(): void { if (this.session && !this.session.closed) this.input.press(); }
  setHeld(bits: number): void { this.input.held = bits & 255; }

  /** Cancel the chain and release the live session (unmount). */
  unmount(): void { this.stop(); this.setState('idle'); }

  private stop(): void {
    if (this.handle !== null) { this.deps.scheduler.cancel(this.handle); this.handle = null; }
    this.generation++;                       // any callback of the old session is stale from here on
    if (this.session && !this.session.closed) { this.session.release(); this.releases++; }
  }

  private schedule(id: number): void {
    this.handle = this.deps.scheduler.request(now => this.onFrame(id, now));
  }

  private setState(state: PreviewState, message?: string): void {
    this.state = state; this.deps.sink.status(message === undefined ? { state } : { state, message });
  }

  private onFrame(id: number, now: number): void {
    const session = this.session;
    if (id !== this.generation || !session || session.closed) return;      // a late callback of an earlier session
    this.handle = null;
    try {
      const due = this.clock!.due(now);
      for (let i = 0; i < due && !session.done; i++) {
        this.deadline += DISPLAY_FRAME_DOTS;                                // absolute: overshoot carries forward
        session.runTo(this.deadline);
      }
    } catch (error) {
      session.release(); this.releases++;
      this.deps.sink.present(session.snapshot(this.deadline));
      this.setState('fault', error instanceof Error ? error.message : String(error));
      return;
    }
    this.deps.sink.present(session.snapshot(this.deadline));
    if (session.done) {
      const reason = session.finishedState ?? 'completed';
      session.release(); this.releases++;
      this.setState(reason);
      return;
    }
    this.schedule(id);
  }
}

// ---- the browser mount ----------------------------------------------------------------------------------------------
const PALETTE = [[0xe0, 0xf8, 0xd0], [0x34, 0x68, 0x56], [0x08, 0x18, 0x20]] as const;

/** Build the page's controls inside `root` and wire the controller to requestAnimationFrame and a pixelated canvas. Returns
 *  an unmount function. Nothing happens at module import. */
export function mountForegroundPreview(root: HTMLElement, win: Window = window): () => void {
  const doc = root.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.width = PREVIEW_W; canvas.height = PREVIEW_H;
  canvas.id = 'preview-canvas';
  canvas.style.cssText = `width:${PREVIEW_W * 24}px;height:${PREVIEW_H * 24}px;image-rendering:pixelated;border:1px solid #888;display:block`;
  const start = doc.createElement('button'); start.id = 'preview-start'; start.textContent = 'Start';
  const skip = doc.createElement('button'); skip.id = 'preview-skip'; skip.textContent = 'Skip'; skip.disabled = true;
  const info = doc.createElement('pre'); info.id = 'preview-status'; info.textContent = 'idle';
  root.append(canvas, start, skip, info);
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(PREVIEW_W, PREVIEW_H);
  const sink: PreviewSink = {
    present(frame) {
      for (let i = 0; i < frame.raster.length; i++) {
        const c = PALETTE[frame.raster[i]];
        image.data.set([c[0], c[1], c[2], 255], i * 4);
      }
      ctx.putImageData(image, 0, 0);
      info.textContent = `stage ${frame.stage}  iterations ${frame.completed}  services ${frame.services}  dots ${frame.elapsed}  audio setup ${frame.audio.setup} movie ${frame.audio.movie}`;
    },
    status(status) {
      const running = status.state === 'running';
      start.textContent = status.state === 'idle' ? 'Start' : 'Replay';
      skip.disabled = !running;
      info.dataset.state = status.state;
      if (!running) info.textContent = `${status.state}${status.message ? ': ' + status.message : ''}\n${info.textContent}`;
    },
  };
  // Optional slow motion for looking at the run: ?fps=3 (default: the Game Boy rate; the whole cutscene is only 7 frames).
  const requested = Number(new URL(win.location.href).searchParams.get('fps'));
  const fps = requested >= 0.5 && requested <= 200 ? requested : undefined;
  const controller = new ForegroundPreviewController({
    scheduler: { request: cb => win.requestAnimationFrame(cb), cancel: h => win.cancelAnimationFrame(h) },
    now: () => win.performance.now(), sink,
    fps,
  });
  const onStart = () => controller.start();
  const onSkip = () => controller.skip();
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'z') controller.setHeld(PREVIEW_SKIP); };
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'z') controller.setHeld(0); };
  start.addEventListener('click', onStart);
  skip.addEventListener('click', onSkip);
  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  return () => {
    start.removeEventListener('click', onStart); skip.removeEventListener('click', onSkip);
    win.removeEventListener('keydown', onKeyDown); win.removeEventListener('keyup', onKeyUp);
    controller.unmount(); root.replaceChildren();
  };
}
