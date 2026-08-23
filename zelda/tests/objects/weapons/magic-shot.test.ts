import { describe, it, expect } from 'vitest';
import { MagicShot, MagicShotState } from '../../../src/objects/weapons/magic-shot.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import { Direction } from '../../../src/core/types.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function screenWithWall(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  for (let r = 0; r < 11; r++) {
    tiles[r]![10] = 1; // block column 10 (x=160-175) — tile index 1 maps to metatile 200 (blocked)
  }
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

// metatileValues: index 0 = walkable (36 < 141), index 1 = blocked (200 >= 141)
const ALL_WALKABLE = [36, 38];
const MIXED_WALKABLE = [36, 200];

describe('MagicShot', () => {
  describe('construction', () => {
    it('starts in Flying state at valid position', () => {
      const shot = new MagicShot(100, 80, Direction.Right);
      expect(shot.state).toBe(MagicShotState.Flying);
      expect(shot.isActive).toBe(true);
    });

    it('immediately dies if horizontal and too close to left edge', () => {
      const shot = new MagicShot(15, 80, Direction.Left);
      expect(shot.state).toBe(MagicShotState.Dead);
      expect(shot.isActive).toBe(false);
    });

    it('immediately dies if horizontal and too close to right edge', () => {
      const shot = new MagicShot(240, 80, Direction.Right);
      expect(shot.state).toBe(MagicShotState.Dead);
      expect(shot.isActive).toBe(false);
    });

    it('does not edge-check vertical shots', () => {
      const shot = new MagicShot(15, 80, Direction.Up);
      expect(shot.isActive).toBe(true);
    });
  });

  describe('movement', () => {
    it('moves at QSpeed $A0 = 2.5 px/frame rightward', () => {
      const shot = new MagicShot(100, 80, Direction.Right);
      const screen = allWalkableScreen();
      const collision = new TileCollisionMap(ALL_WALKABLE);

      const startX = shot.x;
      // Run for 4 frames — should move ~10 pixels (2.5 × 4)
      for (let i = 0; i < 4; i++) {
        shot.update(collision, screen);
      }
      expect(shot.x - startX).toBe(10);
    });

    it('moves upward', () => {
      const shot = new MagicShot(100, 80, Direction.Up);
      const screen = allWalkableScreen();
      const collision = new TileCollisionMap(ALL_WALKABLE);

      const startY = shot.y;
      for (let i = 0; i < 4; i++) {
        shot.update(collision, screen);
      }
      expect(startY - shot.y).toBe(10);
    });
  });

  describe('deactivation', () => {
    it('dies at screen right boundary with wasBlocked = true', () => {
      // Start far enough from edge to not trigger constructor check
      const shot = new MagicShot(230, 80, Direction.Right);
      const screen = allWalkableScreen();
      const collision = new TileCollisionMap(ALL_WALKABLE);

      while (shot.isActive) {
        shot.update(collision, screen);
      }
      expect(shot.wasBlocked).toBe(true);
    });

    it('dies at screen top boundary with wasBlocked = true', () => {
      const shot = new MagicShot(100, 5, Direction.Up);
      const screen = allWalkableScreen();
      const collision = new TileCollisionMap(ALL_WALKABLE);

      while (shot.isActive) {
        shot.update(collision, screen);
      }
      expect(shot.wasBlocked).toBe(true);
    });

    it('dies on tile collision with wasBlocked = true', () => {
      // Place shot heading right toward wall at column 10
      const shot = new MagicShot(150, 80, Direction.Right);
      const screen = screenWithWall();
      const collision = new TileCollisionMap(MIXED_WALKABLE);

      while (shot.isActive) {
        shot.update(collision, screen);
      }
      expect(shot.wasBlocked).toBe(true);
      expect(shot.x).toBeLessThanOrEqual(160);
    });

    it('deactivate() sets wasBlocked false (enemy hit, not wall)', () => {
      const shot = new MagicShot(100, 80, Direction.Right);
      shot.deactivate();
      expect(shot.isActive).toBe(false);
      expect(shot.wasBlocked).toBe(false);
    });
  });

  describe('hitbox', () => {
    it('returns 8x8 hitbox at shot position', () => {
      const shot = new MagicShot(100, 80, Direction.Right);
      const hb = shot.getHitbox();
      expect(hb.x).toBe(100);
      expect(hb.y).toBe(80);
      expect(hb.width).toBe(8);
      expect(hb.height).toBe(8);
    });
  });
});
