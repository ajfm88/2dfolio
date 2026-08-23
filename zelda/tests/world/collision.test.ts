import { describe, it, expect } from 'vitest';
import { TileCollisionMap, createCollisionMap } from '../../src/world/collision.js';
import type { OverworldScreen, OverworldData } from '../../src/data/overworld-types.js';
import { TILE_SIZE, SCREEN_WIDTH, PLAY_AREA_HEIGHT } from '../../src/core/constants.js';

const TEST_METATILES = [36, 111, 243, 250, 152]; // indices 0,1 walkable; 2,3,4 blocked

function makeScreen(tiles: number[][]): OverworldScreen {
  return { id: 0, row: 0, col: 0, uniqueRoomId: 0, tiles };
}

function make2x2Screen(topLeft: number, topRight: number, bottomLeft: number, bottomRight: number): OverworldScreen {
  const rows: number[][] = [];
  for (let r = 0; r < 11; r++) {
    const row: number[] = [];
    for (let c = 0; c < 16; c++) {
      const isTop = r < 5;
      const isLeft = c < 8;
      if (isTop && isLeft) row.push(topLeft);
      else if (isTop) row.push(topRight);
      else if (isLeft) row.push(bottomLeft);
      else row.push(bottomRight);
    }
    rows.push(row);
  }
  return makeScreen(rows);
}

