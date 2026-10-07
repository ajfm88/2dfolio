// A6c: sprite collisions in the Game Boy's screen basis (sprite_collision.ts)

import { describe, it, expect } from 'vitest';
import {
  adjustedCoord, collisionMask, stepStaysOnScreen, spriteInFront, pikachuInFront, screenPixels,
  DIRECTION_BIT, PIKACHU_SLOT,
} from './sprite_collision';
import type { CollisionSprite } from './sprite_collision';

const sprite = (over: Partial<CollisionSprite>): CollisionSprite => ({
  slot: 1, available: true, x: 0x40, y: 0x3c, vx: 0, vy: 0, ...over,
});
const { up, down, left, right } = DIRECTION_BIT;

describe('SetSpriteCollisionValues', () => {
  it('tags a coordinate with its block and direction: 0 still, 7 forward, 9 backward', () => {
    expect(adjustedCoord(0x40, 0)).toBe(0x40);
    expect(adjustedCoord(0x40, 1)).toBe(0x47);
    expect(adjustedCoord(0x41, 1)).toBe(0x47);
    // Backward first steps back one pixel, so an aligned coordinate drops a block
    expect(adjustedCoord(0x40, -1)).toBe(0x39);
    expect(adjustedCoord(0x41, -1)).toBe(0x49);
    expect(adjustedCoord(0x00, -1)).toBe(0xf9);
  });
});

describe('DetectCollisionBetweenSprites', () => {
  const self = sprite({ slot: 1, x: 0x40, y: 0x3c });

  it('still sprites snap to their 16 px block: the same block overlaps, the next never does', () => {
    expect(collisionMask(self, [sprite({ slot: 2, y: 0x3c + 11 })])).toBe(down); // 0x4f → 0x40
    expect(collisionMask(self, [sprite({ slot: 2, y: 0x3c + 16 })])).toBe(0);    // 0x50: 16 > 7 + 7
    expect(collisionMask(self, [sprite({ slot: 2, x: 0x40 - 16 })])).toBe(0);
  });

  it('a step toward a neighbour block overlaps it (≤ 9 + 7); a step away does not', () => {
    // Self walking down: 0x47 against a still sprite at 0x50
    expect(collisionMask(sprite({ slot: 1, vy: 1 }), [sprite({ slot: 2, y: 0x3c + 16 })])).toBe(down);
    // Walking up, away from it: 0x39 against 0x50
    expect(collisionMask(sprite({ slot: 1, vy: -1 }), [sprite({ slot: 2, y: 0x3c + 16 })])).toBe(0);
    // The neighbour walking up toward a still self: (0x50 - 1) & $f0 | 9 = 0x49
    expect(collisionMask(self, [sprite({ slot: 2, y: 0x3c + 16, vy: -1 })])).toBe(down);
  });

  it('two sprites walking at each other across an empty block meet at exactly 18 (inclusive)', () => {
    // 0x47 and (0x60 - 1) & $f0 | 9 = 0x59
    expect(collisionMask(sprite({ slot: 1, vy: 1 }), [sprite({ slot: 2, y: 0x3c + 32, vy: -1 })])).toBe(down);
    // One pixel further: 0x69, 34 apart
    expect(collisionMask(sprite({ slot: 1, vy: 1 }), [sprite({ slot: 2, y: 0x3c + 33, vy: -1 })])).toBe(0);
    // Walking the same way a block apart: 0x47 and 0x57
    expect(collisionMask(sprite({ slot: 1, vy: 1 }), [sprite({ slot: 2, y: 0x3c + 16, vy: 1 })])).toBe(down);
  });

  it('a horizontal mover reports X bits; a still or vertical one Y bits', () => {
    expect(collisionMask(sprite({ slot: 1, vx: 1 }), [sprite({ slot: 2, x: 0x50 })])).toBe(right);
    expect(collisionMask(sprite({ slot: 1, vx: -1 }), [sprite({ slot: 2, x: 0x30 })])).toBe(left);
    expect(collisionMask(sprite({ slot: 1, vy: -1 }), [sprite({ slot: 2, y: 0x2c })])).toBe(up);
    expect(collisionMask(self, [sprite({ slot: 2, y: 0x2c, vy: 1 })])).toBe(up);
    // The bit compares adjusted values, not pixels: moving right, a still sprite 8 px
    // right snaps to 0x40, below self's 0x47, so the bit says left
    expect(collisionMask(sprite({ slot: 1, vx: 1 }), [sprite({ slot: 2, x: 0x48 })])).toBe(left);
  });

  it('equal adjusted coordinates count as down / right', () => {
    expect(collisionMask(self, [sprite({ slot: 2 })])).toBe(down);
    expect(collisionMask(sprite({ slot: 1, vx: 1 }), [sprite({ slot: 2, x: 0x47, vx: 1 })])).toBe(right);
  });

  it('ORs the bits of every overlapping sprite', () => {
    const above = sprite({ slot: 2, y: 0x2c, vy: 1 });
    const below = sprite({ slot: 3, y: 0x4c, vy: -1 });
    expect(collisionMask(self, [above, below])).toBe(up | down);
  });

  it('uses the unsigned byte difference, not a wrap-around distance', () => {
    // Self at the top edge (Y+4 = 0), other at Y+4 = $f0: 16 apart on a torus, 240 here
    const top = sprite({ slot: 1, y: 0xfc });
    expect(collisionMask(top, [sprite({ slot: 2, y: 0xec })])).toBe(0);
  });

  it('skips itself and unavailable sprites (hidden, off screen, image $ff)', () => {
    expect(collisionMask(self, [self])).toBe(0);
    expect(collisionMask(self, [sprite({ slot: 2, available: false })])).toBe(0);
  });

  it("keeps Pikachu out of the player's mask, but not an NPC's", () => {
    const pika = sprite({ slot: PIKACHU_SLOT, y: 0x3c + 14 });
    expect(collisionMask(sprite({ slot: 0 }), [pika])).toBe(0);
    expect(collisionMask(sprite({ slot: 3 }), [pika])).toBe(down);
  });

  it('screen pixels are world pixels relative to the player at ($40, $3c), as bytes', () => {
    expect(screenPixels(160, 96, 128, 128)).toEqual({ x: 0x60, y: 0x1c });
    expect(screenPixels(64, 64, 128, 128)).toEqual({ x: 0x00, y: 0xfc });
    expect(screenPixels(128, 128, 128, 128, 3, -2)).toEqual({ x: 0x43, y: 0x3a });
  });
});

