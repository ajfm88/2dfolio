import { describe, it, expect } from 'vitest';
import { findDonorTile, doorOverlaySpriteCol, itemMaskTileRange } from '../../src/render/dungeon-renderer.js';
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
