// Extract Pokemon base stats, names, evolutions, and learnsets from ROM
// → same format as data/pokemon.json
// pokemon.json format: Array[152] where [0]=null, [1-151]=PokemonEntry

import { BinaryReader } from '../binary_reader';
import {
  BASE_STATS, MONSTER_NAMES, EVOS_MOVES_PTRS, POKEDEX_ORDER,
  BASE_DATA_SIZE, NAME_LENGTH, NUM_DEX,
  EVOS_MOVES_BANK,
} from '../rom_offsets';
import { TYPE_NAMES, GROWTH_RATE_NAMES, EVOLVE_LEVEL, EVOLVE_ITEM, EVOLVE_TRADE } from '../constants';
import { decodeFixedString, titleCaseName } from './text';

export interface PokemonEvolution {
  method: string;     // 'level' | 'item' | 'trade'
  param: number | string;  // level number, or item name string
  to: string;         // species name (title case)
}

export interface LearnsetEntry {
  level: number;
  move: string;
}

export interface PokemonEntry {
  id: number;         // dex number (1-151)
  name: string;       // title case (e.g., "Bulbasaur")
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  type1: string;
  type2: string;
  catchRate: number;
  baseExp: number;
  startMoves: string[];
  growthRate: string;
  learnset: LearnsetEntry[];
  evolutions: PokemonEvolution[];
}

/** Map dex number → internal ID using the PokedexOrder table in ROM.
 *  PokedexOrder is indexed by (internalId - 1), value = dex number.
 *  We search it to build the reverse map. */
function buildDexToInternalMap(rom: BinaryReader): Map<number, number> {
  const map = new Map<number, number>();
  // Scan PokedexOrder: for each internal ID (1-based), read the dex number
  // Internal IDs go up to ~190 (with gaps for MISSINGNO)
  for (let internalId = 1; internalId <= 190; internalId++) {
    const dexNum = rom.readByte(POKEDEX_ORDER + (internalId - 1));
    if (dexNum >= 1 && dexNum <= NUM_DEX) {
      // Only store if we haven't seen this dex number yet (first match wins)
      if (!map.has(dexNum)) {
        map.set(dexNum, internalId);
      }
    }
  }
  return map;
}

/** Read a Pokemon's name from MonsterNames (indexed by internal ID) */
function readPokemonName(rom: BinaryReader, internalId: number): string {
  const offset = MONSTER_NAMES + (internalId - 1) * NAME_LENGTH;
  const rawName = decodeFixedString(rom, offset, NAME_LENGTH);
  return titleCaseName(rawName);
}

/** Parse evolution/learnset data from the evos_moves section */
function parseEvosAndMoves(
  rom: BinaryReader,
  internalId: number,
  _dexToInternal: Map<number, number>,
  _internalToDex: Map<number, number>,
  moveNames: string[],
  itemNames: Record<number, string>,
): { evolutions: PokemonEvolution[]; learnset: LearnsetEntry[] } {
  // Read pointer from EvosMovesPointerTable (indexed by internal ID - 1)
  const ptrOffset = EVOS_MOVES_PTRS + (internalId - 1) * 2;
  const addr = rom.readWord(ptrOffset);
  let offset = rom.resolvePointer(EVOS_MOVES_BANK, addr);

  // Parse evolutions (until db 0 terminator)
  const evolutions: PokemonEvolution[] = [];
  while (true) {
    const method = rom.readByte(offset);
    if (method === 0) { offset++; break; }

    if (method === EVOLVE_LEVEL) {
      const level = rom.readByte(offset + 1);
      const speciesInternalId = rom.readByte(offset + 2);
      const speciesName = readPokemonName(rom, speciesInternalId);
      evolutions.push({ method: 'level', param: level, to: speciesName });
      offset += 3;
    } else if (method === EVOLVE_ITEM) {
      const itemId = rom.readByte(offset + 1);
      rom.readByte(offset + 2); // min level, always 1
      const speciesInternalId = rom.readByte(offset + 3);
      const speciesName = readPokemonName(rom, speciesInternalId);
      const itemName = itemNames[itemId] || `ITEM_${itemId}`;
      evolutions.push({ method: 'item', param: itemName, to: speciesName });
      offset += 4;
    } else if (method === EVOLVE_TRADE) {
      rom.readByte(offset + 1); // min level, always 1
      const speciesInternalId = rom.readByte(offset + 2);
      const speciesName = readPokemonName(rom, speciesInternalId);
      evolutions.push({ method: 'trade', param: 1, to: speciesName });
      offset += 3;
    } else {
      // Unknown evolution method — skip
      offset++;
      break;
    }
  }

  // Parse learnset (until db 0 terminator)
  const learnset: LearnsetEntry[] = [];
  while (true) {
    const level = rom.readByte(offset);
    if (level === 0) break;
    const moveId = rom.readByte(offset + 1);
    const moveName = moveNames[moveId] || `MOVE_${moveId}`;
    learnset.push({ level, move: moveName });
    offset += 2;
  }

  return { evolutions, learnset };
}

