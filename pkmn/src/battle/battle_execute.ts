// Unused ExecutePlayerMove / ExecuteEnemyMove. pret e89ead15 core.asm:3244–3450,5639–5856.
import { A, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { getCurrentMove, getName, copyMoveNameToStringBuffer } from './battle_move_data';
import { decrementPP } from './battle_loaders';
import { displayUsedMoveText, type BattleTurnTextHost } from './battle_turn_text';
import { checkPlayerStatusConditions, checkEnemyStatusConditions, playMoveAnimation,
  type StatusPorts, type StatusContinuation } from './battle_turn_status';
import { checkForDisobedience } from './battle_obedience';
import { criticalHitTest, getDamageVarsForPlayerAttack, getDamageVarsForEnemyAttack, calculateDamage,
  adjustDamageForMoveType, randomizeDamage } from './battle_damage_asm';
import { moveHitTest, handleCounterMove } from './battle_hit';
import { applyAttackToEnemyPokemon, applyAttackToPlayerPokemon, applyDamageToEnemyPokemon, applyDamageToPlayerPokemon,
  printMoveFailureText, printCriticalOHKOText, displayEffectiveness, type ApplyPorts } from './battle_apply';
import { drawPlayerHud, drawEnemyHud } from './battle_hud_state';
import type { BattleScreen } from './battle_screen';
import { delayFrames, type Program } from './battle_menu_context';
import { EXECUTE_EFFECTS, isInEffectArray, swapPlayerAndEnemyLevels, printGhostText, handleExplodingAnimation,
  handleBuildingRage, mirrorMoveCopyMove, executeMetronome, type ExecutePresentation } from './battle_execute_helpers';

export interface ExecuteResult { b: number; exit: 'done' | 'fainted' | 'effect' | 'link' }
export interface ExecutePorts extends ExecutePresentation, ApplyPorts {
  jumpMoveEffect(state: BattleState, effect: number, mode: 'call' | 'tail'): Program<number>;
}
type Entry = 'normal' | 'charge' | 'announce' | 'calc' | 'miss' | 'animation';

/** Status/self-confusion reuse the checked numeric and application routines, without extra RNG. */
function statusPorts(state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ExecutePorts): StatusPorts {
  return {
    animation: ports.animation,
    calculateSelfHit: function* (s, side) {
      const v = side === 0 ? getDamageVarsForPlayerAttack(s) : getDamageVarsForEnemyAttack(s);
      yield* calculateDamage(s, v.attack, v.defense, v.power, v.level);
    },
    applySelfHit: (s, side) => side === 0 ? applyDamageToPlayerPokemon(s, screen, host, ports)
      : applyDamageToEnemyPokemon(s, screen, host, ports),
    drawPlayerHud: () => drawPlayerHud(state, screen),
  };
}

function continuationEntry(continuation: StatusContinuation): Entry | 'done' {
  switch (continuation) {
    case 'normal': return 'normal';
    case 'ExecutePlayerMoveDone': case 'ExecuteEnemyMoveDone': return 'done';
    case 'HandleIfPlayerMoveMissed': case 'HandleIfEnemyMoveMissed': return 'miss';
    case 'PlayerCalcMoveDamage': case 'EnemyCalcMoveDamage': return 'calc';
    case 'GetPlayerAnimationType': case 'GetEnemyAnimationType': return 'animation';
    case 'PlayerCanExecuteMove': case 'EnemyCanExecuteMove': return 'announce';
  }
}

function* executeMove(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ExecutePorts, player: boolean,
): Program<ExecuteResult> {
  if (player) state.hWhoseTurn = 0; // Enemy caller owns hWhoseTurn, just as MainInBattleLoop does.
  const selected = player ? A.wPlayerSelectedMove : A.wEnemySelectedMove;
  const move = player ? A.wPlayerMoveNum : A.wEnemyMoveNum;
  const flags1 = player ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1;
  const flags2 = player ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
  const count = player ? A.wPlayerNumAttacksLeft : A.wEnemyNumAttacksLeft;
  const hits = player ? A.wPlayerNumHits : A.wEnemyNumHits;
  const effect = () => state.mem[move + 1];
  const done = (): ExecuteResult => {
    if (player) state.wActionResultOrTookBattleTurn = 0;
    return { b: 1, exit: 'done' };
  };
  const tailEffect = function* (): Program<ExecuteResult> {
    const b = yield* ports.jumpMoveEffect(state, effect(), 'tail');
    return { b: b & 0xff, exit: 'effect' };
  };
  if (state.mem[selected] === 0xff) return done();
  if (player) {
    state.wMoveMissed = 0; state.wMonIsDisobedient = 0; state.wMoveDidntMiss = 0;
    state.wDamageMultipliers = 0x0a;
    if (state.wActionResultOrTookBattleTurn !== 0) return done();
  }
  if (yield* printGhostText(state, host)) return done();
  if (!player) {
    if (state.wLinkState === LINK_STATE_BATTLING) {
      const received = state.wSerialExchangeNybbleReceiveData;
      if (received !== 0x0e && received >= 4) return { b: 1, exit: 'link' };
    }
    state.wAILayer2Encouragement++;
    state.wMoveMissed = 0; state.wMoveDidntMiss = 0; state.wDamageMultipliers = 0x0a;
  }
  const status = statusPorts(state, screen, host, ports);
  let entry = continuationEntry(yield* (player ? checkPlayerStatusConditions(state, host, status)
    : checkEnemyStatusConditions(state, host, status)));
  if (entry === 'done') return done();
  if (entry === 'normal') {
    if (player) getCurrentMove(state);
    if ((state.mem[flags1] & 0x10) !== 0) {
      state.mem[flags1] &= ~(0x10 | 0x40);
      if (!player) {
        state.wNameListIndex = state.mem[move];
        state.wPredefBank = 0x2f; // BANK(MoveNames)
        state.wNameListType = 2; // MOVE_NAME
        getName(state); copyMoveNameToStringBuffer(state);
      }
      entry = 'announce';
    } else {
      if (!player) getCurrentMove(state);
      if (player && (yield* checkForDisobedience(state, host, status)) === 'cannotUseMove') return done();
      entry = 'charge';
    }
  }
  for (;;) {
    if (entry === 'charge') {
      if (effect() === 0x27 || effect() === 0x2b) return yield* tailEffect();
      entry = 'announce';
    }
    if (entry === 'announce') {
      if (!player) state.wMonIsDisobedient = 0;
      yield* displayUsedMoveText(state, host);
      if (player) decrementPP(state, state.mem[selected]);
      if (isInEffectArray(effect(), EXECUTE_EFFECTS.residual1)) return yield* tailEffect();
      if (isInEffectArray(effect(), EXECUTE_EFFECTS.cont)) yield* ports.jumpMoveEffect(state, effect(), 'call');
      entry = 'calc';
    }
    let calculationZero = false;
    let explosionMiss = false;
    if (entry === 'calc') {
      if (!player) swapPlayerAndEnemyLevels(state);
      if (isInEffectArray(effect(), EXECUTE_EFFECTS.setDamage)) moveHitTest(state);
      else {
        criticalHitTest(state);
        if (!handleCounterMove(state).z) {
          if (!player) swapPlayerAndEnemyLevels(state);
          const vars = player ? getDamageVarsForPlayerAttack(state) : getDamageVarsForEnemyAttack(state);
          if (!player) swapPlayerAndEnemyLevels(state);
          const flags = yield* calculateDamage(state, vars.attack, vars.defense, vars.power, vars.level,
            function* (s) { yield* ports.jumpMoveEffect(s, effect(), 'call'); });
          calculationZero = flags.z;
          if (!calculationZero) {
            adjustDamageForMoveType(state); randomizeDamage(state); moveHitTest(state);
          }
        }
      }
      entry = 'miss';
    }
    if (entry === 'miss') {
      if (calculationZero || (state.wMoveMissed !== 0 && effect() !== 0x07)) {
        if (!player) swapPlayerAndEnemyLevels(state);
        yield* delayFrames(30);
        if (effect() === 0x2b || effect() === 0x27) {
          state.wAnimationType = 0;
          yield* playMoveAnimation(state, ports, 0xa7);
        }
        // Skip the move-animation block, continuing at MirrorMoveCheck below.
      } else {
        explosionMiss = state.wMoveMissed !== 0;
        if (!player) swapPlayerAndEnemyLevels(state);
        entry = 'animation';
      }
    }
    if (entry === 'animation') {
      const type = explosionMiss ? 0 : effect() === 0 ? (player ? 4 : 1) : (player ? 5 : 2);
      if ((state.mem[flags2] & 0x10) !== 0) yield* ports.hideSubstitute(state);
      state.wAnimationType = type;
      yield* playMoveAnimation(state, ports, state.mem[move]);
      yield* handleExplodingAnimation(state, ports);
      yield* (player ? drawPlayerHud(state, screen) : drawEnemyHud(state, screen));
      if ((state.mem[flags2] & 0x10) !== 0) yield* ports.reshowSubstitute(state);
    }
    if (effect() === 0x09) {
      if (!(yield* mirrorMoveCopyMove(state, host))) return done();
      if (player) state.wMonIsDisobedient = 0;
      entry = 'charge'; continue;
    }
    if (effect() === 0x53) {
      yield* executeMetronome(state, ports);
      entry = 'charge'; continue;
    }
    if (isInEffectArray(effect(), EXECUTE_EFFECTS.residual2)) return yield* tailEffect();
    if (state.wMoveMissed !== 0) {
      yield* printMoveFailureText(state, screen, host, ports);
      if (effect() !== 0x07) return done();
    } else {
      yield* (player ? applyAttackToEnemyPokemon(state, screen, host, ports)
        : applyAttackToPlayerPokemon(state, screen, host, ports));
      yield* printCriticalOHKOText(state, host);
      yield* displayEffectiveness(state, host);
      state.wMoveDidntMiss = 1;
    }
    if (isInEffectArray(effect(), EXECUTE_EFFECTS.always)) yield* ports.jumpMoveEffect(state, effect(), 'call');
    if ((player ? state.wEnemyMonHP : state.wBattleMonHP) === 0) return { b: 0, exit: 'fainted' };
    yield* handleBuildingRage(state, host, ports);
    if ((state.mem[flags1] & 4) !== 0) {
      state.mem[count]--;
      if (state.mem[count] !== 0) { entry = 'animation'; continue; }
      state.mem[flags1] &= ~4;
      yield* host.printText(player ? 'MultiHitText' : 'HitXTimesText');
      state.mem[hits] = 0;
    }
    if (effect() !== 0 && !isInEffectArray(effect(), EXECUTE_EFFECTS.special)) {
      yield* ports.jumpMoveEffect(state, effect(), 'call');
    }
    return done();
  }
}

export function executePlayerMove(state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ExecutePorts): Program<ExecuteResult> {
  return executeMove(state, screen, host, ports, true);
}
export function executeEnemyMove(state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ExecutePorts): Program<ExecuteResult> {
  return executeMove(state, screen, host, ports, false);
}
