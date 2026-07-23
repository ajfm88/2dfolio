// Scoring tables transcribed from the original SNES Tetris Attack.
// Source: normal-tetris-attack/objects.js (comboToScore, chainToScore).
// The chain table there stops at 13 with `default: return 0` — a known bug.
// We extend past 13 with a formula instead.

const COMBO_BONUS = {
  4: 20, 5: 30, 6: 50, 7: 60, 8: 70, 9: 80, 10: 100, 11: 140, 12: 170,
};

const CHAIN_BONUS = {
  2: 50, 3: 80, 4: 150, 5: 300, 6: 400, 7: 500,
  8: 700, 9: 900, 10: 1100, 11: 1300, 12: 1500, 13: 1800,
};

const BASE_POINTS_PER_PANEL = 10;

function comboBonus(count) {
  if (count <= 3) return 0;
  return COMBO_BONUS[count] || 170 + 40 * (count - 12);
}

function chainBonus(length) {
  if (length <= 1) return 0;
  return CHAIN_BONUS[length] || 1800 + 300 * (length - 13);
}

function clearScore(panelCount, chainLength) {
  return panelCount * BASE_POINTS_PER_PANEL
    + comboBonus(panelCount)
    + chainBonus(chainLength);
}

export { clearScore };
