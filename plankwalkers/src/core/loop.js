import { FIXED_DT } from '../settings.js';

/**
 * Fixed-timestep loop. `onFrame`, when passed, is measurement only: it receives
 * how long the frame's work took and the raw interval since the previous frame.
 * It is not gameplay, and it is not called unless the caller passed it.
 *
 * @param {{
 *   update: (dt: number) => void,
 *   render: () => void,
 *   onFrame?: (workMs: number, intervalMs: number) => void,
 * }} handlers
 */
export function createLoop({ update, render, onFrame }) {
  let lastTime = 0;
  let accumulator = 0;
  let running = false;
  let raf = 0;

  /**
   * @param {number} timestamp
   */
  function frame(timestamp) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    if (lastTime === 0) {
      lastTime = timestamp;
      render();
      return;
    }

    // Timing stays behind this branch so a normal frame does no extra work.
    let start = 0;
    let intervalMs = 0;
    if (onFrame) {
      start = performance.now();
      intervalMs = timestamp - lastTime;
    }

    let delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (delta > 0.2) delta = 0.2;

    accumulator += delta;

    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 5) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 5) accumulator = 0;

    render();
    if (onFrame) onFrame(performance.now() - start, intervalMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      accumulator = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
