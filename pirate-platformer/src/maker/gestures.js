const ZOOM_LEVELS = [0.5, 1, 2];

/**
 * @param {number} current
 * @param {1 | -1} dir
 */
function neighbourZoom(current, dir) {
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < ZOOM_LEVELS.length; i++) {
    const d = Math.abs(ZOOM_LEVELS[i] - current);
    if (d < best) {
      best = d;
      idx = i;
    }
  }
  const next = idx + dir;
  if (next < 0) return ZOOM_LEVELS[0];
  if (next >= ZOOM_LEVELS.length) return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  return ZOOM_LEVELS[next];
}

/**
 * @param {ReturnType<import('../core/input.js').createInput>} input
 * @param {{
 *   longPressMs?: number,
 *   moveThreshold?: number,
 *   isPanMode?: () => boolean,
 * }} [opts]
 */
export function createGestures(input, opts = {}) {
  const longPressS = (opts.longPressMs ?? 300) / 1000;
  const moveThreshold = opts.moveThreshold ?? 4;
  const isPanMode = opts.isPanMode ?? (() => false);

  /** @type {string} */
  let state = 'idle';
  let elapsed = 0;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;
  let startDist = 1;
  let prevMx = 0;
  let prevMy = 0;
  // After eyedrop, the finger is still down; consume it until lift so we do not
  // re-enter longPress and fire again.
  let ignoreUntilLift = false;

  const out = {
    state: 'idle',
    paintX: 0,
    paintY: 0,
    paintPressed: false,
    paintReleased: false,
    panDx: 0,
    panDy: 0,
    /** @type {number | null} */
    zoomSnap: null,
    zoomCenterX: 0,
    zoomCenterY: 0,
    eyedropX: 0,
    eyedropY: 0,
    eyedropFired: false,
    active: false,

    /**
     * @param {number} dt
     * @param {number} [zoom]
     */
    update(dt, zoom = 1) {
      out.paintPressed = false;
      out.paintReleased = false;
      out.panDx = 0;
      out.panDy = 0;
      out.zoomSnap = null;
      out.eyedropFired = false;

      const touches = input.touches;
      const n = touches.length;
      out.active = n > 0;

      if (n === 0) {
        if (state === 'onePaint') out.paintReleased = true;
        state = 'idle';
        ignoreUntilLift = false;
        out.state = state;
        return;
      }

      if (n >= 2) {
        if (state === 'onePaint') out.paintReleased = true;
        stepTwoFinger(touches, state !== 'twoFinger', zoom);
        ignoreUntilLift = false;
        out.state = state;
        return;
      }

      // One finger.
      if (ignoreUntilLift) {
        out.state = 'idle';
        return;
      }

      const t = touches[0];

      if (state === 'twoFinger') {
        // Spec: fewer than 2 fingers → idle. Remaining finger starts a new
        // one-finger gesture this frame.
        state = 'idle';
      }

      if (state === 'idle') {
        if (isPanMode()) {
          state = 'onePan';
          prevX = t.x;
          prevY = t.y;
        } else {
          state = 'longPress';
          elapsed = 0;
          startX = t.x;
          startY = t.y;
        }
      }

      if (state === 'longPress') {
        elapsed += dt;
        const moved = Math.hypot(t.x - startX, t.y - startY);
        if (moved > moveThreshold) {
          state = 'onePaint';
          out.paintPressed = true;
          out.paintX = t.x;
          out.paintY = t.y;
        } else if (elapsed >= longPressS) {
          out.eyedropFired = true;
          out.eyedropX = t.x;
          out.eyedropY = t.y;
          state = 'idle';
          ignoreUntilLift = true;
        }
      } else if (state === 'onePaint') {
        out.paintX = t.x;
        out.paintY = t.y;
      } else if (state === 'onePan') {
        out.panDx = t.x - prevX;
        out.panDy = t.y - prevY;
        prevX = t.x;
        prevY = t.y;
      }

      out.state = state;
    },

    reset() {
      state = 'idle';
      elapsed = 0;
      ignoreUntilLift = false;
      out.state = 'idle';
      out.paintPressed = false;
      out.paintReleased = false;
      out.panDx = 0;
      out.panDy = 0;
      out.zoomSnap = null;
      out.eyedropFired = false;
      out.active = false;
    },
  };

  /**
   * @param {Array<{ id: number, x: number, y: number }>} touches
   * @param {boolean} justEntered
   * @param {number} zoom
   */
  function stepTwoFinger(touches, justEntered, zoom) {
    state = 'twoFinger';
    const t0 = touches[0];
    const t1 = touches[1];
    const mx = (t0.x + t1.x) / 2;
    const my = (t0.y + t1.y) / 2;
    const d = Math.hypot(t1.x - t0.x, t1.y - t0.y);
    if (justEntered) {
      startDist = d > 0 ? d : 1;
      prevMx = mx;
      prevMy = my;
      return;
    }
    out.panDx = mx - prevMx;
    out.panDy = my - prevMy;
    prevMx = mx;
    prevMy = my;
    const ratio = d / startDist;
    if (ratio > 1.4) {
      const next = neighbourZoom(zoom, 1);
      if (next !== zoom) {
        out.zoomSnap = next;
        out.zoomCenterX = mx;
        out.zoomCenterY = my;
      }
      startDist = d > 0 ? d : startDist;
    } else if (ratio < 0.7) {
      const next = neighbourZoom(zoom, -1);
      if (next !== zoom) {
        out.zoomSnap = next;
        out.zoomCenterX = mx;
        out.zoomCenterY = my;
      }
      startDist = d > 0 ? d : startDist;
    }
  }

  return out;
}
