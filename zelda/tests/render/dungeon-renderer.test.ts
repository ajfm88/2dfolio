import { describe, it, expect } from 'vitest';
import { findDonorTile, doorOverlaySpriteCol, itemMaskTileRange, roomMapCell, isBlankFloorRoom } from '../../src/render/dungeon-renderer.js';
import type { UniqueRoom } from '../../src/data/dungeon-types.js';
import dungeonsJson from '../../src/data/dungeons.json';
import type { DungeonData } from '../../src/data/dungeon-types.js';

const data = dungeonsJson as DungeonData;

describe('findDonorTile', () => {
  it('picks the farthest same-index tile and never the painted cell', () => {
    const unique: UniqueRoom = {
      id: 0,
      tiles: Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 1)),
    };
    // L1 room 83 key sits on inner (row 1, col 6) — play-area tile (3, 8).
    const donor = findDonorTile(unique, 1, 1, 6);
    expect(donor).not.toBeNull();
    expect(donor).not.toEqual({ row: 1, col: 6 });
    // Corners are farthest from (1,6): (6,0) dist 11, (6,11) dist 10, (0,0) dist 7.
    expect(donor).toEqual({ row: 6, col: 0 });
  });

  it('returns null when the painted tile is the only match', () => {
    const tiles = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
    tiles[1]![6] = 1;
    const unique: UniqueRoom = { id: 0, tiles };
    expect(findDonorTile(unique, 1, 1, 6)).toBeNull();
  });

  it('L1 unique room 2 (key room) has a floor donor away from the key tile', () => {
    const unique = data.uniqueRooms[2];
    expect(unique).toBeDefined();
    const donor = findDonorTile(unique!, 1, 1, 6);
    expect(donor).not.toBeNull();
    expect(donor).not.toEqual({ row: 1, col: 6 });
  });
});

describe('itemMaskTileRange', () => {
  it('L1 boss heart (painted at tile 13,5) is covered from NES slot 192,80', () => {
    const r = itemMaskTileRange(192, 80);
    expect(r.startCol).toBeLessThanOrEqual(13);
    expect(r.endCol).toBeGreaterThanOrEqual(13);
    expect(r.startRow).toBeLessThanOrEqual(5);
    expect(r.endRow).toBeGreaterThanOrEqual(5);
  });
});

describe('doorOverlaySpriteCol', () => {
  // dungeon-doors.png cols: 0=wall, 1=open, 2=locked, 3=shutter, 4=hole
  it('does not overlay a closed shutter or key door — the map already paints those', () => {
    expect(doorOverlaySpriteCol(7, false)).toBe(-1);
    expect(doorOverlaySpriteCol(7, true)).toBe(1);
    expect(doorOverlaySpriteCol(5, false)).toBe(-1);
    expect(doorOverlaySpriteCol(5, true)).toBe(1);
    expect(doorOverlaySpriteCol(6, false)).toBe(-1);
    expect(doorOverlaySpriteCol(6, true)).toBe(1);
  });

  it('draws a hole (col 4) once a bombable wall is opened', () => {
    expect(doorOverlaySpriteCol(4, false)).toBe(0);
    expect(doorOverlaySpriteCol(4, true)).toBe(4);
  });

  it('skips overlay for already-open / wall / false-wall types', () => {
    expect(doorOverlaySpriteCol(0, false)).toBe(-1);
    expect(doorOverlaySpriteCol(1, false)).toBe(-1);
    expect(doorOverlaySpriteCol(2, true)).toBe(-1);
    expect(doorOverlaySpriteCol(3, true)).toBe(-1);
  });
});

describe('roomMapCell (dungeons-map.png layout)', () => {
  it('uw1q1 rooms sit at their own cell in the top half', () => {
    expect(roomMapCell(65, 'uw1q1')).toEqual({ col: 1, row: 4 });
    expect(roomMapCell(0, 'uw1q1')).toEqual({ col: 0, row: 0 });
  });

  it('uw2q1 halves are swapped: the painted people prove the offset', () => {
    // L7 Grumble room 40 is painted at cell 32, the L7 bomb seller (72) at 64,
    // the L8 Spectacle Rock man (61) at 53, the L9 gatekeeper (102) at 110.
    const cellId = (c: { col: number; row: number }) => (c.row - 8) * 16 + c.col;
    expect(cellId(roomMapCell(40, 'uw2q1'))).toBe(32);
    expect(cellId(roomMapCell(72, 'uw2q1'))).toBe(64);
    expect(cellId(roomMapCell(61, 'uw2q1'))).toBe(53);
    expect(cellId(roomMapCell(102, 'uw2q1'))).toBe(110);
    expect(roomMapCell(102, 'uw2q1').row).toBe(14);
  });
});

describe('isBlankFloorRoom', () => {
  it('is true for unique room 38 (the people and money rooms)', () => {
    expect(isBlankFloorRoom(data.uniqueRooms[38]!, data.squareTable)).toBe(true);
  });

  it('is false for rooms with blocks or statues', () => {
    expect(isBlankFloorRoom(data.uniqueRooms[33]!, data.squareTable)).toBe(false);
    expect(isBlankFloorRoom(data.uniqueRooms[35]!, data.squareTable)).toBe(false);
  });

  it('every Q1 person, Grumble and rupee-stash room uses a blank-floor layout', () => {
    for (const block of ['uw1q1', 'uw2q1'] as const) {
      for (const room of data.levelBlocks[block].rooms) {
        const list = room.monsterListId;
        if (list === 0x35 || list === 0x36 || (list >= 0x4b && list <= 0x52)) {
          expect(isBlankFloorRoom(data.uniqueRooms[room.uniqueRoomId]!, data.squareTable)).toBe(true);
        }
      }
    }
  });
});
