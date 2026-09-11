/** Which of the six 128-byte overworld attribute planes a patch writes. */
export type AttrTable = 'A' | 'B' | 'C' | 'D' | 'F';

/** One byte write performed by Z_06.asm:239 @PatchQ2Rooms. */
export interface Q2AttrPatch {
  readonly table: AttrTable;
  readonly screen: number;
  readonly value: number;
}

/**
 * Decoded per-screen deltas, derived from the patches above. Only the fields a
 * screen's patches actually change are present.
 */
export interface Q2ScreenOverride {
  readonly screen: number;
  /** (AttrsB & $FC) >> 2. 1-9 is a dungeon entrance, >= 16 a cave (Z_05.asm:7369). */
  readonly caveIndex?: number;
  /** True when caveIndex is 1-9, i.e. this screen becomes a dungeon entrance. */
  readonly isDungeon?: boolean;
  /** AttrsD bits 0-5 — selects the screen's tile layout. */
  readonly uniqueRoomId?: number;
  /** AttrsD bit 6. */
  readonly pushBlock?: boolean;
  /** AttrsA bits 0-1. */
  readonly outerPalette?: number;
  /** AttrsF bits 6-7 — 0 both quests, 1 Quest 1 only, 2 Quest 2 only. */
  readonly questSecret?: number;
  /** AttrsF bits 4-5 — index into LevelInfo_ShortcutOrItemPosArray. */
  readonly shortcutPositionIndex?: number;
  /** AttrsF bits 0-2. */
  readonly secretTrigger?: number;
  /** AttrsC bits 0-5 — only screen 11, via the $8B overrun. */
  readonly monsterListId?: number;
}

export interface Q2OverworldData {
  readonly patches: readonly Q2AttrPatch[];
  readonly screenOverrides: readonly Q2ScreenOverride[];
}
