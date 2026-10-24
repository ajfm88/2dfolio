// Unused HP effects. pret e89ead15 engine/battle/move_effects/{drain_hp,recoil,heal,substitute,
// transform,conversion}.asm and effects.asm:1259-1430.
import { A, LINK_STATE_BATTLING, NUM_MOVES, NUM_STATS, type BattleState } from './battle_state';
import { updateHPBar2, writeHpBarWord } from './battle_hp';
import { drawPlayerHud, drawEnemyHud, drawHuds } from './battle_hud_state';
import { getMonName, readPlayerMonCurHPAndStatus } from './battle_loaders';
import { playCurrentMoveAnimation, playCurrentMoveAnimation2, printButItFailedText, printNoEffectText,
  type EffectAnimationPort, type MoveEffectRegistry } from './battle_effects';
import { bindEntryBattleScreen } from './battle_screen_binding';
import { moveHitTest } from './battle_hit';
import { battleRandom } from './battle_random';
import { BattleUnsupportedState, getMoveName, moveNameBinding } from './battle_move_data';
import { moveSelectionMenu } from './move_selection_menu';
import type { BattleScreen } from './battle_screen';
import type { BattleTurnTextHost } from './battle_turn_text';
import type { ExecutePresentation } from './battle_execute_helpers';
import { delayFrames, type BattleMenuContext, type MoveMenuHost, type Program } from './battle_menu_context';

const INVULNERABLE = 0x40;
const HAS_SUBSTITUTE_UP = 0x10;
const TRANSFORMED = 0x08;
const PP_MASK = 0x3f;
/** (NUM_STATS - 1) * 2. Stat mods use the same length, so the ds 2 padding is copied (wram.asm:726,748). */
const STAT_BLOCK = (NUM_STATS - 1) * 2;

