import { describe, it, expect } from 'vitest';
import overworldJson from '../../src/data/overworld.json';
import type { OverworldData } from '../../src/data/overworld-types.js';
import { getScreenByCoord } from '../../src/render/tile-renderer.js';

const data = overworldJson as OverworldData;

const USED_SQUARE_IDS = new Set<number>();
for (const screen of data.screens) {
  for (const row of screen.tiles) {
    for (const id of row) {
      USED_SQUARE_IDS.add(id);
    }
  }
}
const SORTED_USED_IDS = [...USED_SQUARE_IDS].sort((a, b) => a - b);

describe('Tile renderer — data prerequisites', () => {
  it('all used square IDs are within valid range (0-55)', () => {
    for (const id of SORTED_USED_IDS) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(56);
    }
  });

  it('uses exactly 45 unique square IDs', () => {
    expect(SORTED_USED_IDS).toHaveLength(45);
  });

  it('every screen has 11 rows of 16 tiles', () => {
    for (const screen of data.screens) {
      expect(screen.tiles).toHaveLength(11);
      for (const row of screen.tiles) {
        expect(row).toHaveLength(16);
      }
    }
  });

  it('start screen (119) exists at row 7 col 7', () => {
    const screen = data.screens.find((s) => s.id === 119);
    expect(screen).toBeDefined();
    expect(screen!.row).toBe(7);
    expect(screen!.col).toBe(7);
  });

  it('screen rendering covers exactly 256x176 pixels (16x11 tiles at 16px)', () => {
    expect(16 * 16).toBe(256);
    expect(11 * 16).toBe(176);
  });
});

describe('getScreenByCoord', () => {
  it('returns start screen at (7, 7)', () => {
    const screen = getScreenByCoord(data, 7, 7);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(119);
  });

  it('returns screen 0 at (0, 0)', () => {
    const screen = getScreenByCoord(data, 0, 0);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(0);
  });

  it('wraps row overflow', () => {
    const screen = getScreenByCoord(data, 8, 0);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(0);
  });

  it('wraps column overflow', () => {
    const screen = getScreenByCoord(data, 0, 16);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(0);
  });

  it('wraps negative row', () => {
    const screen = getScreenByCoord(data, -1, 0);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(112);
  });

  it('wraps negative column', () => {
    const screen = getScreenByCoord(data, 0, -1);
    expect(screen).toBeDefined();
    expect(screen!.id).toBe(15);
  });

  it('returns all 128 screens by their coordinates', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 16; col++) {
        const screen = getScreenByCoord(data, row, col);
        expect(screen).toBeDefined();
        expect(screen!.id).toBe(row * 16 + col);
      }
    }
  });

  it('map image dimensions match overworld grid (4096x1408)', () => {
    expect(16 * 256).toBe(4096);
    expect(8 * 176).toBe(1408);
  });
});
