import { FRAME_TIME } from './constants.js';

export interface GameCallbacks {
  update(dt: number): void;
  render(): void;
}

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private readonly callbacks: GameCallbacks;

  constructor(callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private tick(now: number): void {
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

  private onVisibilityChange(): void {
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
