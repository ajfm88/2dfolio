import { FRAME_TIME } from './constants.js';

export class GameLoop {
   accumulator = 0;
   lastTime = 0;
   rafId = 0;
   running = false;
    callbacks;

  constructor(callbacks) {
    this.callbacks = callbacks;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Run exactly one fixed-timestep update plus a render, outside the rAF loop.
   * Debug only (__zelda.step): a background tab freezes requestAnimationFrame, so
   * automated verification has no other way to make frames elapse.
   */
  stepOnce() {
    this.callbacks.update(FRAME_TIME);
    this.callbacks.render();
  }

   tick(now) {
    if (!this.running) return;

    const elapsed = Math.min(now - this.lastTime, FRAME_TIME * 5);
    this.lastTime = now;
    this.accumulator += elapsed;

    while (this.accumulator >= FRAME_TIME) {
      this.callbacks.update(FRAME_TIME);
      this.accumulator -= FRAME_TIME;
    }

    this.callbacks.render();
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

   onVisibilityChange() {
    if (document.hidden) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    } else {
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.running = true;
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
  }
}
