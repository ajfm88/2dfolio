// Extract Pokemon and trainer sprites from ROM using Gen 1 decompression
// Produces grayscale ImageData for injection into rawImageCache

import { BinaryReader } from '../binary_reader';
import { BASE_STATS, BASE_DATA_SIZE, NUM_DEX, POKEDEX_ORDER, MONSTER_NAMES, NAME_LENGTH, NUM_POKEMON } from '../rom_offsets';
import { decompressSprite } from '../sprite_decompress';
import { decode2bpp } from '../tile_decoder';
import { decodeFixedString, pokemonNameToFilename } from './text';

/**
 * Get the ROM bank for a Pokemon's sprite data.
 * Matches the assembly logic in home/pics.asm UncompressMonSprite exactly:
 * Bank is determined by internal species ID thresholds (NOT dex number).
 *
 * Internal ID thresholds (from constants/pokemon_constants.asm):
 *   FOSSIL_KABUTOPS = 0xB6 → bank 0x0B (special case)
 *   index < 0x1F (TANGELA+1)   → bank 0x09 ("Pics 1")
 *   index < 0x4A (MOLTRES+1)   → bank 0x0A ("Pics 2")
 *   index < 0x74 (BEEDRILL+2)  → bank 0x0B ("Pics 3")
 *   index < 0x99 (STARMIE+1)   → bank 0x0C ("Pics 4")
 *   index >= 0x99              → bank 0x0D ("Pics 5")
 */
function getSpriteBankForInternalId(internalId: number): number {
  if (internalId === 0xB6) return 0x0B; // FOSSIL_KABUTOPS special case
  if (internalId < 0x1F) return 0x09;   // Pics 1
  if (internalId < 0x4A) return 0x0A;   // Pics 2
  if (internalId < 0x74) return 0x0B;   // Pics 3
  if (internalId < 0x99) return 0x0C;   // Pics 4
  return 0x0D;                           // Pics 5
}

/**
 * Build dex number → internal species ID reverse lookup from PokedexOrder table.
 * PokedexOrder maps internalIndex (0-189) → dex number (1-151).
 * We scan it to find the internal ID for each dex number.
 */
function buildDexToInternalIdMap(rom: BinaryReader): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < NUM_POKEMON; i++) {
    const dexNum = rom.readByte(POKEDEX_ORDER + i);
    if (dexNum > 0 && dexNum <= NUM_DEX && !map.has(dexNum)) {
      map.set(dexNum, i + 1); // internal IDs are 1-based
    }
  }
  return map;
}

// Cached dex→internal ID map (built on first use)
let _dexToInternalCache: Map<number, number> | null = null;
let _cacheRom: BinaryReader | null = null;

function getDexToInternalId(rom: BinaryReader, dexNum: number): number {
  if (_cacheRom !== rom) {
    _dexToInternalCache = buildDexToInternalIdMap(rom);
    _cacheRom = rom;
  }
  return _dexToInternalCache!.get(dexNum) ?? 1;
}

/**
 * Extract a single Pokemon's front sprite as grayscale ImageData.
 * Returns null if decompression fails.
 */
export function extractPokemonFrontSprite(
  rom: BinaryReader,
  dexNum: number,
): ImageData | null {
  try {
    const statsOffset = BASE_STATS + (dexNum - 1) * BASE_DATA_SIZE;
    const frontPicAddr = rom.readWord(statsOffset + 0x0B);
    const internalId = getDexToInternalId(rom, dexNum);
    const bank = getSpriteBankForInternalId(internalId);
    const offset = bank * 0x4000 + (frontPicAddr & 0x3FFF);

    const { width, tiles2bpp } = decompressSprite(rom, offset);
    return decode2bpp(tiles2bpp, width / 8);
  } catch {
    return null;
  }
}

/**
 * Extract a single Pokemon's back sprite as grayscale ImageData.
 * Uses the same bank as the front sprite (assembly uses same bank lookup).
 */
export function extractPokemonBackSprite(
  rom: BinaryReader,
  dexNum: number,
): ImageData | null {
  try {
    const statsOffset = BASE_STATS + (dexNum - 1) * BASE_DATA_SIZE;
    const backPicAddr = rom.readWord(statsOffset + 0x0D);
    const internalId = getDexToInternalId(rom, dexNum);
    const bank = getSpriteBankForInternalId(internalId);
    const offset = bank * 0x4000 + (backPicAddr & 0x3FFF);

    const { width, tiles2bpp } = decompressSprite(rom, offset);
    return decode2bpp(tiles2bpp, width / 8);
  } catch {
    return null;
  }
}

/** Build dex number → Pokemon filename map by reading names from ROM */
function buildDexToNameMap(rom: BinaryReader): Map<number, string> {
  const map = new Map<number, string>();

  // Build dex → internal ID reverse map from PokedexOrder table
  const dexToInternal = new Map<number, number>();
  for (let i = 0; i < NUM_POKEMON; i++) {
    const dexNum = rom.readByte(POKEDEX_ORDER + i);
    if (dexNum > 0 && dexNum <= NUM_DEX && !dexToInternal.has(dexNum)) {
      dexToInternal.set(dexNum, i + 1); // internal IDs are 1-based
    }
  }

  // Read each pokemon's name from ROM and convert to filename
  for (let dex = 1; dex <= NUM_DEX; dex++) {
    const internalId = dexToInternal.get(dex);
    if (!internalId) continue;
    const nameOffset = MONSTER_NAMES + (internalId - 1) * NAME_LENGTH;
    const romName = decodeFixedString(rom, nameOffset, NAME_LENGTH);
    map.set(dex, pokemonNameToFilename(romName));
  }

  return map;
}

/**
 * Extract all Pokemon front and back sprites as grayscale ImageData.
 * Returns a map of URL path → ImageData.
 */
export function extractAllPokemonSprites(rom: BinaryReader): Record<string, ImageData> {
  const result: Record<string, ImageData> = {};
  const names = buildDexToNameMap(rom);

  for (let dex = 1; dex <= NUM_DEX; dex++) {
    const name = names.get(dex);
    if (!name) continue;

    const front = extractPokemonFrontSprite(rom, dex);
    if (front) {
      result[`/gfx/sprites/front/${dex}.png`] = front;
    }

    const back = extractPokemonBackSprite(rom, dex);
    if (back) {
      result[`/gfx/sprites/back/${dex}.png`] = back;
    }
  }

  return result;
}
