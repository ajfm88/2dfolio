import { FIXED_DT } from '../settings.js';

/**
 * Screen shake as a camera offset. A fixed pattern, stepped once per fixed tick,
 * rather than random numbers or the clock, so a run always shakes the same way
 * (invariant 1). Each step is a direction; the size fades from `amplitude` to zero
 * as the shake runs out.
 */
const PATTERN = /** @type {const} */ ([
  [1, 0], [-1, 1], [0, -1], [1, 1], [-1, 0], [0, 1], [1, -1], [-1, -1],
]);

/**
 * Whole-pixel camera offset for a shake with `left` seconds remaining. Pure: writes
 * `out` and returns it, so the per-frame path allocates nothing.
 *
 * @param {number} left seconds of shake remaining
 * @param {number} duration seconds the whole shake lasts
 * @param {number} amplitude world px on each axis at the start
 * @param {{ x: number, y: number }} out
 * @returns {{ x: number, y: number }}
 */
export function shakeOffset(left, duration, amplitude, out) {
  if (left <= 0 || duration <= 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const size = amplitude * Math.min(1, left / duration);
  const step = Math.round((duration - left) / FIXED_DT) % PATTERN.length;
  // `+ 0` turns a -0 from rounding into 0, so a finished axis reads as plain zero.
  out.x = Math.round(PATTERN[step][0] * size) + 0;
  out.y = Math.round(PATTERN[step][1] * size) + 0;
  return out;
}