describe('TileCollisionMap', () => {
  describe('isTileWalkable', () => {
    const map = new TileCollisionMap(TEST_METATILES);

    it('returns true for tiles below threshold', () => {
      expect(map.isTileWalkable(0)).toBe(true);
      expect(map.isTileWalkable(1)).toBe(true);
    });

    it('returns false for tiles at or above threshold', () => {
      expect(map.isTileWalkable(2)).toBe(false);
      expect(map.isTileWalkable(3)).toBe(false);
      expect(map.isTileWalkable(4)).toBe(false);
    });

    it('returns false for out-of-range index', () => {
      expect(map.isTileWalkable(99)).toBe(false);
      expect(map.isTileWalkable(-1)).toBe(false);
    });
  });

  describe('custom threshold', () => {
    it('respects custom threshold', () => {
      const map = new TileCollisionMap([100, 200, 150], 151);
      expect(map.isTileWalkable(0)).toBe(true);  // 100 < 151
      expect(map.isTileWalkable(1)).toBe(false);  // 200 >= 151
      expect(map.isTileWalkable(2)).toBe(true);  // 150 < 151
    });
  });

  describe('isPositionWalkable', () => {
    const map = new TileCollisionMap(TEST_METATILES);
    const screen = make2x2Screen(0, 2, 0, 0);

    it('returns true for pixel on walkable tile', () => {
      expect(map.isPositionWalkable(screen, 8, 100)).toBe(true);
    });

    it('returns false for pixel on blocked tile', () => {
      expect(map.isPositionWalkable(screen, 130, 10)).toBe(false);
    });

    it('returns true for off-screen positions', () => {
      expect(map.isPositionWalkable(screen, -1, 50)).toBe(true);
      expect(map.isPositionWalkable(screen, SCREEN_WIDTH, 50)).toBe(true);
      expect(map.isPositionWalkable(screen, 50, -1)).toBe(true);
      expect(map.isPositionWalkable(screen, 50, PLAY_AREA_HEIGHT)).toBe(true);
    });

    it('maps pixel coords to correct tile', () => {
      expect(map.isPositionWalkable(screen, 0, 0)).toBe(true);
      expect(map.isPositionWalkable(screen, TILE_SIZE - 1, 0)).toBe(true);
      expect(map.isPositionWalkable(screen, 8 * TILE_SIZE, 0)).toBe(false);
    });
  });

  describe('isRectWalkable', () => {
    const map = new TileCollisionMap(TEST_METATILES);

    it('returns true when all corners on walkable tiles', () => {
      const screen = make2x2Screen(0, 0, 0, 0);
      expect(map.isRectWalkable(screen, 10, 10, 8, 8)).toBe(true);
    });

    it('returns false when any corner is on a blocked tile', () => {
      const screen = make2x2Screen(0, 2, 0, 0);
      // Rect straddles the boundary at col 8 (pixel 128): right edge at 128+4-1=131 → blocked
      expect(map.isRectWalkable(screen, 8 * TILE_SIZE - 4, 10, 8, 8)).toBe(false);
    });

    it('handles rect exactly aligned to tile boundary', () => {
      const screen = make2x2Screen(0, 2, 0, 0);
      expect(map.isRectWalkable(screen, 0, 0, TILE_SIZE, TILE_SIZE)).toBe(true);
      expect(map.isRectWalkable(screen, 8 * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE)).toBe(false);
    });

    it('w-1/h-1 prevents bleeding into next tile at alignment', () => {
      const screen = make2x2Screen(0, 2, 0, 0);
      expect(map.isRectWalkable(screen, 0, 0, 8 * TILE_SIZE, 8)).toBe(true);
    });
  });

  describe('water tile detection', () => {
    const waterValues = [36, 0x8D, 0x90, 0x98, 200];
    const map = new TileCollisionMap(waterValues);

    it('isWaterTileAt returns true for water tiles', () => {
      const screen = makeScreen([
        [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ...Array.from({ length: 10 }, () => Array.from({ length: 16 }, () => 0)),
      ]);
      expect(map.isWaterTileAt(screen, 0, 0)).toBe(true);
      expect(map.isWaterTileAt(screen, 16, 0)).toBe(true);
      expect(map.isWaterTileAt(screen, 32, 0)).toBe(true);
    });

    it('isWaterTileAt returns false for non-water tiles', () => {
      const screen = makeScreen([
        [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ...Array.from({ length: 10 }, () => Array.from({ length: 16 }, () => 0)),
      ]);
      expect(map.isWaterTileAt(screen, 0, 0)).toBe(false);
      expect(map.isWaterTileAt(screen, 16, 0)).toBe(false);
    });

    it('getTileValueAtPosition returns raw primary value', () => {
      const screen = makeScreen([
        [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ...Array.from({ length: 10 }, () => Array.from({ length: 16 }, () => 0)),
      ]);
      expect(map.getTileValueAtPosition(screen, 0, 0)).toBe(0x8D);
      expect(map.getTileValueAtPosition(screen, 16, 0)).toBe(0x98);
    });

    it('getTileValueAtPosition returns undefined for off-screen', () => {
      const screen = makeScreen(Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0)));
      expect(map.getTileValueAtPosition(screen, -1, 0)).toBeUndefined();
      expect(map.getTileValueAtPosition(screen, 0, 200)).toBeUndefined();
    });
  });

  describe('walkable overrides', () => {
    it('setWalkableOverride makes a position walkable', () => {
      const map = new TileCollisionMap(TEST_METATILES);
      const screen = make2x2Screen(2, 2, 2, 2);
      expect(map.isPositionWalkable(screen, 8, 8)).toBe(false);
      map.setWalkableOverride(0, 0);
      expect(map.isPositionWalkable(screen, 8, 8)).toBe(true);
      map.clearWalkableOverrides();
    });

    it('clearWalkableOverrides removes all overrides', () => {
      const map = new TileCollisionMap(TEST_METATILES);
      const screen = make2x2Screen(2, 2, 2, 2);
      map.setWalkableOverride(0, 0);
      map.clearWalkableOverrides();
      expect(map.isPositionWalkable(screen, 8, 8)).toBe(false);
    });
  });
});

describe('createCollisionMap', () => {
  it('creates map from real overworld data', async () => {
    const resp = await import('../../src/data/overworld.json');
    const data = resp.default as unknown as OverworldData;
    const map = createCollisionMap(data);

    expect(map.isTileWalkable(0)).toBe(true);
    expect(map.isTileWalkable(14)).toBe(true);
    expect(map.isTileWalkable(27)).toBe(false);
    expect(map.isTileWalkable(26)).toBe(false);
  });

  it('correctly maps start screen (7,7) tiles', async () => {
    const resp = await import('../../src/data/overworld.json');
    const data = resp.default as unknown as OverworldData;
    const map = createCollisionMap(data);
    const screen = data.screens.find((s) => s.row === 7 && s.col === 7);
    expect(screen).toBeDefined();
    if (!screen) return;

    expect(map.isPositionWalkable(screen, 120, 80)).toBe(true);
    expect(map.isPositionWalkable(screen, 0, 0)).toBe(false);
  });
});
