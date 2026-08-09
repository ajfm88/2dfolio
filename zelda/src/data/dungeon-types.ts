export interface DungeonRoomDoors {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

export interface DungeonRoom {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly uniqueRoomId: number;
  readonly doors: DungeonRoomDoors;
  readonly outerPalette: number;
  readonly innerPalette: number;
  readonly monsterListId: number;
  readonly monsterCountIndex: number;
  readonly itemId: number;
  readonly hasPushBlock: boolean;
  readonly isDark: boolean;
  readonly soundEffect: number;
  readonly secretTrigger: number;
  readonly itemPositionIndex: number;
}

export interface DungeonLevelBlock {
  readonly rooms: readonly DungeonRoom[];
}

export interface DungeonInfo {
  readonly level: number;
  readonly startRoomId: number;
  readonly triforceRoomId: number;
  readonly bossRoomId: number;
  readonly cellarRoomIds: readonly number[];
  readonly foeCounts: readonly number[];
  readonly shortcutOrItemPositions: readonly number[];
  readonly startY: number;
  readonly levelBlock: string;
}

export interface UniqueRoom {
  readonly id: number;
  readonly tiles: readonly (readonly number[])[];
}

export interface DungeonData {
  readonly levelBlocks: {
    readonly uw1q1: DungeonLevelBlock;
    readonly uw2q1: DungeonLevelBlock;
    readonly uw1q2: DungeonLevelBlock;
    readonly uw2q2: DungeonLevelBlock;
  };
  readonly dungeons: readonly DungeonInfo[];
  readonly uniqueRooms: readonly UniqueRoom[];
  readonly cellarRooms: readonly UniqueRoom[];
  readonly squareTable: readonly number[];
}
