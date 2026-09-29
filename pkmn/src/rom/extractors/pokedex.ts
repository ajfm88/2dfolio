// Extract Pokedex entry data from ROM → same format as data/pokedex.json
// Format: Array[152] where [0]=null, [1-151]=PokedexEntry

import { BinaryReader } from '../binary_reader';
import {
  POKEDEX_ENTRY_PTRS, POKEDEX_ORDER, POKEDEX_BANK,
  NUM_DEX,
} from '../rom_offsets';
// Pokemon internal names passed as parameter (read from ROM, not hardcoded)
import { extractAllWild } from './wild';

export interface PokedexEntry {
  id: number;           // dex number (1-151)
  species: string;      // species category (e.g., "SEED", "LIZARD")
  heightFeet: number;
  heightInches: number;
  weight: number;       // in pounds (tenths divided by 10)
  description: string[][];  // pages of lines
  locations: string[];  // map names where this pokemon can be found wild
}

/** Game Boy charmap for species name strings in dex entries.
 *  These strings use the standard charmap encoding. */
const DEX_CHARMAP: Record<number, string> = {
  0x7F: ' ',
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [0x80 + i, String.fromCharCode(65 + i)])
  ),
  0xBA: 'é',
};

/** Decode a 0x50-terminated species name from a dex entry */
function decodeSpeciesName(rom: BinaryReader, offset: number): { name: string; bytesRead: number } {
  let result = '';
  let i = 0;
  while (true) {
    const byte = rom.readByte(offset + i);
    if (byte === 0x50) { i++; break; } // @ terminator
    const ch = DEX_CHARMAP[byte];
    if (ch !== undefined) result += ch;
    i++;
  }
  return { name: result, bytesRead: i };
}

/** Decode description text from a text_far target.
 *  The text uses: text(first line), next(continuation), page(new page), dex(end).
 *  In ROM encoding:
 *    0x4F = newline (next line within same page)
 *    0x51 = page break
 *    0x50 = end (but actually the `dex` macro generates 0x50 at end)
 *    0x57 = done
 *    0x58 = prompt (used as end marker)
 *
 *  However, the dex text ends specially. Looking at DrawDexEntryOnScreen,
 *  the text_far handler reads text until it hits control codes.
 *  The `dex` macro emits: db $e8 (→ "."), then $50 (end).
 *  Actually, `dex` is defined in macros/scripts/text.asm.
 */
/** Charmap for dex description text decoding */
const DESC_CHARMAP: Record<number, string> = {
  0x7F: ' ',
  0xBA: 'é',
  0xE0: "'",
  0xE3: '-',
  0xE6: '?',
  0xE7: '!',
  0xE8: '.',
  0xF3: '/',
  0xF4: ',',
  0xEF: '♂',
  0xF5: '♀',
  0xBB: "'d",
  0xBC: "'l",
  0xBD: "'s",
  0xBE: "'t",
  0xBF: "'v",
  0xE4: "'r",
  0xE5: "'m",
  0xE1: 'PK',
  0xE2: 'MN',
  0xF1: '×',
};

// A-Z
for (let i = 0; i < 26; i++) {
  DESC_CHARMAP[0x80 + i] = String.fromCharCode(65 + i);
}
// a-z
for (let i = 0; i < 26; i++) {
  DESC_CHARMAP[0xA0 + i] = String.fromCharCode(97 + i);
}
// digits 0-9
for (let i = 0; i < 10; i++) {
  DESC_CHARMAP[0xF6 + i] = String(i);
}

/**
 * Decode description text from a text_far target in dex entries.
 *
 * Dex text encoding (from macros/scripts/text.asm + constants/charmap.asm):
 * - $00 (TX_START): first byte of text, skip
 * - $4E (<NEXT>): newline within same page
 * - $49 (<PAGE>): page break
 * - $5F (<DEXEND>): end of dex entry (followed by $50)
 * - $50 (@): string terminator
 * - $54 (#): maps to the special glyph in the charmap (byte 0xBA = é)
 *
 * Note: the charmap # ($54) in the assembly source is a special glyph.
 * The gen_pokedex.js expands #MON and # (space) using charmap byte lookups.
 * In the ROM binary, # is stored as $54 which the game renders as a special glyph.
 */
