// Fixed-rate game clock for the tick loop in main.ts.

/** Game Boy frame rate: one LCD frame is 70224 cycles of the 4.194304 MHz clock (≈59.7275 Hz). */
export const GB_FPS = 4194304 / 70224;

export const MIN_FPS = 10;
export const MAX_FPS = 200;
/** Most ticks one call may run; a longer gap (paused, tab frozen) drops the backlog. */
export const MAX_TICKS_PER_CALL = 4;

/**
 * Counts the ticks due at each rAF / worker call. Leftover time carries over to
 * the next call, so the average rate is the target on any refresh rate.
 * (Upstream reset to `now` on every call, which dropped the remainder: its
 * 50 fps ran 30 ticks/s on a 60 Hz display.)
 */
export class TickClock {
  private frameMs: number;
  private last = 0;

  constructor(fps: number) {
    this.frameMs = 1000 / fps;
  }

  setFps(fps: number): void {
    this.frameMs = 1000 / fps;
  }

  /** How many ticks to run at `now` (ms, performance.now() timebase). */
  due(now: number): number {
    const elapsed = now - this.last;
    if (elapsed < this.frameMs) return 0;
    const ticks = Math.floor(elapsed / this.frameMs);
    if (ticks > MAX_TICKS_PER_CALL) {
      this.last = now;
      return MAX_TICKS_PER_CALL;
    }
    this.last += ticks * this.frameMs;
    return ticks;
  }
}

/** The `-` / `+` stops: multiples of 5 from MIN_FPS to MAX_FPS, plus the Game Boy rate. */
export function stepFps(fps: number, dir: 1 | -1): number {
  const stops: number[] = [];
  for (let f = MIN_FPS; f <= MAX_FPS; f += 5) stops.push(f);
  stops.push(GB_FPS);
  stops.sort((a, b) => a - b);
  const EPS = 1e-6;
  if (dir > 0) return stops.find(s => s > fps + EPS) ?? MAX_FPS;
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i] < fps - EPS) return stops[i];
  }
  return MIN_FPS;
}
