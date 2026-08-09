import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const Z01_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_01.asm');
const Z04_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_04.asm');
const Z07_ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_07.asm');
const OUTPUT_PATH = resolve(__dirname, '../src/data/items.json');

const INES_HEADER = 16;

const LEVEL_BLOCK_OW_OFFSET = 99328 + INES_HEADER;
const LEVEL_BLOCK_OW_LENGTH = 768;
const ATTRS_E_OFFSET = 512;

const CAVE_COUNT = 20;
const ITEMS_PER_CAVE = 3;

const ITEM_NAMES: Record<string, string> = {
  '0': 'Bomb',
  '1': 'WoodSword',
  '2': 'WhiteSword',
  '3': 'MagicSword',
  '4': 'Bait',
  '5': 'Flute',
  '6': 'BlueCandle',
  '7': 'RedCandle',
  '8': 'WoodArrow',
  '9': 'SilverArrow',
  '10': 'Bow',
  '11': 'MagicKey',
  '12': 'Raft',
  '13': 'Ladder',
  '14': 'TriforceOfPower',
  '15': 'FiveRupees',
  '16': 'Wand',
  '17': 'Book',
  '18': 'BlueRing',
  '19': 'RedRing',
  '20': 'PowerBracelet',
  '21': 'Letter',
  '22': 'Compass',
  '23': 'Map',
  '24': 'OneRupee',
  '25': 'Key',
  '26': 'HeartContainer',
  '27': 'TriforcePiece',
  '28': 'MagicShield',
  '29': 'WoodBoomerang',
  '30': 'MagicBoomerang',
  '31': 'BluePotionOrHeart',
  '32': 'RedPotionOrHeart',
  '33': 'Clock',
  '34': 'Heart',
  '35': 'Fairy',
};

// --- ROM reading ---

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

// --- ASM parsing ---

function parseByteSection(asmText: string, label: string): number[] {
  const lines = asmText.split('\n');
  const bytes: number[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === `${label}:` || trimmed.startsWith(`${label}:`)) {
      capturing = true;
      continue;
    }

    if (capturing) {
      if (trimmed.startsWith('.BYTE')) {
        const dataStr = trimmed.slice(5).split(';')[0]!;
        const values = dataStr.split(',').map(v => {
          const s = v.trim();
          if (s.startsWith('$')) return parseInt(s.slice(1), 16);
          return parseInt(s, 10);
        });
        bytes.push(...values);
      } else if (trimmed === '' || trimmed.startsWith(';')) {
        continue;
      } else {
        break;
      }
    }
  }

  return bytes;
}

// --- Drop tables (Z_04.asm) ---

interface DropTablesData {
  noDropMonsterTypes: number[];
  dropItemMonsterTypes: number[][];
  dropItemSetBaseOffsets: number[];
  dropItemRates: number[];
  dropItemTable: number[][];
}

function extractDropTables(z04Asm: string): DropTablesData {
  const noDropMonsterTypes = parseByteSection(z04Asm, 'NoDropMonsterTypes');
  if (noDropMonsterTypes.length !== 7) {
    throw new Error(`NoDropMonsterTypes: expected 7 bytes, got ${noDropMonsterTypes.length}`);
  }

  const group0 = parseByteSection(z04Asm, 'DropItemMonsterTypes0');
  if (group0.length !== 6) {
    throw new Error(`DropItemMonsterTypes0: expected 6 bytes, got ${group0.length}`);
  }

  const group1 = parseByteSection(z04Asm, 'DropItemMonsterTypes1');
  if (group1.length !== 9) {
    throw new Error(`DropItemMonsterTypes1: expected 9 bytes, got ${group1.length}`);
  }

  const group2 = parseByteSection(z04Asm, 'DropItemMonsterTypes2');
  if (group2.length !== 9) {
    throw new Error(`DropItemMonsterTypes2: expected 9 bytes, got ${group2.length}`);
  }

  const dropItemSetBaseOffsets = parseByteSection(z04Asm, 'DropItemSetBaseOffsets');
  if (dropItemSetBaseOffsets.length !== 4) {
    throw new Error(`DropItemSetBaseOffsets: expected 4 bytes, got ${dropItemSetBaseOffsets.length}`);
  }

  const dropItemRates = parseByteSection(z04Asm, 'DropItemRates');
  if (dropItemRates.length !== 4) {
    throw new Error(`DropItemRates: expected 4 bytes, got ${dropItemRates.length}`);
  }

  const dropItemTableFlat = parseByteSection(z04Asm, 'DropItemTable');
  if (dropItemTableFlat.length !== 40) {
    throw new Error(`DropItemTable: expected 40 bytes, got ${dropItemTableFlat.length}`);
  }

  const dropItemTable: number[][] = [];
  for (let row = 0; row < 4; row++) {
    dropItemTable.push(dropItemTableFlat.slice(row * 10, (row + 1) * 10));
  }

  return {
    noDropMonsterTypes,
    dropItemMonsterTypes: [group0, group1, group2],
    dropItemSetBaseOffsets,
    dropItemRates,
    dropItemTable,
  };
}

