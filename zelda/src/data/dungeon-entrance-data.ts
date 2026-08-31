// Quest 1 dungeon entrance screens — overworld screens with cave entrance
// tiles (tile 12) that are NOT in SCREEN_CAVE_INDEX, cross-referenced with
// WHIRLWIND_DEST_ROOMS proximity. Each entrance screen is one screen east
// of the corresponding whirlwind destination.

export const DUNGEON_ENTRANCE_SCREENS: Readonly<Record<number, number>> = {
  55: 1,  // screen 55 (row 3, col 7)  — Level 1 Eagle
  60: 2,  // screen 60 (row 3, col 12) — Level 2 Moon
  116: 3, // screen 116 (row 7, col 4) — Level 3 Manji
  69: 4,  // screen 69 (row 4, col 5)  — Level 4 Snake
  11: 5,  // screen 11 (row 0, col 11) — Level 5 Lizard
  34: 6,  // screen 34 (row 2, col 2)  — Level 6 Dragon
  66: 7,  // screen 66 (row 4, col 2)  — Level 7 Demon (flute dries pond → stairs)
  109: 8, // screen 109 (row 6, col 13) — Level 8 Lion (candle burns tree → stairs)
  5: 9,   // screen 5 (row 0, col 5)   — Level 9 Death Mountain (bomb rock → cave)
  // Q2 alternates (needed when Second Quest lands)
  25: 7,  // Q2 Level 7
  108: 8, // Q2 Level 8
  0: 9,   // Q2 Level 9
};

export function getDungeonLevel(screenId: number): number | null {
  return DUNGEON_ENTRANCE_SCREENS[screenId] ?? null;
}
