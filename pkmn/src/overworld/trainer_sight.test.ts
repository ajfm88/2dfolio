import { describe, it, expect } from 'vitest';
import { byteDiff, engagingTrainer, trainerEngages, walkUpSteps } from './trainer_sight';
import type { SightTrainer } from './trainer_sight';
import { screenPixels } from './sprite_collision';
import type { Direction } from '../core';

/** A trainer `dx`, `dy` steps from the player, in TrainerEngage's screen bytes. */
function at(dx: number, dy: number, facing: Direction, sight: number, onScreen = true): SightTrainer {
  const p = screenPixels(dx * 16, dy * 16, 0, 0);
  return { x: p.x, y: p.y, facing, onScreen, engageDistance: sight << 4 };
}

describe('TrainerEngage (engine/overworld/trainer_sight.asm)', () => {
  it('sees along its facing, up to sight × 16 pixels, on either axis', () => {
    expect(trainerEngages(at(4, 0, 'left', 4))).toBe(true);
    expect(trainerEngages(at(5, 0, 'left', 4))).toBe(false); // one step too far
    expect(trainerEngages(at(-3, 0, 'right', 4))).toBe(true);
    expect(trainerEngages(at(0, 3, 'up', 3))).toBe(true);
    expect(trainerEngages(at(0, -3, 'down', 3))).toBe(true);
    expect(trainerEngages(at(1, 0, 'left', 1))).toBe(true); // adjacent
  });

  it('never sees the player behind it, off its axis, or diagonally', () => {
    expect(trainerEngages(at(4, 0, 'right', 4))).toBe(false); // facing away
    expect(trainerEngages(at(0, 3, 'down', 4))).toBe(false);
    expect(trainerEngages(at(3, 0, 'up', 4))).toBe(false); // same row, looking up
    expect(trainerEngages(at(0, 3, 'left', 4))).toBe(false); // same column, looking left
    expect(trainerEngages(at(2, 1, 'left', 4))).toBe(false);
  });

  it('sight 0 sees nothing; the same tile is distance 0, never an engagement', () => {
    expect(trainerEngages(at(1, 0, 'left', 0))).toBe(false);
    expect(trainerEngages({ x: 0x40, y: 0x3c, facing: 'down', onScreen: true, engageDistance: 0xf0 })).toBe(false);
  });

  it('a latched image ($ff) never engages', () => {
    expect(trainerEngages(at(2, 0, 'left', 4, false))).toBe(false);
  });

  it('the $fc quirk: facing down, it sees 3 steps but not 4', () => {
    expect(at(0, -4, 'down', 4).y).toBe(0xfc);
    expect(byteDiff(0x3c, 0xfc)).toBe(0xc0);
    expect(trainerEngages(at(0, -4, 'down', 4))).toBe(false);
    expect(trainerEngages(at(0, -3, 'down', 4))).toBe(true);
    // Below, facing up, 4 steps is fine
    expect(trainerEngages(at(0, 4, 'up', 4))).toBe(true);
  });

  it('CheckPlayerIsInFrontOfSprite moves $fc down a block (only reachable with sight ≥ 12)', () => {
    // A synthetic header byte of $f0: the distance check passes at 192, and the in-front
    // test then reads Y as $0c, above the player.
    expect(trainerEngages({ x: 0x40, y: 0xfc, facing: 'down', onScreen: true, engageDistance: 0xf0 })).toBe(true);
  });

  it('the left window edge is X = $00, 4 steps, and still in sight', () => {
    expect(at(-4, 0, 'right', 4).x).toBe(0x00);
    expect(trainerEngages(at(-4, 0, 'right', 4))).toBe(true);
  });

  it('the Power Plant skips the in-front check', () => {
    expect(trainerEngages(at(4, 0, 'right', 4), true)).toBe(true);
    expect(trainerEngages(at(4, 0, 'right', 4), false)).toBe(false);
  });
});

describe('CheckForEngagingTrainers', () => {
  it('walks the headers in order: the first engaging trainer wins', () => {
    const trainers = [
      { id: 'a', s: at(3, 0, 'right', 4) }, // facing away
      { id: 'b', s: at(2, 0, 'left', 4) },
      { id: 'c', s: at(0, 2, 'up', 4) },
    ];
    expect(engagingTrainer(trainers, t => t.s)?.id).toBe('b');
  });

  it('skips the trainers the caller filters out (beaten)', () => {
    const trainers = [{ id: 'a', beaten: true, s: at(2, 0, 'left', 4) }, { id: 'b', beaten: false, s: at(0, 2, 'up', 4) }];
    expect(engagingTrainer(trainers, t => (t.beaten ? null : t.s))?.id).toBe('b');
    expect(engagingTrainer([], () => null)).toBeNull();
  });
});

describe('TrainerWalkUpToPlayer', () => {
  it('distance / 16 − 1 steps; none when adjacent', () => {
    expect(walkUpSteps(at(1, 0, 'left', 4))).toBe(0);
    expect(walkUpSteps(at(2, 0, 'left', 4))).toBe(1);
    expect(walkUpSteps(at(4, 0, 'left', 4))).toBe(3);
    expect(walkUpSteps(at(-4, 0, 'right', 4))).toBe(3);
    expect(walkUpSteps(at(0, 3, 'up', 4))).toBe(2);
    expect(walkUpSteps(at(0, -3, 'down', 4))).toBe(2);
  });

  it('is `swap(d) − 1`, exactly, for a distance off the grid', () => {
    // A trainer caught mid-step: d = $31 → swap $13 → 18 steps.
    expect(walkUpSteps({ x: 0x71, y: 0x3c, facing: 'left' })).toBe(0x12);
  });
});
