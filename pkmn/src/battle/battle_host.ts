// Unused A5c3 host. home/vblank.asm order, home/window.asm PrintText;
// note 68 §10.5, §11.1 answer 7 and §11.12 define the frame protocol.
import { BattleMenuScreen } from './battle_menu_screen';
import { A, decodeNick, type BattleState } from './battle_state';
import type { Frame, Program } from './battle_menu_context';
import type { PlaceActors } from '../text/text_printer';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';

export class BattleHost<T = void> {
  private program: Program<T> | undefined;
  private pending: IteratorResult<Frame, T> | undefined;
  private readonly actors: PlaceActors;

  /** Production leaves audio a no-op: main.tickAudio already owns its clock.
   * Tests inject their engines' audioUpdate, on serviced frames only. */
  constructor(state: BattleState, readonly video = new BattleMenuScreen(), private readonly audio: () => void = () => {}) {
    this.actors = {
      get whoseTurn() { return state.hWhoseTurn; },
      get battleMonNick() { return decodeNick(state.mem, A.wBattleMonNick); },
      get enemyMonNick() { return decodeNick(state.mem, A.wEnemyMonNick); },
    };
  }

  /** Prime CPU work in the starting frame, before the first frame step. */
  start(program: Program<T>): void {
    if (this.pending && !this.pending.done) throw new Error('battle program already running');
    this.program = program;
    this.pending = program.next();
  }

  get done(): boolean { return this.pending?.done ?? true; }
  get result(): T | undefined { return this.pending?.done ? this.pending.value : undefined; }

  /** Complete the pending frame, then resume CPU work up to the next yield. */
  step(): Frame | null {
    if (!this.pending || this.pending.done) return null;
    const frame = this.pending.value;
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
