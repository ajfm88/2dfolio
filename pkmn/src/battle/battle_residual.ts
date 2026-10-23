// Unused residual damage / trapping cleanup. pret e89ead15 core.asm:479–705.
import { A, type BattleState } from './battle_state';
import { updateCurMonHPBar, writeHpBarWord } from './battle_hp';
import { playMoveAnimation } from './battle_turn_status';
import type { BattleScreen } from './battle_screen';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';

export interface ResidualPorts {
  /** CPU-only animation interior by default; test fakes declare any owned frames. */
  animation(state: BattleState): Program;
  drawHuds(state: BattleState): Program;
}
export interface ResidualFlags { zero: boolean }

/** BC remains the computed damage, even when the HP loss saturates (core.asm:555–624). */
export function* decreaseOwnHP(state: BattleState, screen: BattleScreen): Program<number> {
  const player = state.hWhoseTurn === 0;
  const hp = player ? A.wBattleMonHP : A.wEnemyMonHP;
  const max = state.readBE(hp + 14), old = state.readBE(hp);
  // The ASM relies on legal max HP <1024 (the last two shifts affect C only).
  let bc = Math.max(1, Math.floor(max / 16));
  const status = player ? state.wPlayerBattleStatus3 : state.wEnemyBattleStatus3;
  if (status & 1) {
    const counter = player ? A.wPlayerToxicCounter : A.wEnemyToxicCounter;
    state.mem[counter]++;
    bc = (bc * (state.mem[counter] || 256)) & 0xffff;
  }
  const next = Math.max(0, old - bc);
  state.writeBE(hp, next);
  writeHpBarWord(state, A.wHPBarMaxHP, max);
  writeHpBarWord(state, A.wHPBarOldHP, old);
  writeHpBarWord(state, A.wHPBarNewHP, next);
  yield* updateCurMonHPBar(state, screen);
  return bc;
}

/** Uses full BC, not HP lost; temporarily inverted turn addresses the healed opponent's bar. */
export function* increaseEnemyHP(state: BattleState, screen: BattleScreen, bc: number): Program {
  const hp = state.hWhoseTurn === 0 ? A.wEnemyMonHP : A.wBattleMonHP;
  const max = state.readBE(hp + 14), old = state.readBE(hp);
  const next = Math.min(max, (old + bc) & 0xffff);
  state.writeBE(hp, next);
  writeHpBarWord(state, A.wHPBarMaxHP, max);
  writeHpBarWord(state, A.wHPBarOldHP, old);
  writeHpBarWord(state, A.wHPBarNewHP, next);
  state.hWhoseTurn ^= 1;
  yield* updateCurMonHPBar(state, screen);
  state.hWhoseTurn ^= 1;
}

/** pret core.asm:479-691; note 69 section 10.4 item 0: bind before any residual presentation. */
export function* handlePoisonBurnLeechSeed(
  state: BattleState, screen: BattleScreen, host: BattleTurnTextHost, ports: ResidualPorts,
): Program<ResidualFlags> {
  bindEntryBattleScreen(state, screen);
  const player = state.hWhoseTurn === 0;
  const status = player ? state.wBattleMonStatus : state.wEnemyMonStatus;
  if (status & 0x18) {
    yield* host.printText(status & 0x10 ? 'HurtByBurnText' : 'HurtByPoisonText');
    state.wAnimationType = 0;
    yield* playMoveAnimation(state, ports, 0xba);
    yield* decreaseOwnHP(state, screen);
  }
  const status2 = player ? state.wPlayerBattleStatus2 : state.wEnemyBattleStatus2;
  if (status2 & 0x80) {
    state.hWhoseTurn ^= 1; state.wAnimationType = 0;
    yield* playMoveAnimation(state, ports, 71); // ABSORB, from the opposing mon.
    state.hWhoseTurn ^= 1;
    const bc = yield* decreaseOwnHP(state, screen);
    yield* increaseEnemyHP(state, screen, bc);
    yield* host.printText('HurtByLeechSeedText');
  }
  if ((player ? state.wBattleMonHP : state.wEnemyMonHP) !== 0) return { zero: false };
  yield* ports.drawHuds(state);
  yield* delayFrames(20);
  return { zero: true };
}

export function checkNumAttacksLeft(state: BattleState): void {
  if (state.wPlayerNumAttacksLeft === 0) state.wPlayerBattleStatus1 &= ~0x20;
  if (state.wEnemyNumAttacksLeft === 0) state.wEnemyBattleStatus1 &= ~0x20;
}
