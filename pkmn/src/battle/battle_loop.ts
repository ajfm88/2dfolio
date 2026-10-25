// Unused tail-jump driver. pret core.asm:289–475,708–739,981–1012; note70 §2.1.
import type { BattleState } from './battle_state';
import type { BattleActionContext, Program } from './battle_menu_context';
import type { TrainerMoveSelection } from './battle_math';
import { mainInBattleLoop, type TurnHost, type TurnPorts } from './battle_turn';
import { handleEnemyMonFainted, handlePlayerMonFainted, enemyRan, type FaintHost } from './battle_faint';
import { bindEntryBattleScreen } from './battle_screen_binding';

export interface BattleLoopHost extends FaintHost, TurnHost {}
export type BattleLoopExit = 'end' | 'blackout';

/** No recursive loop nesting and no EndOfBattle call here: _InitBattleCommon owns that next call. */
export function* battleLoop(state: BattleState, ctx: BattleActionContext, host: BattleLoopHost,
  ports: TurnPorts, trainer?: TrainerMoveSelection): Program<BattleLoopExit> {
  bindEntryBattleScreen(state, host.screen);
  for (;;) {
    const exit = yield* mainInBattleLoop(state, ctx, host, ports, trainer);
    switch (exit) {
      case 'enemyFainted': {
        const next = yield* handleEnemyMonFainted(state, host);
        if (next === 'loop') continue;
        return next;
      }
      case 'playerFainted': {
        const next = yield* handlePlayerMonFainted(state, host);
        if (next === 'loop') continue;
        return next;
      }
      case 'enemyRan': yield* enemyRan(state, host); return 'end';
      case 'ran': case 'escaped': return 'end';
    }
  }
}
