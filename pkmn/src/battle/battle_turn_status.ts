// Unused status/continuation ports. pret e89ead15 core.asm:3499–3887,5859–6141.
import { A, type BattleState } from './battle_state';
import { copyMoveNameToStringBuffer, getMoveName, moveNameBinding } from './battle_move_data';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';
import { battleScreenFor } from './battle_screen';

export type BattleSide = 0 | 1;
export type StatusContinuation = 'normal'
  | 'ExecutePlayerMoveDone' | 'ExecuteEnemyMoveDone'
  | 'HandleIfPlayerMoveMissed' | 'HandleIfEnemyMoveMissed'
  | 'PlayerCalcMoveDamage' | 'EnemyCalcMoveDamage'
  | 'GetPlayerAnimationType' | 'GetEnemyAnimationType'
  | 'PlayerCanExecuteMove' | 'EnemyCanExecuteMove';

export interface StatusPorts {
  /** MoveAnimation only; CPU-only until presentation is ported. */
  animation(state: BattleState): Program;
  /** GetDamageVarsFor{Player,Enemy}Attack + CalculateDamage, no crit/type/range/hit test. */
  calculateSelfHit(state: BattleState, side: BattleSide): Program;
  applySelfHit(state: BattleState, side: BattleSide): Program;
  drawPlayerHud(state: BattleState): Program;
}

// constants/battle_constants.asm and move_constants.asm.
const BIDE = 1, THRASH = 2, FLINCHED = 8, CHARGING = 16, TRAPPING = 32, CONFUSED = 128;
const RECHARGE = 32, RAGE = 64, FLY_EFFECT = 0x2b, CHARGE_EFFECT = 0x27;
const SIDE = [
  { status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2,
    opponent1: A.wEnemyBattleStatus1, disabled: A.wPlayerDisabledMove, disabledId: A.wPlayerDisabledMoveNumber,
    confused: A.wPlayerConfusedCounter, count: A.wPlayerNumAttacksLeft, used: A.wPlayerUsedMove,
    selected: A.wPlayerSelectedMove, move: A.wPlayerMoveNum, bide: A.wPlayerNumHits,
    defense: A.wBattleMonDefense, oppositeDefense: A.wEnemyMonDefense },
  { status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2,
    opponent1: A.wPlayerBattleStatus1, disabled: A.wEnemyDisabledMove, disabledId: A.wEnemyDisabledMoveNumber,
    confused: A.wEnemyConfusedCounter, count: A.wEnemyNumAttacksLeft, used: A.wEnemyUsedMove,
    selected: A.wEnemySelectedMove, move: A.wEnemyMoveNum, bide: A.wEnemyNumHits,
    defense: A.wEnemyMonDefense, oppositeDefense: A.wBattleMonDefense },
] as const;

/** pret core.asm:6820-6825. Delay3, MoveAnimation port, then Func_78e98's 12 serviced frames. */
export function* playMoveAnimation(state: BattleState, ports: Pick<StatusPorts, 'animation'>, id: number): Program {
  state.wAnimationID = id;
  yield* delayFrames(3);
  yield* ports.animation(state);
  yield* battleScreenFor(state).refreshAfterAnimation();
}

/** core.asm:3843–3885 /5957–5997. Power/type stay changed; only effect and opposite defense restore. */
export function* handleSelfConfusionDamage(
  state: BattleState, host: BattleTurnTextHost, ports: StatusPorts, side: BattleSide,
): Program {
  yield* host.printText('HurtItselfText');
  const c = SIDE[side], m = state.mem;
  const defense = state.readBE(c.oppositeDefense), effect = m[c.move + 1];
  state.writeBE(c.oppositeDefense, state.readBE(c.defense));
  m[c.move + 1] = 0; m[c.move + 2] = 40; m[c.move + 3] = 0; state.wCriticalHitOrOHKO = 0;
  yield* ports.calculateSelfHit(state, side);
  m[c.move + 1] = effect; state.writeBE(c.oppositeDefense, defense);
  state.wAnimationType = 0; state.hWhoseTurn = side ^ 1;
  yield* playMoveAnimation(state, ports, 1); // Pound, not the originally selected move.
  if (side === 0) yield* ports.drawPlayerHud(state); // ASM's player-only redraw while whoseTurn=1.
  state.hWhoseTurn = side;
  yield* ports.applySelfHit(state, side);
}

function* cancelMultiTurn(state: BattleState, ports: StatusPorts, side: BattleSide): Program {
  const c = SIDE[side];
  state.mem[c.flags1] &= ~(BIDE | THRASH | CHARGING | TRAPPING); // INVULNERABLE survives full paralysis.
  const effect = state.mem[c.move + 1];
  if (effect === FLY_EFFECT || effect === CHARGE_EFFECT) {
    state.wAnimationType = 0;
    yield* playMoveAnimation(state, ports, 0xa7);
  }
}

