import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import {
  directionToSpriteCol,
  WalkAnimationController,
} from '../../src/render/sprite-renderer.js';
import {
  WALK_ANIM_COUNTER_RESET,
  LINK_SHEET_COLUMNS,
  ENEMY_SHEET_COLUMNS,
  SPRITE_SPACING,
  TILE_SIZE,
} from '../../src/core/constants.js';

describe('directionToSpriteCol', () => {
  it('maps Direction.Down to column 0', () => {
    expect(directionToSpriteCol(Direction.Down)).toBe(0);
  });

  it('maps Direction.Left to column 1', () => {
    expect(directionToSpriteCol(Direction.Left)).toBe(1);
  });

  it('maps Direction.Up to column 2', () => {
    expect(directionToSpriteCol(Direction.Up)).toBe(2);
  });

  it('maps Direction.Right to column 3', () => {
    expect(directionToSpriteCol(Direction.Right)).toBe(3);
  });
});

describe('WalkAnimationController', () => {
  it('starts at step 0', () => {
    const anim = new WalkAnimationController();
    expect(anim.currentStep).toBe(0);
  });

  it('stays at step 0 for counterReset-1 ticks', () => {
    const anim = new WalkAnimationController(6);
    for (let i = 0; i < 5; i++) {
      anim.tick();
    }
    expect(anim.currentStep).toBe(0);
  });

  it('toggles to step 1 on the counterReset-th tick', () => {
    const anim = new WalkAnimationController(6);
    for (let i = 0; i < 6; i++) {
      anim.tick();
    }
    expect(anim.currentStep).toBe(1);
  });

  it('toggles back to step 0 after 2*counterReset ticks', () => {
    const anim = new WalkAnimationController(6);
    for (let i = 0; i < 12; i++) {
      anim.tick();
    }
    expect(anim.currentStep).toBe(0);
  });

  it('tick() returns the current step', () => {
    const anim = new WalkAnimationController(3);
    const results: number[] = [];
    for (let i = 0; i < 9; i++) {
      results.push(anim.tick());
    }
    expect(results).toEqual([0, 0, 1, 1, 1, 0, 0, 0, 1]);
  });

  it('reset() sets step back to 0', () => {
    const anim = new WalkAnimationController(3);
    for (let i = 0; i < 3; i++) anim.tick();
    expect(anim.currentStep).toBe(1);
    anim.reset();
    expect(anim.currentStep).toBe(0);
  });

  it('reset() restores the full counter', () => {
    const anim = new WalkAnimationController(4);
    anim.tick();
    anim.tick();
    anim.reset();
    for (let i = 0; i < 3; i++) anim.tick();
    expect(anim.currentStep).toBe(0);
    anim.tick();
    expect(anim.currentStep).toBe(1);
  });

  it('uses default counterReset from constants', () => {
    const anim = new WalkAnimationController();
    for (let i = 0; i < WALK_ANIM_COUNTER_RESET - 1; i++) {
      anim.tick();
    }
    expect(anim.currentStep).toBe(0);
    anim.tick();
    expect(anim.currentStep).toBe(1);
  });
});

describe('frame index math', () => {
  it('Link still frame facing Down is index 0', () => {
    const step = 0;
    const col = directionToSpriteCol(Direction.Down);
    expect(step * LINK_SHEET_COLUMNS + col).toBe(0);
  });

  it('Link still frame facing Right is index 3', () => {
    const step = 0;
    const col = directionToSpriteCol(Direction.Right);
    expect(step * LINK_SHEET_COLUMNS + col).toBe(3);
  });

  it('Link walk frame facing Down is index 15', () => {
    const step = 1;
    const col = directionToSpriteCol(Direction.Down);
    expect(step * LINK_SHEET_COLUMNS + col).toBe(15);
  });

  it('Link walk frame facing Up is index 17', () => {
    const step = 1;
    const col = directionToSpriteCol(Direction.Up);
    expect(step * LINK_SHEET_COLUMNS + col).toBe(17);
  });

  it('source coordinates for index 0 with 1px spacing are (0, 0)', () => {
    const index = 0;
    const col = index % LINK_SHEET_COLUMNS;
    const row = Math.floor(index / LINK_SHEET_COLUMNS);
    const sx = col * (TILE_SIZE + SPRITE_SPACING);
    const sy = row * (TILE_SIZE + SPRITE_SPACING);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });

  it('source coordinates for index 3 with 1px spacing are (51, 0)', () => {
    const index = 3;
    const col = index % LINK_SHEET_COLUMNS;
    const row = Math.floor(index / LINK_SHEET_COLUMNS);
    const sx = col * (TILE_SIZE + SPRITE_SPACING);
    const sy = row * (TILE_SIZE + SPRITE_SPACING);
    expect(sx).toBe(3 * 17);
    expect(sy).toBe(0);
  });

  it('source coordinates for index 15 (row 1, col 0) are (0, 17)', () => {
    const index = 15;
    const col = index % LINK_SHEET_COLUMNS;
    const row = Math.floor(index / LINK_SHEET_COLUMNS);
    const sx = col * (TILE_SIZE + SPRITE_SPACING);
    const sy = row * (TILE_SIZE + SPRITE_SPACING);
    expect(sx).toBe(0);
    expect(sy).toBe(17);
  });

  it('source coordinates for index 18 (row 1, col 3) are (51, 17)', () => {
    const index = 18;
    const col = index % LINK_SHEET_COLUMNS;
    const row = Math.floor(index / LINK_SHEET_COLUMNS);
    const sx = col * (TILE_SIZE + SPRITE_SPACING);
    const sy = row * (TILE_SIZE + SPRITE_SPACING);
    expect(sx).toBe(51);
    expect(sy).toBe(17);
  });
});

describe('sprite constants', () => {
  it('WALK_ANIM_COUNTER_RESET is 6 (NES-faithful)', () => {
    expect(WALK_ANIM_COUNTER_RESET).toBe(6);
  });

  it('LINK_SHEET_COLUMNS is 15', () => {
    expect(LINK_SHEET_COLUMNS).toBe(15);
  });

  it('ENEMY_SHEET_COLUMNS is 30', () => {
    expect(ENEMY_SHEET_COLUMNS).toBe(30);
  });

  it('SPRITE_SPACING is 1', () => {
    expect(SPRITE_SPACING).toBe(1);
  });
});
