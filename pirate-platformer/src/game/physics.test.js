import { describe, it, expect } from 'vitest';
import {
  resolveH,
  resolveV,
  resolveSemiSolid,
  checkFloor,
  checkWallLeft,
  checkWallRight,
  checkSolid,
} from './physics.js';
import { TILE } from '../settings.js';
import { createBlankLevel } from '../level/schema.js';
import { deserialise } from '../level/codec.js';

/**
 * 40×12 test level (schema minimum).
 * - terrain floor at row 10 (y = 320..352)
 * - terrain column wall at col 0 (rows 0–10)
 * - terrain block at (col 5, row 6) (x = 160..192, y = 192..224)
 * - platform at (col 3, row 6) and (col 4, row 6)
 */
function makeLevel() {
  const level = deserialise(createBlankLevel({ cols: 40, rows: 12 }));
  for (let c = 0; c < 40; c++) level.set('terrain', c, 10, 1);
  for (let r = 0; r <= 10; r++) level.set('terrain', 0, r, 1);
  level.set('terrain', 5, 6, 1);
  level.set('platform', 3, 6, 1);
  level.set('platform', 4, 6, 1);
  return level;
}

describe('resolveH', () => {
  it('pushes hitbox right when moving left into a wall', () => {
    const level = makeLevel();
    const hitbox = { x: 30, y: 64, w: 18, h: 26 };
    const old = { x: 36, y: 64, w: 18, h: 26 };
    resolveH(hitbox, old, level);
    expect(hitbox.x).toBe(TILE);
  });

  it('pushes hitbox left when moving right into a terrain block', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 5 - 10, y: TILE * 6, w: 18, h: 26 };
    const old = { x: TILE * 5 - 20, y: TILE * 6, w: 18, h: 26 };
    resolveH(hitbox, old, level);
    expect(hitbox.x).toBe(TILE * 5 - 18);
  });

  it('does nothing in open space', () => {
    const level = makeLevel();
    const hitbox = { x: 100, y: 32, w: 18, h: 26 };
    const old = { x: 98, y: 32, w: 18, h: 26 };
    resolveH(hitbox, old, level);
    expect(hitbox.x).toBe(100);
  });
});

describe('resolveV', () => {
  it('pushes hitbox up when falling onto floor', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: TILE * 10 - 20, w: 18, h: 26 };
    const old = { x: 64, y: TILE * 10 - 30, w: 18, h: 26 };
    const pushed = resolveV(hitbox, old, level);
    expect(pushed).toBe(true);
    expect(hitbox.y).toBe(TILE * 10 - 26);
  });

  it('pushes hitbox down when jumping into ceiling', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 5, y: TILE * 7 - 4, w: 18, h: 26 };
    const old = { x: TILE * 5, y: TILE * 7, w: 18, h: 26 };
    const pushed = resolveV(hitbox, old, level);
    expect(pushed).toBe(true);
    expect(hitbox.y).toBe(TILE * 7);
  });

  it('does nothing in open space', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: 32, w: 18, h: 26 };
    const old = { x: 64, y: 30, w: 18, h: 26 };
    const pushed = resolveV(hitbox, old, level);
    expect(pushed).toBe(false);
    expect(hitbox.y).toBe(32);
  });
});

describe('resolveSemiSolid', () => {
  it('lands on platform when falling from above', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 3, y: TILE * 6 - 20, w: 18, h: 26 };
    const old = { x: TILE * 3, y: TILE * 6 - 30, w: 18, h: 26 };
    const landed = resolveSemiSolid(hitbox, old, level, false);
    expect(landed).toBe(true);
    expect(hitbox.y).toBe(TILE * 6 - 26);
  });

  it('passes through platform from below', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 3, y: TILE * 6 - 10, w: 18, h: 26 };
    const old = { x: TILE * 3, y: TILE * 6 + 5, w: 18, h: 26 };
    const landed = resolveSemiSolid(hitbox, old, level, false);
    expect(landed).toBe(false);
  });

  it('skips when dropping', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 3, y: TILE * 6 - 20, w: 18, h: 26 };
    const old = { x: TILE * 3, y: TILE * 6 - 30, w: 18, h: 26 };
    const landed = resolveSemiSolid(hitbox, old, level, true);
    expect(landed).toBe(false);
  });
});

