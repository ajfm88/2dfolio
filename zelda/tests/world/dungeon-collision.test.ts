import { describe, it, expect } from 'vitest';
import { DungeonCollisionMap } from '../../src/world/dungeon-collision.js';
import type { DungeonRoom, UniqueRoom } from '../../src/data/dungeon-types.js';
import type { OverworldScreen } from '../../src/data/overworld-types.js';

const squareTable = [176, 116, 148, 180, 112, 104, 244, 36];
// tile 0: 176 >= 141 → NOT walkable
// tile 1: 116 < 141 → walkable
// tile 2: 148 >= 141 → NOT walkable

const dummyScreen = { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles: [] } as unknown as OverworldScreen;

function allFloorRoom(): UniqueRoom {
  return {
    id: 0,
    tiles: Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 1)),
  };
}

function mixedRoom(): UniqueRoom {
  const tiles = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 1));
  // Place a wall block (tile 0) at inner position (2, 3) → grid position (4, 5)
  tiles[2]![3] = 0;
  return { id: 1, tiles };
}

function makeRoom(doors: { north: number; south: number; east: number; west: number }): DungeonRoom {
  return {
    id: 0, row: 0, col: 0, uniqueRoomId: 0, doors,
    outerPalette: 0, innerPalette: 0, monsterListId: 0,
    monsterCountIndex: 0, itemId: 3, hasPushBlock: false,
    isDark: false, soundEffect: 0, secretTrigger: 0, itemPositionIndex: 0,
  };
}

describe('DungeonCollisionMap', () => {
  it('border walls are not walkable', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // Top-left corner border
    expect(col.isPositionWalkable(dummyScreen, 8, 8)).toBe(false);
    // Bottom-right border
    expect(col.isPositionWalkable(dummyScreen, 240, 168)).toBe(false);
    // Left border
    expect(col.isPositionWalkable(dummyScreen, 8, 80)).toBe(false);
    // Right border
    expect(col.isPositionWalkable(dummyScreen, 232, 80)).toBe(false);
  });

  it('inner walkable tiles are walkable', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // Inner area starts at col 2, row 2 → pixel (32, 32)
    expect(col.isPositionWalkable(dummyScreen, 40, 40)).toBe(true);
    // Center of room
    expect(col.isPositionWalkable(dummyScreen, 128, 88)).toBe(true);
  });

  it('open north door creates walkable border', () => {
    const room = makeRoom({ north: 0, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // North door at cols 7-8, rows 0-1 → pixel x 112-143, y 0-31
    expect(col.isPositionWalkable(dummyScreen, 120, 8)).toBe(true);
    // Adjacent border still blocked
    expect(col.isPositionWalkable(dummyScreen, 80, 8)).toBe(false);
  });

  it('open south door creates walkable border', () => {
    const room = makeRoom({ north: 1, south: 2, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // South door at cols 7-8, rows 9-10 → pixel x 112-143, y 144-175
    expect(col.isPositionWalkable(dummyScreen, 120, 150)).toBe(true);
  });

  it('open west door creates walkable border', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 0 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // West door at cols 0-1, rows 4-6 → pixel x 0-31, y 64-111
    expect(col.isPositionWalkable(dummyScreen, 8, 72)).toBe(true);
  });

  it('open east door creates walkable border', () => {
    const room = makeRoom({ north: 1, south: 1, east: 2, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // East door at cols 14-15, rows 4-6 → pixel x 224-255, y 64-111
    expect(col.isPositionWalkable(dummyScreen, 232, 72)).toBe(true);
  });

  it('wall door blocks passage', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // All doors are walls — check door positions
    expect(col.isPositionWalkable(dummyScreen, 120, 8)).toBe(false);
    expect(col.isPositionWalkable(dummyScreen, 120, 150)).toBe(false);
    expect(col.isPositionWalkable(dummyScreen, 8, 72)).toBe(false);
    expect(col.isPositionWalkable(dummyScreen, 232, 72)).toBe(false);
  });

  it('inner wall tile blocks movement', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(mixedRoom(), room, squareTable);

    // Inner (2,3) → grid (4,5) → pixel center (80+8, 64+8) = (88, 72)
    expect(col.isPositionWalkable(dummyScreen, 88, 72)).toBe(false);
    // Adjacent walkable tile
    expect(col.isPositionWalkable(dummyScreen, 72, 72)).toBe(true);
  });

  it('isRectWalkable checks all corners', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // Fully in walkable area
    expect(col.isRectWalkable(dummyScreen, 40, 40, 8, 8)).toBe(true);
    // Overlapping border
    expect(col.isRectWalkable(dummyScreen, 0, 0, 8, 8)).toBe(false);
  });

  it('openDoor makes a closed door passable', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    expect(col.isPositionWalkable(dummyScreen, 120, 8)).toBe(false);
    col.openDoor('north');
    expect(col.isPositionWalkable(dummyScreen, 120, 8)).toBe(true);
  });

  it('isWaterTileAt always returns false for dungeons', () => {
    const room = makeRoom({ north: 0, south: 0, east: 0, west: 0 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);
    expect(col.isWaterTileAt(dummyScreen, 100, 100)).toBe(false);
  });

  it('walkable overrides work', () => {
    const room = makeRoom({ north: 1, south: 1, east: 1, west: 1 });
    const col = new DungeonCollisionMap(allFloorRoom(), room, squareTable);

    // Border position is blocked
    expect(col.isPositionWalkable(dummyScreen, 8, 8)).toBe(false);
    // Override makes it walkable
    col.setWalkableOverride(0, 0);
    expect(col.isPositionWalkable(dummyScreen, 8, 8)).toBe(true);
    // Clear restores
    col.clearWalkableOverrides();
    expect(col.isPositionWalkable(dummyScreen, 8, 8)).toBe(false);
  });
});
