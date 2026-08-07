import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_05.asm');
const OUTPUT_PATH = resolve(__dirname, '../src/data/overworld.json');

const INES_HEADER = 16;
const ROOM_LAYOUTS_OFFSET = 87064 + INES_HEADER;
const ROOM_LAYOUTS_LENGTH = 1936;
const LEVEL_BLOCK_OFFSET = 99328 + INES_HEADER;
const LEVEL_BLOCK_LENGTH = 768;
const ATTRS_D_TABLE_OFFSET = 384;

const ROWS_PER_SCREEN = 11;
const COLS_PER_SCREEN = 16;
const SCREENS_TOTAL = 128;

// --- ROM reading ---

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

function extractAttrsD(rom: Buffer): Uint8Array {
  return new Uint8Array(rom.subarray(
    LEVEL_BLOCK_OFFSET + ATTRS_D_TABLE_OFFSET,
    LEVEL_BLOCK_OFFSET + ATTRS_D_TABLE_OFFSET + SCREENS_TOTAL,
  ));
}

function extractRoomLayouts(rom: Buffer): Uint8Array {
  return new Uint8Array(rom.subarray(
    ROOM_LAYOUTS_OFFSET,
    ROOM_LAYOUTS_OFFSET + ROOM_LAYOUTS_LENGTH,
  ));
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

function parseColumnHeaps(asmText: string): number[][] {
  const heaps: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const label = `ColumnHeapOW${i.toString(16).toUpperCase()}`;
    const bytes = parseByteSection(asmText, label);
    if (bytes.length === 0) {
      throw new Error(`Failed to parse column heap: ${label}`);
    }
    heaps.push(bytes);
  }
  return heaps;
}

function parsePrimarySquares(asmText: string): number[] {
  const bytes = parseByteSection(asmText, 'PrimarySquaresOW');
  if (bytes.length !== 56) {
    throw new Error(`PrimarySquaresOW: expected 56 bytes, got ${bytes.length}`);
  }
  return bytes;
}

function parseSecondarySquares(asmText: string): number[][] {
  const bytes = parseByteSection(asmText, 'SecondarySquaresOW');
  if (bytes.length !== 64) {
    throw new Error(`SecondarySquaresOW: expected 64 bytes, got ${bytes.length}`);
  }
  const squares: number[][] = [];
  for (let i = 0; i < 16; i++) {
    squares.push(bytes.slice(i * 4, i * 4 + 4));
  }
  return squares;
}

// --- Column decoding ---
// The 16 heaps are contiguous in ROM — column data can span across heap
// boundaries. We concatenate all heaps and track each one's start offset.

function buildContiguousHeap(heaps: number[][]): { data: number[]; offsets: number[] } {
  const data: number[] = [];
  const offsets: number[] = [];
  for (const heap of heaps) {
    offsets.push(data.length);
    data.push(...heap);
  }
  return { data, offsets };
}

function decodeColumn(
  heapData: number[],
  heapStartOffset: number,
  columnIndex: number,
): number[] {
  let pos = heapStartOffset;
  let remaining = columnIndex;

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

  const squares: number[] = [];
  let repeatToggle = 0;

  while (squares.length < ROWS_PER_SCREEN) {
    if (pos >= heapData.length) {
      throw new Error(`Ran out of heap data at pos ${pos}, needed ${ROWS_PER_SCREEN - squares.length} more rows`);
    }

    const byte = heapData[pos]!;
    const squareIndex = byte & 0x3F;
    squares.push(squareIndex);

    const repeatFlag = byte & 0x40;
    if (repeatFlag) {
      repeatToggle ^= repeatFlag;
      if (repeatToggle !== 0) {
        continue;
      }
    }
    pos++;
  }

  return squares;
}

// --- Screen decoding ---

interface ScreenData {
  id: number;
  row: number;
  col: number;
  uniqueRoomId: number;
  tiles: number[][];
}

