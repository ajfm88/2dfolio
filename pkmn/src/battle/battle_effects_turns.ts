// Unused turn effects. pret e89ead15 engine/battle/effects.asm and move_effects, cited below.
import { A, type BattleState } from './battle_state';
import { battleRandom } from './battle_random';
import { divide } from './battle_arithmetic';
import { readPlayerMonCurHPAndStatus } from './battle_loaders';
import { clearHyperBeam, playBattleAnimation, playBattleAnimation2, printButItFailedText,
  conditionalPrintButItFailed, printDidntAffectText, type MoveEffectRegistry } from './battle_effects';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';
import type { ExecutePresentation } from './battle_execute_helpers';
import type { TextAsmHandler } from '../text/text_runner';

export interface TurnEffectEnvironment extends Pick<ExecutePresentation, 'animation' | 'hideSubstitute' | 'reshowSubstitute'> {
  host: BattleTurnTextHost;
}

/** pret effects.asm:186-193,800-809,961-970: acting-side addresses; Bide overlaps NumHits. */
function user(state: BattleState) {
  return state.hWhoseTurn === 0
    ? { hp: A.wBattleMonHP, status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1,
      flags2: A.wPlayerBattleStatus2, move: A.wPlayerMoveNum, effect: A.wPlayerMoveEffect,
      count: A.wPlayerNumAttacksLeft, hits: A.wPlayerNumHits }
    : { hp: A.wEnemyMonHP, status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1,
      flags2: A.wEnemyBattleStatus2, move: A.wEnemyMoveNum, effect: A.wEnemyMoveEffect,
      count: A.wEnemyNumAttacksLeft, hits: A.wEnemyNumHits };
}

/** pret effects.asm:185-202: clear user HP/status/SEEDED, preserving the byte between HP and status. */
export function* explodeEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  const u = user(state);
  state.writeBE(u.hp, 0); state.mem[u.status] = 0; state.mem[u.flags2] &= ~0x80;
}

/** pret engine/math/bcd.asm:169-190: three ADC/DAA bytes from the end, saturate all bytes on carry. */
function addPayDayBcd(state: BattleState): void {
  let carry = 0;
  for (let i = 2; i >= 0; i--) {
    const a = state.mem[A.wTotalPayDayMoney + i], b = state.mem[A.wPayDayMoney + i];
    const sum = a + b + carry, halfCarry = (a & 15) + (b & 15) + carry > 15;
    carry = sum > 0x99 ? 1 : 0;
    const correction = (carry ? 0x60 : 0) | (halfCarry || (sum & 15) > 9 ? 6 : 0);
    state.mem[A.wTotalPayDayMoney + i] = (sum + correction) & 255;
  }
  if (carry !== 0) state.mem.fill(0x99, A.wTotalPayDayMoney, A.wTotalPayDayMoney + 3);
}

/** pret move_effects/pay_day.asm:1-45: ADD A wraps at eight bits, Divide converts to three BCD bytes. */
export function* payDayEffect(state: BattleState, env: TurnEffectEnvironment): Program {
  const level = state.hWhoseTurn === 0 ? state.wBattleMonLevel : state.wEnemyMonLevel;
  const h = new Uint8Array(10); h[3] = (level * 2) & 255;
  state.mem[A.wPayDayMoney] = 0;
  h[4] = 100; divide(h, 4); state.mem[A.wPayDayMoney + 1] = h[3];
  h[3] = h[4]; h[4] = 10; divide(h, 4);
  state.mem[A.wPayDayMoney + 2] = (h[3] << 4) + h[4];
  addPayDayBcd(state);
  yield* env.host.printText('CoinsScatteredText');
}

/** pret effects.asm:800-825: clear both effects before duration RNG; reset both accumulator bytes. */
export function* bideEffect(state: BattleState, env: TurnEffectEnvironment): Program {
  const u = user(state);
  state.mem[u.flags1] |= 1;
  state.writeBE(u.hits, 0);
  state.wPlayerMoveEffect = 0; state.wEnemyMoveEffect = 0;
  state.mem[u.count] = (battleRandom(state) & 1) + 2;
  yield* playBattleAnimation2(state, env, 0xae + state.hWhoseTurn);
}

/** pret effects.asm:827-844: reroll even when already thrashing, then side-specific helper2 animation. */
export function* thrashPetalDanceEffect(state: BattleState, env: TurnEffectEnvironment): Program {
  const u = user(state);
  state.mem[u.flags1] |= 2;
  state.mem[u.count] = (battleRandom(state) & 1) + 2;
  yield* playBattleAnimation2(state, env, 0xb0 + state.hWhoseTurn);
}

/** pret effects.asm:846-947: trainer printer asymmetry, wild rejection samples and player-roster sync. */
export function* switchAndTeleportEffect(state: BattleState, env: TurnEffectEnvironment): Program {
  const player = state.hWhoseTurn === 0, move = state.mem[user(state).move];
  if (state.wIsInBattle !== 1) {
    yield* delayFrames(50);
    if (move !== 100) yield* env.host.printText('IsUnaffectedText');
    else if (player) yield* printButItFailedText(env.host);
    else yield* conditionalPrintButItFailed(state, env.host);
    return;
  }
  const ownLevel = player ? state.wBattleMonLevel : state.wCurEnemyLevel;
  const targetLevel = player ? state.wCurEnemyLevel : state.wBattleMonLevel;
  if (ownLevel < targetLevel) {
    const limit = (ownLevel + targetLevel + 1) & 255;
    let roll: number;
    do { roll = battleRandom(state); } while (roll >= limit);
    if (roll < (targetLevel >> 2)) {
      yield* delayFrames(50);
      if (move === 100) yield* printButItFailedText(env.host);
      else yield* printDidntAffectText(env.host);
      return;
    }
  }
  readPlayerMonCurHPAndStatus(state);
  state.wAnimationType = 0; state.wEscapedFromBattle = 1;
  yield* playBattleAnimation(state, env, move);
  yield* delayFrames(20);
  yield* env.host.printText(move === 100 ? 'RanFromBattleText' : move === 46 ? 'RanAwayScaredText' : 'WasBlownAwayText');
}