function decodeDescription(rom: BinaryReader, offset: number): string[][] {
  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentLine = '';
  let pos = offset;

  const maxLen = 500; // safety limit
  for (let i = 0; i < maxLen; i++) {
    const byte = rom.readByte(pos);
    pos++;

    // TX_START: skip (beginning of text block)
    if (byte === 0x00) continue;

    // String terminator
    if (byte === 0x50) {
      if (currentLine.length > 0) currentPage.push(currentLine);
      if (currentPage.length > 0) pages.push(currentPage);
      break;
    }

    // DEXEND: end of dex entry (next byte should be $50)
    if (byte === 0x5F) {
      if (currentLine.length > 0) currentPage.push(currentLine);
      if (currentPage.length > 0) pages.push(currentPage);
      break;
    }

    // NEXT ($4E): newline within same page
    if (byte === 0x4E) {
      currentPage.push(currentLine);
      currentLine = '';
      continue;
    }

    // PAGE ($49): page break
    if (byte === 0x49) {
      if (currentLine.length > 0) currentPage.push(currentLine);
      if (currentPage.length > 0) pages.push(currentPage);
      currentPage = [];
      currentLine = '';
      continue;
    }

    // # character ($54): POKé glyph — decode via charmap bytes
    // Match gen_pokedex.js behavior: expand #MON and # (space) using charmap lookups
    if (byte === 0x54) {
      const next1 = rom.readByte(pos);
      const next2 = rom.readByte(pos + 1);
      const next3 = rom.readByte(pos + 2);
      // Build the expanded string from charmap entries (no hardcoded trademarked strings)
      const poke = DESC_CHARMAP[0xBA] ? 'POK' + DESC_CHARMAP[0xBA] : 'POK\u00e9';
      if (next1 === 0x8C && next2 === 0x8E && next3 === 0x8D) {
        // #MON → poke + "MON"
        currentLine += poke + (DESC_CHARMAP[0x8C] ?? '') + (DESC_CHARMAP[0x8E] ?? '') + (DESC_CHARMAP[0x8D] ?? '');
        pos += 3;
      } else if (next1 === 0x7F) {
        // # followed by space → poke glyph (consume both)
        currentLine += poke;
        pos++; // skip the space byte
      } else {
        // All other cases: keep as literal #
        currentLine += '#';
      }
      continue;
    }

    // Regular character
    const ch = DESC_CHARMAP[byte];
    if (ch !== undefined) {
      currentLine += ch;
    }
    // Unknown bytes silently skipped
  }

  return pages;
}

/** Build internal ID → dex number map from PokedexOrder table */
function buildInternalToDexMap(rom: BinaryReader): Map<number, number> {
  const map = new Map<number, number>();
  for (let internalId = 1; internalId <= 190; internalId++) {
    const dexNum = rom.readByte(POKEDEX_ORDER + (internalId - 1));
    if (dexNum >= 1 && dexNum <= NUM_DEX) {
      if (!map.has(internalId)) {
        map.set(internalId, dexNum);
      }
    }
  }
  return map;
}

/** Build dex number → internal ID map */
function buildDexToInternalMap(rom: BinaryReader): Map<number, number> {
  const map = new Map<number, number>();
  for (let internalId = 1; internalId <= 190; internalId++) {
    const dexNum = rom.readByte(POKEDEX_ORDER + (internalId - 1));
    if (dexNum >= 1 && dexNum <= NUM_DEX) {
      if (!map.has(dexNum)) {
        map.set(dexNum, internalId);
      }
    }
  }
  return map;
}

/** Map from Pokemon constant name to location key for pokedex.
 *  Most are identity mappings. Multi-floor dungeons collapse to one location. */
const WILD_FILE_TO_LOCATION: Record<string, string> = {
  'Route1': 'Route1', 'Route2': 'Route2', 'Route3': 'Route3', 'Route4': 'Route4',
  'Route5': 'Route5', 'Route6': 'Route6', 'Route7': 'Route7', 'Route8': 'Route8',
  'Route9': 'Route9', 'Route10': 'Route10', 'Route11': 'Route11', 'Route12': 'Route12',
  'Route13': 'Route13', 'Route14': 'Route14', 'Route15': 'Route15', 'Route16': 'Route16',
  'Route17': 'Route17', 'Route18': 'Route18', 'Route19': 'Route19', 'Route20': 'Route20',
  'Route21': 'Route21', 'Route22': 'Route22', 'Route23': 'Route23', 'Route24': 'Route24',
  'Route25': 'Route25',
  'ViridianForest': 'ViridianForest',
  'DiglettsCave': 'DiglettsCave',
  'MtMoon1F': 'MtMoon', 'MtMoonB1F': 'MtMoon', 'MtMoonB2F': 'MtMoon',
  'RockTunnel1F': 'RockTunnel', 'RockTunnelB1F': 'RockTunnel',
  'PokemonTower1F': 'PokemonTower', 'PokemonTower2F': 'PokemonTower',
  'PokemonTower3F': 'PokemonTower', 'PokemonTower4F': 'PokemonTower',
  'PokemonTower5F': 'PokemonTower', 'PokemonTower6F': 'PokemonTower',
  'PokemonTower7F': 'PokemonTower',
  'SafariZoneCenter': 'SafariZone', 'SafariZoneEast': 'SafariZone',
  'SafariZoneNorth': 'SafariZone', 'SafariZoneWest': 'SafariZone',
  'SeafoamIslands1F': 'SeafoamIslands', 'SeafoamIslandsB1F': 'SeafoamIslands',
  'SeafoamIslandsB2F': 'SeafoamIslands', 'SeafoamIslandsB3F': 'SeafoamIslands',
  'SeafoamIslandsB4F': 'SeafoamIslands',
  'VictoryRoad1F': 'VictoryRoad', 'VictoryRoad2F': 'VictoryRoad',
  'VictoryRoad3F': 'VictoryRoad',
  'PowerPlant': 'PowerPlant',
  'PokemonMansion1F': 'CinnabarIsland', 'PokemonMansion2F': 'CinnabarIsland',
  'PokemonMansion3F': 'CinnabarIsland', 'PokemonMansionB1F': 'CinnabarIsland',
  'CeruleanCave1F': 'CeruleanCity', 'CeruleanCave2F': 'CeruleanCity',
  'CeruleanCaveB1F': 'CeruleanCity',
};