describe("CanWalkOntoTile's screen edge", () => {
  it.each([
    // [x, y (YPIXELS), dir, allowed]
    [0x40, 0xfc, 'up', false],     // top row: Y+4-1 underflows
    [0x40, 0xfc, 'down', true],
    [0x40, 0xfc, 'left', true],
    [0x40, 0x7c, 'up', true],      // Y+4 = 128: only up passes the Y test
    [0x40, 0x7c, 'down', false],
    [0x40, 0x7c, 'left', false],
    [0x40, 0x7b, 'left', true],    // Y+4 = 127
    [0x40, 0x7b, 'down', false],
    [0x90, 0x3c, 'left', true],    // X = 144: only left passes the X test
    [0x90, 0x3c, 'right', false],
    [0x90, 0x3c, 'up', false],
    [0x8f, 0x3c, 'up', true],      // X = 143
    [0x8f, 0x3c, 'right', false],
    [0x00, 0x3c, 'left', false],   // X = 0: left underflows
    [0x00, 0x3c, 'right', true],
  ] as const)('x %i, y %i, %s → %s', (x, y, dir, allowed) => {
    expect(stepStaysOnScreen(x, y, dir)).toBe(allowed);
  });
});

describe('IsSpriteInFrontOfPlayer', () => {
  it('needs exact pixels 16 px ahead, and takes the lowest slot', () => {
    const a = sprite({ slot: 3, x: 0x40, y: 0x2c });
    const b = sprite({ slot: 2, x: 0x40, y: 0x2c });
    expect(spriteInFront([a, b], 'up')).toBe(b);
    expect(spriteInFront([sprite({ slot: 2, x: 0x40, y: 0x2d })], 'up')).toBeNull();
    expect(spriteInFront([sprite({ slot: 2, x: 0x50, y: 0x3c })], 'right')?.slot).toBe(2);
    expect(spriteInFront([sprite({ slot: 2, x: 0x50, y: 0x3c, available: false })], 'right')).toBeNull();
  });
});

describe('wPikachuCollisionCounter in CollisionCheckOnLand', () => {
  it('an armed 8 blocks seven checks; the eighth passes', () => {
    let counter = 8;
    const results: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      const r = pikachuInFront(counter, false, false);
      counter = r.counter;
      results.push(r.blocked);
    }
    expect(results).toEqual([true, true, true, true, true, true, true, false]);
    expect(counter).toBe(0);
    expect(pikachuInFront(0, false, false)).toEqual({ blocked: false, counter: 0 });
  });

  it('B passes and keeps the counter; a Pikachu that is not following blocks, even with B', () => {
    expect(pikachuInFront(5, true, false)).toEqual({ blocked: false, counter: 5 });
    expect(pikachuInFront(0, true, true)).toEqual({ blocked: true, counter: 0 });
  });
});
