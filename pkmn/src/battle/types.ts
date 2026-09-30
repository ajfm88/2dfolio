// Battle system type definitions

import type { Volatiles } from './volatiles';

export interface PokemonSpecies {
  id: number;
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
  evolutions: { method: string; param: number; to: string }[];
}

export interface MoveData {
  id: number;
  effect: string;
  power: number;
  type: string;
  accuracy: number;
  pp: number;
}

export interface BattleMove {
  id: string;       // move name key (e.g. "THUNDERSHOCK")
  pp: number;
  maxPp: number;
}

export interface BattlePokemon {
  species: PokemonSpecies;
  nickname: string;
  level: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  moves: BattleMove[];
  statStages: StatStages;
  status: StatusCondition;
  // DVs (IVs in Gen 1): 0-15
  atkDV: number;
  defDV: number;
  spdDV: number;
  spcDV: number;
  // Experience
  exp: number;
  // Status tracking
  sleepTurns: number;    // 1-7 turns remaining (0 = not asleep)
  toxicCounter: number;  // increments each turn when badly poisoned
  badlyPoisoned: boolean;
  // Volatile statuses (reset on switch-out / battle end)
  volatiles: Volatiles;
  // Snapshot of stats at battle start (for Haze reset)
  originalStats: { attack: number; defense: number; speed: number; special: number };
  // Original Trainer
  otName: string;
  otId: number;
}

export type StatusCondition = null | 'PSN' | 'BRN' | 'FRZ' | 'PAR' | 'SLP';

export interface StatStages {
  attack: number;
  defense: number;
  speed: number;
  special: number;
  accuracy: number;
  evasion: number;
}

export interface TypeMatchup {
  attacker: string;
  defender: string;
  multiplier: number;
}

export interface WildEncounterData {
  grassRate: number;
  grass: { level: number; pokemon: string }[];
  waterRate: number;
  water: { level: number; pokemon: string }[];
}

// Encounter slot probabilities (from original game)
// 10 slots with cumulative thresholds out of 256
export const ENCOUNTER_SLOTS = [
  { threshold: 51,  slot: 0 },  // ~20%
  { threshold: 102, slot: 1 },  // ~20%
  { threshold: 141, slot: 2 },  // ~15%
  { threshold: 166, slot: 3 },  // ~10%
  { threshold: 191, slot: 4 },  // ~10%
  { threshold: 216, slot: 5 },  // ~10%
  { threshold: 229, slot: 6 },  // ~5%
  { threshold: 242, slot: 7 },  // ~5%
  { threshold: 253, slot: 8 },  // ~4%
  { threshold: 256, slot: 9 },  // ~1%
];

export type BattleState =
  | 'trainer_intro'   // Trainer battle intro: slide in, pokeballs, "wants to fight!"
  | 'intro'           // "Wild X appeared!" / "Go! Y!"
  | 'choose_action'   // FIGHT / PKMN / ITEM / RUN
  | 'choose_move'     // Select which move to use
  | 'choose_item'     // Select item to use (bag menu)
  | 'execute_turn'    // Executing both sides' moves
  | 'player_move'     // Player's move animation/text
  | 'enemy_move'      // Enemy's move animation/text
  | 'check_faint'     // Check if either side fainted
  | 'throw_ball'      // Ball throw animation/text
  | 'victory'         // "Enemy X fainted!" / EXP gain
  | 'gain_exp'        // XP gain text / level-up
  | 'choose_pokemon'  // Party menu shown for voluntary switch
  | 'forced_switch'   // Party menu shown after player mon fainted (no cancel)
  | 'switching_out'   // "Come back, X!" text phase
  | 'switching_in'    // "Go! X!" text phase
  | 'defeat'              // Player's Pokemon fainted
  | 'run_away'            // "Got away safely!"
  | 'run_failed'          // Failed to escape, enemy gets free turn
  | 'learn_move_prompt'   // "Wants to learn X! Delete a move?" yes/no
  | 'learn_move_select'   // Select which of 4 moves to forget
  | 'learn_move_confirm'  // "Abandon learning X?" yes/no
  | 'blackout'            // "X is out of useable POKéMON!" → "X blacked out!"
  | 'end';                // Battle is over, return to overworld
