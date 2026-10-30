import { refreshPartyMon } from './battle_party_codec';
import { decodeBattleText } from './battle_text_codec';
// Unused shared field/battle LearnMove. pret e89ead15 engine/pokemon/learn_move.asm:1–250.
import { battleContext, encodeText, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { getMoveName, getName, moveNameBinding, getMoveRecord, BattleUnsupportedState } from './battle_move_data';
import { formatMovesString } from './move_selection_menu';
import { displayTwoOptionMenu, type TwoOptionHost } from './battle_two_option';
import { MenuInput } from '../menus/menu_input';
import { placeMenuCursor, placeString, textBoxBorder, type MenuCursorState } from '../menus/tile_surface';
import type { Program } from './battle_menu_context';
import type { ExperienceHost } from './battle_experience';
import type { BattleAudio, BattleSfx } from './battle_audio';
import type { TextAsmContinuation, TextBindings } from '../text/text_runner';

export interface LearnMoveHost extends TwoOptionHost, Pick<ExperienceHost,
  'printText' | 'saveScreenTilesToBuffer1' | 'loadScreenTilesFromBuffer1'> {
  /** Same authoritative bank/ID/wait/music owner in battle and field (field starts in bank02). */
  audio: BattleAudio;
  swapSound: BattleSfx;
}

const HM_MOVES = [15, 19, 57, 70, 148] as const;

/** Called inside one retained PrintText; only the existing host services the yielded frames. */
export function oneTwoAndText(host: Pick<LearnMoveHost, 'audio' | 'swapSound'>): TextAsmContinuation {
  return function* () {
    for (const frame of host.audio.playSwap(host.swapSound)) {
      if (frame !== 'serviced') throw new BattleUnsupportedState('swap frame');
      yield;
    }
    return 'PoofText';
  };
}

function bindings(state: BattleState): TextBindings {
  return { learnMoveMonName: decodeBattleText(state.mem, D.wLearnMoveMonName),
    stringBuffer: moveNameBinding(state), nameBuffer: decodeBattleText(state.mem, D.wNameBuffer) };
}

function formatLearnMoves(state: BattleState, at: number): string {
  const moves = [...state.mem.slice(at, at + 4)]; state.setBytes(D.wMoves, moves, 4);
  const ctx = battleContext(state);
  formatMovesString(ctx, moves, { getMove(id) {
    state.wNameListIndex = id; state.wNameListType = 2; state.wPredefBank = 0x2f; getName(state);
    return { name: moveNameBinding(state, D.wNameBuffer) };
  } });
  const bytes = ctx.movesString.split('<NEXT>').flatMap((part, i) => [...(i ? [0x4e] : []), ...encodeText(part)]);
  state.mem.set(bytes, D.wMovesString); return ctx.movesString;
}

function* yesNo(state: BattleState, host: LearnMoveHost): Program<boolean> {
  state.mem[D.wTextBoxID] = 0x14;
  yield* displayTwoOptionMenu(state, host, 14, 7, 8, 15);
  return (state.wCurrentMenuItem & 1) !== 0;
}

/** :98–183. Return the original party pointer/old ID; Load1 precedes B and HM checks. */
export function* tryingToLearn(state: BattleState, host: LearnMoveHost, movesAt: number): Program<
  { carry: true } | { carry: false; at: number; oldMove: number }> {
  yield* host.printText('TryingToLearnText', bindings(state));
  if (yield* yesNo(state, host)) return { carry: true };
  const text = formatLearnMoves(state, movesAt);
  for (;;) {
    yield* host.printText('WhichMoveToForgetText', bindings(state));
    textBoxBorder(host.tiles, 4, 7, 4, 14);
    state.mem[D.hUILayoutFlags] |= 4; placeString(host.tiles, 6, 8, text, 1); state.mem[D.hUILayoutFlags] &= ~4;
    state.mem[D.wTopMenuItemY] = 8; state.mem[D.wTopMenuItemX] = 5;
    state.wCurrentMenuItem = state.mem[D.wLastMenuItem] = 0;
    state.wMaxMenuItem = state.wNumMovesMinusOne; state.mem[D.wMenuWatchedKeys] = 3;
    const menu = new MenuInput({ watched: ['a', 'b'], maxItem: state.wMaxMenuItem, topX: 5, topY: 8, rowStep: 1 });
    const cursor: MenuCursorState = { topX: 5, topY: 8, rowStep: 1, item: 0, lastItem: 0, tileBehind: ' ', location: null };
    placeMenuCursor(host.tiles, cursor); state.mem[D.hUILayoutFlags] |= 2;
    let pressed: string[];
    for (;;) {
      yield 'serviced'; const hit = menu.update(() => host.readJoypad(), () => host.pressSound());
      state.wCurrentMenuItem = menu.item;
      if (hit) { pressed = hit; break; }
      if (cursor.item !== menu.item) {
        cursor.item = menu.item; placeMenuCursor(host.tiles, cursor); state.mem[D.wLastMenuItem] = cursor.lastItem;
      }
    }
    state.mem[D.hUILayoutFlags] &= ~2; state.mem[D.wMenuWrappingEnabled] = 0;
    host.loadScreenTilesFromBuffer1();
    if (pressed.includes('b')) return { carry: true };
    const at = movesAt + state.wCurrentMenuItem, oldMove = state.mem[at];
    if (!(HM_MOVES as readonly number[]).includes(oldMove)) return { carry: false, at, oldMove };
    yield* host.printText('HMCantDeleteText', bindings(state));
  }
}

/** :1–96. No battle-only prerequisite; wIsInBattle gates only the final battle-copy writes. */
export function* learnMove(state: BattleState, host: LearnMoveHost): Program<{ b: 0 | 1 }> {
  host.saveScreenTilesToBuffer1();
  const nick = D.wPartyMonNicks + 11 * state.wWhichPokemon;
  state.mem.set(state.mem.slice(nick, nick + 11), D.wNameBuffer);
  state.mem.set(state.mem.slice(D.wNameBuffer, D.wNameBuffer + 11), D.wLearnMoveMonName);
  const movesAt = D.wPartyMons + 44 * state.wWhichPokemon + 8;
  for (;;) { // DontAbandonLearning rescans all four slots and reprints TryingToLearn.
    let slot = 0; while (slot < 4 && state.mem[movesAt + slot]) slot++;
    if (slot === 4) {
      const choice = yield* tryingToLearn(state, host, movesAt);
      if (choice.carry) {
        yield* host.printText('AbandonLearningText', bindings(state));
        if (yield* yesNo(state, host)) continue;
        yield* host.printText('DidNotLearnText', bindings(state)); return { b: 0 };
      }
      slot = choice.at - movesAt; state.wNamedObjectIndex = choice.oldMove; getMoveName(state);
      yield* host.printText('OneTwoAndText', { ...bindings(state), nameBuffer: moveNameBinding(state, D.wNameBuffer) },
        { asmContinuations: { OneTwoAndText: oneTwoAndText(host) } });
    }
    const move = state.mem[D.wMoveNum]; state.mem[movesAt + slot] = move;
    state.setBytes(D.wBuffer, getMoveRecord(move), 6);
    const pp = state.mem[D.wBuffer + 5]; state.mem[movesAt + 21 + slot] = pp;
    if (state.partyMons[state.wWhichPokemon]) refreshPartyMon(state, state.wWhichPokemon);
    if (state.wIsInBattle && state.wWhichPokemon === state.wPlayerMonNumber) {
      state.mem.set(state.mem.slice(movesAt, movesAt + 4), D.wBattleMonMoves);
      state.mem.set(state.mem.slice(movesAt + 21, movesAt + 25), D.wBattleMonPP);
    }
    yield* host.printText('LearnedMove1Text', bindings(state)); return { b: 1 };
  }
}

/** Fill checkpoint-06's seam on an existing battle/field owner; no new screen or audio clock. */
export function bindLearnMove(experience: Pick<ExperienceHost, 'learnMove'>, host: LearnMoveHost): void {
  experience.learnMove = state => learnMove(state, host);
}
