import { describe, it, expect } from 'vitest';
import { SwordBeam } from '../../../src/objects/player/sword-beam.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import { Direction } from '../../../src/core/types.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';

const ALL_WALKABLE = [36, 38];
const MIXED = [36, 200]; // index 0 walkable, index 1 blocked

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function screenWithWall(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  for (let r = 0; r < 11; r++) {
    tiles[r]![10] = 1; // block column 10
  }
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

describe('SwordBeam', () => {
  describe('movement', () => {
    it('moves at 3px/frame', () => {
      const beam = new SwordBeam(120, 80, Direction.Right);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();

      let totalDist = 0;
      for (let i = 0; i < 4; i++) {
        const prev = beam.x;
        beam.update(collision, screen);
        totalDist += beam.x - prev;
      }
      expect(totalDist).toBe(12); // 3px/frame * 4 frames
    });

    it('moves in the given direction', () => {
      const beam = new SwordBeam(120, 80, Direction.Up);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();

      beam.update(collision, screen);
      expect(beam.y).toBeLessThan(80);
      expect(beam.x).toBe(120);
    });
  });

  describe('deactivation', () => {
    it('deactivates on screen edge', () => {
      const beam = new SwordBeam(250, 80, Direction.Right);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();

      for (let i = 0; i < 10; i++) {
        beam.update(collision, screen);
        if (!beam.isActive()) break;
      }
      expect(beam.isActive()).toBe(false);
    });

    it('deactivates on blocked tile', () => {
      const beam = new SwordBeam(140, 80, Direction.Right);
      const collision = new TileCollisionMap(MIXED);
      const screen = screenWithWall(); // wall at column 10 (pixel 160)

      for (let i = 0; i < 20; i++) {
        beam.update(collision, screen);
        if (!beam.isActive()) break;
      }
      expect(beam.isActive()).toBe(false);
    });

    it('does not update after deactivation', () => {
      const beam = new SwordBeam(254, 80, Direction.Right);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();

      beam.update(collision, screen); // should deactivate at edge
      const posAfter = beam.x;
      beam.update(collision, screen); // should not move
      expect(beam.x).toBe(posAfter);
    });
  });

  describe('getHitbox', () => {
    it('returns 8x8 hitbox at beam position', () => {
      const beam = new SwordBeam(100, 50, Direction.Down);
      const hb = beam.getHitbox();
      expect(hb.x).toBe(100);
      expect(hb.y).toBe(50);
      expect(hb.width).toBe(8);
      expect(hb.height).toBe(8);
    });
  });

  describe('isActive', () => {
    it('starts active', () => {
      const beam = new SwordBeam(120, 80, Direction.Left);
      expect(beam.isActive()).toBe(true);
    });
  });
});
