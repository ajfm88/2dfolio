import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import {
  directionToProjectileRow,
  PROJ_CELL,
  PROJ_COLUMNS,
  PROJ_ROWS,
  PROJ_COL_ARROW,
  PROJ_COL_SWORD_BEAM,
  PROJ_COL_SWORD_BEAM_ALT,
  PROJ_COL_BOOMERANG,
  PROJ_COL_FIREBALL,
  PROJ_COL_BOMB,
  PROJ_ROW_NORTH,
  PROJ_ROW_SOUTH,
  PROJ_ROW_WEST,
  PROJ_ROW_EAST,
} from '../../src/render/projectile-sprite-data.js';

// projectiles.png is 240×160. These constants are what L0c got wrong (it read the
// sheet as 15 columns of 16×16), so pin the geometry down.
describe('projectiles.png geometry', () => {
  it('is a 6×4 grid of 40×40 cells covering the whole 240×160 sheet', () => {
    expect(PROJ_COLUMNS * PROJ_CELL).toBe(240);
    expect(PROJ_ROWS * PROJ_CELL).toBe(160);
  });
});

describe('column constants', () => {
  // Named in zelda-clone-master's ProjectileSpriteFactory.cs, which ships the
  // byte-identical sheet: arrowColumn 0, swordBeamColumn 1, boomerangColumn 3,
  // fireballColumn 4, bombColumn 5.
  it('match the source repo that shipped the sheet', () => {
    expect(PROJ_COL_ARROW).toBe(0);
    expect(PROJ_COL_SWORD_BEAM).toBe(1);
    expect(PROJ_COL_SWORD_BEAM_ALT).toBe(2);
    expect(PROJ_COL_BOOMERANG).toBe(3);
    expect(PROJ_COL_FIREBALL).toBe(4);
    expect(PROJ_COL_BOMB).toBe(5);
  });

  it('all fall inside the grid', () => {
    for (const col of [
      PROJ_COL_ARROW, PROJ_COL_SWORD_BEAM, PROJ_COL_SWORD_BEAM_ALT,
      PROJ_COL_BOOMERANG, PROJ_COL_FIREBALL, PROJ_COL_BOMB,
    ]) {
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(PROJ_COLUMNS);
    }
  });
});

describe('directionToProjectileRow', () => {
  // Arrow.cs: const int northSprite = 0, southSprite = 1, westSprite = 2, eastSprite = 3;
  it('maps each facing to the sheet row the source repo uses', () => {
    expect(directionToProjectileRow(Direction.Up)).toBe(PROJ_ROW_NORTH);
    expect(directionToProjectileRow(Direction.Down)).toBe(PROJ_ROW_SOUTH);
    expect(directionToProjectileRow(Direction.Left)).toBe(PROJ_ROW_WEST);
    expect(directionToProjectileRow(Direction.Right)).toBe(PROJ_ROW_EAST);
  });

  it('produces four distinct in-range rows', () => {
    const rows = [Direction.Up, Direction.Down, Direction.Left, Direction.Right]
      .map(directionToProjectileRow);
    expect(new Set(rows).size).toBe(4);
    for (const row of rows) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(PROJ_ROWS);
    }
  });
});
