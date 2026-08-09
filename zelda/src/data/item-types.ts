export const ITEM_NAMES: Readonly<Record<number, string>> = {
  0x00: 'Bomb',
  0x01: 'WoodSword',
  0x02: 'WhiteSword',
  0x03: 'MagicSword',
  0x04: 'Bait',
  0x05: 'Flute',
  0x06: 'BlueCandle',
  0x07: 'RedCandle',
  0x08: 'WoodArrow',
  0x09: 'SilverArrow',
  0x0A: 'Bow',
  0x0B: 'MagicKey',
  0x0C: 'Raft',
  0x0D: 'Ladder',
  0x0E: 'TriforceOfPower',
  0x0F: 'FiveRupees',
  0x10: 'Wand',
  0x11: 'Book',
  0x12: 'BlueRing',
  0x13: 'RedRing',
  0x14: 'PowerBracelet',
  0x15: 'Letter',
  0x16: 'Compass',
  0x17: 'Map',
  0x18: 'OneRupee',
  0x19: 'Key',
  0x1A: 'HeartContainer',
  0x1B: 'TriforcePiece',
  0x1C: 'MagicShield',
  0x1D: 'WoodBoomerang',
  0x1E: 'MagicBoomerang',
  0x1F: 'BluePotionOrHeart',
  0x20: 'RedPotionOrHeart',
  0x21: 'Clock',
  0x22: 'Heart',
  0x23: 'Fairy',
} as const;

export const CAVE_TYPE_NAMES: Readonly<Record<number, string>> = {
  0x6A: 'Shop1',
  0x6B: 'Shop2',
  0x6C: 'WhiteSwordCave',
  0x6D: 'Shop3',
  0x6E: 'HintCaveOldMan1',
  0x6F: 'HintCaveOldMan2',
  0x70: 'HintCaveOldWoman1',
  0x71: 'DoorRepairCharge',
  0x72: 'MoneyMakingGame',
  0x73: 'Shop4',
  0x74: 'PotionShop',
  0x75: 'HintCaveOldMan3',
  0x76: 'HintCaveOldMan4',
  0x77: 'HintCaveOldMan5',
  0x78: 'HintCaveOldMan6',
  0x79: 'HintCaveOldWoman2',
  0x7A: 'HintCaveOldWoman3',
  0x7B: 'MoblinGivesRupees',
  0x7C: 'MoblinGivesRupees2',
  0x7D: 'MoblinGivesRupees3',
} as const;

export interface DropTables {
  readonly noDropMonsterTypes: readonly number[];
  readonly dropItemMonsterTypes: readonly (readonly number[])[];
  readonly dropItemSetBaseOffsets: readonly number[];
  readonly dropItemRates: readonly number[];
  readonly dropItemTable: readonly (readonly number[])[];
}

export interface CaveContent {
  readonly caveIndex: number;
  readonly objectType: number;
  readonly items: readonly number[];
  readonly itemFlags: readonly number[];
  readonly prices: readonly number[];
}

export interface CaveTypeInfo {
  readonly textSelector: number;
  readonly payFlag: boolean;
  readonly pickUpFlag: boolean;
}

export interface SecretArmos {
  readonly roomId: number;
  readonly x: number;
  readonly y: number;
}

export interface HeartContainerOW {
  readonly screenId: number;
  readonly x: number;
  readonly y: number;
  readonly itemId: number;
}

export interface ItemData {
  readonly itemNames: Readonly<Record<string, string>>;
  readonly itemIdToSlot: readonly number[];
  readonly itemIdToDescriptor: readonly number[];
  readonly dropTables: DropTables;
  readonly caveContents: readonly CaveContent[];
  readonly caveTypes: readonly CaveTypeInfo[];
  readonly overworldHeartContainer: HeartContainerOW;
  readonly secretArmos: readonly SecretArmos[];
  readonly fluteSecretRoomIds: readonly number[];
  readonly objectHpPairs: readonly number[];
  readonly moneyGame: {
    readonly lossAmounts: readonly number[];
    readonly permutations: readonly number[];
  };
}
