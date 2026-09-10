import { FIXED_DT } from '../settings.js';

/**
 * @param {{ update: (dt: number) => void, render: () => void }} handlers
 */
export function createLoop({ update, render }) {
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
