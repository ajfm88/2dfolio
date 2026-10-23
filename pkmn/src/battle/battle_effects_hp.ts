// Unused HP effects. pret e89ead15 engine/battle/move_effects/{drain_hp,recoil,heal,substitute}.asm.
import { A, type BattleState } from './battle_state';
import { updateHPBar2, writeHpBarWord } from './battle_hp';
import { drawPlayerHud, drawEnemyHud, drawHuds } from './battle_hud_state';
import { readPlayerMonCurHPAndStatus } from './battle_loaders';
import { playCurrentMoveAnimation, printButItFailedText, type EffectAnimationPort, type MoveEffectRegistry } from './battle_effects';
import { bindEntryBattleScreen } from './battle_screen_binding';
import type { BattleScreen } from './battle_screen';
import type { BattleTurnTextHost } from './battle_turn_text';
import { delayFrames, type Program } from './battle_menu_context';

export interface HpEffectEnvironment extends EffectAnimationPort {
  host: BattleTurnTextHost;
  screen: BattleScreen;
  /** CPU-only AnimationSubstitute interior until A5e; this branch has no shared refresh. */
  animationSubstitute(state: BattleState): Program;
}

/** pret drain_hp.asm:15-21, heal.asm:2-10; note69 section10.3: share the actual presentation screen. */
function user(state: BattleState, env: HpEffectEnvironment) {
  bindEntryBattleScreen(state, env.screen);
  return state.hWhoseTurn === 0
    ? { hp: A.wBattleMonHP, max: A.wBattleMonMaxHP, status: A.wBattleMonStatus,
      move: A.wPlayerMoveNum, flags2: A.wPlayerBattleStatus2, substitute: A.wPlayerSubstituteHP }
    : { hp: A.wEnemyMonHP, max: A.wEnemyMonMaxHP, status: A.wEnemyMonStatus,
      move: A.wEnemyMoveNum, flags2: A.wEnemyBattleStatus2, substitute: A.wEnemySubstituteHP };
}

/** pret drain_hp.asm:23-48, recoil.asm:29-46, heal.asm:47-69: six little-endian HP-bar cells. */
function hpBarWords(state: BattleState, old: number, max: number, next: number): void {
  writeHpBarWord(state, A.wHPBarOldHP, old);
  writeHpBarWord(state, A.wHPBarMaxHP, max);
  writeHpBarWord(state, A.wHPBarNewHP, next);
}

/** pret drain_hp.asm:72-81, recoil.asm:55-65, heal.asm:90-99: player type1/(10,9), enemy type0/(2,2). */
function* updateOwnHPBar(state: BattleState, env: HpEffectEnvironment, old: number, next: number, max: number): Program {
  const player = state.hWhoseTurn === 0;
  state.wHPBarType = player ? 1 : 0;
  yield* updateHPBar2(state, env.screen, player ? 10 : 2, player ? 9 : 2, player ? 1 : 0, old, next, max);
}

/** pret move_effects/drain_hp.asm:1-104: damage halved in place, overflow cap, both HUDs then player sync. */
export function* drainHPEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const u = user(state, env), old = state.readBE(u.hp), max = state.readBE(u.max);
  state.wDamage = Math.max(1, state.wDamage >>> 1);
  const sum = old + state.wDamage;
  const next = sum > 0xffff || sum > max ? max : sum;
  state.writeBE(u.hp, next); hpBarWords(state, old, max, next);
  yield* updateOwnHPBar(state, env, old, next, max);
  yield* drawPlayerHud(state, env.screen);
  yield* drawEnemyHud(state, env.screen);
  readPlayerMonCurHPAndStatus(state);
  const effect = state.hWhoseTurn === 0 ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
  yield* env.host.printText(effect === 8 ? 'DreamWasEatenText' : 'SuckedHealthText');
}

/** pret move_effects/recoil.asm:1-70: move-number Struggle, minimum1, HP floor0, no HUD or party sync. */
export function* recoilEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const u = user(state, env), old = state.readBE(u.hp), max = state.readBE(u.max);
  const recoil = Math.max(1, state.wDamage >>> (state.mem[u.move] === 0xa5 ? 1 : 2));
  const next = Math.max(0, old - recoil);
  state.writeBE(u.hp, next); hpBarWords(state, old, max, next);
  yield* updateOwnHPBar(state, env, old, next, max);
  yield* env.host.printText('HitWithRecoilText');
}

/** pret move_effects/heal.asm:1-120: CP-high carry feeds SBC-low; Rest preserves its saved Z/full-heal choice. */
export function* healEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const u = user(state, env), m = state.mem;
  const highBorrow = m[u.hp] < m[u.max] ? 1 : 0;
  if (((m[u.hp + 1] - m[u.max + 1] - highBorrow) & 255) === 0) {
    yield* delayFrames(50); yield* printButItFailedText(env.host); return;
  }
  const rest = m[u.move] === 156;
  if (rest) {
    yield* delayFrames(50);
    const wasStatused = m[u.status] !== 0;
    m[u.status] = 2;
    yield* env.host.printText(wasStatused ? 'FellAsleepBecameHealthyText' : 'StartedSleepingEffect');
  }
  const old = state.readBE(u.hp), max = state.readBE(u.max);
  const sum = (old + (rest ? max : max >>> 1)) & 0xffff;
  const next = sum >= max ? max : sum;
  state.writeBE(u.hp, next); hpBarWords(state, old, max, next);
  yield* playCurrentMoveAnimation(state, env);
  yield* updateOwnHPBar(state, env, old, next, max);
  yield* drawHuds(state, env.screen);
  yield* env.host.printText('RegainedHealthText');
}

/** pret move_effects/substitute.asm:1-77: first wait50, one-byte cost/scratch before borrow, zero HP succeeds. */
export function* substituteEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const u = user(state, env), m = state.mem;
  yield* delayFrames(50);
  if ((m[u.flags2] & 0x10) !== 0) { yield* env.host.printText('HasSubstituteText'); return; }
  const cost = (state.readBE(u.max) >>> 2) & 255;
  m[u.substitute] = cost;
  const old = state.readBE(u.hp);
  if (old < cost) { yield* env.host.printText('TooWeakSubstituteText'); return; }
  state.writeBE(u.hp, old - cost); m[u.flags2] |= 0x10;
  if ((state.wOptions & 0x80) === 0) yield* playCurrentMoveAnimation(state, env);
  else yield* env.animationSubstitute(state);
  yield* env.host.printText('SubstituteText');
  yield* drawHuds(state, env.screen);
}

/** pret data/moves/effects_pointers.asm:6,11,51,59,82: bank0f wrapper names. */
export function hpEffectHandlers(env: HpEffectEnvironment): MoveEffectRegistry {
  return {
    DrainHPEffect: state => drainHPEffect(state, env), RecoilEffect: state => recoilEffect(state, env),
    HealEffect: state => healEffect(state, env), SubstituteEffect: state => substituteEffect(state, env),
  };
}
