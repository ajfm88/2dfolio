// Extracts the Second Quest overworld attribute patches from Z_06.asm:239
// @PatchQ2Rooms. On the NES the overworld LevelBlock is shared between quests;
// Quest 2 loads it and then overwrites a handful of attribute bytes in place.
// Those writes are how dungeons 2, 3 and 4 move to different overworld screens.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/Z_06.asm');
const OUTPUT_PATH = resolve(__dirname, '../src/data/q2-overworld.json');

const SCREENS = 128;

type AttrTable = 'A' | 'B' | 'C' | 'D' | 'F';

interface Q2AttrPatch {
  table: AttrTable;
  screen: number;
  value: number;
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

// --- Patch extraction ---

function extractAttrsBPatches(asmText: string): Q2AttrPatch[] {
  const offsets = parseByteSection(asmText, 'LevelBlockAttrsBQ2ReplacementOffsets');
  const values = parseByteSection(asmText, 'LevelBlockAttrsBQ2ReplacementValues');
  if (offsets.length !== 8 || values.length !== 8) {
    throw new Error(
      `@PatchQ2Rooms AttrsB tables: expected 8 offsets and 8 values, got ${offsets.length}/${values.length}`,
    );
  }

  return offsets.map((offset, i) => {
    const value = values[i]!;
    // The loop is `STA LevelBlockAttrsB, X` with X taken straight from the table,
    // and offset $8B (139) is past the 128-screen plane. AttrsB ($68FE) and AttrsC
    // ($697E) are contiguous in RAM, so that write actually lands on AttrsC + 11 —
    // it changes screen 11's monster list, not any AttrsB screen. Preserve it.
    if (offset >= SCREENS) {
      return { table: 'C' as const, screen: offset - SCREENS, value };
    }
    return { table: 'B' as const, screen: offset, value };
  });
}

// Z_06.asm:249-262 — fixed writes, immediates in the routine body rather than tables.
const FIXED_PATCHES: Q2AttrPatch[] = [
  { table: 'D', screen: 11, value: 0x7B },
  { table: 'D', screen: 60, value: 0x7B },
  { table: 'D', screen: 116, value: 0x5A },
  { table: 'A', screen: 60, value: 0x72 },
  { table: 'A', screen: 116, value: 0x72 },
  { table: 'F', screen: 60, value: 0x01 },
  { table: 'F', screen: 116, value: 0x00 },
];

// --- Decoding ---
// Bit layouts per Variables.inc:325-330 and the usage sites cited on each field.

interface Q2ScreenOverride {
  screen: number;
  caveIndex?: number;
  isDungeon?: boolean;
  uniqueRoomId?: number;
  pushBlock?: boolean;
  outerPalette?: number;
  questSecret?: number;
  shortcutPositionIndex?: number;
  secretTrigger?: number;
  monsterListId?: number;
}

function decodeOverrides(patches: Q2AttrPatch[]): Q2ScreenOverride[] {
  const byScreen = new Map<number, Q2ScreenOverride>();
  const forScreen = (screen: number): Q2ScreenOverride => {
    let entry = byScreen.get(screen);
    if (!entry) {
      entry = { screen };
      byScreen.set(screen, entry);
    }
    return entry;
  };

  for (const { table, screen, value } of patches) {
    const entry = forScreen(screen);
    switch (table) {
      case 'A':
        entry.outerPalette = value & 0x03;
        break;
      case 'B': {
        // Z_05.asm:7369 HandleWarpOW — AND #$FC then LSR twice.
        const caveIndex = (value & 0xFC) >> 2;
        entry.caveIndex = caveIndex;
        entry.isDungeon = caveIndex >= 1 && caveIndex <= 9;
        break;
      }
      case 'C':
        entry.monsterListId = value & 0x3F;
        break;
      case 'D':
        entry.uniqueRoomId = value & 0x3F;
        entry.pushBlock = (value & 0x40) !== 0;
        break;
      case 'F':
        entry.secretTrigger = value & 0x07;
        entry.shortcutPositionIndex = (value & 0x30) >> 4;
        entry.questSecret = (value & 0xC0) >> 6;
        break;
    }
  }

  return [...byScreen.values()].sort((a, b) => a.screen - b.screen);
}

// --- Main ---

console.log('Parsing Z_06.asm @PatchQ2Rooms...');
const asmText = readFileSync(ASM_PATH, 'utf-8');

const patches = [...extractAttrsBPatches(asmText), ...FIXED_PATCHES];
for (const { table, screen } of patches) {
  if (screen < 0 || screen >= SCREENS) {
    throw new Error(`Attrs${table} patch resolved to out-of-range screen ${screen}`);
  }
}

const screenOverrides = decodeOverrides(patches);

console.log(`  ${patches.length} attribute writes across ${screenOverrides.length} screens`);
for (const o of screenOverrides) {
  const bits: string[] = [];
  if (o.caveIndex !== undefined) {
    bits.push(o.isDungeon ? `dungeon CurLevel ${o.caveIndex}` : `cave index ${o.caveIndex}`);
  }
  if (o.uniqueRoomId !== undefined) bits.push(`uniqueRoomId ${o.uniqueRoomId}`);
  if (o.monsterListId !== undefined) bits.push(`monsterListId ${o.monsterListId}`);
  if (o.questSecret !== undefined) bits.push(`questSecret ${o.questSecret}`);
  console.log(`  screen ${o.screen}: ${bits.join(', ')}`);
}

const output = { patches, screenOverrides };

console.log(`Writing ${OUTPUT_PATH}...`);
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log('Done.');