// --- Item ID mappings (Z_01.asm) ---

function extractItemIdToSlot(z01Asm: string): number[] {
  const bytes = parseByteSection(z01Asm, 'ItemIdToSlot');
  if (bytes.length !== 36) {
    throw new Error(`ItemIdToSlot: expected 36 bytes, got ${bytes.length}`);
  }
  return bytes;
}

function extractItemIdToDescriptor(z01Asm: string): number[] {
  const bytes = parseByteSection(z01Asm, 'ItemIdToDescriptor');
  if (bytes.length !== 36) {
    throw new Error(`ItemIdToDescriptor: expected 36 bytes, got ${bytes.length}`);
  }
  return bytes;
}

// --- Cave/shop data (ROM binary + Z_01.asm) ---

interface CaveContentData {
  caveIndex: number;
  objectType: number;
  items: number[];
  itemFlags: number[];
  prices: number[];
}

interface CaveTypeInfoData {
  textSelector: number;
  payFlag: boolean;
  pickUpFlag: boolean;
}

function extractCaveContents(rom: Buffer): CaveContentData[] {
  const blockBase = LEVEL_BLOCK_OW_OFFSET;
  const attrsE = new Uint8Array(rom.subarray(
    blockBase + ATTRS_E_OFFSET,
    blockBase + ATTRS_E_OFFSET + 128,
  ));

  const caves: CaveContentData[] = [];
  for (let ci = 0; ci < CAVE_COUNT; ci++) {
    const items: number[] = [];
    const itemFlags: number[] = [];
    const prices: number[] = [];

    for (let j = 0; j < ITEMS_PER_CAVE; j++) {
      const itemByte = attrsE[ci * ITEMS_PER_CAVE + j]!;
      items.push(itemByte & 0x3F);
      itemFlags.push((itemByte >> 6) & 0x03);
    }

    for (let j = 0; j < ITEMS_PER_CAVE; j++) {
      prices.push(attrsE[60 + ci * ITEMS_PER_CAVE + j]!);
    }

    caves.push({
      caveIndex: ci,
      objectType: 0x6A + ci,
      items,
      itemFlags,
      prices,
    });
  }

  return caves;
}

function extractCaveTypes(z01Asm: string): CaveTypeInfoData[] {
  const bytes = parseByteSection(z01Asm, 'OverworldPersonTextSelectors');
  if (bytes.length !== 20) {
    throw new Error(`OverworldPersonTextSelectors: expected 20 bytes, got ${bytes.length}`);
  }

  return bytes.map(b => ({
    textSelector: b & 0x3F,
    payFlag: (b & 0x80) !== 0,
    pickUpFlag: (b & 0x40) !== 0,
  }));
}

// --- Secret Armos (Z_04.asm) ---

interface SecretArmosData {
  roomId: number;
  x: number;
  y: number;
}

function extractSecretArmos(z04Asm: string): SecretArmosData[] {
  const roomIds = parseByteSection(z04Asm, 'SecretArmosRoomIds');
  if (roomIds.length !== 7) {
    throw new Error(`SecretArmosRoomIds: expected 7 bytes, got ${roomIds.length}`);
  }

  const xs = parseByteSection(z04Asm, 'SecretArmosXs');
  if (xs.length !== 7) {
    throw new Error(`SecretArmosXs: expected 7 bytes, got ${xs.length}`);
  }

  return roomIds.map((roomId, i) => ({
    roomId,
    x: xs[i]!,
    y: 0x80,
  }));
}

