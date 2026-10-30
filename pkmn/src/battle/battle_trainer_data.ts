// Unused raw trainer/species tables. No battle-state/address-map imports: startup is cycle-safe.
import { loadBattleData, getAllLoadedMoveIds, getMove, getSpeciesById } from './data';

export interface PartyMember {
  species: string;
  level: number;
  moveOverrides?: Record<string, string>;
}

export interface TrainerRow {
  id: number;
  displayName: string;
  baseMoney: number;
  pic: string;
  picOverride?: { trainerNoAtLeast: number; pic: string };
  parties: PartyMember[][];
}

export interface MoveRow { id: number; pp: number }

export interface MonRow {
  name: string;
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
  learnset: { level: number; move: string }[];
}


interface TrainerTables { trainers: Record<string, TrainerRow>; pokemon: (MonRow | null)[]; moves: Record<string, MoveRow> }
let tables: TrainerTables | undefined;
let loading: Promise<void> | undefined;
/** The same committed files through fetch. Reuse main's pokemon/moves cache. */
export function loadTrainerSpeciesData(): Promise<void> {
  return loading ??= (async () => {
    const [, response] = await Promise.all([loadBattleData(), fetch('trainers.json')]);
    if (!response.ok) throw new Error(`trainers: HTTP ${response.status}`);
    tables = { trainers: await response.json() as Record<string, TrainerRow>,
      pokemon: Array.from({length:152}, (_, dex) => getSpeciesById(dex)),
      moves: Object.fromEntries(getAllLoadedMoveIds().map(name => [name, getMove(name)!])) };
  })();
}
export function getTrainerSpeciesData(): TrainerTables {
  if (!tables) throw new Error('trainer species data not loaded');
  return tables;
}