describe('checkFloor', () => {
  it('returns true when standing on terrain', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: TILE * 10 - 26, w: 18, h: 26 };
    expect(checkFloor(hitbox, level)).toBe(true);
  });

  it('returns true when standing on platform', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 3, y: TILE * 6 - 26, w: 18, h: 26 };
    expect(checkFloor(hitbox, level)).toBe(true);
  });

  it('returns false in mid-air', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: 32, w: 18, h: 26 };
    expect(checkFloor(hitbox, level)).toBe(false);
  });

  it('returns false when bottom is below the level', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: TILE * 12, w: 18, h: 26 };
    expect(checkFloor(hitbox, level)).toBe(false);
  });
});

describe('checkWallLeft', () => {
  it('returns true when touching left wall', () => {
    const level = makeLevel();
    const hitbox = { x: TILE, y: TILE, w: 18, h: 26 };
    expect(checkWallLeft(hitbox, level)).toBe(true);
  });

  it('returns false when away from wall', () => {
    const level = makeLevel();
    const hitbox = { x: TILE + 10, y: TILE, w: 18, h: 26 };
    expect(checkWallLeft(hitbox, level)).toBe(false);
  });

  it('returns false at the left edge of the level', () => {
    const level = makeLevel();
    const hitbox = { x: 0, y: TILE * 5, w: 18, h: 26 };
    expect(checkWallLeft(hitbox, level)).toBe(false);
  });
});

describe('checkWallRight', () => {
  it('returns true when touching right side of terrain block', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 5 - 18, y: TILE * 6, w: 18, h: 26 };
    expect(checkWallRight(hitbox, level)).toBe(true);
  });

  it('returns false when away from wall', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 5 - 28, y: TILE * 6, w: 18, h: 26 };
    expect(checkWallRight(hitbox, level)).toBe(false);
  });

  it('returns false at the right edge of the level', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 40 - 18, y: TILE, w: 18, h: 26 };
    expect(checkWallRight(hitbox, level)).toBe(false);
  });
});

describe('checkSolid', () => {
  it('is true when overlapping a terrain cell', () => {
    const level = makeLevel();
    // over the block at (5, 6)
    expect(checkSolid({ x: TILE * 5 + 4, y: TILE * 6 + 4, w: 10, h: 10 }, level)).toBe(true);
  });

  it('is false in empty space', () => {
    const level = makeLevel();
    expect(checkSolid({ x: TILE * 20, y: TILE * 2, w: 10, h: 10 }, level)).toBe(false);
  });

  it('is true when straddling a cell boundary onto a solid cell', () => {
    const level = makeLevel();
    // spans col 5 (solid) and col 6 (empty)
    expect(checkSolid({ x: TILE * 6 - 5, y: TILE * 6 + 4, w: 10, h: 10 }, level)).toBe(true);
  });

  it('is true when partially outside the grid but overlapping a solid in-grid cell', () => {
    const level = makeLevel();
    // straddles the left edge onto the col-0 wall
    expect(checkSolid({ x: -5, y: TILE * 3, w: 10, h: 10 }, level)).toBe(true);
  });

  it('is false when fully outside the grid', () => {
    const level = makeLevel();
    expect(checkSolid({ x: -50, y: TILE * 3, w: 10, h: 10 }, level)).toBe(false);
  });

  it('is not triggered by a platform-layer tile', () => {
    const level = makeLevel();
    // over the platform at (3, 6) — semi-solid must not stop a shot
    expect(checkSolid({ x: TILE * 3 + 4, y: TILE * 6 + 4, w: 10, h: 10 }, level)).toBe(false);
  });
});

describe('edge cases', () => {
  it('resolveH handles hitbox spanning multiple cells', () => {
    const level = makeLevel();
    const hitbox = { x: 28, y: 64, w: 18, h: 26 };
    const old = { x: 36, y: 64, w: 18, h: 26 };
    resolveH(hitbox, old, level);
    expect(hitbox.x).toBe(TILE);
  });

  it('resolveV does not push when resting one pixel above floor', () => {
    const level = makeLevel();
    const hitbox = { x: 64, y: TILE * 10 - 27, w: 18, h: 26 };
    const old = { x: 64, y: TILE * 10 - 27, w: 18, h: 26 };
    const pushed = resolveV(hitbox, old, level);
    expect(pushed).toBe(false);
    expect(hitbox.y).toBe(TILE * 10 - 27);
  });

  it('resolveH does not collide with platform layer', () => {
    const level = makeLevel();
    const hitbox = { x: TILE * 3 - 5, y: TILE * 6, w: 18, h: 26 };
    const old = { x: TILE * 3 - 10, y: TILE * 6, w: 18, h: 26 };
    resolveH(hitbox, old, level);
    expect(hitbox.x).toBe(TILE * 3 - 5);
  });
});
