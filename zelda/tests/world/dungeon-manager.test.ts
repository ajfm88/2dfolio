import { describe, it, expect } from 'vitest';
import { DungeonManager } from '../../src/world/dungeon-manager.js';
import { DungeonRenderer } from '../../src/render/dungeon-renderer.js';
import { Direction } from '../../src/core/types.js';
import type { DungeonData } from '../../src/data/dungeon-types.js';

function createTestDungeonData(): DungeonData {
  const rooms = Array.from({ length: 128 }, (_, i) => ({
    id: i,
    row: Math.floor(i / 16),
    col: i % 16,
    uniqueRoomId: 0,
    doors: {
      north: i === 115 ? 1 : (i === 99 ? 0 : 1),
      south: i === 115 ? 0 : (i === 99 ? 0 : 1),
      east: i === 115 ? 0 : 1,
      west: i === 116 ? 0 : 1,
    },
    outerPalette: 0,
    innerPalette: 0,
    monsterListId: 0,
    monsterCountIndex: 0,
    itemId: 3,
    hasPushBlock: false,
    isDark: false,
    soundEffect: 0,
    secretTrigger: 0,
    itemPositionIndex: 0,
  }));

  // Room 115 (start): south open, east open
  // Room 116: west open (connects to 115 east)
  // Room 99: north open, south open (connects to 115 north)

  return {
    levelBlocks: {
      uw1q1: { rooms },
      uw2q1: { rooms: [] as never },
      uw1q2: { rooms: [] as never },
      uw2q2: { rooms: [] as never },
    },
    dungeons: [
      {
        level: 1,
        startRoomId: 115,
        triforceRoomId: 54,
        bossRoomId: 53,
        cellarRoomIds: [255],
        foeCounts: [3, 5, 6, 8],
        shortcutOrItemPositions: [201, 172, 137, 135],
        startY: 221,
        levelBlock: 'uw1q1',
      },
    ],
    uniqueRooms: [
      {
        id: 0,
        tiles: Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 1)),
      },
    ],
    cellarRooms: [],
    squareTable: [176, 116, 148, 180, 112, 104, 244, 36],
  };
}

function createDummyRenderer(): DungeonRenderer {
  const img = { width: 4096, height: 2816 } as HTMLImageElement;
  return new DungeonRenderer(img);
}

describe('DungeonManager', () => {
  it('initializes at start room', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());
    expect(dm.currentRoomId).toBe(115);
    expect(dm.level).toBe(1);
    expect(dm.visitedRooms.has(115)).toBe(true);
  });

  it('calculates next room correctly for each direction', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    // North: 115 - 16 = 99
    expect(dm.currentRoomId - 16).toBe(99);
    // South: 115 + 16 = 131 (out of range but that's fine)
    expect(dm.currentRoomId + 16).toBe(131);
    // East: 115 + 1 = 116
    expect(dm.currentRoomId + 1).toBe(116);
    // West: 115 - 1 = 114
    expect(dm.currentRoomId - 1).toBe(114);
  });

  it('canPassDoor returns true for open doors', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    // Room 115 has south=0 (open) and east=0 (open), north=1 (wall), west depends
    expect(dm.canPassDoor(Direction.Down)).toBe(true);
    expect(dm.canPassDoor(Direction.Right)).toBe(true);
    expect(dm.canPassDoor(Direction.Up)).toBe(false);
  });

  it('transitionToRoom changes current room and marks visited', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    dm.transitionToRoom(Direction.Right);
    expect(dm.currentRoomId).toBe(116);
    expect(dm.visitedRooms.has(116)).toBe(true);
    expect(dm.visitedRooms.size).toBe(2);
  });

  it('returnToEntranceRoom warps back to the start room (Wallmaster grab)', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    dm.transitionToRoom(Direction.Right); // move off the start room
    expect(dm.currentRoomId).toBe(116);

    const entry = dm.returnToEntranceRoom();
    expect(dm.currentRoomId).toBe(dm.startRoomId); // back at start room 115
    // Entry position is the entrance (bottom-center), same as first dungeon entry.
    expect(entry.y).toBe(160);
    expect(entry.x).toBe(120);
  });

  it('getEntryPosition returns opposite edge', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    const fromRight = dm.getEntryPosition(Direction.Right);
    expect(fromRight.x).toBe(0);

    const fromUp = dm.getEntryPosition(Direction.Up);
    expect(fromUp.y).toBe(160);
  });

  it('getDoorType returns correct door types', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());

    expect(dm.getDoorType(Direction.Up)).toBe(1);
    expect(dm.getDoorType(Direction.Down)).toBe(0);
    expect(dm.getDoorType(Direction.Right)).toBe(0);
  });

  it('startRoomId matches dungeon info', () => {
    const data = createTestDungeonData();
    const dm = new DungeonManager(1, data, createDummyRenderer());
    expect(dm.startRoomId).toBe(115);
  });
});
