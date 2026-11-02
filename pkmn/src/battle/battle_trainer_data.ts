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


interface TrainerTables { trainers: Record<string, TrainerRow>; pokemon: (MonRow | null)[]; moves: Record<string, MoveRow>;
  monsterNames: readonly (string | null)[] }
let tables: TrainerTables | undefined;
let loading: Promise<void> | undefined;
/** The same committed files through fetch. Reuse main's pokemon/moves cache. */
export function loadTrainerSpeciesData(): Promise<void> {
  return loading ??= (async () => {
    const [, response, names] = await Promise.all([loadBattleData(), fetch('trainers.json'), fetch('monster_names.json')]);
    if (!response.ok) throw new Error(`trainers: HTTP ${response.status}`);
    if (!names.ok) throw new Error(`monster names: HTTP ${names.status}`);
    tables = { trainers: await response.json() as Record<string, TrainerRow>,
      pokemon: Array.from({length:152}, (_, dex) => getSpeciesById(dex)),
      moves: Object.fromEntries(getAllLoadedMoveIds().map(name => [name, getMove(name)!])),
      monsterNames: Object.freeze(await names.json() as (string | null)[]) };
  })();
}
/** home/names.asm GetMonName's source: MonsterNames by internal id, as the cartridge stores it. */
export function monsterName(id: number): string {
  const name = getTrainerSpeciesData().monsterNames[id];
  if (typeof name !== 'string') throw new Error(`monster name ${id}`);
  return name;
}
export function getTrainerSpeciesData(): TrainerTables {
  if (!tables) throw new Error('trainer species data not loaded');
  return tables;
}
