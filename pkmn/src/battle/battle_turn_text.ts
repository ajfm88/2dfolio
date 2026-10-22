// Unused turn text. used_move_text.asm:1–137; data/moves/grammar.asm (pret e89ead15).
import type { TextAsmHandler, TextBindings, TextRunnerOptions } from '../text/text_runner';
import type { Program } from './battle_menu_context';
import { decrementPP } from './battle_loaders';
import { moveNameBinding } from './battle_move_data';
import type { BattleState } from './battle_state';

// Zero-delimited MoveGrammar sets, with the final -1 represented by the default group4.
const GRAMMAR_GROUPS: readonly (readonly number[])[] = [
  [14, 74],
  [105, 120, 133],
  [96, 97, 100, 102, 104, 117, 140],
  [1, 10, 11, 17, 19, 20, 21, 30, 34, 35, 37, 39, 43, 44, 45, 46, 47, 64, 68, 70,
    71, 81, 89, 90, 91, 92, 103, 106, 107, 110, 111, 118, 122, 128, 132, 139, 141,
    145, 148, 150, 151, 154, 156, 159, 163, 164],
];

/** GetMoveGrammar transforms the shared byte from move ID into grammar group. */
export function getMoveGrammar(state: BattleState): void {
  const group = GRAMMAR_GROUPS.findIndex(moves => moves.includes(state.wMoveGrammar));
  state.wMoveGrammar = group < 0 ? 4 : group;
}

/** Four ASM bodies, five extracted program roots. Registration lasts for one print only. */
export function usedMoveTextHandlers(state: BattleState): Record<string, TextAsmHandler> {
  const obedience: TextAsmHandler = () => state.wMonIsDisobedient !== 0
    ? 'UsedMoveText_CheckObedience.UsedInsteadText' : 'MoveNameText';
  return {
    UsedMoveText: () => {
      const move = state.hWhoseTurn === 0 ? state.wPlayerMoveNum : state.wEnemyMoveNum;
      if (state.hWhoseTurn === 0) state.wPlayerUsedMove = move;
      else state.wEnemyUsedMove = move;
      state.wMoveGrammar = move; getMoveGrammar(state);
      return state.wMonIsDisobedient !== 0 || state.wMoveGrammar < 3 ? 'UsedMove2Text' : 'UsedMove1Text';
    },
    UsedMove1Text: obedience,
    UsedMove2Text: obedience,
    'UsedMoveText_CheckObedience.UsedInsteadText': () => 'MoveNameText',
    MoveNameText: () => `EndUsedMove${state.wMoveGrammar + 1}Text`,
  };
}

export interface BattleTurnTextHost {
  printText(program: string, bindings?: TextBindings, options?: TextRunnerOptions): Program;
}

/** DisplayUsedMoveText: one PrintText; actors are supplied by BattleHost, never overridden here. */
export function* displayUsedMoveText(state: BattleState, host: BattleTurnTextHost): Program {
  const bindings: TextBindings = { get stringBuffer() { return moveNameBinding(state); } };
  yield* host.printText('UsedMoveText', bindings, { asm: usedMoveTextHandlers(state) });
}

/** The two announce/PP call sites, core.asm:3288–3293 and5692–5695. Not a move executor. */
export function* announceMove(state: BattleState, host: BattleTurnTextHost): Program {
  if (state.hWhoseTurn !== 0) state.wMonIsDisobedient = 0;
  yield* displayUsedMoveText(state, host);
  if (state.hWhoseTurn === 0) decrementPP(state, state.wPlayerSelectedMove);
}
