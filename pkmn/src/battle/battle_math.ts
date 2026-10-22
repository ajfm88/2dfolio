// Unused ports for A5c3. pret e89ead15 engine/battle/core.asm, cited below.
import { A, LINK_STATE_BATTLING, STRUGGLE, WILD_BATTLE, type BattleState } from './battle_state';
import { calculateDamage, type DamageResult } from './damage';
import { getMove, getTypeChart } from './data';
import { getEffectiveTypes } from './effects';
import { applyTrainerMoveModifiers } from './trainer_ai';
import type { BattlePokemon } from './types';

export { battleRandom } from './battle_random';

// data/battle/stat_modifiers.asm. Decimal percentages are intentional.
export const STAT_MODIFIER_RATIOS: readonly (readonly [number, number])[] = [
  [25, 100], [28, 100], [33, 100], [40, 100], [50, 100], [66, 100],
  [1, 1], [15, 10], [2, 1], [25, 10], [3, 1], [35, 10], [4, 1],
];

/** core.asm:6550–6637. C indexes attack/defense/speed/special, never HP. */
export function calculateModifiedStat(state: BattleState, stat: 0 | 1 | 2 | 3): void {
  const player = state.wCalculateWhoseStats === 0;
  const mods = player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods;
  const original = (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3 + stat * 2;
  const dest = (player ? A.wBattleMonAttack : A.wEnemyMonAttack) + stat * 2;
  const offset = ((state.mem[mods + stat] - 1) << 1) & 0xff;
  // DEC B; SLA B on mod 0 reads ROM at StatModifierRatios+$FE = 0f:777f.
  // EA 77 are the opcode/low address of `ld [wEscapedFromBattle], a` in
  // SwitchAndTeleportEffect.enemyMoveWasSuccessful. Pinned cartridge quirk.
  const ratio = offset === 0xfe ? [0xea, 0x77] : STAT_MODIFIER_RATIOS[offset >> 1];
  if (!ratio) throw new Error(`untraced stat modifier offset: ${offset}`);
  const value = Math.floor(state.readBE(original) * ratio[0] / ratio[1]);
  state.writeBE(dest, Math.max(1, Math.min(999, value)));
}

export function calculateModifiedStats(state: BattleState): void {
  for (const stat of [0, 1, 2, 3] as const) calculateModifiedStat(state, stat);
}

/** unused_stats_functions.asm: both far routines, double first. No doubling cap. */
export function doubleOrHalveSelectedStats(state: BattleState): void {
  const player = state.hWhoseTurn === 0;
  const start = player ? A.wBattleMonAttack : A.wEnemyMonAttack;
  const double = player ? state.wPlayerStatsToDouble : state.wEnemyStatsToDouble;
  const halve = player ? state.wPlayerStatsToHalve : state.wEnemyStatsToHalve;
  for (let stat = 0; stat < 4; stat++) {
    const addr = start + stat * 2;
    if (double & (1 << stat)) state.writeBE(addr, state.readBE(addr) * 2);
  }
  for (let stat = 0; stat < 4; stat++) {
    const addr = start + stat * 2;
    if (halve & (1 << stat)) state.writeBE(addr, Math.max(1, state.readBE(addr) >> 1));
  }
}

/** Execute{Player,Enemy}Move's damage/type/random/hit chain, result adapter only.
 * calculateDamage keeps its upstream RNG order, formula and early returns.
 * core.asm:3251–3321, 5246–5355, 5658–5725; note 68 §11.7.
 */
export function executeMoveDamageChain(
  state: BattleState, attacker: BattlePokemon, defender: BattlePokemon, moveId: string, skipAccuracy = false,
): DamageResult {
  state.wDamageMultipliers = 10;
  const result = calculateDamage(attacker, defender, moveId, skipAccuracy);
  const move = getMove(moveId);
  // SetDamageEffects and HandleCounterMove bypass AdjustDamageForMoveType.
  // core.asm:3305–3321, 4718–4780, 5706–5725.
  const skipsType = move?.effect === 'SUPER_FANG_EFFECT' || move?.effect === 'SPECIAL_DAMAGE_EFFECT' || moveId === 'COUNTER';
  if (move && move.power !== 0 && !skipsType) {
    const attackTypes = getEffectiveTypes(attacker);
    const defendTypes = getEffectiveTypes(defender);
    const stab = attackTypes.type1 === move.type || attackTypes.type2 === move.type ? 0x80 : 0;
    let factor = 10;
    for (const row of getTypeChart()) {
      if (row.attacker === move.type && (row.defender === defendTypes.type1 || row.defender === defendTypes.type2)) {
        factor = row.multiplier * 10;
      }
    }
    state.wDamageMultipliers = stab | factor;
  }
  state.wDamage = result.damage;
  state.wCriticalHitOrOHKO = result.critical ? 1 : 0;
  state.wMoveMissed = result.missed || (!skipsType && result.effectiveness === 0) ? 1 : 0;
  return result;
}

export interface TrainerMoveSelection {
  enemy: BattlePokemon;
  player: BattlePokemon;
  aiModifiers: number[];
}

/** trainer_ai.asm:3–105. Scores alias wBuffer until replaced with the minimum move list. */
export function aiEnemyTrainerChooseMoves(state: BattleState, trainer: TrainerMoveSelection): number {
  if (trainer.enemy.moves.length > 4) throw new Error('enemy moves do not match wEnemyMonMoves');
  for (let slot = 0; slot < 4; slot++) {
    const move = trainer.enemy.moves[slot];
    const id = move ? getMove(move.id)?.id : 0;
    if (id !== state.mem[A.wEnemyMonMoves + slot]) throw new Error('enemy moves do not match wEnemyMonMoves');
  }
  state.setBytes(A.wBuffer, [10, 10, 10, 10], 4);
  const disabled = state.wEnemyDisabledMove >> 4;
  if (disabled !== 0) state.mem[A.wBuffer + disabled - 1] = 0x50;
  if (trainer.aiModifiers.length === 0) return A.wEnemyMonMoves;
  const scores = state.bytes(A.wBuffer, 4); // Indexed writes wrap as bytes, including upstream ++/--.
  applyTrainerMoveModifiers(scores, trainer.enemy, trainer.player, trainer.aiModifiers);
  let minimum = Infinity;
  for (let slot = 0; slot < 4; slot++) {
    if (state.mem[A.wEnemyMonMoves + slot] !== 0) minimum = Math.min(minimum, scores[slot]);
  }
  for (let slot = 0; slot < 4; slot++) {
    const move = state.mem[A.wEnemyMonMoves + slot];
    state.mem[A.wBuffer + slot] = move !== 0 && scores[slot] === minimum ? move : 0;
  }
  return A.wBuffer;
}

/** core.asm:3086–3176. Link consumes an already exchanged nybble; no serial/UI. */
export function selectEnemyMove(state: BattleState, trainer?: TrainerMoveSelection): void {
  if (state.wLinkState === LINK_STATE_BATTLING) {
    const received = state.wSerialExchangeNybbleReceiveData;
    if (received === 0x0e) state.wEnemySelectedMove = STRUGGLE;
    else if (received === 0x0d) state.wEnemySelectedMove = 0xff;
    else if (received < 4) {
      state.wEnemyMoveListIndex = received;
      state.wEnemySelectedMove = state.mem[A.wEnemyMonMoves + received];
    }
    return;
  }
  if (state.wEnemyBattleStatus2 & 0x60) return; // recharge, Rage
  if (state.wEnemyBattleStatus1 & 0x12) return; // charging, thrash
  if (state.wEnemyMonStatus & 0x27) return; // freeze, sleep
  if (state.wEnemyBattleStatus1 & 0x21) return; // trapping, Bide
  if (state.wPlayerBattleStatus1 & 0x20) {
    state.wEnemySelectedMove = 0xff;
    return;
  }
  if (state.mem[A.wEnemyMonMoves + 1] === 0 && state.wEnemyDisabledMove !== 0) {
    state.wEnemySelectedMove = STRUGGLE;
    return;
  }
  let list: number = A.wEnemyMonMoves;
  if (state.wIsInBattle !== WILD_BATTLE) {
    if (!trainer) throw new Error('trainer selection requires battle Pokemon');
    list = aiEnemyTrainerChooseMoves(state, trainer);
  }
  for (;;) {
    const roll = state.random();
    const slot = roll < 63 ? 0 : roll < 127 ? 1 : roll < 190 ? 2 : 3;
    state.wEnemyMoveListIndex = slot;
    const move = state.mem[list + slot];
    if ((state.wEnemyDisabledMove >> 4) === slot + 1) continue;
    if (move === 0) continue;
    state.wEnemySelectedMove = move;
    return;
  }
}

/** core.asm:5184–5209. Animation and ReloadMoveData belong to later slices. */
export function metronomePickMove(state: BattleState): number {
  state.wAnimationType = 0;
  for (;;) {
    const move = state.random();
    if (move === 0 || move >= STRUGGLE || move === 118) continue;
    if (state.hWhoseTurn === 0) state.wPlayerSelectedMove = move;
    else state.wEnemySelectedMove = move;
    return move;
  }
}
