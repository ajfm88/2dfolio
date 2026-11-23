// Note 136: a reusable foreground program for original cutscenes. UNUSED by the game: only tests import it. It owns the
// lifecycle ORDER and nothing else; the caller supplies every timed operation as a small generator over the existing
// IntroForegroundStep / IntroHelperReply protocol (note 134), and each yielded step passes through the runner one at a time,
// so interrupts, DMA latches and audio time stay with the runner and the display clock. The program adds no dot costs.
//
// Order (per run): setup once; the seed input; then per iteration: poll the input, branch, and on no fresh press the stage
// entry (when the supplied schedule says one is due), the iteration's work, its wait, and the commit of one completed
// iteration. A fresh press (`current & ~previous & skipMask`) at the poll returns before the stage entry and the wait, so
// it suppresses that iteration's transition. Natural completion ends after the last committed iteration (a press first seen
// during the final wait opens no further poll). Both exits run the one cleanup program with an explicit reason. Stage
// progress and the previous input are locals of the generator, so a new run over the same host state starts from stage zero.
import type { IntroForegroundStep, IntroHelperReply } from './intro_helper_timing';

type Gen = Generator<IntroForegroundStep, void, IntroHelperReply>;
type ByteGen = Generator<IntroForegroundStep, number, IntroHelperReply>;

export type IntroProgramExit = 'completed' | 'skipped';

export interface IntroProgramInput {
  /** The entry read: the seed for the previous input (its timed steps are the caller's). */
  seed(): ByteGen;
  /** One timed input poll; returns the byte read (the caller's steps include its own compare and previous-input store). */
  poll(): ByteGen;
  /** The branch instruction after the compare: taken (`fresh`) or not. */
  branch(fresh: boolean): Gen;
  /** The fresh-press mask. */
  skipMask: number;
}

export interface IntroProgramHooks {
  input: IntroProgramInput;
  /** Completed iterations per stage; stage k is entered when the sum of the earlier lengths have completed. */
  stageLengths: readonly number[];
  /** Once, before the seed read. */
  setup(): Gen;
  /** Stage `stage` (0-based) is due: entered after its first iteration's poll, before that iteration's work. */
  enterStage(stage: number): Gen;
  /** Iteration `iteration` (0-based) work, before its wait. */
  work(iteration: number, stage: number): Gen;
  /** The iteration's wait (for example one DelayFrame). */
  wait(iteration: number): Gen;
  /** One more iteration completed: `completed` is the new count. */
  commit(completed: number): Gen;
  /** Both exits: release resources and restore the saved IE. */
  cleanup(reason: IntroProgramExit): Gen;
}

export function* introForegroundProgram(hooks: IntroProgramHooks): Gen {
  const { input, stageLengths } = hooks;
  if (!stageLengths.length || stageLengths.some(n => !Number.isInteger(n) || n < 1)) throw new RangeError('Invalid intro program schedule');
  if (!Number.isInteger(input.skipMask) || input.skipMask < 1 || input.skipMask > 255) throw new RangeError('Invalid intro program skip mask');
  const starts: number[] = [];
  let total = 0;
  for (const length of stageLengths) { starts.push(total); total += length; }
  yield* hooks.setup();
  let previous = yield* input.seed();
  let completed = 0;
  let reason: IntroProgramExit = 'completed';
  while (completed < total) {
    const current = yield* input.poll();
    const fresh = (current & ~previous & input.skipMask) !== 0;
    previous = current;
    yield* input.branch(fresh);
    if (fresh) { reason = 'skipped'; break; }
    const stage = starts.indexOf(completed);
    if (stage >= 0) yield* hooks.enterStage(stage);
    yield* hooks.work(completed, starts.filter(start => start <= completed).length - 1);
    yield* hooks.wait(completed);
    completed++;
    yield* hooks.commit(completed);
  }
  yield* hooks.cleanup(reason);
}
