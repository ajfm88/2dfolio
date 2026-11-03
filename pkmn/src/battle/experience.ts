// Gen 1 experience gain, growth rates, and leveling

import type { BattlePokemon } from './types';

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

/** Initialize experience for a Pokemon based on its current level. */
export function initExperience(pokemon: BattlePokemon): void {
  pokemon.exp = expForLevel(pokemon.species.growthRate, pokemon.level);
}
