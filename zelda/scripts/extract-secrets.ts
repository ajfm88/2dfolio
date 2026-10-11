import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const OUTPUT_PATH = resolve(__dirname, '../src/data/secrets.json');

const INES_HEADER = 16;
const LEVEL_BLOCK_OW_OFFSET = 99328 + INES_HEADER;
const LEVEL_BLOCK_OW_LENGTH = 768;
const LEVEL_INFO_OW_OFFSET = 103168 + INES_HEADER;
const LEVEL_INFO_OW_LENGTH = 252;

const SCREENS_TOTAL = 128;
const ATTRS_F_TABLE_OFFSET = 640;
const LI_SHORTCUT_OR_ITEM_POS = 41;
const LI_SHORTCUT_OR_ITEM_POS_LEN = 4;

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

// AttrsF bits 6-7 encode which quest the secret belongs to.
// 0 = both quests, 1 = Q1 only (maps to quest number 0), 2 = Q2 only (maps to quest number 1).
// See IsQuestSecretMismatch in Z_04.asm:3829.
function extractQuestSecretByScreen(rom: Buffer): number[] {
  const block = new Uint8Array(rom.subarray(
    LEVEL_BLOCK_OW_OFFSET,
    LEVEL_BLOCK_OW_OFFSET + LEVEL_BLOCK_OW_LENGTH,
  ));

  const result: number[] = [];
  for (let i = 0; i < SCREENS_TOTAL; i++) {
    const attrsF = block[ATTRS_F_TABLE_OFFSET + i]!;
    const questSecret = (attrsF >> 6) & 0x03;
    result.push(questSecret);
  }
  return result;
}

// AttrsF bits 4-5 encode the shortcut/item position index (0-3).
// GetShortcutOrItemXYForRoom (Z_01.asm:4050) uses this to look up
// the position where stairs appear after a secret is revealed.
function extractShortcutPositionIndexByScreen(rom: Buffer): number[] {
  const block = new Uint8Array(rom.subarray(
    LEVEL_BLOCK_OW_OFFSET,
    LEVEL_BLOCK_OW_OFFSET + LEVEL_BLOCK_OW_LENGTH,
  ));

  const result: number[] = [];
  for (let i = 0; i < SCREENS_TOTAL; i++) {
    const attrsF = block[ATTRS_F_TABLE_OFFSET + i]!;
    const posIndex = (attrsF >> 4) & 0x03;
    result.push(posIndex);
  }
  return result;
}

// 4 packed position bytes from LevelInfoOW at offset 41.
// Each byte: high nibble = X coordinate (masked to $F0), low nibble * 16 = Y coordinate.
// See GetShortcutOrItemXYForRoom in Z_01.asm:4050.
function extractShortcutPositions(rom: Buffer): Array<{ x: number; y: number }> {
  const info = new Uint8Array(rom.subarray(
    LEVEL_INFO_OW_OFFSET,
    LEVEL_INFO_OW_OFFSET + LEVEL_INFO_OW_LENGTH,
  ));

  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < LI_SHORTCUT_OR_ITEM_POS_LEN; i++) {
    const packed = info[LI_SHORTCUT_OR_ITEM_POS + i]!;
    const x = packed & 0xF0;
    const y = (packed & 0x0F) << 4;
    positions.push({ x, y });
  }
  return positions;
}

console.log('Reading ROM...');
const rom = readRom();

console.log('Extracting quest secret numbers...');
const questSecretByScreen = extractQuestSecretByScreen(rom);

console.log('Extracting shortcut position indices...');
const shortcutPositionIndexByScreen = extractShortcutPositionIndexByScreen(rom);

console.log('Extracting shortcut positions from LevelInfoOW...');
const shortcutPositions = extractShortcutPositions(rom);

const nonZeroQuest = questSecretByScreen.filter(q => q !== 0).length;
console.log(`Quest secret numbers: ${nonZeroQuest} screens with quest-specific secrets`);
console.log(`Shortcut positions: ${shortcutPositions.map(p => `(${p.x},${p.y})`).join(', ')}`);

const output = {
  questSecretByScreen,
  shortcutPositionIndexByScreen,
  shortcutPositions,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
console.log(`Written to ${OUTPUT_PATH}`);
