// Extract wild encounter data from ROM → same format as data/wild/*.json
// Each map: { grassRate, grass: [{level, pokemon}], waterRate, water: [{level, pokemon}] }

import { BinaryReader } from '../binary_reader';
import { WILD_DATA_PTRS, WILD_DATA_BANK } from '../rom_offsets';
// Pokemon internal names passed as parameter (read from ROM, not hardcoded)

export interface WildEncounter {
  level: number;
  pokemon: string;  // constant name e.g. "PIDGEY"
}

export interface WildData {
  grassRate: number;
  grass: WildEncounter[];
  waterRate: number;
  water: WildEncounter[];
}

/** Number of encounter slots per grass/water table */
const NUM_ENCOUNTER_SLOTS = 10;

/** Map constant indices that have wild encounter data, mapped to JSON file names.
 *  Derived from data/wild/grass_water.asm WildDataPointers table. */
const WILD_MAP_NAMES: Record<number, string> = {
  0x0C: 'Route1',
  0x0D: 'Route2',
  0x0E: 'Route3',
  0x0F: 'Route4',
  0x10: 'Route5',
  0x11: 'Route6',
  0x12: 'Route7',
  0x13: 'Route8',
  0x14: 'Route9',
  0x15: 'Route10',
  0x16: 'Route11',
  0x17: 'Route12',
  0x18: 'Route13',
  0x19: 'Route14',
  0x1A: 'Route15',
  0x1B: 'Route16',
  0x1C: 'Route17',
  0x1D: 'Route18',
  0x1E: 'Route19',
  0x1F: 'Route20',
  0x20: 'Route21',
  0x21: 'Route22',
  0x22: 'Route23',
  0x23: 'Route24',
  0x24: 'Route25',
  0x33: 'ViridianForest',
  0x3B: 'MtMoon1F',
  0x3C: 'MtMoonB1F',
  0x3D: 'MtMoonB2F',
  0x52: 'RockTunnel1F',
  0x53: 'PowerPlant',
  0x6C: 'VictoryRoad1F',
  0x8E: 'PokemonTower1F',
  0x8F: 'PokemonTower2F',
  0x90: 'PokemonTower3F',
  0x91: 'PokemonTower4F',
  0x92: 'PokemonTower5F',
  0x93: 'PokemonTower6F',
  0x94: 'PokemonTower7F',
  0x9F: 'SeafoamIslandsB1F',
  0xA0: 'SeafoamIslandsB2F',
  0xA1: 'SeafoamIslandsB3F',
  0xA2: 'SeafoamIslandsB4F',
  0xA5: 'PokemonMansion1F',
  0xC0: 'SeafoamIslands1F',
  0xC2: 'VictoryRoad2F',
  0xC5: 'DiglettsCave',
  0xC6: 'VictoryRoad3F',
  0xD6: 'PokemonMansion2F',
  0xD7: 'PokemonMansion3F',
  0xD8: 'PokemonMansionB1F',
  0xD9: 'SafariZoneEast',
  0xDA: 'SafariZoneNorth',
  0xDB: 'SafariZoneWest',
  0xDC: 'SafariZoneCenter',
  0xE2: 'CeruleanCave2F',
  0xE3: 'CeruleanCaveB1F',
  0xE4: 'CeruleanCave1F',
  0xE8: 'RockTunnelB1F',
};

/** Read wild encounter data for a single map from ROM */
function readWildData(rom: BinaryReader, dataOffset: number, pokemonNames: Record<number, string>): WildData {
  let offset = dataOffset;

  // Read grass data
  const grassRate = rom.readByte(offset);
  offset++;

  const grass: WildEncounter[] = [];
  if (grassRate > 0) {
    for (let i = 0; i < NUM_ENCOUNTER_SLOTS; i++) {
      const level = rom.readByte(offset);
      const speciesId = rom.readByte(offset + 1);
      const pokemon = pokemonNames[speciesId] || `POKEMON_${speciesId}`;
      grass.push({ level, pokemon });
      offset += 2;
    }
  }

  // Read water data
  const waterRate = rom.readByte(offset);
  offset++;

  const water: WildEncounter[] = [];
  if (waterRate > 0) {
    for (let i = 0; i < NUM_ENCOUNTER_SLOTS; i++) {
      const level = rom.readByte(offset);
      const speciesId = rom.readByte(offset + 1);
      const pokemon = pokemonNames[speciesId] || `POKEMON_${speciesId}`;
      water.push({ level, pokemon });
      offset += 2;
    }
  }

  return { grassRate, grass, waterRate, water };
}

/** Extract wild encounter data for a specific map by name */
export function extractWild(rom: BinaryReader, mapName: string, pokemonNames: Record<number, string>): WildData | null {
  // Find the map index for this name
  const mapIndex = Object.entries(WILD_MAP_NAMES).find(([, name]) => name === mapName);
  if (!mapIndex) return null;

  const index = parseInt(mapIndex[0]);
  const ptrOffset = WILD_DATA_PTRS + index * 2;
  const dataAddr = rom.readWord(ptrOffset);
  const dataOffset = rom.resolvePointer(WILD_DATA_BANK, dataAddr);

  return readWildData(rom, dataOffset, pokemonNames);
}

/** Extract all wild encounter data, keyed by map name */
export function extractAllWild(rom: BinaryReader, pokemonNames: Record<number, string>): Record<string, WildData> {
  const result: Record<string, WildData> = {};

  for (const [indexStr, mapName] of Object.entries(WILD_MAP_NAMES)) {
    const index = parseInt(indexStr);
    const ptrOffset = WILD_DATA_PTRS + index * 2;
    const dataAddr = rom.readWord(ptrOffset);
    const dataOffset = rom.resolvePointer(WILD_DATA_BANK, dataAddr);

    const data = readWildData(rom, dataOffset, pokemonNames);
    // Only include maps that actually have encounters
    if (data.grassRate > 0 || data.waterRate > 0) {
      result[mapName] = data;
    }
  }

  return result;
}
