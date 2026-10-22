// Unused execution helpers. pret e89ead15 core.asm:3452–3497,5084–5210,6370–6379,6787–6823.
import { A, isGhostBattle, type BattleState } from './battle_state';
import { reloadMoveData } from './battle_move_data';
import { metronomePickMove } from './battle_math';
import { playMoveAnimation } from './battle_turn_status';
import type { Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';

export interface ExecutePresentation {
  animation(state: BattleState): Program;
  statModifierUpEffect(state: BattleState): Program;
  hideSubstitute(state: BattleState): Program;
  reshowSubstitute(state: BattleState): Program;
}

// Exact ROM byte arrays. SpecialEffects falls through into Cont before the single FF.
const CONT = [0x1b, 0x2a, 0xff] as const;
export const EXECUTE_EFFECTS = {
  residual1: [0x18, 0x19, 0x1c, 0x2e, 0x2f, 0x31, 0x38, 0x39, 0x40, 0x41, 0x42, 0x43, 0x4f, 0x52, 0x54, 0x55, 0xff],
  residual2: [0x01, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x1a, 0x20,
    0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0xff],
  setDamage: [0x28, 0x29, 0xff],
  always: [0x03, 0x07, 0x08, 0x10, 0x1d, 0x1e, 0x2c, 0x30, 0x4d, 0x51, 0xff],
  special: [0x03, 0x07, 0x08, 0x10, 0x11, 0x1d, 0x1e, 0x27, 0x28, 0x29, 0x2b, 0x2c, 0x2d, 0x30, ...CONT],
  cont: CONT,
} as const;

export function isInEffectArray(effect: number, bytes: readonly number[]): boolean {
  for (const byte of bytes) {
    if (byte === 0xff) return false;
    if (byte === effect) return true;
  }
  return false;
}

export function swapPlayerAndEnemyLevels(state: BattleState): void {
  const level = state.wBattleMonLevel;
  state.wBattleMonLevel = state.wEnemyMonLevel;
  state.wEnemyMonLevel = level;
}

/** True is the Z exit after ghost text; bag lookup remains isGhostBattle's inventory API. */
export function* printGhostText(state: BattleState, host: BattleTurnTextHost): Program<boolean> {
  if (!isGhostBattle(state)) return false;
  if (state.hWhoseTurn === 0) {
    if ((state.wBattleMonStatus & 0x27) !== 0) return false;
    yield* host.printText('ScaredText');
  } else yield* host.printText('GetOutText');
  return true;
}

export function* handleExplodingAnimation(state: BattleState, ports: ExecutePresentation): Program {
  const player = state.hWhoseTurn === 0;
  const move = player ? state.wPlayerMoveNum : state.wEnemyMoveNum;
  if (move !== 120 && move !== 153) return;
  // The cartridge tests enemy status1 on BOTH turns, including the enemy's own INVULNERABLE bug.
  if ((state.wEnemyBattleStatus1 & 0x40) !== 0) return;
  const type1 = player ? state.wEnemyMonType1 : state.wBattleMonType1;
  const type2 = player ? state.wEnemyMonType2 : state.wBattleMonType2;
  if (type1 === 8 || type2 === 8 || state.wMoveMissed !== 0) return;
  state.wAnimationType = 5;
  yield* playMoveAnimation(state, ports, 5); // MEGA_PUNCH == horizontal light shake.
}

export function* handleBuildingRage(
  state: BattleState, host: BattleTurnTextHost, ports: ExecutePresentation,
): Program {
  const player = state.hWhoseTurn === 0;
  const status = player ? state.wEnemyBattleStatus2 : state.wPlayerBattleStatus2;
  if ((status & 0x40) === 0) return;
  const mods = player ? A.wEnemyMonStatMods : A.wPlayerMonStatMods;
  if (state.mem[mods] === 13) return;
  const move = player ? A.wEnemyMoveNum : A.wPlayerMoveNum;
  state.hWhoseTurn ^= 1;
  state.mem[move] = 0; state.mem[move + 1] = 0x0a;
  yield* host.printText('BuildingRageText');
  yield* ports.statModifierUpEffect(state);
  state.mem[move + 1] = 0; state.mem[move] = 99;
  state.hWhoseTurn ^= 1;
}

/** Mirror writes selected even when zero/Mirror fails; ReloadMoveData owns PP compensation. */
export function* mirrorMoveCopyMove(state: BattleState, host: BattleTurnTextHost): Program<boolean> {
  const player = state.hWhoseTurn === 0;
  const move = player ? state.wEnemyUsedMove : state.wPlayerUsedMove;
  if (player) state.wPlayerSelectedMove = move; else state.wEnemySelectedMove = move;
  if (move === 0 || move === 119) {
    yield* host.printText('MirrorMoveFailedText'); return false;
  }
  reloadMoveData(state, move);
  return true;
}

export function* executeMetronome(state: BattleState, ports: ExecutePresentation): Program {
  state.wAnimationType = 0;
  yield* playMoveAnimation(state, ports, 118);
  reloadMoveData(state, metronomePickMove(state));
}
