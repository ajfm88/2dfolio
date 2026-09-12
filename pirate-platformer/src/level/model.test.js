import { describe, expect, it } from 'vitest';
import { deserialise } from './codec.js';
import { createBlankLevel } from './schema.js';

function blank(cols = 40, rows = 12) {
  return deserialise(createBlankLevel({ cols, rows }));
}

describe('LevelModel', () => {
  it('indexes row-major', () => {
    const level = blank();
    expect(level.tileIndex(3, 2)).toBe(2 * 40 + 3);
  });

  it('get/set a terrain cell', () => {
    const level = blank();
    expect(level.get('terrain', 5, 5)).toBe(0);
    level.set('terrain', 5, 5, 1);
    expect(level.get('terrain', 5, 5)).toBe(1);
  });

  it('reports in-bounds', () => {
    const level = blank();
    expect(level.inBounds(0, 0)).toBe(true);
    expect(level.inBounds(39, 11)).toBe(true);
    expect(level.inBounds(40, 0)).toBe(false);
    expect(level.inBounds(0, 12)).toBe(false);
  });

  it('resize grow keeps existing cells', () => {
    const level = blank();
    level.set('terrain', 1, 1, 1);
    level.resize(48, 16);
    expect(level.cols).toBe(48);
    expect(level.rows).toBe(16);
    expect(level.get('terrain', 1, 1)).toBe(1);
    expect(level.get('terrain', 47, 15)).toBe(0);
  });

  it('resize shrink drops out-of-range entities and clamps spawn/goal', () => {
    const level = blank(48, 16);
    level.entities.push({ k: 'keep', c: 1, r: 1 });
    level.entities.push({ k: 'drop', c: 47, r: 0 });
    level.decor.push({ k: 'drop', c: 40, r: 15 });
    level.spawn = { c: 47, r: 15 };
    level.goal = { c: 46, r: 14 };
    level.resize(40, 12);
    expect(level.cols).toBe(40);
    expect(level.rows).toBe(12);
    expect(level.entities).toEqual([{ k: 'keep', c: 1, r: 1 }]);
    expect(level.decor).toEqual([]);
    expect(level.spawn).toEqual({ c: 39, r: 11 });
    expect(level.goal).toEqual({ c: 39, r: 11 });
  });
});
