// Load and cache Pokemon/move/type data from JSON

import type {
  PokemonSpecies, MoveData, TypeMatchup, WildEncounterData,
  BattlePokemon, BattleMove,
} from './types';
import { POKEDEX_ORDER } from './battle_state';

let pokemonData: (PokemonSpecies | null)[] | null = null;
let moveData: Record<string, MoveData> | null = null;
let typeChart: TypeMatchup[] | null = null;
let monsterNames: readonly (string | null)[] | null = null;
const wildDataCache = new Map<string, WildEncounterData>();

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.json();
}

export async function loadBattleData(): Promise<void> {
  if (!pokemonData || !moveData || !typeChart || !monsterNames) {
    const [pokemon, moves, types, names] = await Promise.all([
      fetchJson<(PokemonSpecies | null)[]>('pokemon.json'),
      fetchJson<Record<string, MoveData>>('moves.json'),
      fetchJson<TypeMatchup[]>('type_chart.json'),
      fetchJson<(string | null)[]>('monster_names.json'),
    ]);
    pokemonData = pokemon;
    moveData = moves;
    typeChart = types;
    monsterNames = Object.freeze(names);
  }
}

/** Species names compare without case or punctuation: trainers.json and wild/*.json
 *  use pret constants (NIDORAN_F, MR_MIME, FARFETCHD), pokemon.json display names
 *  (Nidoran-F, Mr. Mime, Farfetch'd). */
function speciesKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getSpecies(name: string): PokemonSpecies | null {
  if (!pokemonData) return null;
  const key = speciesKey(name);
  return pokemonData.find(p => p && speciesKey(p.name) === key) ?? null;
}

/** GetMonName (home/names.asm): the cartridge's MonsterNames entry, the species name a screen prints.
 *  `species.name` (pokemon.json) is upstream's title-cased spelling and stays the lookup key. */
export function speciesDisplayName(species: Pick<PokemonSpecies, 'id'>): string {
  // POKEDEX_ORDER holds 0 in the MISSINGNO. slots, so dex 0 must not be looked up.
  const name = species.id >= 1 ? monsterNames?.[POKEDEX_ORDER.indexOf(species.id) + 1] : undefined;
  if (typeof name !== 'string') throw new Error(`monster name for dex ${species.id}`);
  return name;
}

/** MonsterNames by internal id, [0] = null, as loaded; the battle's tables share this one copy. */
export function getMonsterNames(): readonly (string | null)[] {
  if (!monsterNames) throw new Error('monster names not loaded');
  return monsterNames;
}

export function getSpeciesById(dexId: number): PokemonSpecies | null {
  if (!pokemonData) return null;
  return pokemonData[dexId] ?? null;
}

export function getAllSpeciesNames(): string[] {
  if (!pokemonData) return [];
  return pokemonData.filter((p): p is PokemonSpecies => p !== null).map(p => p.name);
}

export function getMove(name: string): MoveData | null {
  return moveData?.[name] ?? null;
}

export function getAllLoadedMoveIds(): string[] {
  return moveData ? Object.keys(moveData) : [];
}

export function getTypeChart(): TypeMatchup[] {
  return typeChart ?? [];
}

export async function getWildData(mapName: string): Promise<WildEncounterData | null> {
  if (wildDataCache.has(mapName)) return wildDataCache.get(mapName)!;
  try {
    const data = await fetchJson<WildEncounterData>(`wild/${mapName}.json`);
    wildDataCache.set(mapName, data);
    return data;
  } catch {
    return null;
  }
}

// Gen 1 stat calculation
function calcHp(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + level + 10;
}

function calcStat(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + 5;
}

/** Create a BattlePokemon from species data at a given level. */
export function createPokemon(
  speciesNameOrId: string | number,
  level: number,
  nickname?: string,
  dvs?: { atk: number; def: number; spd: number; spc: number },
): BattlePokemon | null {
  const species = typeof speciesNameOrId === 'number'
    ? getSpeciesById(speciesNameOrId)
    : getSpecies(speciesNameOrId);
  if (!species) return null;

  // No randomness here (DECISIONS #91): the cartridge paths that need DVs pass them (AddPartyMon's two Random
  // calls, the battle's BattleRandom). The wild and catch-demo callers' DVs are replaced by the battle.
  const atkDV = dvs?.atk ?? 0;
  const defDV = dvs?.def ?? 0;
  const spdDV = dvs?.spd ?? 0;
  const spcDV = dvs?.spc ?? 0;

  const maxHp = calcHp(species.hp, ((atkDV & 1) << 3) | ((defDV & 1) << 2) | ((spdDV & 1) << 1) | (spcDV & 1), level);
  const attack = calcStat(species.attack, atkDV, level);
  const defense = calcStat(species.defense, defDV, level);
  const speed = calcStat(species.speed, spdDV, level);
  const special = calcStat(species.special, spcDV, level);

  // Determine moves: start with base moves, then add level-up moves
  const learnedMoves: string[] = [...species.startMoves.filter(m => m !== 'NO_MOVE')];
  for (const lm of species.learnset) {
    if (lm.level <= level) {
      // Add move, replacing oldest if full
      if (!learnedMoves.includes(lm.move)) {
        if (learnedMoves.length < 4) {
          learnedMoves.push(lm.move);
        } else {
          learnedMoves.shift();
          learnedMoves.push(lm.move);
        }
      }
    }
  }

  const moves: BattleMove[] = learnedMoves.map(id => {
    const md = getMove(id);
    return { id, pp: md?.pp ?? 10, maxPp: md?.pp ?? 10 };
  });

  // Calculate initial experience for this level
  const n2 = level * level;
  const n3 = n2 * level;
  let exp: number;
  switch (species.growthRate) {
    case 'MEDIUM_FAST': exp = n3; break;
    case 'MEDIUM_SLOW': exp = Math.floor(6 * n3 / 5 - 15 * n2 + 100 * level - 140); break;
    case 'FAST': exp = Math.floor(4 * n3 / 5); break;
    case 'SLOW': exp = Math.floor(5 * n3 / 4); break;
    default: exp = n3;
  }
  if (level <= 1) exp = 0;

  return {
    species,
    nickname: nickname ?? speciesDisplayName(species),
    level,
    currentHp: maxHp,
    maxHp,
    attack,
    defense,
    speed,
    special,
    moves,
    statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    status: null,
    atkDV,
    defDV,
    spdDV,
    spcDV,
    exp,
    statExp: [0, 0, 0, 0, 0],
    sleepTurns: 0,
    toxicCounter: 0,
    badlyPoisoned: false,
    originalStats: { attack, defense, speed, special },
    otName: '',
    otId: 0,
  };
}