function* checkStatus(
  state: BattleState, host: BattleTurnTextHost, ports: StatusPorts, side: BattleSide,
): Program<StatusContinuation> {
  const c = SIDE[side], m = state.mem;
  const done = side === 0 ? 'ExecutePlayerMoveDone' : 'ExecuteEnemyMoveDone';
  const sleep = m[c.status] & 7;
  if (sleep !== 0) {
    m[c.status] = sleep - 1;
    if (m[c.status] === 0) yield* host.printText('WokeUpText');
    else if (side === 0) {
      state.wAnimationType = 0; yield* playMoveAnimation(state, ports, 0xbc);
      yield* host.printText('FastAsleepText');
    } else {
      yield* host.printText('FastAsleepText');
      state.wAnimationType = 0; yield* playMoveAnimation(state, ports, 0xbd);
    }
    m[c.used] = 0;
    return done;
  }
  if (m[c.status] & 0x20) {
    yield* host.printText('IsFrozenText'); m[c.used] = 0; return done;
  }
  if (m[c.opponent1] & TRAPPING) { yield* host.printText('CantMoveText'); return done; }
  if (m[c.flags1] & FLINCHED) {
    m[c.flags1] &= ~FLINCHED; yield* host.printText('FlinchedText'); return done;
  }
  if (m[c.flags2] & RECHARGE) {
    m[c.flags2] &= ~RECHARGE; yield* host.printText('MustRechargeText'); return done;
  }
  if (m[c.disabled] !== 0) {
    m[c.disabled]--;
    if ((m[c.disabled] & 15) === 0) {
      m[c.disabled] = 0; m[c.disabledId] = 0; yield* host.printText('DisabledNoMoreText');
    }
  }
  if (m[c.flags1] & CONFUSED) {
    m[c.confused]--;
    if (m[c.confused] === 0) {
      m[c.flags1] &= ~CONFUSED; yield* host.printText('ConfusedNoMoreText');
    } else {
      yield* host.printText('IsConfusedText');
      state.wAnimationType = 0; yield* playMoveAnimation(state, ports, side === 0 ? 0xbe : 0xbf);
      if (state.random() >= 128) {
        m[c.flags1] &= CONFUSED;
        yield* handleSelfConfusionDamage(state, host, ports, side);
        yield* cancelMultiTurn(state, ports, side);
        return done;
      }
    }
  }
  if (m[c.disabledId] !== 0 && m[c.disabledId] === m[c.selected]) {
    m[c.flags1] &= ~CHARGING;
    state.wNamedObjectIndex = m[c.selected]; getMoveName(state);
    yield* host.printText('MoveIsDisabledText', { get nameBuffer() { return moveNameBinding(state, A.wNameBuffer); } });
    return done;
  }
  if ((m[c.status] & 0x40) && state.random() < 63) {
    yield* host.printText('FullyParalyzedText'); yield* cancelMultiTurn(state, ports, side); return done;
  }
  if (m[c.flags1] & BIDE) {
    m[c.move] = 0;
    state.writeBE(c.bide, state.readBE(c.bide) + state.wDamage);
    m[c.count]--;
    if (m[c.count] !== 0) return done;
    m[c.flags1] &= ~BIDE; yield* host.printText('UnleashedEnergyText');
    m[c.move + 2] = 1; state.wDamage = state.readBE(c.bide) * 2;
    if (state.wDamage === 0) state.wMoveMissed = 1;
    state.writeBE(c.bide, 0); m[c.move] = 117;
    if (side === 1) {
      const level = state.wBattleMonLevel; state.wBattleMonLevel = state.wEnemyMonLevel; state.wEnemyMonLevel = level;
    }
    return side === 0 ? 'HandleIfPlayerMoveMissed' : 'HandleIfEnemyMoveMissed';
  }
  if (m[c.flags1] & THRASH) {
    m[c.move] = 37; yield* host.printText('ThrashingAboutText'); m[c.count]--;
    if (m[c.count] === 0) {
      m[c.flags1] = (m[c.flags1] & ~THRASH) | CONFUSED;
      m[c.confused] = (state.random() & 3) + 2;
    }
    return side === 0 ? 'PlayerCalcMoveDamage' : 'EnemyCalcMoveDamage';
  }
  if (m[c.flags1] & TRAPPING) {
    yield* host.printText('AttackContinuesText'); m[c.count]--;
    return side === 0 ? 'GetPlayerAnimationType' : 'GetEnemyAnimationType';
  }
  if (m[c.flags2] & RAGE) {
    state.wNamedObjectIndex = 99; getMoveName(state); copyMoveNameToStringBuffer(state); m[c.move + 1] = 0;
    return side === 0 ? 'PlayerCanExecuteMove' : 'EnemyCanExecuteMove';
  }
  return 'normal';
}

export function checkPlayerStatusConditions(state: BattleState, host: BattleTurnTextHost, ports: StatusPorts): Program<StatusContinuation> {
  return checkStatus(state, host, ports, 0);
}
export function checkEnemyStatusConditions(state: BattleState, host: BattleTurnTextHost, ports: StatusPorts): Program<StatusContinuation> {
  return checkStatus(state, host, ports, 1);
}
