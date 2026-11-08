import { decodeBattleText } from './battle_text_codec';
// A5c3 host. home/vblank.asm order, home/window.asm PrintText;
// note 68 §10.5, §11.1 answer 7 and §11.12 define the frame protocol.
import { BattleMenuScreen } from './battle_menu_screen';
import { battleScreenFor, bindBattleScreen, type BattleScreen } from './battle_screen';
import { A, type BattleState } from './battle_state';
import type { Frame, Program } from './battle_menu_context';
import type { PlaceActors } from '../text/text_printer';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';

/** BattleIntroTiming already satisfies this. A local interface keeps that module off the live bundle. */
interface RasterTiming {
  readonly screen: BattleScreen;
  boundary(frame: Exclude<Frame, 'session'>): void;
}

export class BattleHost<T = void> {
  private program: Program<T> | undefined;
  private pending: IteratorResult<Frame, T> | undefined;
  private raster: RasterTiming | null = null;
  private readonly actors: PlaceActors;

  /** pret home/tilemap.asm:9-28; animations.asm:599-617: bind the host's screen and Buffer 2.
   * Production leaves audio a no-op: main.tickAudio already owns its clock.
   * Tests inject their engines' audioUpdate, on serviced frames only. */
  constructor(state: BattleState, readonly video = new BattleMenuScreen(battleScreenFor(state)), private readonly audio: () => void = () => {}) {
    bindBattleScreen(state, video.screen);
    this.actors = {
      get whoseTurn() { return state.hWhoseTurn; },
      get battleMonNick() { return decodeBattleText(state.mem, A.wBattleMonNick); },
      get enemyMonNick() { return decodeBattleText(state.mem, A.wEnemyMonNick); },
    };
  }

  /** note 79 §2.4. Seal and latch at the next step, before that step's VBlank, so the frame
   * main already presented keeps this frame's scroll. null unbinds; unbinding nothing is allowed. */
  bindRaster(timing: RasterTiming | null): void {
    if (timing === null) { this.raster = null; return; }
    if (this.raster) throw new Error('raster timing already bound');
    if (timing.screen !== this.video.screen) throw new Error('raster timing for another screen');
    this.raster = timing;
  }

  /** Prime CPU work in the starting frame, before the first frame step. */
  start(program: Program<T>): void {
    if (this.pending && !this.pending.done) throw new Error('battle program already running');
    this.program = program;
    this.pending = program.next();
  }

  get done(): boolean { return this.pending?.done ?? true; }
  get result(): T | undefined { return this.pending?.done ? this.pending.value : undefined; }
  /** The frame step() will complete next, or null when nothing is running. */
  get pendingFrame(): Frame | null {
    return this.pending && !this.pending.done ? this.pending.value : null;
  }

  /** Complete the pending frame, then resume CPU work up to the next yield.
   * Bound: boundary, then the existing serviced VBlank and audio. Held frames stay boundary-only.
   * A dark frame is one LCD-off tick: no VBlank and no audio, bound or unbound (note 79 §8.2). */
  step(): Frame | null {
    if (!this.pending || this.pending.done) return null;
    const frame = this.pending.value;
    if (this.raster) {
      if (frame === 'session') throw new Error('session frame during raster-timed intro');
      this.raster.boundary(frame);
    }
    if (frame === 'serviced') {
      this.video.vblank();
      this.audio();
    }
    // Held frames tick nothing; session frames were ticked by their owner.
    this.pending = this.program!.next();
    return frame;
  }

  *printText(program: string, bindings?: TextBindings, options: TextRunnerOptions = {}): Program {
    yield* this.video.printText(program, bindings, { actors: this.actors, ...options });
  }
}
