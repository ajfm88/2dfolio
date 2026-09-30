// Trainer AI move selection (faithful to engine/battle/trainer_ai.asm)
//
// The AI uses a "modification array" system:
// - Start with scores [10, 10, 10, 10] for each move slot
// - Apply modification functions (1, 2, 3) based on trainer class
// - Find the minimum score among moves that exist
// - Randomly pick from moves that share the minimum score
//
// Modification functions:
// 1: Discourage status moves if player already has a status condition
// 2: Slightly encourage stat-modifying moves (25% chance each call)
// 3: Encourage super-effective moves, discourage not-very-effective moves

import type { BattlePokemon, BattleMove } from './types';
import { getMove } from './data';
import { getTypeEffectiveness } from './damage';

// Status-inflicting move effects that modification 1 discourages
const STATUS_MOVE_EFFECTS = new Set([
  'SLEEP_EFFECT',
  'POISON_EFFECT',
  'PARALYZE_EFFECT',
]);

// Stat-modifying effects that modification 2 encourages
// Range: ATTACK_UP1_EFFECT through EVASION_UP1_EFFECT, and ATTACK_UP2_EFFECT through SPECIAL_UP2_EFFECT
// Also includes some in-between effects
function isStatModEffect(effect: string): boolean {
  // Pure stat-raising moves
  if (effect.endsWith('_UP1_EFFECT') || effect.endsWith('_UP2_EFFECT')) return true;
  // Pure stat-lowering moves targeting defender
  if (effect.endsWith('_DOWN1_EFFECT') || effect.endsWith('_DOWN2_EFFECT')) return true;
  return false;
}

export interface TrainerClassData {
  id: number;
  displayName: string;
  baseMoney: number;
  aiModifiers: number[];
  parties: TrainerPartyMember[][];
}

export interface TrainerPartyMember {
  species: string;
  level: number;
  moveOverrides?: Record<string, string>;
}

let trainerData: Record<string, TrainerClassData> | null = null;

export async function loadTrainerData(): Promise<void> {
  if (trainerData) return;
  const resp = await fetch('trainers.json');
  if (!resp.ok) throw new Error(`Failed to load trainers.json: ${resp.status}`);
  trainerData = await resp.json();
}

export function getTrainerClass(className: string): TrainerClassData | null {
  return trainerData?.[className] ?? null;
}

/**
 * Select a move for the enemy trainer's Pokemon using the AI system.
 * Faithful to AIEnemyTrainerChooseMoves in trainer_ai.asm.
 */
export function selectTrainerMove(
  enemy: BattlePokemon,
  player: BattlePokemon,
  aiModifiers: number[],
): string {
  const validMoves = enemy.moves.filter(m => m.pp > 0);
  if (validMoves.length === 0) return 'STRUGGLE';
  if (validMoves.length === 1) return validMoves[0].id;

  // Initialize scores (10 for each slot, only for moves that exist)
  const scores: number[] = [];
  for (let i = 0; i < enemy.moves.length; i++) {
    scores.push(enemy.moves[i].pp > 0 ? 10 : 50); // heavily discourage 0 PP moves
  }

  // Apply AI modifiers in order
  for (const mod of aiModifiers) {
    switch (mod) {
      case 1:
        applyModification1(scores, enemy, player);
        break;
      case 2:
        applyModification2(scores, enemy);
        break;
      case 3:
        applyModification3(scores, enemy, player);
        break;
      // mod 4 does nothing (unused)
    }
  }

  // Find minimum score among valid moves
  let minScore = Infinity;
  for (let i = 0; i < enemy.moves.length; i++) {
    if (enemy.moves[i].pp > 0 && scores[i] < minScore) {
      minScore = scores[i];
    }
  }

  // Collect all moves that share the minimum score
  const bestMoves: BattleMove[] = [];
  for (let i = 0; i < enemy.moves.length; i++) {
    if (enemy.moves[i].pp > 0 && scores[i] === minScore) {
      bestMoves.push(enemy.moves[i]);
    }
  }

  if (bestMoves.length === 0) return 'STRUGGLE';
  return bestMoves[Math.floor(Math.random() * bestMoves.length)].id;
}

/**
 * Modification 1: Discourage status moves if player already has a status condition.
 * (AIMoveChoiceModification1 in trainer_ai.asm)
 */
function applyModification1(
  scores: number[],
  enemy: BattlePokemon,
  player: BattlePokemon,
): void {
  if (!player.status) return; // only applies if player already has a status

  for (let i = 0; i < enemy.moves.length; i++) {
    const move = getMove(enemy.moves[i].id);
    if (!move) continue;

    // Only discourage non-damaging status moves
    if (move.power > 0) continue;

    if (STATUS_MOVE_EFFECTS.has(move.effect)) {
      scores[i] += 5; // heavily discourage
    }
  }
}

/**
 * Modification 2: Slightly encourage stat-modifying moves.
 * Has a 75% chance of doing nothing (wAILayer2Encouragement check).
 * (AIMoveChoiceModification2 in trainer_ai.asm)
 */
function applyModification2(
  scores: number[],
  enemy: BattlePokemon,
): void {
  // 25% chance of actually applying (faithful to cp $1 check)
  if (Math.floor(Math.random() * 4) !== 0) return;

  for (let i = 0; i < enemy.moves.length; i++) {
    const move = getMove(enemy.moves[i].id);
    if (!move) continue;

    if (isStatModEffect(move.effect)) {
      scores[i]--; // slightly encourage
    }
  }
}

/**
 * Modification 3: Encourage super-effective moves, discourage not-very-effective moves.
 * (AIMoveChoiceModification3 in trainer_ai.asm)
 */
function applyModification3(
  scores: number[],
  enemy: BattlePokemon,
  player: BattlePokemon,
): void {
  for (let i = 0; i < enemy.moves.length; i++) {
    const move = getMove(enemy.moves[i].id);
    if (!move) continue;

    const effectiveness = getTypeEffectiveness(
      move.type,
      player.species.type1,
      player.species.type2,
    );

    if (effectiveness > 1) {
      scores[i]--; // encourage super-effective
    } else if (effectiveness < 1) {
      // Check if there's a better move available before discouraging
      let hasBetterMove = false;
      for (let j = 0; j < enemy.moves.length; j++) {
        if (j === i) continue;
        const otherMove = getMove(enemy.moves[j].id);
        if (!otherMove) continue;

        // Special damage moves, Super Fang, and Fly are considered "better"
        if (otherMove.effect === 'SPECIAL_DAMAGE_EFFECT' ||
            otherMove.effect === 'SUPER_FANG_EFFECT' ||
            otherMove.effect === 'FLY_EFFECT') {
          hasBetterMove = true;
          break;
        }

        // Damaging moves of a different type are considered better
        if (otherMove.power > 0 && otherMove.type !== move.type) {
          hasBetterMove = true;
          break;
        }
      }

      if (hasBetterMove) {
        scores[i]++; // discourage not-very-effective
      }
    }
  }
}
