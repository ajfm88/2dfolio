import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_05.asm');
const OUTPUT_PATH = resolve(__dirname, '../src/data/dungeons.json');

const INES_HEADER = 16;

// LevelBlock offsets (from bins.xml)
const LEVEL_BLOCK_OFFSETS: Record<string, number> = {
  uw1q1: 100096 + INES_HEADER,
  uw2q1: 100864 + INES_HEADER,
  uw1q2: 101632 + INES_HEADER,
  uw2q2: 102400 + INES_HEADER,
};
const LEVEL_BLOCK_LENGTH = 768;
const ROOMS_PER_BLOCK = 128;

// LevelInfo offsets (from bins.xml)
const LEVEL_INFO_BASE = 103420 + INES_HEADER;
const LEVEL_INFO_LENGTH = 252;

// RoomLayoutsUW offset (from bins.xml)
const ROOM_LAYOUTS_UW_OFFSET = 90334 + INES_HEADER;
const ROOM_LAYOUTS_UW_LENGTH = 504;

const COLS_PER_ROOM = 12;
const ROWS_PER_ROOM = 7;
const UNIQUE_ROOMS = 42;

// Dungeon-to-level-block mapping (from Z_06.asm LevelBlockAddrsQ1/Q2)
const DUNGEON_LEVEL_BLOCK_Q1: Record<number, string> = {
  1: 'uw1q1', 2: 'uw1q1', 3: 'uw1q1', 4: 'uw1q1', 5: 'uw1q1', 6: 'uw1q1',
  7: 'uw2q1', 8: 'uw2q1', 9: 'uw2q1',
};

// LevelInfo field offsets (base $6B7E)
const LI_FOE_COUNTS = 36;
const LI_START_Y = 40;
const LI_SHORTCUT_OR_ITEM_POS = 41;
const LI_SHORTCUT_OR_ITEM_POS_LEN = 4;
const LI_START_ROOM_ID = 47;
const LI_TRIFORCE_ROOM_ID = 48;
const LI_LEVEL_NUMBER = 51;
const LI_CELLAR_ROOM_IDS = 52;
const LI_CELLAR_ROOM_IDS_LEN = 10;
const LI_BOSS_ROOM_ID = 62;

// --- ROM reading ---

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

// --- LevelBlock parsing ---

interface RoomData {
  id: number;
  row: number;
  col: number;
  uniqueRoomId: number;
  doors: { north: number; south: number; east: number; west: number };
  outerPalette: number;
  innerPalette: number;
  monsterListId: number;
  monsterCountIndex: number;
  itemId: number;
  hasPushBlock: boolean;
  isDark: boolean;
  soundEffect: number;
  secretTrigger: number;
  itemPositionIndex: number;
}

interface LevelBlockResult {
  rooms: RoomData[];
  rawAttrs: Uint8Array;
}

function extractLevelBlock(rom: Buffer, offset: number): LevelBlockResult {
  const block = new Uint8Array(rom.subarray(offset, offset + LEVEL_BLOCK_LENGTH));
  const rooms: RoomData[] = [];

  for (let r = 0; r < ROOMS_PER_BLOCK; r++) {
    const attrsA = block[r]!;
    const attrsB = block[r + 128]!;
    const attrsC = block[r + 256]!;
    const attrsD = block[r + 384]!;
    const attrsE = block[r + 512]!;
    const attrsF = block[r + 640]!;

    rooms.push({
      id: r,
      row: Math.floor(r / 16),
      col: r % 16,
      uniqueRoomId: attrsD & 0x3F,
      doors: {
        north: (attrsA >> 5) & 0x07,
        south: (attrsA >> 2) & 0x07,
        east: (attrsB >> 2) & 0x07,
        west: (attrsB >> 5) & 0x07,
      },
      outerPalette: attrsA & 0x03,
      innerPalette: attrsB & 0x03,
      monsterListId: (attrsC & 0x3F) | ((attrsD & 0x80) >> 1),
      monsterCountIndex: (attrsC >> 6) & 0x03,
      itemId: attrsE & 0x1F,
      hasPushBlock: (attrsD & 0x40) !== 0,
      isDark: (attrsE & 0x80) !== 0,
      soundEffect: (attrsE >> 5) & 0x03,
      secretTrigger: attrsF & 0x07,
      itemPositionIndex: (attrsF >> 4) & 0x03,
    });
  }

  return { rooms, rawAttrs: block };
}

