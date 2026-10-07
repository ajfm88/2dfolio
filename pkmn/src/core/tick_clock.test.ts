import { describe, it, expect } from 'vitest';
import { GB_FPS, MAX_TICKS_PER_CALL, TickClock, stepFps } from './tick_clock';

/** Ticks run over `seconds` when called every `periodMs` (a display refresh or the worker). */
function ticksOver(fps: number, periodMs: number, seconds: number): { total: number; maxPerCall: number } {
  const clock = new TickClock(fps);
  clock.due(0);
  let total = 0;
  let maxPerCall = 0;
  for (let t = periodMs; t <= seconds * 1000; t += periodMs) {
    const n = clock.due(t);
    total += n;
    maxPerCall = Math.max(maxPerCall, n);
  }
  return { total, maxPerCall };
}

describe('tick clock', () => {
  it('uses the Game Boy frame rate', () => {
    expect(GB_FPS).toBeCloseTo(59.7275, 4);
  });

  // 60 s at the Game Boy rate is 3583.65 ticks
  it.each([
    ['60 Hz display', 1000 / 60],
    ['120 Hz display', 1000 / 120],
    ['144 Hz display', 1000 / 144],
    ['165 Hz display', 1000 / 165],
    ['background worker (8 ms)', 8],
  ])('keeps the Game Boy rate on a %s', (_label, periodMs) => {
    const { total, maxPerCall } = ticksOver(GB_FPS, periodMs, 60);
    expect(Math.abs(total - 60 * GB_FPS)).toBeLessThanOrEqual(1);
    expect(maxPerCall).toBeLessThanOrEqual(2);
  });

  it('keeps the leftover time: 50 fps on a 60 Hz display is 50 ticks/s, not 30', () => {
    expect(Math.abs(ticksOver(50, 1000 / 60, 60).total - 3000)).toBeLessThanOrEqual(1);
  });

  it('drops the backlog after a long gap instead of catching up', () => {
    const clock = new TickClock(GB_FPS);
    clock.due(0);
    expect(clock.due(5000)).toBe(MAX_TICKS_PER_CALL);
    expect(clock.due(5000 + 1000 / 60)).toBe(0);
    expect(clock.due(5000 + 2000 / 60)).toBe(1);
  });

  it('follows a rate change', () => {
    const clock = new TickClock(GB_FPS);
    clock.due(0);
    clock.setFps(100);
    expect(clock.due(10)).toBe(1);
  });
});

describe('fps steps', () => {
  it('stops at the Game Boy rate between 55 and 60', () => {
    expect(stepFps(55, 1)).toBe(GB_FPS);
    expect(stepFps(GB_FPS, 1)).toBe(60);
    expect(stepFps(60, -1)).toBe(GB_FPS);
    expect(stepFps(GB_FPS, -1)).toBe(55);
  });

  it('walks multiples of 5 and clamps at 10 and 200', () => {
    expect(stepFps(50, 1)).toBe(55);
    expect(stepFps(50, -1)).toBe(45);
    expect(stepFps(10, -1)).toBe(10);
    expect(stepFps(200, 1)).toBe(200);
  });
});
