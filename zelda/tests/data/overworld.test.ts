import { describe, it, expect } from 'vitest';
import overworldJson from '../../src/data/overworld.json';
import type { OverworldData } from '../../src/data/overworld-types.js';

const data = overworldJson as OverworldData;

describe('Overworld data — structure', () => {
  it('has exactly 128 screens', () => {
    expect(data.screens).toHaveLength(128);
  });

  it('screens have sequential IDs 0-127', () => {
    data.screens.forEach((screen, i) => {
      expect(screen.id).toBe(i);
    });
  });

  it('row and col derive from ID', () => {
    for (const screen of data.screens) {
      expect(screen.row).toBe(Math.floor(screen.id / 16));
      expect(screen.col).toBe(screen.id % 16);
    }
  });

  it('uniqueRoomId is 0-63', () => {
    for (const screen of data.screens) {
      expect(screen.uniqueRoomId).toBeGreaterThanOrEqual(0);
      expect(screen.uniqueRoomId).toBeLessThanOrEqual(63);
    }
  });
});

describe('Overworld data — tile grids', () => {
  it('every screen has 11 rows of 16 columns', () => {
    for (const screen of data.screens) {
      expect(screen.tiles).toHaveLength(11);
      for (const row of screen.tiles) {
        expect(row).toHaveLength(16);
      }
    }
  });

  it('all square indices are in range 0-71', () => {
    for (const screen of data.screens) {
      for (const row of screen.tiles) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(71);
        }
      }
    }
  });
});

describe('Overworld data — square table', () => {
  it('primary has 56 entries', () => {
    expect(data.squareTable.primary).toHaveLength(56);
  });

  it('primary values are valid CHR tile IDs (0-255)', () => {
    for (const val of data.squareTable.primary) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it('secondary has 16 entries of 4 CHR tile IDs each', () => {
    expect(data.squareTable.secondary).toHaveLength(16);
    for (const entry of data.squareTable.secondary) {
      expect(entry).toHaveLength(4);
      for (const val of entry) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('Overworld data — room IDs', () => {
  it('has 64 unique room IDs', () => {
    const ids = new Set(data.screens.map(s => s.uniqueRoomId));
    expect(ids.size).toBe(64);
  });

  it('every uniqueRoomId has at least one screen', () => {
    const ids = new Set(data.screens.map(s => s.uniqueRoomId));
    for (let i = 0; i < 64; i++) {
      expect(ids.has(i)).toBe(true);
    }
  });
});

describe('Overworld data — spot checks', () => {
  it('screen 119 is the starting area (row 7, col 7)', () => {
    const s = data.screens[119]!;
    expect(s.row).toBe(7);
    expect(s.col).toBe(7);
    expect(s.uniqueRoomId).toBe(50);
  });

  it('screen 119 top row is mostly mountains (27) with cave opening (14)', () => {
    const topRow = data.screens[119]!.tiles[0]!;
    const mountainCount = topRow.filter(v => v === 27).length;
    expect(mountainCount).toBeGreaterThanOrEqual(12);
    expect(topRow).toContain(14);
  });
});
