import { describe, expect, it } from 'vitest';

import { createFrameStats } from './frame-stats.js';

/** @returns {{ avgWork: number, maxWork: number, fps: number, count: number }} */
function blank() {
  return { avgWork: -1, maxWork: -1, fps: -1, count: -1 };
}

describe('createFrameStats', () => {
  it('writes zeros when nothing has been pushed', () => {
    const stats = createFrameStats(4);
    const out = blank();
    stats.summarize(out);
    expect(out).toEqual({ avgWork: 0, maxWork: 0, fps: 0, count: 0 });
  });

  it('reports the mean, max and fps over three frames', () => {
    const stats = createFrameStats(8);
    stats.push(1, 20);
    stats.push(2, 20);
    stats.push(3, 20);
    const out = blank();
    stats.summarize(out);
    expect(out.avgWork).toBe(2);
    expect(out.maxWork).toBe(3);
    expect(out.fps).toBe(50);
    expect(out.count).toBe(3);
  });

  it('drops the oldest frame once the window is full', () => {
    const stats = createFrameStats(3);
    stats.push(1, 10);
    stats.push(2, 10);
    stats.push(3, 10);
    stats.push(9, 10);
    const out = blank();
    stats.summarize(out);
    expect(out.count).toBe(3);
    expect(out.avgWork).toBeCloseTo((2 + 3 + 9) / 3);
    expect(out.maxWork).toBe(9);
  });

  it('reports 0 fps when every interval is zero', () => {
    const stats = createFrameStats(4);
    stats.push(4, 0);
    stats.push(6, 0);
    const out = blank();
    stats.summarize(out);
    expect(out.fps).toBe(0);
    expect(out.avgWork).toBe(5);
    expect(out.maxWork).toBe(6);
    expect(out.count).toBe(2);
  });
});