export interface HpEffectEnvironment extends EffectAnimationPort,
  Pick<ExecutePresentation, 'hideSubstitute' | 'reshowSubstitute'> {
  host: BattleTurnTextHost;
  screen: BattleScreen;
  /** CPU-only AnimationSubstitute interior until A5e; this branch has no shared refresh. */
  animationSubstitute(state: BattleState): Program;
  /** CPU-only AnimationTransformMon until A5e. This branch writes no animation id or type and has no refresh. */
  animationTransformMon(state: BattleState): Program;
  /** The context and host MainInBattleLoop passes to moveSelectionMenu (battle_turn.ts:50). */
  moveMenu: { ctx: BattleMenuContext; host: MoveMenuHost };
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

function copyBytes(state: BattleState, from: number, to: number, length: number): void {
  for (let i = 0; i < length; i++) state.mem[to + i] = state.mem[from + i];
}

/** Species at 0; types/catch/moves at 5; DVs at 12; level and max HP at 14; stats at 17; PP at 25. */
function monBase(player: boolean): number {
  return player ? A.wBattleMonSpecies : A.wEnemyMonSpecies;
}

/** $CD12 / $CD26. Unmodified Attack has no cell name; it is unmodified level + 3 (note 69 §10.15). */
function unmodifiedAttack(player: boolean): number {
  return (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3;
}

function nameText(state: BattleState): { readonly nameBuffer: string } {
  return { get nameBuffer() { return moveNameBinding(state, A.wNameBuffer); } };
}

/** pret move_effects/transform.asm:1-147. Player checks the user's status1 after zeroing wPlayerMoveListIndex.
 * Enemy A is hWhoseTurn (1), so INVULNERABLE never fails. The doll hidden is the user's. */
export function* transformEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const player = state.hWhoseTurn === 0;
  if (player) {
    state.wPlayerMoveListIndex = 0;
    if ((state.wPlayerBattleStatus1 & INVULNERABLE) !== 0) { yield* printButItFailedText(env.host); return; }
  }
  const userFlags2 = player ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
  const doll = (state.mem[userFlags2] & HAS_SUBSTITUTE_UP) !== 0;
  if (doll) yield* env.hideSubstitute(state);
  bindEntryBattleScreen(state, env.screen);
  if ((state.wOptions & 0x80) === 0) yield* playCurrentMoveAnimation(state, env);
  else yield* env.animationTransformMon(state);
  if (doll) yield* env.reshowSubstitute(state);
  const userFlags3 = player ? A.wPlayerBattleStatus3 : A.wEnemyBattleStatus3;
  state.mem[userFlags3] |= TRANSFORMED;
  const target = monBase(!player), user = monBase(player);
  state.mem[user] = state.mem[target];
  copyBytes(state, target + 5, user + 5, 7);
  if (!player) {
    state.mem[A.wTransformedEnemyMonOriginalDVs] = state.mem[user + 12];
    state.mem[A.wTransformedEnemyMonOriginalDVs + 1] = state.mem[user + 13];
  }
  copyBytes(state, target + 12, user + 12, 2);
  copyBytes(state, target + 17, user + 17, STAT_BLOCK);
  for (let i = 0; i < NUM_MOVES; i++) state.mem[user + 25 + i] = state.mem[target + 8 + i] === 0 ? 0 : 5;
  state.wNamedObjectIndex = state.mem[target];
  getMonName(state, state.species(state.wNamedObjectIndex));
  copyBytes(state, unmodifiedAttack(!player), unmodifiedAttack(player), STAT_BLOCK);
  const mods = player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods;
  const targetMods = player ? A.wEnemyMonStatMods : A.wPlayerMonStatMods;
  copyBytes(state, targetMods, mods, STAT_BLOCK);
  yield* env.host.printText('TransformedText', nameText(state));
}

/** pret move_effects/conversion.asm:1-35. The target's INVULNERABLE fails with no wait; otherwise copy two type bytes. */
export function* conversionEffect(state: BattleState, env: HpEffectEnvironment): Program {
  const player = state.hWhoseTurn === 0;
  const targetFlags1 = player ? A.wEnemyBattleStatus1 : A.wPlayerBattleStatus1;
  if ((state.mem[targetFlags1] & INVULNERABLE) !== 0) { yield* printButItFailedText(env.host); return; }
  const target = player ? A.wEnemyMonType1 : A.wBattleMonType1;
  const user = player ? A.wBattleMonType1 : A.wEnemyMonType1;
  copyBytes(state, target, user, 2);
  bindEntryBattleScreen(state, env.screen);
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('ConvertedTypeText');
}

/** pret effects.asm:1328-1329. */
function* mimicMissed(env: HpEffectEnvironment): Program {
  yield* printButItFailedText(env.host);
}

/** pret effects.asm:1317-1327. Saved menu item is only A; wCurrentMenuItem keeps the menu's new value. No PP write. */
function* mimicLearn(state: BattleState, env: HpEffectEnvironment, moves: number, index: number, move: number): Program {
  state.mem[moves + index] = move;
  state.wNamedObjectIndex = move;
  getMoveName(state);
  bindEntryBattleScreen(state, env.screen);
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('MimicLearnedMoveText', nameText(state));
}

/** pret effects.asm:1279-1298. All-zero target moves throw before any draw (note 69 §10.1 answer 4). */
function* mimicRandomMove(state: BattleState, env: HpEffectEnvironment, moves: number, status1: number): Program {
  // pret effects.asm:1277-1278,1301-1302. Unreachable after moveHitTest: an invulnerable target already missed, with no draw.
  if ((status1 & INVULNERABLE) !== 0) { yield* mimicMissed(env); return; }
  let selectable = false;
  for (let i = 0; i < NUM_MOVES; i++) if (state.mem[moves + i] !== 0) selectable = true;
  if (!selectable) throw new BattleUnsupportedState('mimic target moves are all zero');
  let move = 0;
  do {
    move = state.mem[moves + (battleRandom(state) & 3)];
  } while (move === 0);
  const player = state.hWhoseTurn === 0;
  yield* mimicLearn(state, env, player ? A.wBattleMonMoves : A.wEnemyMonMoves,
    player ? state.wPlayerMoveListIndex : state.wEnemyMoveListIndex, move);
}

/** pret effects.asm:1299-1316. No hang guard: the menu is not a rejection loop. */
function* mimicLetPlayerChoose(state: BattleState, env: HpEffectEnvironment): Program {
  // pret effects.asm:1300-1302. Unreachable after moveHitTest, same as the draw-path check.
  if ((state.wEnemyBattleStatus1 & INVULNERABLE) !== 0) { yield* mimicMissed(env); return; }
  const saved = state.wCurrentMenuItem;
  state.wMoveMenuType = 1;
  yield* moveSelectionMenu(env.moveMenu.ctx, env.moveMenu.host);
  env.moveMenu.host.loadScreenTilesFromBuffer1();
  const picked = state.mem[A.wEnemyMonMoves + state.wCurrentMenuItem];
  yield* mimicLearn(state, env, A.wBattleMonMoves, saved, picked);
}

/** pret effects.asm:1259-1336. Fifty frames, then MoveHitTest. Link and the enemy rejection-sample the target's moves. */
export function* mimicEffect(state: BattleState, env: HpEffectEnvironment): Program {
  yield* delayFrames(50);
  moveHitTest(state);
  if (state.wMoveMissed !== 0) { yield* mimicMissed(env); return; }
  if (state.hWhoseTurn !== 0) { yield* mimicRandomMove(state, env, A.wBattleMonMoves, state.wPlayerBattleStatus1); return; }
  if (state.wLinkState !== LINK_STATE_BATTLING) { yield* mimicLetPlayerChoose(state, env); return; }
  yield* mimicRandomMove(state, env, A.wEnemyMonMoves, state.wEnemyBattleStatus1);
}

/** pret effects.asm:1359-1398. Throw before drawing only when no slot can ever be accepted. */
function assertDisableCanFinish(state: BattleState, moves: number, pp: number | null): void {
  let anyMove = false;
  for (let i = 0; i < NUM_MOVES; i++) if (state.mem[moves + i] !== 0) anyMove = true;
  if (!anyMove) throw new BattleUnsupportedState('disable target moves are all zero');
  if (pp === null) return;
  let masked = 0;
  for (let i = 0; i < NUM_MOVES; i++) masked |= state.mem[pp + i];
  if ((masked & PP_MASK) === 0) return;
  for (let i = 0; i < NUM_MOVES; i++) if (state.mem[moves + i] !== 0 && state.mem[pp + i] !== 0) return;
  throw new BattleUnsupportedState('disable PP path accepts no slot');
}

/** pret effects.asm:1342-1423. Hit draw, then the disabled gate, then slot draws, then PP re-draws, then duration. */
export function* disableEffect(state: BattleState, env: HpEffectEnvironment): Program {
  moveHitTest(state);
  if (state.wMoveMissed !== 0) { yield* printButItFailedText(env.host); return; }
  const player = state.hWhoseTurn === 0;
  const disabled = player ? A.wEnemyDisabledMove : A.wPlayerDisabledMove;
  const moves = player ? A.wEnemyMonMoves : A.wBattleMonMoves;
  if (state.mem[disabled] !== 0) { yield* printButItFailedText(env.host); return; }
  const ppPath = !player || state.wLinkState === LINK_STATE_BATTLING;
  const pp = player ? A.wEnemyMonPP : A.wBattleMonPP;
  assertDisableCanFinish(state, moves, ppPath ? pp : null);
  let slot = 0;
  for (;;) {
    slot = battleRandom(state) & 3;
    const move = state.mem[moves + slot];
    if (move === 0) continue;
    state.wNamedObjectIndex = move;
    if (!ppPath) break;
    let masked = 0;
    for (let i = 0; i < NUM_MOVES; i++) masked |= state.mem[pp + i];
    if ((masked & PP_MASK) === 0) { yield* printButItFailedText(env.host); return; }
    if (state.mem[pp + slot] === 0) continue;
    break;
  }
  const duration = (battleRandom(state) & 7) + 1;
  let packed = slot + 1;
  packed = ((packed & 0x0f) << 4) | (packed >> 4);
  state.mem[disabled] = (duration + packed) & 0xff;
  bindEntryBattleScreen(state, env.screen);
  yield* playCurrentMoveAnimation2(state, env);
  state.mem[player ? A.wEnemyDisabledMoveNumber : A.wPlayerDisabledMoveNumber] = state.wNamedObjectIndex;
  getMoveName(state);
  yield* env.host.printText('MoveWasDisabledText', nameText(state));
}

/** pret effects.asm:1338-1340. Current-move animation, then NoEffectText. No other write. */
export function* splashEffect(state: BattleState, env: HpEffectEnvironment): Program {
  bindEntryBattleScreen(state, env.screen);
  yield* playCurrentMoveAnimation(state, env);
  yield* printNoEffectText(env.host);
}

/** pret data/moves/effects_pointers.asm:6,11,27,51,59,70,82,85,86: bank0f wrapper names. */
export function hpEffectHandlers(env: HpEffectEnvironment): MoveEffectRegistry {
  return {
    DrainHPEffect: state => drainHPEffect(state, env), RecoilEffect: state => recoilEffect(state, env),
    HealEffect: state => healEffect(state, env), SubstituteEffect: state => substituteEffect(state, env),
    TransformEffect: state => transformEffect(state, env), ConversionEffect: state => conversionEffect(state, env),
    MimicEffect: state => mimicEffect(state, env), DisableEffect: state => disableEffect(state, env),
    SplashEffect: state => splashEffect(state, env),
  };
}
