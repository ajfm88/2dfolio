import type { BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { BattleAudio, BattleSfx } from './battle_audio';
import { I } from './battle_item_state';
import { MOVE_ANIM } from './battle_move_anim';
import { delayFrames, type Program } from './battle_menu_context';
import { textBgTransfer } from '../text/bg_transfer';

/** constants/move_constants.asm, counted after STRUGGLE ($A5). */
export const BALL_ANIMATION = { SHOWPIC: 0xa6, TOSS: 0xc1, SHAKE: 0xc2, POOF: 0xc3,
  BLOCKBALL: 0xc4, GREATTOSS: 0xc5, ULTRATOSS: 0xc6, HIDEPIC: 0xc8 } as const;
export interface BallAnimationHost {
  screen: BattleScreen;
  audio: BattleAudio;
  faintThud: BattleSfx;
  /** PlayAnimation for the toss, shake, poof and block IDs (A5f checkpoint-03: the session's sub-animation player). */
  ballSubanimation(id: number): Program;
}

/** PlayAnimation's special-effect commands have NO_MOVE sound, no command delay and a bare ret at AnimationOver. */
function* playBallAnimation(state: BattleState, host: BallAnimationHost, id: number): Program {
  state.wAnimationID = id;
  state.mem[MOVE_ANIM.hBaseTileID] = state.mem[MOVE_ANIM.wSubAnimTransform] = 0; // hROMBankTemp aliases hBaseTileID.
  if (id === BALL_ANIMATION.HIDEPIC || id === BALL_ANIMATION.SHOWPIC) {
    const turn = state.hWhoseTurn; state.hWhoseTurn ^= 1;
    const enemy = state.hWhoseTurn !== 0, x = enemy ? 12 : 1, y = enemy ? 0 : 5;
    textBgTransfer.enabled = false;
    if (id === BALL_ANIMATION.SHOWPIC) state.mem[MOVE_ANIM.hBaseTileID] = enemy ? 0 : 0x31;
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++)
      host.screen.put(x + col, y + row, id === BALL_ANIMATION.HIDEPIC ? ' '
        : state.mem[MOVE_ANIM.hBaseTileID] + col * 7 + row);
    textBgTransfer.enabled = true;
    // Hide restores whoseTurn before Delay3; Show returns through CallWithTurnFlipped after Delay3.
    if (id === BALL_ANIMATION.HIDEPIC) state.hWhoseTurn = turn;
    yield* delayFrames(3);
    state.hWhoseTurn = turn;
  } else yield* host.ballSubanimation(id);
}

/** pret animations.asm:2777–2833. Keep the toss + c-1 sequence, final id, and Safari's Ultra fallback. */
export function* tossBallAnimation(state: BattleState, host: BallAnimationHost): Program {
  const a = BALL_ANIMATION;
  if (state.wIsInBattle === 2) {
    yield* playBallAnimation(state, host, a.TOSS);
    host.audio.play(host.faintThud);
    yield* playBallAnimation(state, host, a.BLOCKBALL);
    return;
  }
  const data = state.mem[I.wPokeBallAnimData];
  state.mem[I.wNumShakes] = data & 15;
  const item = state.mem[I.wCurItem];
  const toss = item === 4 ? a.TOSS : item === 3 ? a.GREATTOSS : a.ULTRATOSS;
  const sequence = [toss, a.POOF, a.HIDEPIC, a.SHAKE, a.POOF, a.SHOWPIC];
  for (let index = 0, count = data >>> 4; index < count; index++)
    yield* playBallAnimation(state, host, sequence[index]);
}
