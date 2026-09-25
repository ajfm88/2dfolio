import {
  WIPE_CLOSE,
  WIPE_COLOR,
  WIPE_FADE,
  WIPE_HOLD,
  WIPE_OPEN,
} from '../settings.js';

const COVER_AT = WIPE_CLOSE;
const OPEN_AT = WIPE_CLOSE + WIPE_HOLD;
const END_AT = WIPE_CLOSE + WIPE_HOLD + WIPE_OPEN;
const FADE_END_AT = WIPE_FADE * 2;

/**
 * Radius of the wipe's see-through hole as a fraction of the half-diagonal:
 * 1 → 0 while closing, 0 while covered, 0 → 1 while opening.
 *
 * @param {number} t seconds since the wipe started
 * @returns {number}
 */
export function holeFraction(t) {
  if (t <= 0) return 1;
  if (t < COVER_AT) return 1 - t / WIPE_CLOSE;
  if (t < OPEN_AT) return 0;
  if (t < END_AT) return (t - OPEN_AT) / WIPE_OPEN;
  return 1;
}

/**
 * Cover opacity for the reduced-motion fade: 0 → 1, then 1 → 0.
 *
 * @param {number} t seconds since the fade started
 * @returns {number}
 */
export function fadeAlpha(t) {
  if (t <= 0 || t >= FADE_END_AT) return 0;
  if (t < WIPE_FADE) return t / WIPE_FADE;
  return 1 - (t - WIPE_FADE) / WIPE_FADE;
}

/**
 * The mode-switch wipe, ported from Pirate Maker's expanding circle
 * (`28_finish/main.py` Transition): a ring whose border grows inward until the
 * screen is covered, the modes swap, then it shrinks back. Advanced only in fixed
 * steps; `draw` reads and never mutates.
 */
export function createTransition() {
  let active = false;
  let reduced = false;
  let covered = false;
  let t = 0;
  /** @type {(() => void) | null} */
  let onCover = null;
  /** @type {(() => void) | null} */
  let onEnd = null;

  return {
    get active() {
      return active;
    },

    /**
     * @param {{ reducedMotion: boolean, onCover: () => void, onEnd: () => void }} opts
     * @returns {boolean} false, doing nothing, while a wipe is already running
     */
    start(opts) {
      if (active) return false;
      active = true;
      reduced = opts.reducedMotion;
      covered = false;
      t = 0;
      onCover = opts.onCover;
      onEnd = opts.onEnd;
      return true;
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (!active) return;
      t += dt;
      if (!covered && t >= (reduced ? WIPE_FADE : COVER_AT)) {
        covered = true;
        if (onCover) onCover();
      }
      if (t >= (reduced ? FADE_END_AT : END_AT)) {
        const done = onEnd;
        active = false;
        onCover = null;
        onEnd = null;
        if (done) done();
      }
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} viewW
     * @param {number} viewH
     */
    draw(ctx, viewW, viewH) {
      if (!active) return;
      ctx.fillStyle = WIPE_COLOR;
      if (reduced) {
        ctx.globalAlpha = fadeAlpha(t);
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.globalAlpha = 1;
        return;
      }
      const r = holeFraction(t) * Math.hypot(viewW / 2, viewH / 2);
      if (r <= 0) {
        ctx.fillRect(0, 0, viewW, viewH);
        return;
      }
      ctx.beginPath();
      ctx.rect(0, 0, viewW, viewH);
      ctx.arc(viewW / 2, viewH / 2, r, 0, Math.PI * 2);
      ctx.fill('evenodd');
    },
  };
}