/** Build a mapping from Pokemon constant name to array of location strings */
function buildPokemonLocations(rom: BinaryReader, pokemonNames: Record<number, string>): Map<string, string[]> {
  const allWild = extractAllWild(rom, pokemonNames);
  const pokemonLocs = new Map<string, Set<string>>();

  for (const [mapName, data] of Object.entries(allWild)) {
    const locationKey = WILD_FILE_TO_LOCATION[mapName];
    if (!locationKey) continue;

    const allEncounters = [...data.grass, ...data.water];
    for (const enc of allEncounters) {
      if (!pokemonLocs.has(enc.pokemon)) {
        pokemonLocs.set(enc.pokemon, new Set());
      }
      pokemonLocs.get(enc.pokemon)!.add(locationKey);
    }
  }

  // Convert sets to alphabetically sorted arrays (matching gen_pokedex.js output)
  const result = new Map<string, string[]>();
  for (const [pokemon, locs] of pokemonLocs) {
    result.set(pokemon, [...locs].sort());
  }
  return result;
}

/** Extract all 151 Pokedex entries from ROM */
export function extractPokedex(
  rom: BinaryReader,
  pokemonInternalNames: Record<number, string>,
): (PokedexEntry | null)[] {
  const dexToInternal = buildDexToInternalMap(rom);
  const internalToDex = buildInternalToDexMap(rom);
  const pokemonLocations = buildPokemonLocations(rom, pokemonInternalNames);

  // Build reverse map from constant name to dex number for location lookup
  // pokemonInternalNames: internalId → constant name
  // We need: constant name → dex number → so we can map locations
  const constNameToDex = new Map<string, number>();
  for (const [idStr, name] of Object.entries(pokemonInternalNames)) {
    const internalId = parseInt(idStr);
    const dexNum = internalToDex.get(internalId);
    if (dexNum !== undefined) {
      constNameToDex.set(name, dexNum);
    }
  }

  // Build dex number → locations
  const dexLocations = new Map<number, string[]>();
  for (const [constName, locs] of pokemonLocations) {
    const dexNum = constNameToDex.get(constName);
    if (dexNum !== undefined) {
      dexLocations.set(dexNum, locs);
    }
  }

  const result: (PokedexEntry | null)[] = [null]; // index 0

  for (let dex = 1; dex <= NUM_DEX; dex++) {
    const internalId = dexToInternal.get(dex)!;

    // Read the pointer to the dex entry from PokedexEntryPointers
    // The pointer table is indexed by (internalId - 1)
    const ptrOffset = POKEDEX_ENTRY_PTRS + (internalId - 1) * 2;
    const entryAddr = rom.readWord(ptrOffset);
    let entryOffset = rom.resolvePointer(POKEDEX_BANK, entryAddr);

    // Parse species name (0x50-terminated)
    const { name: species, bytesRead: nameLen } = decodeSpeciesName(rom, entryOffset);
    entryOffset += nameLen;

    // Parse height and weight
    const heightFeet = rom.readByte(entryOffset);
    const heightInches = rom.readByte(entryOffset + 1);
    const weightTenths = rom.readWord(entryOffset + 2);
    const weight = weightTenths / 10;
    entryOffset += 4;

    // Parse text_far pointer: 0x17, addr_lo, addr_hi, bank
    const txFarByte = rom.readByte(entryOffset);
    let description: string[][] = [];
    if (txFarByte === 0x17) {
      const textAddr = rom.readWord(entryOffset + 1);
      const textBank = rom.readByte(entryOffset + 3);
      const textOffset = rom.resolvePointer(textBank, textAddr);
      description = decodeDescription(rom, textOffset);
    }

    // Get locations
    const locations = dexLocations.get(dex) || [];

    result.push({
      id: dex,
      species,
      heightFeet,
      heightInches,
      weight,
      description,
      locations,
    });
  }

  return result;
}
