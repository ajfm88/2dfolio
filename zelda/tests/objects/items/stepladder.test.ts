import { describe, it, expect } from 'vitest';
import { Stepladder, LadderState } from '../../../src/objects/items/stepladder.js';
import { Direction } from '../../../src/core/types.js';
import { TileCollisionMap } from '../../../src/world/collision.js';
import type { OverworldScreen } from '../../../src/data/overworld-types.js';

function allWalkableScreen(): OverworldScreen {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0));
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

// metatileValues: index 0 = walkable (36), index 1 = blocked wall (200)
const ALL_WALKABLE = [36, 38];

describe('Stepladder', () => {
  describe('construction', () => {
    it('places ladder at correct offset facing Right', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      expect(ladder.x).toBe(116); // +16
      expect(ladder.y).toBe(83);  // +3
      expect(ladder.direction).toBe(Direction.Right);
      expect(ladder.state).toBe(LadderState.Approaching);
    });

    it('places ladder at correct offset facing Left', () => {
      const ladder = new Stepladder(100, 80, Direction.Left);
      expect(ladder.x).toBe(84);  // -16
      expect(ladder.y).toBe(83);  // +3
    });

    it('places ladder at correct offset facing Down', () => {
      const ladder = new Stepladder(100, 80, Direction.Down);
      expect(ladder.x).toBe(100); // 0
      expect(ladder.y).toBe(99);  // +19
    });

    it('places ladder at correct offset facing Up', () => {
      const ladder = new Stepladder(100, 80, Direction.Up);
      expect(ladder.x).toBe(100); // 0
      expect(ladder.y).toBe(75);  // -5
    });
  });

  describe('state machine', () => {
    it('transitions to OnLadder when distance < 16', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // Ladder at x=116. Link at x=105 → distance = 11 < 16
      ladder.update(105, 80);
      expect(ladder.state).toBe(LadderState.OnLadder);
    });

    it('stays Approaching when distance === 16 and facing ladder', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // Ladder at x=116. Link at x=100 → distance = 16
      ladder.update(100, 80);
      expect(ladder.state).toBe(LadderState.Approaching);
    });

    it('transitions to Done when distance === 16 and state is OnLadder', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // First get onto ladder
      ladder.update(105, 80);
      expect(ladder.state).toBe(LadderState.OnLadder);
      // Now step off — distance back to 16
      ladder.update(100, 80);
      expect(ladder.state).toBe(LadderState.Done);
      expect(ladder.isActive).toBe(false);
    });

    it('transitions to Done when distance > 16', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // Ladder at x=116. Link at x=80 → distance = 36 > 16
      ladder.update(80, 80);
      expect(ladder.state).toBe(LadderState.Done);
      expect(ladder.isActive).toBe(false);
    });

    it('uses Y distance with +3 offset for vertical ladders', () => {
      const ladder = new Stepladder(100, 80, Direction.Down);
      // Ladder at y=99. Link at y=80 → distance = |83-99| = 16, stays Approaching
      ladder.update(100, 80);
      expect(ladder.state).toBe(LadderState.Approaching);
      // Link moves closer: y=85 → distance = |88-99| = 11 < 16
      ladder.update(100, 85);
      expect(ladder.state).toBe(LadderState.OnLadder);
    });
  });

  describe('movement override', () => {
    const collision = new TileCollisionMap(ALL_WALKABLE);
    const screen = allWalkableScreen();

    it('allows movement in ladder direction', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      expect(ladder.shouldAllowMovement(Direction.Right, 100, 80, collision, screen)).toBe(true);
    });

    it('allows retreat (opposite direction)', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      expect(ladder.shouldAllowMovement(Direction.Left, 100, 80, collision, screen)).toBe(true);
    });

    it('blocks perpendicular movement', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // Move link onto ladder (distance < 16)
      ladder.update(110, 80);
      expect(ladder.shouldAllowMovement(Direction.Up, 110, 80, collision, screen)).toBe(false);
      expect(ladder.shouldAllowMovement(Direction.Down, 110, 80, collision, screen)).toBe(false);
    });
  });

  describe('tile position', () => {
    it('computes correct tile row and col', () => {
      const ladder = new Stepladder(100, 80, Direction.Right);
      // Ladder at (116, 83) → tile (83/16=5, 116/16=7)
      expect(ladder.tileRow).toBe(5);
      expect(ladder.tileCol).toBe(7);
    });
  });
});