/** pret effects.asm:961-1005: active gate first, Twineedle rewrites its effect, conditional second draw. */
export function* twoToFiveAttacksEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  const u = user(state), m = state.mem;
  if ((m[u.flags1] & 4) !== 0) return;
  m[u.flags1] |= 4;
  const id = m[u.effect]; let count = 2;
  if (id === 0x4d) m[u.effect] = 2;
  else if (id !== 0x2c) {
    count = battleRandom(state) & 3;
    if (count >= 2) count = battleRandom(state) & 3;
    count += 2;
  }
  m[u.count] = count; m[u.hits] = count;
}

/** pret move_effects/one_hit_ko.asm:1-38: full-word speed compare, tie succeeds, slow keeps FF sentinel. */
export function* oneHitKOEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  state.wDamage = 0; state.wCriticalHitOrOHKO = 0xff;
  const own = state.hWhoseTurn === 0 ? state.wBattleMonSpeed : state.wEnemyMonSpeed;
  const target = state.hWhoseTurn === 0 ? state.wEnemyMonSpeed : state.wBattleMonSpeed;
  if (own >= target) { state.wDamage = 0xffff; state.wCriticalHitOrOHKO = 2; }
  else state.wMoveMissed = 1;
}

/** pret effects.asm:1088-1110: live ChargeMoveNum; final LD HL gives every unmatched move Dig's suffix. */
export function chargeMoveEffectText(state: BattleState): TextAsmHandler {
  return () => {
    switch (state.wChargeMoveNum) {
      case 13: return 'MadeWhirlwindText';
      case 76: return 'TookInSunlightText';
      case 130: return 'LoweredItsHeadText';
      case 143: return 'SkyAttackGlowingText';
      case 19: return 'FlewUpHighText';
      default: return 'DugAHoleText';
    }
  };
}

/** pret effects.asm:1037-1086: Fly effect, then Dig number override; user-doll ports around type0 animation. */
export function* chargeEffect(state: BattleState, env: TurnEffectEnvironment): Program {
  const u = user(state), m = state.mem;
  m[u.flags1] |= 0x10;
  let animation = state.hWhoseTurn === 0 ? 0xae : 0xaf;
  if (m[u.effect] === 0x2b) { m[u.flags1] |= 0x40; animation = 100; }
  if (m[u.move] === 91) { m[u.flags1] |= 0x40; animation = 0xc0; }
  if ((m[u.flags2] & 0x10) !== 0) yield* env.hideSubstitute(state);
  state.wAnimationType = 0;
  yield* playBattleAnimation(state, env, animation);
  if ((m[u.flags2] & 0x10) !== 0) yield* env.reshowSubstitute(state);
  state.wChargeMoveNum = m[u.move];
  yield* env.host.printText('ChargeMoveEffectText', undefined, { asm: { ChargeMoveEffectText: chargeMoveEffectText(state) } });
}

/** pret effects.asm:1136-1159: clear target recharge before flag/RNG, one or two draws, duration1-4. */
export function* trappingEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  const u = user(state), m = state.mem;
  if ((m[u.flags1] & 0x20) !== 0) return;
  clearHyperBeam(state);
  m[u.flags1] |= 0x20;
  let count = battleRandom(state) & 3;
  if (count >= 2) count = battleRandom(state) & 3;
  m[u.count] = count + 1;
}

/** pret effects.asm:1227-1235: user recharge only, with no extra gate. */
export function* hyperBeamEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  state.mem[user(state).flags2] |= 0x20;
}
/** pret effects.asm:1249-1257: user USING_RAGE only; subsequent boosts are HandleBuildingRage's work. */
export function* rageEffect(state: BattleState, _env: TurnEffectEnvironment): Program {
  state.mem[user(state).flags2] |= 0x40;
}

/** pret data/moves/effects_pointers.asm:10,19,29-33,41-47,80,83-84: wrapper labels, not far labels. */
export function turnEffectHandlers(env: TurnEffectEnvironment): MoveEffectRegistry {
  return {
    ExplodeEffect: state => explodeEffect(state, env), PayDayEffect: state => payDayEffect(state, env),
    BideEffect: state => bideEffect(state, env), ThrashPetalDanceEffect: state => thrashPetalDanceEffect(state, env),
    SwitchAndTeleportEffect: state => switchAndTeleportEffect(state, env),
    TwoToFiveAttacksEffect: state => twoToFiveAttacksEffect(state, env), OneHitKOEffect: state => oneHitKOEffect(state, env),
    ChargeEffect: state => chargeEffect(state, env), TrappingEffect: state => trappingEffect(state, env),
    HyperBeamEffect: state => hyperBeamEffect(state, env), RageEffect: state => rageEffect(state, env),
  };
}
