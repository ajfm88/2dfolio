import { describe, it, expect } from 'vitest';
import dungeonJson from '../../src/data/dungeons.json';
import type { DungeonData } from '../../src/data/dungeon-types.js';

const data = dungeonJson as DungeonData;

describe('Dungeon data — level blocks', () => {
  const blockKeys = ['uw1q1', 'uw2q1', 'uw1q2', 'uw2q2'] as const;

  it('has exactly 4 level blocks', () => {
    expect(Object.keys(data.levelBlocks)).toHaveLength(4);
    for (const key of blockKeys) {
      expect(data.levelBlocks[key]).toBeDefined();
    }
  });

  it('each level block has 128 rooms', () => {
    for (const key of blockKeys) {
      expect(data.levelBlocks[key].rooms).toHaveLength(128);
    }
  });

  it('rooms have sequential IDs 0-127', () => {
    for (const key of blockKeys) {
      data.levelBlocks[key].rooms.forEach((room, i) => {
        expect(room.id).toBe(i);
      });
    }
  });

  it('row and col derive from ID', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.row).toBe(Math.floor(room.id / 16));
        expect(room.col).toBe(room.id % 16);
      }
    }
  });

  it('all door types are in range 0-7', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.doors.north).toBeGreaterThanOrEqual(0);
        expect(room.doors.north).toBeLessThanOrEqual(7);
        expect(room.doors.south).toBeGreaterThanOrEqual(0);
        expect(room.doors.south).toBeLessThanOrEqual(7);
        expect(room.doors.east).toBeGreaterThanOrEqual(0);
        expect(room.doors.east).toBeLessThanOrEqual(7);
        expect(room.doors.west).toBeGreaterThanOrEqual(0);
        expect(room.doors.west).toBeLessThanOrEqual(7);
      }
    }
  });

  it('uniqueRoomId is 0-63', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.uniqueRoomId).toBeGreaterThanOrEqual(0);
        expect(room.uniqueRoomId).toBeLessThanOrEqual(63);
      }
    }
  });

  it('itemId is 0-31', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.itemId).toBeGreaterThanOrEqual(0);
        expect(room.itemId).toBeLessThanOrEqual(31);
      }
    }
  });

  it('secretTrigger is 0-7', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.secretTrigger).toBeGreaterThanOrEqual(0);
        expect(room.secretTrigger).toBeLessThanOrEqual(7);
      }
    }
  });

  it('palette values are 0-3', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.outerPalette).toBeGreaterThanOrEqual(0);
        expect(room.outerPalette).toBeLessThanOrEqual(3);
        expect(room.innerPalette).toBeGreaterThanOrEqual(0);
        expect(room.innerPalette).toBeLessThanOrEqual(3);
      }
    }
  });

  it('monsterCountIndex is 0-3', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(room.monsterCountIndex).toBeGreaterThanOrEqual(0);
        expect(room.monsterCountIndex).toBeLessThanOrEqual(3);
      }
    }
  });

  it('boolean fields are booleans', () => {
    for (const key of blockKeys) {
      for (const room of data.levelBlocks[key].rooms) {
        expect(typeof room.hasPushBlock).toBe('boolean');
        expect(typeof room.isDark).toBe('boolean');
      }
    }
  });
});

