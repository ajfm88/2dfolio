// Run-from-battle logic, faithful to Gen 1 (core.asm TryRunningFromBattle)

export interface RunResult {
  escaped: boolean;
  message: string[];
}

/**
 * Attempt to run from a wild Pokemon battle.
 * Faithful to TryRunningFromBattle in engine/battle/core.asm:1535-1665.
 */
export function tryRunFromBattle(
  playerSpeed: number,
  enemySpeed: number,
  numRunAttempts: number,
): RunResult {
  // Speed comparison: if player speed >= enemy speed, always escape
  if (playerSpeed >= enemySpeed) {
    return { escaped: true, message: ['Got away safely!'] };
  }

  // Divisor: (enemySpeed / 4) mod 256 — ASM uses 16-bit right shift by 2,
  // then only the low byte (a register) is used as divisor
  const divisor = Math.floor(enemySpeed / 4) & 0xFF;

  // If divisor is 0, always escape (division by zero guard)
  if (divisor === 0) {
    return { escaped: true, message: ['Got away safely!'] };
  }

  // Escape factor: (playerSpeed * 32) / divisor
  const quotient = Math.floor((playerSpeed * 32) / divisor);

  // If quotient > 255, always escape
  if (quotient > 255) {
    return { escaped: true, message: ['Got away safely!'] };
  }

  // Start with low byte of quotient
  let escapeFactor = quotient & 0xFF;

  // Add 30 for each previous run attempt (first attempt adds nothing)
  for (let i = 1; i < numRunAttempts; i++) {
    escapeFactor += 30;
    if (escapeFactor > 255) {
      return { escaped: true, message: ['Got away safely!'] };
    }
  }

  // Compare with random value [0, 255]
  const randomValue = Math.floor(Math.random() * 256);
  if (escapeFactor >= randomValue) {
    return { escaped: true, message: ['Got away safely!'] };
  }

  return { escaped: false, message: ["Can't escape!"] };
}
