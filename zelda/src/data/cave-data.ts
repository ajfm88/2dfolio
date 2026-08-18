// Per-screen cave content index, derived from LevelBlockOW.dat AttrsB.
// Formula: caveContentIdx = ((attrsB & 0xFC) - 0x40) / 4
// Only includes screens where (attrsB & 0xFC) >= 0x40 and caveContentIdx < 20.
// Screens with values 1-15 are dungeon entrances (handled by H-series).
export const SCREEN_CAVE_INDEX: Readonly<Record<number, number>> = {
  1: 7, 2: 10, 3: 7, 4: 10, 6: 1, 7: 7, 9: 3, 10: 2,
  12: 14, 13: 10, 14: 8, 15: 18, 16: 6, 17: 8, 18: 15, 19: 17,
  20: 7, 21: 14, 22: 6, 24: 10, 26: 11, 28: 5, 29: 4, 30: 7,
  31: 6, 32: 1, 33: 3, 35: 4, 37: 13, 38: 15, 39: 10, 40: 17,
  41: 10, 43: 19, 44: 1, 45: 17, 47: 1, 51: 10, 52: 16, 58: 1,
  61: 17, 68: 13, 70: 15, 71: 1, 72: 17, 73: 4, 74: 13, 75: 10,
  77: 15, 78: 19, 81: 19, 83: 18, 86: 19, 88: 17, 91: 19, 94: 14,
  96: 6, 98: 18, 99: 7, 100: 10, 102: 14, 103: 17, 104: 7, 106: 7,
  107: 18, 110: 19, 111: 13, 112: 12, 113: 17, 114: 7, 117: 9, 118: 6,
  119: 0, 120: 10, 121: 4, 123: 1, 124: 6, 125: 7,
};

// Square indices that visually represent cave/stair entrances on the overworld.
// These are non-walkable "dark opening" tiles that Link walks UP into.
export const CAVE_ENTRANCE_TILES = new Set([12]);

export function getScreenCaveIndex(screenId: number): number | null {
  const idx = SCREEN_CAVE_INDEX[screenId];
  return idx !== undefined ? idx : null;
}

export function isCaveEntranceTile(tileIndex: number): boolean {
  return CAVE_ENTRANCE_TILES.has(tileIndex);
}