function getRawAttr(rawAttrs: Uint8Array, roomId: number, attrIndex: number): number {
  return rawAttrs[roomId + attrIndex * 128]!;
}

interface CellarConnectionData {
  cellarRoomId: number;
  leftDest: number;
  rightDest: number;
  exitPos: number;
  layoutIndex: number;
}

function computeCellarConnections(
  cellarRoomIds: number[],
  rawAttrs: Uint8Array,
): CellarConnectionData[] {
  const connections: CellarConnectionData[] = [];
  for (const cellarRoomId of cellarRoomIds) {
    if (cellarRoomId === 255) continue;
    const attrsA = getRawAttr(rawAttrs, cellarRoomId, 0);
    const attrsB = getRawAttr(rawAttrs, cellarRoomId, 1);
    const attrsC = getRawAttr(rawAttrs, cellarRoomId, 2);
    const attrsD = getRawAttr(rawAttrs, cellarRoomId, 3);
    const uniqueRoomId = attrsD & 0x3F;
    connections.push({
      cellarRoomId,
      leftDest: attrsA,
      rightDest: attrsB,
      exitPos: attrsC,
      layoutIndex: uniqueRoomId - 62,
    });
  }
  return connections;
}

// --- LevelInfo parsing ---

interface DungeonInfoData {
  level: number;
  startRoomId: number;
  triforceRoomId: number;
  bossRoomId: number;
  cellarRoomIds: number[];
  cellarConnections: CellarConnectionData[];
  foeCounts: number[];
  shortcutOrItemPositions: number[];
  startY: number;
  levelBlock: string;
}

function extractLevelInfo(
  rom: Buffer,
  dungeonIndex: number,
  levelBlockRawAttrs: Record<string, Uint8Array>,
): DungeonInfoData {
  const offset = LEVEL_INFO_BASE + dungeonIndex * LEVEL_INFO_LENGTH;
  const info = new Uint8Array(rom.subarray(offset, offset + LEVEL_INFO_LENGTH));

  const foeCounts: number[] = [];
  for (let i = 0; i < 4; i++) {
    foeCounts.push(info[LI_FOE_COUNTS + i]!);
  }

  const shortcutOrItemPositions: number[] = [];
  for (let i = 0; i < LI_SHORTCUT_OR_ITEM_POS_LEN; i++) {
    shortcutOrItemPositions.push(info[LI_SHORTCUT_OR_ITEM_POS + i]!);
  }

  const cellarRoomIds: number[] = [];
  for (let i = 0; i < LI_CELLAR_ROOM_IDS_LEN; i++) {
    cellarRoomIds.push(info[LI_CELLAR_ROOM_IDS + i]!);
  }

  const level = info[LI_LEVEL_NUMBER]!;
  const levelBlock = DUNGEON_LEVEL_BLOCK_Q1[level];
  if (!levelBlock) {
    throw new Error(`Unknown level number: ${level} for dungeon index ${dungeonIndex}`);
  }

  const rawAttrs = levelBlockRawAttrs[levelBlock]!;
  const cellarConnections = computeCellarConnections(cellarRoomIds, rawAttrs);

  return {
    level,
    startRoomId: info[LI_START_ROOM_ID]!,
    triforceRoomId: info[LI_TRIFORCE_ROOM_ID]!,
    bossRoomId: info[LI_BOSS_ROOM_ID]!,
    cellarRoomIds,
    cellarConnections,
    foeCounts,
    shortcutOrItemPositions,
    startY: info[LI_START_Y]!,
    levelBlock,
  };
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

function parseColumnHeapsUW(asmText: string): number[][] {
  const heaps: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const label = `ColumnHeapUW${i}`;
    const bytes = parseByteSection(asmText, label);
    if (bytes.length === 0) {
      throw new Error(`Failed to parse column heap: ${label}`);
    }
    heaps.push(bytes);
  }
  return heaps;
}

