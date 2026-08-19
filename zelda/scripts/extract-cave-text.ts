import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROM_PATH = resolve(__dirname, '../../zelda1-disassembly-master/ext/Original.nes');
const ADDRS_PATH = resolve(__dirname, '../../zelda1-disassembly-master/src/dat/PersonTextAddrs.inc');
const OUTPUT_PATH = resolve(__dirname, '../src/data/cave-text.json');

const INES_HEADER = 16;
const PERSON_TEXT_OFFSET = 16460 + INES_HEADER;
const PERSON_TEXT_LENGTH = 1366;

// NES PPU tile ID → ASCII character mapping
// Low 6 bits of each byte encode the character tile
const TILE_TO_CHAR: Record<number, string> = {};
for (let i = 0; i <= 9; i++) TILE_TO_CHAR[i] = String.fromCharCode(0x30 + i); // 0-9
for (let i = 0; i <= 25; i++) TILE_TO_CHAR[0x0a + i] = String.fromCharCode(0x41 + i); // A-Z
TILE_TO_CHAR[0x24] = ' ';
TILE_TO_CHAR[0x25] = ' '; // fast space (skipped by NES display, rendered as space)
TILE_TO_CHAR[0x28] = ',';
TILE_TO_CHAR[0x29] = ' '; // padding space
TILE_TO_CHAR[0x2a] = "'"; // apostrophe (NES uses period tile for this)
TILE_TO_CHAR[0x2b] = "'";
TILE_TO_CHAR[0x2c] = '!';
TILE_TO_CHAR[0x2d] = '-';
TILE_TO_CHAR[0x2e] = '?';
TILE_TO_CHAR[0x2f] = '-';

function readRom(): Buffer {
  const rom = readFileSync(ROM_PATH);
  if (rom.length !== 131088) {
    throw new Error(`Unexpected ROM size: ${rom.length} (expected 131088)`);
  }
  return rom;
}

function readTextOffsets(): number[] {
  const content = readFileSync(ADDRS_PATH, 'utf-8');
  const offsets: number[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/PersonText\+(\d+)/);
    if (match) {
      offsets.push(parseInt(match[1]!, 10));
    }
  }
  return offsets;
}

interface CaveTextMessage {
  readonly index: number;
  readonly textSelector: number;
  readonly lines: readonly string[];
}

function decodeMessage(data: Buffer, start: number, maxEnd: number): string[] {
  const lines: string[] = ['', '', ''];
  let currentLine = 0;

  for (let j = start; j < maxEnd; j++) {
    const byte = data[j]!;
    const tileId = byte & 0x3f;
    const control = byte & 0xc0;

    const ch = TILE_TO_CHAR[tileId] ?? '?';
    lines[currentLine] += ch;

    if (control === 0xc0) break; // end of text
    if (control === 0x80) currentLine = 1; // next chars go to line 2
    if (control === 0x40) currentLine = 2; // next chars go to line 3
  }

  return lines.map(l => l.trim()).filter(l => l.length > 0);
}

function main(): void {
  const rom = readRom();
  const textData = rom.subarray(PERSON_TEXT_OFFSET, PERSON_TEXT_OFFSET + PERSON_TEXT_LENGTH);
  const offsets = readTextOffsets();

  console.log(`PersonText: ${PERSON_TEXT_LENGTH} bytes, ${offsets.length} messages`);

  const messages: CaveTextMessage[] = [];

  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!;
    const end = i < offsets.length - 1 ? offsets[i + 1]! : PERSON_TEXT_LENGTH;
    const lines = decodeMessage(textData, start, end);

    messages.push({
      index: i,
      textSelector: i * 2,
      lines,
    });

    console.log(`  [${i}] sel=${i * 2}: ${lines.join(' / ')}`);
  }

  const output = {
    _comment: 'Cave/NPC text strings extracted from PersonText.dat in NES ROM',
    messages,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`\nWrote ${messages.length} messages to ${OUTPUT_PATH}`);
}

main();
