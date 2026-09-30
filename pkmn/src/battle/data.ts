// Load and cache Pokemon/move/type data from JSON

import type {
  PokemonSpecies, MoveData, TypeMatchup, WildEncounterData,
  BattlePokemon, BattleMove,
} from './types';
import { createVolatiles } from './volatiles';

let pokemonData: (PokemonSpecies | null)[] | null = null;
let moveData: Record<string, MoveData> | null = null;
let typeChart: TypeMatchup[] | null = null;
const wildDataCache = new Map<string, WildEncounterData>();

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.json();
}

export async function loadBattleData(): Promise<void> {
  if (!pokemonData || !moveData || !typeChart) {
    const [pokemon, moves, types] = await Promise.all([
      fetchJson<(PokemonSpecies | null)[]>('pokemon.json'),
      fetchJson<Record<string, MoveData>>('moves.json'),
      fetchJson<TypeMatchup[]>('type_chart.json'),
    ]);
    pokemonData = pokemon;
    moveData = moves;
    typeChart = types;
  }
}

export function getSpecies(name: string): PokemonSpecies | null {
  if (!pokemonData) return null;
  return pokemonData.find(p => p && p.name.toUpperCase() === name.toUpperCase()) ?? null;
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

  const atkDV = dvs?.atk ?? Math.floor(Math.random() * 16);
  const defDV = dvs?.def ?? Math.floor(Math.random() * 16);
  const spdDV = dvs?.spd ?? Math.floor(Math.random() * 16);
  const spcDV = dvs?.spc ?? Math.floor(Math.random() * 16);

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
    nickname: nickname ?? species.name,
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
    sleepTurns: 0,
    toxicCounter: 0,
    badlyPoisoned: false,
    volatiles: createVolatiles(),
    originalStats: { attack, defense, speed, special },
    otName: '',
    otId: 0,
  };
}
