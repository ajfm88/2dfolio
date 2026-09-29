// Extract blockset data from ROM → same format as data/blockset_*.json
// Each blockset is an array of blocks, where each block is an array of 16 tile indices.

import { BinaryReader } from '../binary_reader';
import { TILESETS, TILESET_HEADER_SIZE, NUM_TILESETS } from '../rom_offsets';

/** 16 bytes per block (4x4 tile IDs) */
const BLOCK_SIZE = 16;

/** Tileset names indexed by tileset ID (0-24).
 *  From data/tilesets/tileset_headers.asm. */
const TILESET_NAMES: string[] = [
  'Overworld',     // 0
  'RedsHouse1',    // 1
  'Mart',          // 2
  'Forest',        // 3
  'RedsHouse2',    // 4
  'Dojo',          // 5
  'Pokecenter',    // 6
  'Gym',           // 7
  'House',         // 8
  'ForestGate',    // 9
  'Museum',        // 10
  'Underground',   // 11
  'Gate',          // 12
  'Ship',          // 13
  'ShipPort',      // 14
  'Cemetery',      // 15
  'Interior',      // 16
  'Cavern',        // 17
  'Lobby',         // 18
  'Mansion',       // 19
  'Lab',           // 20
  'Club',          // 21
  'Facility',      // 22
  'Plateau',       // 23
  'BeachHouse',    // 24
];

/** Map from tileset name to JSON filename (snake_case).
 *  Some tilesets share blockset data — aliases are handled below. */
const TILESET_TO_JSON_NAME: Record<string, string> = {
  'Overworld': 'overworld',
  'RedsHouse1': 'reds_house',
  'RedsHouse2': 'reds_house',  // shares with RedsHouse1
  'Mart': 'pokecenter',        // shares with Pokecenter
  'Pokecenter': 'pokecenter',
  'Dojo': 'gym',               // shares with Gym
  'Gym': 'gym',
  'Forest': 'forest',
  'House': 'house',
  'ForestGate': 'gate',        // shares with Museum, Gate
  'Museum': 'gate',
  'Gate': 'gate',
  'Ship': 'ship',
  'ShipPort': 'ship_port',
  'Underground': 'underground',
  'Cemetery': 'cemetery',
  'Interior': 'interior',
  'Cavern': 'cavern',
  'Lobby': 'lobby',
  'Mansion': 'mansion',
  'Lab': 'lab',
  'Club': 'club',
  'Facility': 'facility',
  'Plateau': 'plateau',
  'BeachHouse': 'beach_house',
};

/** Known block counts per unique blockset (from .bst file sizes / 16).
 *  Keyed by JSON name. */
const BLOCKSET_SIZES: Record<string, number> = {
  'overworld': 128,
  'reds_house': 19,
  'pokecenter': 40,
  'forest': 128,
  'gym': 116,
  'house': 35,
  'gate': 128,
  'ship': 62,
  'ship_port': 23,
  'underground': 17,
  'cemetery': 110,
  'interior': 58,
  'cavern': 128,
  'lobby': 79,
  'mansion': 72,
  'lab': 58,
  'club': 36,
  'facility': 128,
  'plateau': 73,
  'beach_house': 20,
};

/** Extract a single blockset by tileset index */
function extractBlocksetByIndex(rom: BinaryReader, tilesetIndex: number): number[][] {
  const headerOffset = TILESETS + tilesetIndex * TILESET_HEADER_SIZE;

  // Tileset header layout (12 bytes):
  // byte 0: bank of GFX/Block/Coll data
  // bytes 1-2: pointer to Block data (LE)
  // bytes 3-4: pointer to GFX data (LE)
  // bytes 5-6: pointer to Coll data (LE)
  // bytes 7-11: counter tiles, grass tile, animations
  const bank = rom.readByte(headerOffset);
  const blockPtr = rom.readWord(headerOffset + 1);
  const blockOffset = rom.resolvePointer(bank, blockPtr);

  // Get the JSON name for this tileset to look up block count
  const tilesetName = TILESET_NAMES[tilesetIndex];
  const jsonName = TILESET_TO_JSON_NAME[tilesetName] || tilesetName.toLowerCase();
  const numBlocks = BLOCKSET_SIZES[jsonName] || 128; // default to 128 if unknown

  const blocks: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    const block: number[] = [];
    for (let j = 0; j < BLOCK_SIZE; j++) {
      block.push(rom.readByte(blockOffset + i * BLOCK_SIZE + j));
    }
    blocks.push(block);
  }

  return blocks;
}

/** Extract a blockset by its JSON filename (e.g., "overworld", "reds_house") */
export function extractBlockset(rom: BinaryReader, name: string): number[][] | null {
  // Find the first tileset index that maps to this JSON name
  for (let i = 0; i < NUM_TILESETS; i++) {
    const tilesetName = TILESET_NAMES[i];
    const jsonName = TILESET_TO_JSON_NAME[tilesetName];
    if (jsonName === name) {
      return extractBlocksetByIndex(rom, i);
    }
  }
  return null;
}

/** Extract all unique blocksets, keyed by JSON filename */
export function extractAllBlocksets(rom: BinaryReader): Record<string, number[][]> {
  const result: Record<string, number[][]> = {};

  for (let i = 0; i < NUM_TILESETS; i++) {
    const tilesetName = TILESET_NAMES[i];
    const jsonName = TILESET_TO_JSON_NAME[tilesetName] || tilesetName.toLowerCase();

    // Skip if we already extracted this blockset (shared aliases)
    if (result[jsonName]) continue;

    result[jsonName] = extractBlocksetByIndex(rom, i);
  }

  return result;
}
