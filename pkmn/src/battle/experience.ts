// Gen 1 experience gain, growth rates, and leveling

import type { BattlePokemon } from './types';
import { getMove } from './data';

const MAX_LEVEL = 100;

// ──────── Growth rate formulas ────────
// Total XP required to reach level n

function expForLevel(growthRate: string, n: number): number {
  if (n <= 1) return 0;
  const n2 = n * n;
  const n3 = n2 * n;
  switch (growthRate) {
    case 'MEDIUM_FAST':
      return n3;
    case 'MEDIUM_SLOW':
      // Assembly floors the cubic division first, then adds integer terms
      return Math.floor(6 * n3 / 5) - 15 * n2 + 100 * n - 140;
    case 'FAST':
      return Math.floor(4 * n3 / 5);
    case 'SLOW':
      return Math.floor(5 * n3 / 4);
    default:
      return n3; // fallback to Medium Fast
  }
}

/** Get XP required for a specific level. */
export function totalExpForLevel(growthRate: string, level: number): number {
  return expForLevel(growthRate, level);
}

/** Get XP needed from current level to next level. */
export function expToNextLevel(growthRate: string, level: number, currentExp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, expForLevel(growthRate, level + 1) - currentExp);
}

/** Calculate level from total experience. */
export function calcLevelFromExp(growthRate: string, exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && expForLevel(growthRate, level + 1) <= exp) {
    level++;
  }
  return level;
}

// ──────── XP gain calculation ────────

/** Calculate XP gained from defeating an enemy Pokemon (wild battle).
 *  Gen 1 formula: floor(baseExp * enemyLevel / 7) */
export function calcExpGain(enemy: BattlePokemon, isTrainerBattle: boolean): number {
  let exp = Math.floor(enemy.species.baseExp * enemy.level / 7);
  if (isTrainerBattle) {
    // Trainer battles give 1.5x exp
    exp = Math.floor(exp * 3 / 2);
  }
  return Math.max(1, exp);
}

// ──────── Stat calculation (Gen 1) ────────

function calcHp(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + level + 10;
}

function calcStat(base: number, dv: number, level: number): number {
  return Math.floor(((base + dv) * 2 * level) / 100) + 5;
}

// ──────── Level up ────────

export interface LevelUpResult {
  newLevel: number;
  hpGain: number;
  newMoves: string[];       // moves successfully learned (had space or duplicate)
  pendingMoves: string[];   // moves needing interactive "delete a move?" prompt (moveset full)
}

/** Apply experience gain and handle level-ups.
 *  Returns array of level-up results (can level up multiple times). */
export function gainExperience(pokemon: BattlePokemon, expGained: number): LevelUpResult[] {
  const results: LevelUpResult[] = [];
  const growthRate = pokemon.species.growthRate;

  pokemon.exp += expGained;

  // Cap at max level exp
  const maxExp = expForLevel(growthRate, MAX_LEVEL);
  if (pokemon.exp > maxExp) pokemon.exp = maxExp;

  // Check for level ups
  while (pokemon.level < MAX_LEVEL) {
    const nextLevelExp = expForLevel(growthRate, pokemon.level + 1);
    if (pokemon.exp < nextLevelExp) break;

    pokemon.level++;
    const result = applyLevelUp(pokemon);
    results.push(result);
  }

  return results;
}

/** Recalculate stats for a level up. Returns HP gain and new moves. */
function applyLevelUp(pokemon: BattlePokemon): LevelUpResult {
  const species = pokemon.species;
  const level = pokemon.level;

  const oldMaxHp = pokemon.maxHp;

  // Recalculate all stats
  const hpDV = ((pokemon.atkDV & 1) << 3) | ((pokemon.defDV & 1) << 2) |
               ((pokemon.spdDV & 1) << 1) | (pokemon.spcDV & 1);
  pokemon.maxHp = calcHp(species.hp, hpDV, level);
  pokemon.attack = calcStat(species.attack, pokemon.atkDV, level);
  pokemon.defense = calcStat(species.defense, pokemon.defDV, level);
  pokemon.speed = calcStat(species.speed, pokemon.spdDV, level);
  pokemon.special = calcStat(species.special, pokemon.spcDV, level);

  // Increase current HP by the gain in max HP
  const hpGain = pokemon.maxHp - oldMaxHp;
  pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + hpGain);

  // Check for new moves at this level
  const newMoves: string[] = [];
  const pendingMoves: string[] = [];
  for (const lm of species.learnset) {
    if (lm.level === level) {
      const result = tryLearnMove(pokemon, lm.move);
      if (result === 'learned') {
        newMoves.push(lm.move);
      } else if (result === 'full') {
        pendingMoves.push(lm.move);
      }
      // 'duplicate' → silently skip
    }
  }

  return { newLevel: level, hpGain, newMoves, pendingMoves };
}

/** Try to add a move to the Pokemon's moveset.
 *  Returns 'learned' if added, 'duplicate' if already known, 'full' if moveset is full. */
function tryLearnMove(pokemon: BattlePokemon, moveId: string): 'learned' | 'duplicate' | 'full' {
  if (pokemon.moves.some(m => m.id === moveId)) return 'duplicate';

  const md = getMove(moveId);
  const newMove = { id: moveId, pp: md?.pp ?? 10, maxPp: md?.pp ?? 10 };

  if (pokemon.moves.length < 4) {
    pokemon.moves.push(newMove);
    return 'learned';
  }
  return 'full';
}

/** Force-learn a move by replacing a specific slot (used by interactive learn flow). */
export function forceLearnMove(pokemon: BattlePokemon, moveId: string, replaceIndex: number): void {
  const md = getMove(moveId);
  pokemon.moves[replaceIndex] = { id: moveId, pp: md?.pp ?? 10, maxPp: md?.pp ?? 10 };
}

/** Initialize experience for a Pokemon based on its current level. */
export function initExperience(pokemon: BattlePokemon): void {
  pokemon.exp = expForLevel(pokemon.species.growthRate, pokemon.level);
}