function parsePrimarySquaresUW(asmText: string): number[] {
  const bytes = parseByteSection(asmText, 'PrimarySquaresUW');
  if (bytes.length !== 8) {
    throw new Error(`PrimarySquaresUW: expected 8 bytes, got ${bytes.length}`);
  }
  return bytes;
}

function parseCellarLayouts(asmText: string): number[][] {
  const layouts: number[][] = [];
  for (let i = 0; i < 2; i++) {
    const bytes = parseByteSection(asmText, `RoomLayoutUWCellar${i}`);
    if (bytes.length !== 16) {
      throw new Error(`RoomLayoutUWCellar${i}: expected 16 bytes, got ${bytes.length}`);
    }
    layouts.push(bytes);
  }
  return layouts;
}

function parseCellarColumnHeap(asmText: string): number[] {
  const bytes = parseByteSection(asmText, 'ColumnHeapUWCellar');
  if (bytes.length === 0) {
    throw new Error('Failed to parse ColumnHeapUWCellar');
  }
  return bytes;
}

// --- Column decoding (UW) ---
// UW column format differs from OW:
// - Square descriptor: bit 7 = column start, bits 6-4 = repeat count, bits 2-0 = square index
// - 7 rows per column (not 11)
// - Repeat count in bits 6-4 means "repeat this many additional times"

function buildContiguousHeap(heaps: number[][]): { data: number[]; offsets: number[] } {
  const data: number[] = [];
  const offsets: number[] = [];
  for (const heap of heaps) {
    offsets.push(data.length);
    data.push(...heap);
  }
  return { data, offsets };
}

function decodeColumnUW(
  heapData: number[],
  heapStartOffset: number,
  columnIndex: number,
): number[] {
  let pos = heapStartOffset;
  let remaining = columnIndex;

  // Navigate to the correct column by counting high-bit markers
  while (pos < heapData.length) {
    const byte = heapData[pos]!;
    if (byte & 0x80) {
      if (remaining === 0) break;
      remaining--;
    }
    pos++;
  }

  if (pos >= heapData.length) {
    throw new Error(`Column index ${columnIndex} not found in heap at offset ${heapStartOffset}`);
  }

  // Decode 7 rows of square indices
  // Matches LayoutUWFloor logic in Z_05.asm lines 5377-5408
  const squares: number[] = [];
  let repeatCount = 0;
  let repeatsUsed = 0;

  while (squares.length < ROWS_PER_ROOM) {
    if (pos >= heapData.length) {
      throw new Error(`Ran out of heap data at pos ${pos}, needed ${ROWS_PER_ROOM - squares.length} more rows`);
    }

    const byte = heapData[pos]!;
    const squareIndex = byte & 0x07;
    squares.push(squareIndex);

    repeatCount = (byte >> 4) & 0x07;
    if (repeatsUsed < repeatCount) {
      repeatsUsed++;
    } else {
      repeatsUsed = 0;
      pos++;
    }
  }

  return squares;
}

// --- Room layout decoding ---

interface UniqueRoomData {
  id: number;
  tiles: number[][];
}

