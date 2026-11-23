// Note 137: the original geometric cutscene for the Vite development preview. UNUSED by the game: nothing under src/ imports
// this file or foreground_preview.ts. A 16x8 indexed raster, one background tile with a marker at (1,1), a three-pixel L
// sprite, three stages (2, 3 and 1 completed iterations), a Skip bit, and synthetic audio readiness. Tile and sprite bytes are
// generated here; no game asset, ROM byte or audio engine is involved. The scene only supplies the timed hooks the note 136
// program calls and a renderer that reads the display's visible OAM; the runner owns time, interrupts and DMA.
import { introForegroundProgram, type IntroProgramExit, type IntroProgramHooks } from '../src/menus/intro_foreground_program';
import { introDelayFrameSteps, type IntroForegroundStep, type IntroHelperReply } from '../src/menus/intro_helper_timing';
import { introQuietSharedFields, type IntroAudioOwner, type IntroAudioPredictor, type IntroSharedState } from '../src/menus/intro_foreground_runner';

type Gen = Generator<IntroForegroundStep, void, IntroHelperReply>;
type ByteGen = Generator<IntroForegroundStep, number, IntroHelperReply>;

export const PREVIEW_SKIP = 0x08;
export const PREVIEW_W = 16;
export const PREVIEW_H = 8;
export const PREVIEW_STAGES: readonly number[] = [2, 3, 1];
/** The L's anchor X by iteration (Y is 2). */
export const PREVIEW_POS_X: readonly number[] = [2, 2, 4, 6, 8, 8];
/** Synthetic audio callee costs in machine cycles: before readiness (setup) and after it (movie). */
export const PREVIEW_AUDIO_COST: Record<IntroAudioPredictor, number> = { setup: 60, movie: 90 };

const nop = (cycles: number, op: string): IntroForegroundStep => ({ cycles, op });
const ldh = (field: string): IntroForegroundStep => ({ cycles: 3, op: `ldh a,[${field}]`, read: { field, trailingDots: 4 } });
const st = (field: string, value: number, cycles = 3): IntroForegroundStep => ({ cycles, op: `ld [${field}],a`, store: { field, trailingDots: 4, value } });

/** A synthetic audio owner: two predictors, a version bump per update, and per-predictor counts. */
export class PreviewAudio implements IntroAudioOwner {
  version = 0;
  readonly counts: Record<IntroAudioPredictor, number> = { setup: 0, movie: 0 };
  forecast(predictor: IntroAudioPredictor): number { return PREVIEW_AUDIO_COST[predictor]; }
  update(predictor: IntroAudioPredictor): void { this.counts[predictor]++; this.version++; }
}

/** The fields the scene owns, on top of the quiet VBlank domain (hWY 144: no window, which the display clock refuses with objects). */
export function previewFields(initialInput: number): Record<string, number> {
  return {
    ...introQuietSharedFields(), hWY: 144, hJoyInput: initialInput,
    fSavedIE: 0, fAudioActive: 0, fInit: 0, fIter: 0, fStage: 0, fCleanup: 0, fFinished: 0, fPrev: 0, aReady: 0,
  };
}
/** Semantic audio readiness at VBlank handler entry: 2 is ready. A first publication (1) alone is not. */
export const previewPredictor = (state: IntroSharedState): IntroAudioPredictor => (state.read('aReady') >= 2 ? 'movie' : 'setup');

export function previewHooks(stageLengths: readonly number[] = PREVIEW_STAGES): IntroProgramHooks {
  let saved = 0;
  return {
    input: {
      skipMask: PREVIEW_SKIP,
      *seed(): ByteGen { const prev = (yield ldh('hJoyInput')) as number; yield st('fPrev', prev); return prev; },
      *poll(): ByteGen { const cur = (yield ldh('hJoyInput')) as number; yield nop(2, 'and SKIP'); yield st('fPrev', cur); return cur; },
      *branch(fresh: boolean): Gen { yield fresh ? nop(2, 'jr nz,.skip') : nop(3, 'jr'); },
    },
    stageLengths,
    *setup(): Gen {
      saved = (yield ldh('rIE')) as number;
      yield st('fSavedIE', saved);
      yield st('rIE', saved | 1);
      yield st('hVBlankCopySize', 1);          // one synthetic tile copy, consumed by the first VBlank service
      yield st('fAudioActive', 1);
      yield st('shadowOam.2', 1, 2); yield st('shadowOam.3', 0, 2);
      yield st('fInit', 1);
      for (const f of ['fIter', 'fStage', 'fCleanup', 'fFinished', 'aReady']) yield st(f, 0);
    },
    *enterStage(stage: number): Gen {
      yield st('fStage', stage + 1);
      if (stage === 1) yield st('aReady', 2);  // the explicit readiness effect: later services use the ready predictor
    },
    *work(iteration: number): Gen { yield st('shadowOam.1', PREVIEW_POS_X[Math.min(iteration, PREVIEW_POS_X.length - 1)] + 8, 2); yield st('shadowOam.0', 2 + 16, 2); },
    *wait(): Gen { yield* introDelayFrameSteps(); },
    *commit(done: number): Gen { yield st('fIter', done); },
    *cleanup(reason: IntroProgramExit): Gen {
      yield st('fCleanup', 1);
      yield* introDelayFrameSteps();
      yield st('hVBlankCopySize', 0); yield st('fAudioActive', 0); yield st('rIE', saved);
      yield st('fFinished', reason === 'skipped' ? 2 : 1);
    },
  };
}
export const previewStream = () => () => introForegroundProgram(previewHooks());

// ---- the renderer ---------------------------------------------------------------------------------------------------
const tile = (pixels: [number, number][], index: number): Uint8Array => { const t = new Uint8Array(64); for (const [x, y] of pixels) t[y * 8 + x] = index; return t; };
const BG_TILE = tile([[1, 1]], 1);
const L_TILE = tile([[0, 0], [0, 1], [1, 1]], 2);

/** Indexed pixels from the VISIBLE OAM (the OAM the display scans, i.e. after the DMA latch); `copied` is whether the
 *  synthetic tile copy has run. Reads only: nothing here advances a clock. */
export function renderPreview(visibleOam: ArrayLike<number>, copied: boolean): Uint8Array {
  const out = new Uint8Array(PREVIEW_W * PREVIEW_H);
  if (copied) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y * PREVIEW_W + x] = BG_TILE[y * 8 + x];
  const sx = visibleOam[1] - 8, sy = visibleOam[0] - 16;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const px = sx + x, py = sy + y;
    if (L_TILE[y * 8 + x] && px >= 0 && px < PREVIEW_W && py >= 0 && py < PREVIEW_H) out[py * PREVIEW_W + px] = L_TILE[y * 8 + x];
  }
  return out;
}
