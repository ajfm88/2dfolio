import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../settings.js';
import { shakeOffset } from './shake.js';

const DURATION = 0.25;
const AMP = 3;

/** Every offset of one whole shake, a fixed tick apart. */
function run() {
  const out = [];
  for (let left = DURATION; left > 0; left -= FIXED_DT) {
    const o = shakeOffset(left, DURATION, AMP, { x: 0, y: 0 });
    out.push([o.x, o.y]);
  }
  return out;
}

describe('shakeOffset', () => {
  it('is zero once the shake has run out', () => {
    expect(shakeOffset(0, DURATION, AMP, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(-0.1, DURATION, AMP, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
  });

  it('never moves further than the amplitude on either axis', () => {
    for (const [x, y] of run()) {
      expect(Math.abs(x)).toBeLessThanOrEqual(AMP);
      expect(Math.abs(y)).toBeLessThanOrEqual(AMP);
    }
  });

  it('gives whole pixels only', () => {
    for (const [x, y] of run()) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  it('is the same every run', () => {
    expect(run()).toEqual(run());
  });

  it('starts at full size and fades out', () => {
    const offsets = run();
    const size = ([x, y]) => Math.max(Math.abs(x), Math.abs(y));
    expect(size(offsets[0])).toBe(AMP);
    expect(size(offsets[offsets.length - 1])).toBeLessThan(AMP);
    // It actually moves the camera, not just once.
    expect(offsets.filter((o) => size(o) > 0).length).toBeGreaterThan(offsets.length / 2);
  });

  it('writes into and returns the object it is given', () => {
    const out = { x: 0, y: 0 };
    expect(shakeOffset(DURATION, DURATION, AMP, out)).toBe(out);
  });
});