export function extractPokemon(
  rom: BinaryReader,
  moveNames: string[],
  itemNames: Record<number, string>,
): (PokemonEntry | null)[] {
  const dexToInternal = buildDexToInternalMap(rom);

  // Build reverse map: internal ID → dex number
  const internalToDex = new Map<number, number>();
  for (const [dex, internal] of dexToInternal) {
    internalToDex.set(internal, dex);
  }

  const result: (PokemonEntry | null)[] = [null]; // index 0

  for (let dex = 1; dex <= NUM_DEX; dex++) {
    const statsOffset = BASE_STATS + (dex - 1) * BASE_DATA_SIZE;
    const internalId = dexToInternal.get(dex)!;

    // Read base stats
    // byte 0 is dex number (redundant with loop index)
    rom.readByte(statsOffset);
    const hp = rom.readByte(statsOffset + 1);
    const attack = rom.readByte(statsOffset + 2);
    const defense = rom.readByte(statsOffset + 3);
    const speed = rom.readByte(statsOffset + 4);
    const special = rom.readByte(statsOffset + 5);
    const type1Id = rom.readByte(statsOffset + 6);
    const type2Id = rom.readByte(statsOffset + 7);
    const catchRate = rom.readByte(statsOffset + 8);
    const baseExp = rom.readByte(statsOffset + 9);
    // 0x0A: pic size, 0x0B-0x0E: pic pointers (skip for now)
    const startMove1 = rom.readByte(statsOffset + 0x0F);
    const startMove2 = rom.readByte(statsOffset + 0x10);
    const startMove3 = rom.readByte(statsOffset + 0x11);
    const startMove4 = rom.readByte(statsOffset + 0x12);
    const growthRateId = rom.readByte(statsOffset + 0x13);

    // Read name from MonsterNames
    const name = readPokemonName(rom, internalId);

    // Convert type IDs to names (PSYCHIC_TYPE → PSYCHIC for pokemon types)
    const rawType1 = TYPE_NAMES[type1Id] || `TYPE_${type1Id}`;
    const rawType2 = TYPE_NAMES[type2Id] || `TYPE_${type2Id}`;
    const type1 = rawType1 === 'PSYCHIC_TYPE' ? 'PSYCHIC' : rawType1;
    const type2 = rawType2 === 'PSYCHIC_TYPE' ? 'PSYCHIC' : rawType2;

    // Convert start moves (0 = no move)
    const startMoves: string[] = [];
    for (const moveId of [startMove1, startMove2, startMove3, startMove4]) {
      if (moveId !== 0) {
        startMoves.push(moveNames[moveId] || `MOVE_${moveId}`);
      }
    }

    // Growth rate
    const growthRate = GROWTH_RATE_NAMES[growthRateId] || `GROWTH_${growthRateId}`;

    // Parse evolutions and learnset
    const { evolutions, learnset } = parseEvosAndMoves(rom, internalId, dexToInternal, internalToDex, moveNames, itemNames);

    result.push({
      id: dex,
      name,
      hp, attack, defense, speed, special,
      type1, type2,
      catchRate, baseExp,
      startMoves,
      growthRate,
      learnset,
      evolutions,
    });
  }

  return result;
}
