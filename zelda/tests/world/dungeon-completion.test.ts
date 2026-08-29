import { describe, it, expect } from 'vitest';
import { DungeonManager } from '../../src/world/dungeon-manager.js';
import { DungeonRenderer } from '../../src/render/dungeon-renderer.js';
import { checkSecretTrigger } from '../../src/world/dungeon-secrets.js';
import type { DungeonData } from '../../src/data/dungeon-types.js';

// H2 completion machinery: the triforce room-item offset, the boss-room secret
// gating (trigger 7), and the "all foes dead → item + shutter" trigger.

const START = 115;

function makeData(startItemId: number, startSecretTrigger: number): DungeonData {
  const rooms = Array.from({ length: 128 }, (_, i) => ({
    id: i,
    row: Math.floor(i / 16),
    col: i % 16,
    uniqueRoomId: 0,
    doors: { north: 1, south: 0, east: 0, west: 1 },
    outerPalette: 0,
    innerPalette: 0,
    monsterListId: 0,
    monsterCountIndex: 0,
    itemId: i === START ? startItemId : 3,
    hasPushBlock: false,
    isDark: false,
    soundEffect: 0,
    secretTrigger: i === START ? startSecretTrigger : 0,
    itemPositionIndex: 0,
  }));

  return {
    levelBlocks: {
      uw1q1: { rooms },
      uw2q1: { rooms: [] as never },
      uw1q2: { rooms: [] as never },
      uw2q2: { rooms: [] as never },
    },
    dungeons: [{
      level: 1,
      startRoomId: START,
      triforceRoomId: 54,
      bossRoomId: 53,
      cellarRoomIds: [255],
      foeCounts: [3, 5, 6, 8],
      shortcutOrItemPositions: [0xC9, 172, 137, 135], // index 0 = $C9 → X $C0, Y $90
      startY: 221,
      levelBlock: 'uw1q1',
    }],
    uniqueRooms: [{
      id: 0,
      tiles: Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 1)),
    }],
    cellarRooms: [],
    squareTable: [176, 116, 148, 180, 112, 104, 244, 36],
  };
}

function dummyRenderer(): DungeonRenderer {
  return new DungeonRenderer({ width: 4096, height: 2816 } as HTMLImageElement);
}

describe('triforce room-item position', () => {
  it('shifts a triforce piece ($1B) 8px left of its slot', () => {
    const dm = new DungeonManager(1, makeData(0x1B, 0), dummyRenderer());
    // Packed $C9 → X $C0 (192), Y $90 (144); triforce shifts X −8 → 184.
    expect(dm.getRoomItemPosition()).toEqual({ x: 184, y: 144 });
  });

  it('does not shift a non-triforce item (heart container $1A)', () => {
    const dm = new DungeonManager(1, makeData(0x1A, 0), dummyRenderer());
    expect(dm.getRoomItemPosition()).toEqual({ x: 192, y: 144 });
  });

  it('returns null when the room has no item ($3 = none)', () => {
    const dm = new DungeonManager(1, makeData(3, 0), dummyRenderer());
    expect(dm.getRoomItemPosition()).toBeNull();
  });
});

describe('boss-room item gating', () => {
  it('gates the item behind secret trigger 7 (FoesForItem)', () => {
    const dm = new DungeonManager(1, makeData(0x1A, 7), dummyRenderer());
    expect(dm.isItemSecretGated()).toBe(true);
  });

  it('does not gate an ungated item (trigger 0)', () => {
    const dm = new DungeonManager(1, makeData(0x1A, 0), dummyRenderer());
    expect(dm.isItemSecretGated()).toBe(false);
  });
});

describe('all-foes-dead trigger (boss defeat)', () => {
  it('trigger 7 opens the shutter and activates the item once all foes are dead', () => {
    expect(checkSecretTrigger(7, true, false, false)).toEqual({
      shuttersOpen: true, stairsRevealed: false, itemActivated: true,
    });
  });

  it('trigger 7 does nothing while foes remain', () => {
    expect(checkSecretTrigger(7, false, false, false)).toEqual({
      shuttersOpen: false, stairsRevealed: false, itemActivated: false,
    });
  });
});