// --- Flute secrets (Z_07.asm) ---

function extractFluteSecrets(z07Asm: string): number[] {
  const bytes = parseByteSection(z07Asm, 'FluteRoomSecretsOW');
  if (bytes.length !== 11) {
    throw new Error(`FluteRoomSecretsOW: expected 11 bytes, got ${bytes.length}`);
  }
  return bytes;
}

// --- Object HP table (Z_07.asm) ---

function extractObjectHpPairs(z07Asm: string): number[] {
  const bytes = parseByteSection(z07Asm, 'ObjectTypeToHpPairs');
  if (bytes.length !== 38) {
    throw new Error(`ObjectTypeToHpPairs: expected 38 bytes, got ${bytes.length}`);
  }
  return bytes;
}

// --- Money game (Z_01.asm) ---

function extractMoneyGame(z01Asm: string): { lossAmounts: number[]; permutations: number[] } {
  const lossAmounts = parseByteSection(z01Asm, 'MoneyGameLossAmounts');
  if (lossAmounts.length !== 2) {
    throw new Error(`MoneyGameLossAmounts: expected 2 bytes, got ${lossAmounts.length}`);
  }

  const permutations = parseByteSection(z01Asm, 'MoneyGamePermutations');
  if (permutations.length !== 18) {
    throw new Error(`MoneyGamePermutations: expected 18 bytes, got ${permutations.length}`);
  }

  return { lossAmounts, permutations };
}

// --- Main ---

console.log('Reading ROM...');
const rom = readRom();

console.log('Parsing assembly sources...');
const z01Asm = readFileSync(Z01_ASM_PATH, 'utf-8');
const z04Asm = readFileSync(Z04_ASM_PATH, 'utf-8');
const z07Asm = readFileSync(Z07_ASM_PATH, 'utf-8');

console.log('Extracting drop tables...');
const dropTables = extractDropTables(z04Asm);
console.log(`  noDropMonsterTypes: ${dropTables.noDropMonsterTypes.length} types`);
console.log(`  dropItemMonsterTypes: ${dropTables.dropItemMonsterTypes.map(g => g.length).join(', ')} groups`);
console.log(`  dropItemTable: ${dropTables.dropItemTable.length} rows x ${dropTables.dropItemTable[0]!.length} cols`);

console.log('Extracting item ID mappings...');
const itemIdToSlot = extractItemIdToSlot(z01Asm);
const itemIdToDescriptor = extractItemIdToDescriptor(z01Asm);
console.log(`  itemIdToSlot: ${itemIdToSlot.length} entries`);
console.log(`  itemIdToDescriptor: ${itemIdToDescriptor.length} entries`);

console.log('Extracting cave contents from ROM...');
const caveContents = extractCaveContents(rom);
console.log(`  ${caveContents.length} caves extracted`);

console.log('Extracting cave types...');
const caveTypes = extractCaveTypes(z01Asm);
console.log(`  ${caveTypes.length} cave types`);

console.log('Extracting secret Armos locations...');
const secretArmos = extractSecretArmos(z04Asm);
console.log(`  ${secretArmos.length} secret Armos entries`);

console.log('Extracting flute secret rooms...');
const fluteSecretRoomIds = extractFluteSecrets(z07Asm);
console.log(`  ${fluteSecretRoomIds.length} flute secret rooms`);

console.log('Extracting object HP table...');
const objectHpPairs = extractObjectHpPairs(z07Asm);
console.log(`  ${objectHpPairs.length} packed HP pairs`);

console.log('Extracting money game data...');
const moneyGame = extractMoneyGame(z01Asm);
console.log(`  lossAmounts: ${moneyGame.lossAmounts.length}, permutations: ${moneyGame.permutations.length}`);

const output = {
  itemNames: ITEM_NAMES,
  itemIdToSlot,
  itemIdToDescriptor,
  dropTables,
  caveContents,
  caveTypes,
  overworldHeartContainer: {
    screenId: 0x5F,
    x: 0xC0,
    y: 0x90,
    itemId: 0x1A,
  },
  secretArmos,
  fluteSecretRoomIds,
  objectHpPairs,
  moneyGame,
};

console.log(`Writing ${OUTPUT_PATH}...`);
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log('Done.');