function decodeScreen(
  screenId: number,
  attrsD: Uint8Array,
  roomLayouts: Uint8Array,
  heapData: number[],
  heapOffsets: number[],
): ScreenData {
  const attrsDVal = attrsD[screenId]!;
  const layoutIndex = attrsDVal & 0x7F;
  const uniqueRoomId = attrsDVal & 0x3F;
  const row = Math.floor(screenId / 16);
  const col = screenId % 16;

  const layoutBase = layoutIndex * 16;
  if (layoutBase + 16 > roomLayouts.length) {
    throw new Error(`Screen ${screenId}: layout index ${layoutIndex} out of bounds`);
  }

  const tiles: number[][] = Array.from({ length: ROWS_PER_SCREEN }, () =>
    new Array<number>(COLS_PER_SCREEN).fill(0),
  );

  for (let c = 0; c < COLS_PER_SCREEN; c++) {
    const descriptor = roomLayouts[layoutBase + c]!;
    const tableIndex = (descriptor >> 4) & 0x0F;
    const columnIndex = descriptor & 0x0F;

    const startOffset = heapOffsets[tableIndex];
    if (startOffset === undefined) {
      throw new Error(`Screen ${screenId}, col ${c}: invalid table index ${tableIndex}`);
    }

    const columnSquares = decodeColumn(heapData, startOffset, columnIndex);

    for (let r = 0; r < ROWS_PER_SCREEN; r++) {
      tiles[r]![c] = columnSquares[r]!;
    }
  }

  return { id: screenId, row, col, uniqueRoomId, tiles };
}

// --- Main ---

console.log('Reading ROM...');
const rom = readRom();
const attrsD = extractAttrsD(rom);
const roomLayouts = extractRoomLayouts(rom);

console.log('Parsing assembly source...');
const asmText = readFileSync(ASM_PATH, 'utf-8');
const columnHeaps = parseColumnHeaps(asmText);
const primarySquares = parsePrimarySquares(asmText);
const secondarySquares = parseSecondarySquares(asmText);

const { data: heapData, offsets: heapOffsets } = buildContiguousHeap(columnHeaps);
console.log(`Column heaps: ${columnHeaps.length} tables, total ${heapData.length} bytes`);
console.log(`Primary squares: ${primarySquares.length} entries`);
console.log(`Secondary squares: ${secondarySquares.length} entries`);

console.log('Decoding 128 screens...');
const screens: ScreenData[] = [];
for (let i = 0; i < SCREENS_TOTAL; i++) {
  screens.push(decodeScreen(i, attrsD, roomLayouts, heapData, heapOffsets));
}

const uniqueRoomIds = new Set(screens.map(s => s.uniqueRoomId));
console.log(`Unique room IDs: ${uniqueRoomIds.size}`);

for (const screen of screens) {
  if (screen.tiles.length !== ROWS_PER_SCREEN) {
    throw new Error(`Screen ${screen.id}: expected ${ROWS_PER_SCREEN} rows, got ${screen.tiles.length}`);
  }
  for (let r = 0; r < ROWS_PER_SCREEN; r++) {
    const row = screen.tiles[r]!;
    if (row.length !== COLS_PER_SCREEN) {
      throw new Error(`Screen ${screen.id}, row ${r}: expected ${COLS_PER_SCREEN} cols, got ${row.length}`);
    }
    for (let c = 0; c < COLS_PER_SCREEN; c++) {
      const val = row[c]!;
      if (val < 0 || val > 71) {
        throw new Error(`Screen ${screen.id}, tile [${r}][${c}] = ${val} is out of range 0-71`);
      }
    }
  }
}

const output = {
  screens,
  squareTable: {
    primary: primarySquares,
    secondary: secondarySquares,
  },
};

console.log(`Writing ${OUTPUT_PATH}...`);
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log(`Done. ${screens.length} screens extracted.`);