function decodeUniqueRooms(
  roomLayouts: Uint8Array,
  heapData: number[],
  heapOffsets: number[],
): UniqueRoomData[] {
  const rooms: UniqueRoomData[] = [];

  for (let roomId = 0; roomId < UNIQUE_ROOMS; roomId++) {
    const layoutBase = roomId * COLS_PER_ROOM;
    const tiles: number[][] = Array.from({ length: ROWS_PER_ROOM }, () =>
      new Array<number>(COLS_PER_ROOM).fill(0),
    );

    for (let c = 0; c < COLS_PER_ROOM; c++) {
      const descriptor = roomLayouts[layoutBase + c]!;
      const tableIndex = (descriptor >> 4) & 0x0F;
      const columnIndex = descriptor & 0x0F;

      if (tableIndex >= heapOffsets.length) {
        throw new Error(`Room ${roomId}, col ${c}: invalid table index ${tableIndex}`);
      }

      const startOffset = heapOffsets[tableIndex]!;
      const columnSquares = decodeColumnUW(heapData, startOffset, columnIndex);

      for (let r = 0; r < ROWS_PER_ROOM; r++) {
        tiles[r]![c] = columnSquares[r]!;
      }
    }

    rooms.push({ id: roomId, tiles });
  }

  return rooms;
}

// --- Cellar room decoding ---
// Cellar layouts use a different format: 16 bytes per layout.
// They use ColumnHeapUWCellar instead of the main heaps.
// Layout is 16 column descriptors (wider room with walls included).

function decodeCellarRooms(
  cellarLayouts: number[][],
  cellarHeap: number[],
): UniqueRoomData[] {
  const rooms: UniqueRoomData[] = [];

  for (let i = 0; i < cellarLayouts.length; i++) {
    const layout = cellarLayouts[i]!;
    const tiles: number[][] = Array.from({ length: ROWS_PER_ROOM }, () =>
      new Array<number>(layout.length).fill(0),
    );

    for (let c = 0; c < layout.length; c++) {
      const descriptor = layout[c]!;
      const columnIndex = descriptor & 0x0F;
      const columnSquares = decodeColumnUW(cellarHeap, 0, columnIndex);

      for (let r = 0; r < ROWS_PER_ROOM; r++) {
        tiles[r]![c] = columnSquares[r]!;
      }
    }

    rooms.push({ id: i, tiles });
  }

  return rooms;
}

// --- Validation ---

function validateRooms(rooms: RoomData[], blockName: string): void {
  if (rooms.length !== ROOMS_PER_BLOCK) {
    throw new Error(`${blockName}: expected ${ROOMS_PER_BLOCK} rooms, got ${rooms.length}`);
  }
  for (const room of rooms) {
    for (const [dir, val] of Object.entries(room.doors)) {
      if (val < 0 || val > 7) {
        throw new Error(`${blockName} room ${room.id}: ${dir} door type ${val} out of range 0-7`);
      }
    }
    if (room.uniqueRoomId < 0 || room.uniqueRoomId > 63) {
      throw new Error(`${blockName} room ${room.id}: uniqueRoomId ${room.uniqueRoomId} out of range 0-63`);
    }
    if (room.itemId < 0 || room.itemId > 31) {
      throw new Error(`${blockName} room ${room.id}: itemId ${room.itemId} out of range 0-31`);
    }
    if (room.secretTrigger < 0 || room.secretTrigger > 7) {
      throw new Error(`${blockName} room ${room.id}: secretTrigger ${room.secretTrigger} out of range 0-7`);
    }
    if (room.itemPositionIndex < 0 || room.itemPositionIndex > 3) {
      throw new Error(`${blockName} room ${room.id}: itemPositionIndex ${room.itemPositionIndex} out of range 0-3`);
    }
  }
}

function validateUniqueRooms(rooms: UniqueRoomData[]): void {
  if (rooms.length !== UNIQUE_ROOMS) {
    throw new Error(`Expected ${UNIQUE_ROOMS} unique rooms, got ${rooms.length}`);
  }
  for (const room of rooms) {
    if (room.tiles.length !== ROWS_PER_ROOM) {
      throw new Error(`Unique room ${room.id}: expected ${ROWS_PER_ROOM} rows, got ${room.tiles.length}`);
    }
    for (let r = 0; r < ROWS_PER_ROOM; r++) {
      const row = room.tiles[r]!;
      if (row.length !== COLS_PER_ROOM) {
        throw new Error(`Unique room ${room.id}, row ${r}: expected ${COLS_PER_ROOM} cols, got ${row.length}`);
      }
      for (let c = 0; c < COLS_PER_ROOM; c++) {
        const val = row[c]!;
        if (val < 0 || val > 7) {
          throw new Error(`Unique room ${room.id}, tile [${r}][${c}] = ${val} is out of range 0-7`);
        }
      }
    }
  }
}

