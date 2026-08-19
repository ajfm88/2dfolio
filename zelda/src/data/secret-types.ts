export interface ShortcutPosition {
  readonly x: number;
  readonly y: number;
}

export interface SecretsData {
  readonly questSecretByScreen: readonly number[];
  readonly shortcutPositionIndexByScreen: readonly number[];
  readonly shortcutPositions: readonly ShortcutPosition[];
}

// Tile object types from TileObjectTypes (Z_05.asm:5743)
export const TILE_OBJ_ROCK = 0x62;
export const TILE_OBJ_ROCK_WALL = 0x63;
export const TILE_OBJ_TREE = 0x64;
export const TILE_OBJ_GRAVESTONE = 0x65;
export const TILE_OBJ_ARMOS1 = 0x66;
export const TILE_OBJ_ARMOS2 = 0x67;

// Square indices in PrimarySquaresOW that map to tile object types
export const TILE_OBJ_SQUARE_INDICES: Readonly<Record<number, number>> = {
  38: TILE_OBJ_ROCK,
  39: TILE_OBJ_ROCK_WALL,
  40: TILE_OBJ_TREE,
  41: TILE_OBJ_GRAVESTONE,
  42: TILE_OBJ_ARMOS1,
  43: TILE_OBJ_ARMOS2,
};

// Square indices used for revealed secrets
export const SQUARE_INDEX_CAVE_ENTRANCE = 12;
export const SQUARE_INDEX_STAIRS = 18;