describe('Dungeon data — dungeon info', () => {
  it('has exactly 9 dungeons', () => {
    expect(data.dungeons).toHaveLength(9);
  });

  it('dungeons have levels 1-9', () => {
    for (let i = 0; i < 9; i++) {
      expect(data.dungeons[i]!.level).toBe(i + 1);
    }
  });

  it('dungeons 1-6 use uw1q1, dungeons 7-9 use uw2q1', () => {
    for (let i = 0; i < 6; i++) {
      expect(data.dungeons[i]!.levelBlock).toBe('uw1q1');
    }
    for (let i = 6; i < 9; i++) {
      expect(data.dungeons[i]!.levelBlock).toBe('uw2q1');
    }
  });

  it('startRoomId is in range 0-127', () => {
    for (const dungeon of data.dungeons) {
      expect(dungeon.startRoomId).toBeGreaterThanOrEqual(0);
      expect(dungeon.startRoomId).toBeLessThanOrEqual(127);
    }
  });

  it('triforceRoomId is in range 0-127', () => {
    for (const dungeon of data.dungeons) {
      expect(dungeon.triforceRoomId).toBeGreaterThanOrEqual(0);
      expect(dungeon.triforceRoomId).toBeLessThanOrEqual(127);
    }
  });

  it('bossRoomId is in range 0-127', () => {
    for (const dungeon of data.dungeons) {
      expect(dungeon.bossRoomId).toBeGreaterThanOrEqual(0);
      expect(dungeon.bossRoomId).toBeLessThanOrEqual(127);
    }
  });

  it('each dungeon has 4 foe counts', () => {
    for (const dungeon of data.dungeons) {
      expect(dungeon.foeCounts).toHaveLength(4);
    }
  });

  it('each dungeon has 10 cellar room IDs', () => {
    for (const dungeon of data.dungeons) {
      expect(dungeon.cellarRoomIds).toHaveLength(10);
    }
  });

  it('start room exists in the level block and has a non-wall door', () => {
    for (const dungeon of data.dungeons) {
      const block = data.levelBlocks[dungeon.levelBlock as keyof typeof data.levelBlocks];
      const startRoom = block.rooms[dungeon.startRoomId];
      expect(startRoom).toBeDefined();
      const doors = startRoom!.doors;
      const hasNonWallDoor = doors.north !== 1 || doors.south !== 1 ||
                             doors.east !== 1 || doors.west !== 1;
      expect(hasNonWallDoor).toBe(true);
    }
  });
});

describe('Dungeon data — unique rooms', () => {
  it('has exactly 42 unique rooms', () => {
    expect(data.uniqueRooms).toHaveLength(42);
  });

  it('unique rooms have sequential IDs 0-41', () => {
    data.uniqueRooms.forEach((room, i) => {
      expect(room.id).toBe(i);
    });
  });

  it('every unique room has 7 rows of 12 columns', () => {
    for (const room of data.uniqueRooms) {
      expect(room.tiles).toHaveLength(7);
      for (const row of room.tiles) {
        expect(row).toHaveLength(12);
      }
    }
  });

  it('all square indices are in range 0-7', () => {
    for (const room of data.uniqueRooms) {
      for (const row of room.tiles) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(7);
        }
      }
    }
  });

  it('most rooms have tile variety (not all same index)', () => {
    let roomsWithVariety = 0;
    for (const room of data.uniqueRooms) {
      const vals = new Set(room.tiles.flat());
      if (vals.size > 1) roomsWithVariety++;
    }
    expect(roomsWithVariety).toBeGreaterThan(30);
  });
});

describe('Dungeon data — cellar rooms', () => {
  it('has exactly 2 cellar rooms', () => {
    expect(data.cellarRooms).toHaveLength(2);
  });

  it('cellar rooms have IDs 0 and 1', () => {
    expect(data.cellarRooms[0]!.id).toBe(0);
    expect(data.cellarRooms[1]!.id).toBe(1);
  });

  it('cellar rooms have 7 rows of 16 columns', () => {
    for (const room of data.cellarRooms) {
      expect(room.tiles).toHaveLength(7);
      for (const row of room.tiles) {
        expect(row).toHaveLength(16);
      }
    }
  });

  it('cellar room square indices are in range 0-7', () => {
    for (const room of data.cellarRooms) {
      for (const row of room.tiles) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(7);
        }
      }
    }
  });
});

describe('Dungeon data — square table', () => {
  it('has exactly 8 entries', () => {
    expect(data.squareTable).toHaveLength(8);
  });

  it('values are valid CHR tile IDs (0-255)', () => {
    for (const val of data.squareTable) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('matches known PrimarySquaresUW values', () => {
    expect(data.squareTable).toEqual([0xB0, 0x74, 0x94, 0xB4, 0x70, 0x68, 0xF4, 0x24]);
  });
});

describe('Dungeon data — cross-references', () => {
  it('all uniqueRoomIds used by rooms exist in uniqueRooms', () => {
    const uniqueIds = new Set(data.uniqueRooms.map(r => r.id));
    for (const key of ['uw1q1', 'uw2q1'] as const) {
      for (const room of data.levelBlocks[key].rooms) {
        if (room.uniqueRoomId < 42) {
          expect(uniqueIds.has(room.uniqueRoomId)).toBe(true);
        }
      }
    }
  });
});
