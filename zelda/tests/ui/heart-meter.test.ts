import { describe, it, expect } from 'vitest';
import { computeHearts } from '../../src/ui/heart-meter.js';

describe('computeHearts', () => {
  it('3 full hearts (starting health)', () => {
    const result = computeHearts(6, 6);
    expect(result).toEqual({ fullCount: 3, hasHalf: false, emptyCount: 0 });
  });

  it('2.5 hearts out of 3', () => {
    const result = computeHearts(5, 6);
    expect(result).toEqual({ fullCount: 2, hasHalf: true, emptyCount: 0 });
  });

  it('2 full hearts out of 3', () => {
    const result = computeHearts(4, 6);
    expect(result).toEqual({ fullCount: 2, hasHalf: false, emptyCount: 1 });
  });

  it('1.5 hearts out of 3', () => {
    const result = computeHearts(3, 6);
    expect(result).toEqual({ fullCount: 1, hasHalf: true, emptyCount: 1 });
  });

  it('0.5 hearts out of 3', () => {
    const result = computeHearts(1, 6);
    expect(result).toEqual({ fullCount: 0, hasHalf: true, emptyCount: 2 });
  });

  it('0 hearts out of 3 (dead)', () => {
    const result = computeHearts(0, 6);
    expect(result).toEqual({ fullCount: 0, hasHalf: false, emptyCount: 3 });
  });

  it('max containers (16 hearts = 32 half-hearts)', () => {
    const result = computeHearts(32, 32);
    expect(result).toEqual({ fullCount: 16, hasHalf: false, emptyCount: 0 });
  });

  it('half health with max containers', () => {
    const result = computeHearts(16, 32);
    expect(result).toEqual({ fullCount: 8, hasHalf: false, emptyCount: 8 });
  });

  it('1 heart out of 16 containers', () => {
    const result = computeHearts(2, 32);
    expect(result).toEqual({ fullCount: 1, hasHalf: false, emptyCount: 15 });
  });

  it('5.5 hearts out of 8 containers', () => {
    const result = computeHearts(11, 16);
    expect(result).toEqual({ fullCount: 5, hasHalf: true, emptyCount: 2 });
  });

  it('total container count matches fullCount + hasHalf + emptyCount', () => {
    for (let maxHp = 6; maxHp <= 32; maxHp += 2) {
      for (let hp = 0; hp <= maxHp; hp++) {
        const { fullCount, hasHalf, emptyCount } = computeHearts(hp, maxHp);
        const total = fullCount + (hasHalf ? 1 : 0) + emptyCount;
        expect(total).toBe(maxHp / 2);
      }
    }
  });

  it('half-hearts reconstructed equal original health', () => {
    for (let maxHp = 6; maxHp <= 32; maxHp += 2) {
      for (let hp = 0; hp <= maxHp; hp++) {
        const { fullCount, hasHalf } = computeHearts(hp, maxHp);
        const reconstructed = fullCount * 2 + (hasHalf ? 1 : 0);
        expect(reconstructed).toBe(hp);
      }
    }
  });
});
