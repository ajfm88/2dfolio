// Unused MainInBattleLoop. pret e89ead15 engine/battle/core.asm:289–475.
import { A, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { displayBattleMenu } from './battle_menu';
import { moveSelectionMenu } from './move_selection_menu';
import { selectEnemyMove, type TrainerMoveSelection } from './battle_math';
import { battleRandom } from './battle_random';
import { readPlayerMonCurHPAndStatus } from './battle_loaders';
import { handlePoisonBurnLeechSeed, checkNumAttacksLeft } from './battle_residual';
import { drawHuds, hudContext } from './battle_hud_state';
import { executePlayerMove, executeEnemyMove, type ExecutePorts } from './battle_execute';
import type { BattleActionContext, BattleActionHost, MoveMenuHost, Program } from './battle_menu_context';
import type { TextBindings, TextRunnerOptions } from '../text/text_runner';

export type TurnExit = 'ran' | 'escaped' | 'playerFainted' | 'enemyFainted' | 'enemyRan';
export interface TurnHost extends BattleActionHost, MoveMenuHost {
  printText(program: string, bindings?: TextBindings, options?: TextRunnerOptions): Program;
}
export interface TurnPorts extends ExecutePorts {
  trainerAI(state: BattleState): Program<{ carry: boolean }>;
  switchEnemyMon(state: BattleState): Program;
}

/** Loops through complete turns and menu cancellations; the caller owns the returned exit label. */
export function* mainInBattleLoop(
  state: BattleState, ctx: BattleActionContext, host: TurnHost, ports: TurnPorts, trainer?: TrainerMoveSelection,
): Program<TurnExit> {
  const screen = host.screen;
  const residualPorts = { animation: ports.animation, drawHuds: () => drawHuds(state, screen) };
  for (;;) {
    readPlayerMonCurHPAndStatus(state);
    if (state.wBattleMonHP === 0) return 'playerFainted';
    if (state.wEnemyMonHP === 0) return 'enemyFainted';
    host.saveScreenTilesToBuffer1();
    state.wFirstMonsNotOutYet = 0;
    if ((state.wPlayerBattleStatus2 & 0x60) === 0) {
      state.wEnemyBattleStatus1 &= ~8;
      state.wPlayerBattleStatus1 &= ~8;
      if ((state.wPlayerBattleStatus1 & 0x12) === 0) {
        // Refresh A5c2's HUD views through the shared adapter; retain the caller's bag/menu context.
        const hud = hudContext(state); ctx.playerHud = hud.playerHud; ctx.enemyHud = hud.enemyHud;
        if ((yield* displayBattleMenu(ctx, host)).carry) return 'ran';
        if (state.wEscapedFromBattle !== 0) return 'escaped';
        if ((state.wBattleMonStatus & 0x27) === 0 && (state.wPlayerBattleStatus1 & 0x21) === 0) {
          if ((state.wEnemyBattleStatus1 & 0x20) !== 0) state.wPlayerSelectedMove = 0xff;
          else if (state.wActionResultOrTookBattleTurn === 0) {
            state.wMoveMenuType = 0; state.wAnimationID = 1; state.wMenuItemToSwap = 0;
            const flags = yield* moveSelectionMenu(ctx, host);
            host.loadScreenTilesFromBuffer1();
            yield* drawHuds(state, screen);
            if (!flags.zero) continue;
          }
        }
      }
    }
    selectEnemyMove(state, trainer);
    if (state.wLinkState === LINK_STATE_BATTLING) {
      const received = state.wSerialExchangeNybbleReceiveData;
      if (received === 0x0f) return 'enemyRan';
      if (received !== 0x0e && received !== 0x0d && received >= 4) {
        if ((state.wPlayerBattleStatus1 & 0x20) !== 0
          && state.mem[A.wBattleMonMoves + state.wPlayerMoveListIndex] === 0x76) {
          state.wPlayerSelectedMove = 0x76; // Missing MIRROR MOVE comparison is the cartridge bug.
        }
        yield* ports.switchEnemyMon(state);
      }
    }
    let playerFirst: boolean;
    if (state.wPlayerSelectedMove === 0x62 && state.wEnemySelectedMove !== 0x62) playerFirst = true;
    else if (state.wEnemySelectedMove === 0x62 && state.wPlayerSelectedMove !== 0x62) playerFirst = false;
    else if (state.wPlayerSelectedMove === 0x44 && state.wEnemySelectedMove !== 0x44) playerFirst = false;
    else if (state.wEnemySelectedMove === 0x44 && state.wPlayerSelectedMove !== 0x44) playerFirst = true;
    else if (state.wBattleMonSpeed !== state.wEnemyMonSpeed) playerFirst = state.wBattleMonSpeed > state.wEnemyMonSpeed;
    else {
      const roll = battleRandom(state);
      playerFirst = (roll < 0x80) !== (state.hSerialConnectionStatus === 2);
    }
    if (!playerFirst) {
      state.hWhoseTurn = 1;
      if (!(yield* ports.trainerAI(state)).carry) {
        const result = yield* executeEnemyMove(state, screen, host, ports);
        if (state.wEscapedFromBattle !== 0) return 'escaped';
        if (result.b === 0) return 'playerFainted';
      }
      if ((yield* handlePoisonBurnLeechSeed(state, screen, host, residualPorts)).zero) return 'enemyFainted';
      yield* drawHuds(state, screen);
      const result = yield* executePlayerMove(state, screen, host, ports);
      if (state.wEscapedFromBattle !== 0) return 'escaped';
      if (result.b === 0) return 'enemyFainted';
      if ((yield* handlePoisonBurnLeechSeed(state, screen, host, residualPorts)).zero) return 'playerFainted';
      yield* drawHuds(state, screen);
    } else {
      const result = yield* executePlayerMove(state, screen, host, ports);
      if (state.wEscapedFromBattle !== 0) return 'escaped';
      if (result.b === 0) return 'enemyFainted';
      if ((yield* handlePoisonBurnLeechSeed(state, screen, host, residualPorts)).zero) return 'playerFainted';
      yield* drawHuds(state, screen);
      state.hWhoseTurn = 1;
      if (!(yield* ports.trainerAI(state)).carry) {
        const enemy = yield* executeEnemyMove(state, screen, host, ports);
        if (state.wEscapedFromBattle !== 0) return 'escaped';
        if (enemy.b === 0) return 'playerFainted';
      }
      if ((yield* handlePoisonBurnLeechSeed(state, screen, host, residualPorts)).zero) return 'enemyFainted';
      yield* drawHuds(state, screen);
    }
    checkNumAttacksLeft(state);
  }
}
