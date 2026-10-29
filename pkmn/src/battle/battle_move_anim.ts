// Unused A5c3f checkpoint-05. pret e89ead15 engine/battle/animations.asm, engine/gfx/screen_effects.asm.
import type { BattleState } from './battle_state';
import type { BattleScreen } from './battle_screen';
import type { BattleAudio, BattleSfx } from './battle_audio';
import { delayFrames, type Program } from './battle_menu_context';
import { textBgTransfer } from '../text/bg_transfer';
import { bindEntryBattleScreen } from './battle_screen_binding';

/** pret ram/{wram,hram}.asm; pokeyellow.sym 573535d. Byte views, including the low byte at D095. */
export const MOVE_ANIM = {
  wAnimPalette: 0xcc79, wAnimSoundID: 0xcf07, wSubAnimTransform: 0xd08a,
  wSubAnimSubEntryAddr: 0xd095, wUnusedMoveAnimByte: 0xd09a, wDisableVBlankWYUpdate: 0xd09f,
  hBaseTileID: 0xff8b, hMutateWY: 0xff96, hMutateWX: 0xff97, hWY: 0xffb0,
} as const;
export interface MoveAnimationHost {
  screen: BattleScreen;
  audio: BattleAudio;
  sounds: { damage: BattleSfx; superEffective: BattleSfx; notVeryEffective: BattleSfx };
  /** Existing WaitForSoundToFinish owner, including the low-health bit7 early return. */
  waitForSound(): Program;
  /** TossBallAnimation remains A5f's presentation hand-off. */
  tossBall(state: BattleState): Program;
}

/** pret animations.asm:2834-2858. Modifier writes precede PlaySound; no post-sound wait here. */
export function* playApplyingAttackSound(state: BattleState, host: MoveAnimationHost): Program {
  yield* host.waitForSound();
  const multiplier = state.wDamageMultipliers & 0x7f;
  if (multiplier === 0) return;
  const [sound, frequency, tempo] = multiplier === 10 ? [host.sounds.damage, 0x20, 0x30]
    : multiplier > 10 ? [host.sounds.superEffective, 0xe0, 0xff] : [host.sounds.notVeryEffective, 0x50, 1];
  host.audio.frequencyModifier = frequency;
  host.audio.tempoModifier = tempo;
  host.audio.play(sound);
}

/** pret engine/gfx/screen_effects.asm:16-40. Later passes seed hMutateWY with B, not zero. */
function* shakeVertically(state: BattleState, screen: BattleScreen): Program {
  state.mem[MOVE_ANIM.wDisableVBlankWYUpdate] = 1;
  for (let b = 8; b > 0; b--) {
    state.mem[MOVE_ANIM.hMutateWY] = b === 8 ? 0 : b;
    for (let call = 0; call < 2; call++) {
      state.mem[MOVE_ANIM.hMutateWY] ^= b;
      screen.wy = state.mem[MOVE_ANIM.hMutateWY];
      yield* delayFrames(3);
    }
  }
  state.mem[MOVE_ANIM.wDisableVBlankWYUpdate] = 0;
}

/** pret engine/gfx/screen_effects.asm:42-73. The middle Delay1 and final WX7 are separate source writes. */
function* shakeHorizontallyFast(state: BattleState, screen: BattleScreen, count: number): Program {
  for (let b = count; b > 0; b--) {
    state.mem[MOVE_ANIM.hMutateWX] = b === count ? 0 : b;
    for (let call = 0; call < 2; call++) {
      state.mem[MOVE_ANIM.hMutateWX] ^= b;
      const value = state.mem[MOVE_ANIM.hMutateWX];
      screen.wx = ((value & 0x80 ? 0 : value) + 7) & 255;
      yield* delayFrames(4);
      if (call === 0) yield* delayFrames(1);
    }
  }
  screen.wx = 7;
}

/** pret animations.asm:541-563. Two cycles, each B increments then B decrements, Delay2 at every step. */
function* shakeHorizontallySlow(screen: BattleScreen, count: number): Program {
  for (let c = 2; c > 0; c--) {
    for (const step of [1, -1]) for (let b = count; b > 0; b--) {
      screen.wx = (screen.wx + step) & 255;
      yield* delayFrames(2);
    }
  }
}

/** pret animations.asm:993-1004,1428-1448,1464-1470,2254-2308,2414-2472; data/tilemaps.asm:24-25.
 * CopyTileIDs_NoBGTransfer disables BG transfers during its CPU copy, then unconditionally enables them.
 * MonTiles is column-major: the row-major destination receives base + row + 7*column. */
function* blinkOpponent(state: BattleState, screen: BattleScreen): Program {
  const turn = state.hWhoseTurn;
  state.hWhoseTurn = turn ^ 1;
  const enemy = state.hWhoseTurn !== 0, x = enemy ? 12 : 1, y = enemy ? 0 : 5;
  for (let c = 6; c > 0; c--) {
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) screen.put(x + col, y + row, ' ');
    yield* delayFrames(5);
    textBgTransfer.enabled = false;
    const base = enemy ? 0 : 0x31;
    state.mem[MOVE_ANIM.hBaseTileID] = base;
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) screen.put(x + col, y + row, base + row + 7 * col);
    textBgTransfer.enabled = true;
    yield* delayFrames(3);
    yield* delayFrames(5);
  }
  state.hWhoseTurn = turn;
}

/** pret animations.asm:488-563. Types3/6 have no applying-attack sound call. */
export function* playApplyingAttackAnimation(state: BattleState, host: MoveAnimationHost): Program {
  const type = state.wAnimationType;
  if (type === 0) return;
  if (type === 3 || type === 6) { yield* shakeHorizontallySlow(host.screen, type === 3 ? 6 : 3); return; }
  yield* playApplyingAttackSound(state, host);
  if (type === 1) yield* shakeVertically(state, host.screen);
  else if (type === 2 || type === 5) yield* shakeHorizontallyFast(state, host.screen, type === 2 ? 8 : 2);
  else if (type === 4) yield* blinkOpponent(state, host.screen);
}

/** pret animations.asm:417-463,565-597 (non-SGB). Always OFF until A5e, irrespective of wOptions bit7. */
export function* moveAnimation(state: BattleState, host: MoveAnimationHost): Program {
  bindEntryBattleScreen(state, host.screen);
  host.screen.bindWindowRegisters({ get wy() { return state.mem[MOVE_ANIM.hWY]; },
    get disabled() { return state.mem[MOVE_ANIM.wDisableVBlankWYUpdate]; } });
  yield* host.waitForSound();
  state.mem[MOVE_ANIM.wAnimPalette] = host.screen.obp0 = 0xe4;
  host.screen.obp1 = 0x6c;
  if (state.wAnimationID === 0xc1) yield* host.tossBall(state);
  else if (state.wAnimationID !== 0) {
    yield* delayFrames(30);
    yield* playApplyingAttackAnimation(state, host);
  }
  yield* host.waitForSound();
  state.mem[MOVE_ANIM.wSubAnimSubEntryAddr] = 0; // ASM clears this byte only; D096 survives.
  state.mem[MOVE_ANIM.wUnusedMoveAnimByte] = state.mem[MOVE_ANIM.wSubAnimTransform] = 0;
  state.mem[MOVE_ANIM.wAnimSoundID] = 0xff;
}
