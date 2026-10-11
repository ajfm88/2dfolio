import { describe, expect, it } from 'vitest';
import { decreaseObjectAngle, rotateObjectLocation, shiftMultiply, type OrbitState } from '../../../src/objects/enemies/orbit-math.js';

const state = (): OrbitState => ({ x: 120, y: 36, xFrac: 0, yFrac: 0, angleWhole: 0x18, angleFrac: 0, qSpeedFrac: 0x20 });

describe('NES orbit math', () => {
  it('ShiftMultiply uses six high multiplier bits', () => {
    expect(shiftMultiply(0x20, 0x80, 6)).toBe(0x400);
    expect(shiftMultiply(0x20, 0x83, 6)).toBe(0x400);
  });
  it('subtracts with fractional borrow and wraps the whole angle to $1F', () => {
    const s = state();
    s.angleWhole = 0;
    decreaseObjectAngle(s, 0x60);
    expect([s.angleWhole, s.angleFrac]).toEqual([0x1f, 0xa0]);
    decreaseObjectAngle(s, 0x60);
    expect([s.angleWhole, s.angleFrac]).toEqual([0x1f, 0x40]);
  });
  it('supports the high subtraction byte as well as the low byte', () => {
    const s = state();
    s.angleFrac = 0x20;
    decreaseObjectAngle(s, 0x60, 2);
    expect([s.angleWhole, s.angleFrac]).toEqual([0x15, 0xc0]);
  });
  it('angle $18 moves left exactly four pixels, without vertical movement', () => {
    const s = state();
    rotateObjectLocation(s, 6, 6);
    expect([s.x, s.y, s.xFrac, s.yFrac]).toEqual([116, 36, 0, 0]);
  });
  it('keeps byte fractions across a complete revolution', () => {
    const s = state();
    for (let i = 0; i < 256; i++) {
      const prev = { x: s.x, y: s.y };
      decreaseObjectAngle(s, 0x60);
      rotateObjectLocation(s, 6, 6);
      expect(Math.abs(s.x - prev.x)).toBeLessThanOrEqual(4);
      expect(Math.abs(s.y - prev.y)).toBeLessThanOrEqual(4);
      expect(s.xFrac).toBeGreaterThanOrEqual(0);
      expect(s.xFrac).toBeLessThan(256);
    }
  });
});
