// Extract collision tile IDs from ROM → same format as data/collision_tiles.json
// Format: { [tilesetName: string]: number[] } — array of passable tile IDs per tileset

import { BinaryReader } from '../binary_reader';
import { TILESETS, TILESET_HEADER_SIZE, NUM_TILESETS } from '../rom_offsets';

/** Collision tile data is always in ROM bank 0x01 (engine/gfx/sprite_oam.asm) */
const COLLISION_BANK = 0x01;

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

/** Map from tileset name to collision JSON key name.
 *  Tilesets that share collision data use the canonical name from collision_tile_ids.asm.
 *  The JSON uses these specific names as keys. */
const TILESET_TO_COLL_NAME: Record<string, string> = {
  'Overworld': 'Overworld',
  'RedsHouse1': 'RedsHouse2',    // RedsHouse1_Coll = RedsHouse2_Coll
  'RedsHouse2': 'RedsHouse2',
  'Mart': 'Pokecenter',          // Mart_Coll = Pokecenter_Coll
  'Pokecenter': 'Pokecenter',
  'Dojo': 'Gym',                 // Dojo_Coll = Gym_Coll
  'Gym': 'Gym',
  'Forest': 'Forest',
  'House': 'House',
  'ForestGate': 'Gate',          // ForestGate_Coll = Museum_Coll = Gate_Coll
  'Museum': 'Gate',
  'Gate': 'Gate',
  'Ship': 'Ship',
  'ShipPort': 'ShipPort',
  'Underground': 'Underground',
  'Cemetery': 'Cemetery',
  'Interior': 'Interior',
  'Cavern': 'Cavern',
  'Lobby': 'Lobby',
  'Mansion': 'Mansion',
  'Lab': 'Lab',
  'Club': 'Club',
  'Facility': 'Facility',
  'Plateau': 'Plateau',
  'BeachHouse': 'BeachHouse',
};

/** Read a collision tile list from ROM.
 *  Format: sequence of tile IDs terminated by 0xFF (-1 as signed byte). */
function readCollisionTiles(rom: BinaryReader, offset: number): number[] {
  const tiles: number[] = [];
  let pos = offset;
  while (true) {
    const byte = rom.readByte(pos);
    if (byte === 0xFF) break; // end marker (-1)
    tiles.push(byte);
    pos++;
  }
  return tiles;
}

/** Extract collision tiles for all unique tilesets.
 *  Returns the same format as collision_tiles.json: { name: number[] }
 *  Keys are ordered by ROM address (matching collision_tile_ids.asm order). */
export function extractCollisionTiles(rom: BinaryReader): Record<string, number[]> {
  // First pass: collect all unique collision data entries with their ROM offsets
  const entries: { name: string; offset: number; tiles: number[] }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < NUM_TILESETS; i++) {
    const tilesetName = TILESET_NAMES[i];
    const collName = TILESET_TO_COLL_NAME[tilesetName];

    // Skip if already extracted (shared collision data)
    if (seen.has(collName)) continue;
    seen.add(collName);

    const headerOffset = TILESETS + i * TILESET_HEADER_SIZE;

    // Tileset header layout (12 bytes):
    // byte 0: bank of GFX/Block data
    // bytes 1-2: pointer to Block data (LE)
    // bytes 3-4: pointer to GFX data (LE)
    // bytes 5-6: pointer to Coll data (LE) — always in bank 0x01
    // Collision data lives in bank 01 (engine/gfx/sprite_oam.asm),
    // NOT in the tileset's GFX bank.
    const collPtr = rom.readWord(headerOffset + 5);
    const collOffset = rom.resolvePointer(COLLISION_BANK, collPtr);

    entries.push({
      name: collName,
      offset: collOffset,
      tiles: readCollisionTiles(rom, collOffset),
    });
  }

  // Sort by ROM offset to match assembly source order (collision_tile_ids.asm)
  entries.sort((a, b) => a.offset - b.offset);

  // Build result in sorted order
  const result: Record<string, number[]> = {};
  for (const entry of entries) {
    result[entry.name] = entry.tiles;
  }

  return result;
}
