// Gen 1 Pokeball catch formula (faithful to engine/items/item_effects.asm)

import type { BattlePokemon } from './types';

export type BallType = 'POKE_BALL' | 'GREAT_BALL' | 'ULTRA_BALL' | 'MASTER_BALL';

export interface CatchResult {
  caught: boolean;
  shakes: number;  // 0-3
}

/** Gen 1 catch algorithm.
 *  Faithful to engine/items/item_effects.asm ItemUseBall. */
export function attemptCatch(
  enemy: BattlePokemon,
  ballType: BallType,
): CatchResult {
  // Master Ball always catches
  if (ballType === 'MASTER_BALL') {
    return { caught: true, shakes: 3 };
  }

  // Step 1: Generate Rand1 within ball's acceptable range
  // Poke Ball: [0, 255], Great Ball: [0, 200], Ultra Ball: [0, 150]
  // Assembly loops until random byte is within range
  const maxRand = ballType === 'POKE_BALL' ? 256
    : ballType === 'GREAT_BALL' ? 201
    : 151; // ULTRA_BALL
  let rand1 = Math.floor(Math.random() * maxRand);

  // Step 2: Status ailment modifier
  // FRZ/SLP: subtract 25 from Rand1; BRN/PAR/PSN: subtract 12
  // If subtraction causes underflow (carry), Pokemon is caught
  let statusMod = 0;
  if (enemy.status === 'FRZ' || enemy.status === 'SLP') {
    statusMod = 25;
  } else if (enemy.status === 'BRN' || enemy.status === 'PAR' || enemy.status === 'PSN') {
    statusMod = 12;
  }

  if (statusMod > rand1) {
    return { caught: true, shakes: 3 };
  }
  rand1 -= statusMod;

  // Step 3: Calculate W and X
  // BallFactor: Great Ball = 8, all others = 12
  const ballFactor = ballType === 'GREAT_BALL' ? 8 : 12;

  // W = floor(floor(MaxHP * 255 / BallFactor) / max(floor(CurrentHP / 4), 1))
  const hpDiv4 = Math.max(1, Math.floor(enemy.currentHp / 4));
  const w = Math.floor(Math.floor(enemy.maxHp * 255 / ballFactor) / hpDiv4);

  // X = min(W, 255)
  const x = Math.min(255, w);

  // Step 4: If Rand1 > CatchRate, ball fails
  if (rand1 > enemy.species.catchRate) {
    return { caught: false, shakes: calcShakes(x, enemy, ballType) };
  }

  // Step 5: If W > 255, Pokemon is caught
  if (w > 255) {
    return { caught: true, shakes: 3 };
  }

  // Step 6: Generate Rand2 in [0, 255]; if Rand2 > X, fail
  const rand2 = Math.floor(Math.random() * 256);
  if (rand2 > x) {
    return { caught: false, shakes: calcShakes(x, enemy, ballType) };
  }

  return { caught: true, shakes: 3 };
}

/** Calculate number of shakes on a failed capture.
 *  Faithful to assembly lines 334-427 of item_effects.asm. */
function calcShakes(x: number, enemy: BattlePokemon, ballType: BallType): number {
  // Y = floor(CatchRate * 100 / BallFactor2)
  // BallFactor2: Poke Ball = 255, Great Ball = 200, Ultra Ball = 150
  const ballFactor2 = ballType === 'POKE_BALL' ? 255
    : ballType === 'GREAT_BALL' ? 200
    : 150; // ULTRA_BALL

  const y = Math.floor(enemy.species.catchRate * 100 / ballFactor2);

  // If Y > 255, 3 shakes (shouldn't happen per assembly comment, max = 170)
  if (y > 255) return 3;

  // Z = floor(X * Y / 255) + Status2
  // Status2: FRZ/SLP = 10, BRN/PAR/PSN = 5, none = 0
  let status2 = 0;
  if (enemy.status === 'FRZ' || enemy.status === 'SLP') {
    status2 = 10;
  } else if (enemy.status === 'BRN' || enemy.status === 'PAR' || enemy.status === 'PSN') {
    status2 = 5;
  }

  const z = Math.floor(x * y / 255) + status2;

  if (z < 10) return 0;
  if (z < 30) return 1;
  if (z < 70) return 2;
  return 3;
}
