import { describe, expect, it } from 'vitest';
import { TILE } from '../settings.js';
import { createEmptyModel } from '../level/model.js';
import { forEachCellOnLine, pickToolAt, screenToCell } from './tools.js';

describe('screenToCell', () => {
  const cam = { x: 64, y: 32 };

  it('maps virtual coords at zoom 1', () => {
    expect(screenToCell(0, 0, cam)).toEqual({ c: 2, r: 1 });
    expect(screenToCell(0, 0, cam, 1)).toEqual({ c: 2, r: 1 });
  });

  it('divides pointer by zoom before adding camera', () => {
    // pointer (64, 32) at zoom 2 → world (32+64, 16+32) = (96, 48) → cell (3, 1)
    expect(screenToCell(64, 32, cam, 2)).toEqual({ c: 3, r: 1 });
    // zoom 0.5 doubles the pointer contribution
    expect(screenToCell(0, 0, cam, 0.5)).toEqual({
      c: Math.floor(cam.x / TILE),
      r: Math.floor(cam.y / TILE),
    });
    expect(screenToCell(TILE * 0.5, 0, { x: 0, y: 0 }, 0.5)).toEqual({ c: 1, r: 0 });
  });
});

describe('pickToolAt', () => {
  it('returns null for empty and out-of-bounds cells', () => {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    // spawn is at (4, 6) on a 12-row level — pick a cell that is not spawn
    expect(pickToolAt(1, 1, level)).toBeNull();
    expect(pickToolAt(-1, 0, level)).toBeNull();
    expect(pickToolAt(40, 0, level)).toBeNull();
  });

  it('priority: entity over terrain over spawn', () => {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    level.set('terrain', 4, 6, 1);
    expect(pickToolAt(4, 6, level)?.id).toBe('terrain');
    level.entities.push({ k: 'crabby', c: 4, r: 6, p: { dir: -1 } });
    expect(pickToolAt(4, 6, level)?.id).toBe('crabby');
  });

  it('picks platform, water, spawn, and goal in remaining order', () => {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    level.set('platform', 8, 8, 1);
    expect(pickToolAt(8, 8, level)?.id).toBe('platform');
    level.set('water', 9, 9, 1);
    expect(pickToolAt(9, 9, level)?.id).toBe('water');
    expect(pickToolAt(level.spawn.c, level.spawn.r, level)?.id).toBe('spawn');
    level.goal = { c: 10, r: 8 };
    expect(pickToolAt(10, 8, level)?.id).toBe('goal');
  });

  it('skips unknown entity kinds and falls through', () => {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    level.set('terrain', 2, 2, 1);
    level.entities.push({ k: 'not_a_kind', c: 2, r: 2 });
    expect(pickToolAt(2, 2, level)?.id).toBe('terrain');
  });
});

describe('forEachCellOnLine', () => {
  /** @param {number} c0 @param {number} r0 @param {number} c1 @param {number} r1 */
  const walk = (c0, r0, c1, r1) => {
    /** @type {Array<[number, number]>} */
    const cells = [];
    forEachCellOnLine(c0, r0, c1, r1, (c, r) => cells.push([c, r]));
    return cells;
  };

  it('visits a single cell once', () => {
    expect(walk(3, 4, 3, 4)).toEqual([[3, 4]]);
  });

  it('fills a horizontal run with no gaps, both ends included', () => {
    expect(walk(2, 5, 6, 5)).toEqual([[2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]);
  });

  it('fills a vertical run in either direction', () => {
    expect(walk(1, 3, 1, 0)).toEqual([[1, 3], [1, 2], [1, 1], [1, 0]]);
  });

  it('steps one axis at a time, so the path is edge-connected', () => {
    const cells = walk(0, 0, 7, -3);
    expect(cells).toHaveLength(7 + 3 + 1);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([7, -3]);
    for (let i = 1; i < cells.length; i++) {
      const [c, r] = cells[i];
      const [pc, pr] = cells[i - 1];
      expect(Math.abs(c - pc) + Math.abs(r - pr)).toBe(1);
    }
  });

  it('stays close to the straight line', () => {
    // Every visited cell centre lies within one cell of the segment from (0,0) to (9,4).
    for (const [c, r] of walk(0, 0, 9, 4)) {
      const dist = Math.abs(4 * c - 9 * r) / Math.hypot(4, 9);
      expect(dist).toBeLessThan(1);
    }
  });
});