// --- Main ---

console.log('Reading ROM...');
const rom = readRom();

console.log('Extracting level blocks...');
const levelBlocks: Record<string, RoomData[]> = {};
const levelBlockRawAttrs: Record<string, Uint8Array> = {};
for (const [key, offset] of Object.entries(LEVEL_BLOCK_OFFSETS)) {
  const { rooms, rawAttrs } = extractLevelBlock(rom, offset);
  validateRooms(rooms, key);
  levelBlocks[key] = rooms;
  levelBlockRawAttrs[key] = rawAttrs;
  console.log(`  ${key}: ${rooms.length} rooms`);
}

console.log('Extracting dungeon info (9 dungeons)...');
const dungeons: DungeonInfoData[] = [];
for (let i = 0; i < 9; i++) {
  const info = extractLevelInfo(rom, i, levelBlockRawAttrs);
  dungeons.push(info);
  const cellars = info.cellarConnections.length;
  console.log(`  Dungeon ${info.level}: start=${info.startRoomId}, triforce=${info.triforceRoomId}, boss=${info.bossRoomId}, block=${info.levelBlock}, cellars=${cellars}`);
}

console.log('Parsing assembly source...');
const asmText = readFileSync(ASM_PATH, 'utf-8');
const columnHeaps = parseColumnHeapsUW(asmText);
const primarySquares = parsePrimarySquaresUW(asmText);
const cellarLayouts = parseCellarLayouts(asmText);
const cellarHeap = parseCellarColumnHeap(asmText);

const { data: heapData, offsets: heapOffsets } = buildContiguousHeap(columnHeaps);
console.log(`Column heaps: ${columnHeaps.length} tables, total ${heapData.length} bytes`);
console.log(`Primary squares: ${primarySquares.length} entries`);

console.log('Extracting room layouts from ROM...');
const roomLayouts = new Uint8Array(rom.subarray(
  ROOM_LAYOUTS_UW_OFFSET,
  ROOM_LAYOUTS_UW_OFFSET + ROOM_LAYOUTS_UW_LENGTH,
));

console.log(`Decoding ${UNIQUE_ROOMS} unique room tile grids...`);
const uniqueRooms = decodeUniqueRooms(roomLayouts, heapData, heapOffsets);
validateUniqueRooms(uniqueRooms);

console.log('Decoding 2 cellar room tile grids...');
const cellarRooms = decodeCellarRooms(cellarLayouts, cellarHeap);
console.log(`  Cellar 0: ${cellarRooms[0]!.tiles[0]!.length} cols x ${cellarRooms[0]!.tiles.length} rows`);
console.log(`  Cellar 1: ${cellarRooms[1]!.tiles[0]!.length} cols x ${cellarRooms[1]!.tiles.length} rows`);

const output = {
  levelBlocks: {
    uw1q1: { rooms: levelBlocks['uw1q1']! },
    uw2q1: { rooms: levelBlocks['uw2q1']! },
    uw1q2: { rooms: levelBlocks['uw1q2']! },
    uw2q2: { rooms: levelBlocks['uw2q2']! },
  },
  dungeons,
  uniqueRooms,
  cellarRooms,
  squareTable: primarySquares,
};

console.log(`Writing ${OUTPUT_PATH}...`);
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log(`Done. ${Object.keys(levelBlocks).length} level blocks, ${dungeons.length} dungeons, ${uniqueRooms.length} unique rooms, ${cellarRooms.length} cellar rooms.`);
