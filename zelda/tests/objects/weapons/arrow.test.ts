import { describe, it, expect } from 'vitest';
import { Arrow, ArrowState, ARROW_DAMAGE, SILVER_ARROW_DAMAGE } from '../../../src/objects/weapons/arrow.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import { Direction } from '../../../src/core/types.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';
import { ARROW_SPARK_FRAMES } from '../../../src/core/constants.js';

const ALL_WALKABLE = [36, 38];
const MIXED_WALKABLE = [36, 200]; // index 0 walkable (36 < 141), index 1 blocked (200 >= 141)

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function screenWithWall(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  // Block column 10 (tile x=160-175)
  for (let r = 0; r < 11; r++) {
    tiles[r]![10] = 1;
  }
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

describe('Arrow', () => {
  describe('construction', () => {
    it('starts in Flying state', () => {
      const arrow = new Arrow(100, 80, Direction.Right, false);
      expect(arrow.state).toBe(ArrowState.Flying);
      expect(arrow.isActive).toBe(true);
    });

    it('reports silver status', () => {
      expect(new Arrow(100, 80, Direction.Right, false).isSilver).toBe(false);
      expect(new Arrow(100, 80, Direction.Right, true).isSilver).toBe(true);
    });

    it('nudges vertical arrows right by 3px', () => {
      const up = new Arrow(100, 80, Direction.Up, false);
      expect(up.x).toBe(103);
      const down = new Arrow(100, 80, Direction.Down, false);
      expect(down.x).toBe(103);
    });

    it('does not nudge horizontal arrows', () => {
      const right = new Arrow(100, 80, Direction.Right, false);
      expect(right.x).toBe(100);
      const left = new Arrow(100, 80, Direction.Left, false);
      expect(left.x).toBe(100);
    });
  });

  describe('movement', () => {
    it('moves at 3px/frame (QSpeed $C0)', () => {
      const arrow = new Arrow(100, 80, Direction.Right, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      arrow.update(collision, screen);
      expect(arrow.x).toBe(103);
      expect(arrow.y).toBe(80);
    });

    it('moves left', () => {
      const arrow = new Arrow(100, 80, Direction.Left, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      arrow.update(collision, screen);
      expect(arrow.x).toBe(97);
    });

    it('moves up', () => {
      const arrow = new Arrow(100, 80, Direction.Up, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      arrow.update(collision, screen);
      expect(arrow.y).toBe(77);
    });

    it('moves down', () => {
      const arrow = new Arrow(100, 80, Direction.Down, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      arrow.update(collision, screen);
      expect(arrow.y).toBe(83);
    });
  });

  describe('boundary deactivation', () => {
    it('sparks when reaching right screen edge', () => {
      const arrow = new Arrow(250, 80, Direction.Right, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      // Flies right until x >= 256
      for (let i = 0; i < 10; i++) {
        arrow.update(collision, screen);
        if (arrow.state !== ArrowState.Flying) break;
      }
      expect(arrow.state).toBe(ArrowState.Spark);
    });

    it('sparks when reaching top edge', () => {
      const arrow = new Arrow(100, 5, Direction.Up, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      arrow.update(collision, screen);
      arrow.update(collision, screen);
      expect(arrow.state).toBe(ArrowState.Spark);
    });
  });

  describe('tile collision', () => {
    it('sparks when hitting a blocked tile', () => {
      // Wall at column 10 (x=160). Arrow starts at x=150, moving right.
      const arrow = new Arrow(150, 80, Direction.Right, false);
      const collision = new TileCollisionMap(MIXED_WALKABLE);
      const screen = screenWithWall();
      // At 3px/frame, reaches x=153, 156, 159... checks walkability at x+4
      for (let i = 0; i < 10; i++) {
        arrow.update(collision, screen);
        if (arrow.state !== ArrowState.Flying) break;
      }
      expect(arrow.state).toBe(ArrowState.Spark);
    });
  });

  describe('spark state', () => {
    it('lasts exactly 3 frames then dies', () => {
      const arrow = new Arrow(100, 80, Direction.Right, false);
      arrow.deactivate();
      expect(arrow.state).toBe(ArrowState.Spark);

      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();

      for (let i = 0; i < ARROW_SPARK_FRAMES - 1; i++) {
        arrow.update(collision, screen);
        expect(arrow.state).toBe(ArrowState.Spark);
      }
      arrow.update(collision, screen);
      expect(arrow.state).toBe(ArrowState.Dead);
      expect(arrow.isActive).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('transitions to Spark from Flying', () => {
      const arrow = new Arrow(100, 80, Direction.Right, false);
      arrow.deactivate();
      expect(arrow.state).toBe(ArrowState.Spark);
    });

    it('does nothing when already Dead', () => {
      const arrow = new Arrow(100, 80, Direction.Right, false);
      arrow.deactivate();
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      for (let i = 0; i < 3; i++) arrow.update(collision, screen);
      expect(arrow.state).toBe(ArrowState.Dead);
      arrow.deactivate();
      expect(arrow.state).toBe(ArrowState.Dead);
    });
  });

  describe('hitbox', () => {
    it('returns 8x8 rect at position', () => {
      const arrow = new Arrow(50, 70, Direction.Right, false);
      const hb = arrow.getHitbox();
      expect(hb.x).toBe(50);
      expect(hb.y).toBe(70);
      expect(hb.width).toBe(8);
      expect(hb.height).toBe(8);
    });
  });

  describe('damage constants', () => {
    it('ARROW_DAMAGE is 0x20', () => {
      expect(ARROW_DAMAGE).toBe(0x20);
    });

    it('SILVER_ARROW_DAMAGE is 0x40', () => {
      expect(SILVER_ARROW_DAMAGE).toBe(0x40);
    });
  });

  describe('no distance limit', () => {
    it('keeps flying across full screen width', () => {
      const arrow = new Arrow(10, 80, Direction.Right, false);
      const collision = new TileCollisionMap(ALL_WALKABLE);
      const screen = allWalkableScreen();
      // 246px / 3px per frame = 82 frames to cross screen
      for (let i = 0; i < 80; i++) {
        arrow.update(collision, screen);
      }
      expect(arrow.state).toBe(ArrowState.Flying);
      expect(arrow.x).toBeGreaterThan(200);
    });
  });
});
