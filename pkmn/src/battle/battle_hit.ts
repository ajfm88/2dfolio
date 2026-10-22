// Unused hit / Counter routines. pret e89ead15 core.asm:4718–4780,5410–5600.
import { A, type BattleState } from './battle_state';
import { battleRandom } from './battle_random';
import { STAT_MODIFIER_RATIOS } from './battle_math';
import { multiply, divide } from './battle_arithmetic';
import { BattleUnsupportedState } from './battle_move_data';

/** Z and C at RET, including the turn-dependent AND on the ordinary miss path. */
export interface HitFlags { z: boolean; carry: boolean }

/** Both stages use the same HRAM union. The second Multiply sees the first quotient at +1..3. */
export function calcHitChance(state: BattleState): void {
  const player = state.hWhoseTurn === 0;
  const accuracy = player ? A.wPlayerMoveAccuracy : A.wEnemyMoveAccuracy;
  const mods = [state.mem[player ? A.wPlayerMonAccuracyMod : A.wEnemyMonAccuracyMod],
    (14 - state.mem[player ? A.wEnemyMonEvasionMod : A.wPlayerMonEvasionMod]) & 0xff];
  const h = new Uint8Array(10);
  h[3] = state.mem[accuracy];
  for (const mod of mods) {
    const offset = ((mod - 1) << 1) & 0xff;
    // Same pinned ROM read as calculateModifiedStat when DEC B wraps from 0.
    const ratio = offset === 0xfe ? [0xea, 0x77] : STAT_MODIFIER_RATIOS[offset >> 1];
    if (!ratio) throw new BattleUnsupportedState(`hit ratio offset ${offset}`);
    h[4] = ratio[0];
    multiply(h);
    h[4] = ratio[1];
    divide(h, 4);
    if ((h[2] | h[3]) === 0) { h[2] = 0; h[3] = 1; }
  }
  state.mem[accuracy] = h[2] !== 0 ? 0xff : h[3];
}

export function moveHitTest(state: BattleState): HitFlags {
  const player = state.hWhoseTurn === 0;
  const effect = player ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
  const targetStatus = player ? state.wEnemyMonStatus : state.wBattleMonStatus;
  const miss = (): HitFlags => {
    state.wDamage = 0;
    state.wMoveMissed = 1;
    if (player) state.wPlayerBattleStatus1 &= ~0x20;
    else state.wEnemyBattleStatus1 &= ~0x20;
    return { z: player, carry: false };
  };
  if (effect === 0x08 && (targetStatus & 7) === 0) return miss();
  if (effect === 0x11) return { z: true, carry: false };
  // CheckTargetSubstitute (effects.asm:1492) leaves A = hWhoseTurn, not the effect.
  // Its drain / Dream Eater comparisons therefore cannot match on either legal turn.
  const target1 = player ? state.wEnemyBattleStatus1 : state.wPlayerBattleStatus1;
  if ((target1 & 0x40) !== 0) return miss();
  const target2 = player ? state.wEnemyBattleStatus2 : state.wPlayerBattleStatus2;
  // Track the last CP carry for the X Accuracy BIT / RET NZ path.
  let carry = effect < 0x12;
  let mistEffect = false;
  if (!carry) {
    carry = effect < 0x1a;
    if (carry) mistEffect = true;
    else {
      carry = effect < 0x3a;
      if (!carry) { carry = effect < 0x42; mistEffect = carry; }
    }
  }
  if (mistEffect && (target2 & 2) !== 0) return miss();
  const attacker2 = player ? state.wPlayerBattleStatus2 : state.wEnemyBattleStatus2;
  if ((attacker2 & 1) !== 0) return { z: false, carry };
  calcHitChance(state);
  const accuracy = player ? state.wPlayerMoveAccuracy : state.wEnemyMoveAccuracy;
  const draw = battleRandom(state);
  if (draw >= accuracy) return miss();
  return { z: false, carry: true };
}

export function handleCounterMove(state: BattleState): HitFlags {
  const player = state.hWhoseTurn === 0;
  const selected = player ? state.wPlayerSelectedMove : state.wEnemySelectedMove;
  if (selected !== 68) return { z: false, carry: selected < 68 };
  state.wMoveMissed = 1;
  const opponent = player ? state.wEnemySelectedMove : state.wPlayerSelectedMove;
  if (opponent === 68) return { z: true, carry: false };
  const power = player ? state.wEnemyMovePower : state.wPlayerMovePower;
  if (power === 0) return { z: true, carry: false };
  const type = player ? state.wEnemyMoveType : state.wPlayerMoveType;
  if (type !== 0 && type !== 1) return { z: true, carry: false };
  if (state.wDamage === 0) return { z: true, carry: false };
  state.wDamage = Math.min(0xffff, state.wDamage * 2);
  state.wMoveMissed = 0;
  moveHitTest(state);
  return { z: true, carry: false };
}
