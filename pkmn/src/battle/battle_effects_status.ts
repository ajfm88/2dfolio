// Unused status effects. pret e89ead15 effects.asm:26-172,204-381,1007-1032,1170-1219;
// engine/battle/move_effects/paralyze.asm:1-47 and leech_seed.asm:1-40.
import { A, LINK_STATE_BATTLING, PARTYMON_STRUCT_LENGTH, type BattleState } from './battle_state';
import { battleRandom } from './battle_random';
import { moveHitTest } from './battle_hit';
import { quarterSpeedDueToParalysis, halveAttackDueToBurn } from './battle_loaders';
import { delayFrames, type Program } from './battle_menu_context';
import type { BattleTurnTextHost } from './battle_turn_text';
import { checkTargetSubstitute, clearHyperBeam, playCurrentMoveAnimation, playCurrentMoveAnimation2,
  playBattleAnimation, playBattleAnimation2, printDidntAffectText, printMayNotAttackText,
  printDoesntAffectText, conditionalPrintButItFailed, type EffectAnimationPort, type MoveEffectRegistry } from './battle_effects';

export interface StatusEffectEnvironment extends EffectAnimationPort { host: BattleTurnTextHost }

/** pret effects.asm:27-33,89-95,1185-1193: target addresses selected by the attacking side. */
function target(state: BattleState) {
  return state.hWhoseTurn === 0
    ? { status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2,
      flags3: A.wEnemyBattleStatus3, toxic: A.wEnemyToxicCounter, confused: A.wEnemyConfusedCounter }
    : { status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2,
      flags3: A.wPlayerBattleStatus3, toxic: A.wPlayerToxicCounter, confused: A.wPlayerConfusedCounter };
}
/** pret effects.asm:109,223,288,1189-1193: read the active move-effect byte. */
function effect(state: BattleState): number {
  return state.hWhoseTurn === 0 ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
}
/** pret effects.asm:133-145: Toxic is identified by move number, not effect. */
function move(state: BattleState): number {
  return state.hWhoseTurn === 0 ? state.wPlayerMoveNum : state.wEnemyMoveNum;
}
/** pret effects.asm:215,280,356,369: attacking move type, not species type. */
function moveType(state: BattleState): number {
  return state.hWhoseTurn === 0 ? state.wPlayerMoveType : state.wEnemyMoveType;
}

/** pret effects.asm:26-78: recharge skips status/hit tests; both sleep rejection loops consume real draws. */
export function* sleepEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  const t = target(state), m = state.mem;
  const recharging = (m[t.flags2] & 0x20) !== 0;
  m[t.flags2] &= ~0x20;
  if (!recharging) {
    if ((m[t.status] & 7) !== 0) { yield* env.host.printText('AlreadyAsleepText'); return; }
    if (m[t.status] !== 0) { yield* printDidntAffectText(env.host); return; }
    moveHitTest(state);
    if (state.wMoveMissed !== 0) { yield* printDidntAffectText(env.host); return; }
  }
  let count: number;
  for (;;) {
    count = battleRandom(state) & 7;
    if (count === 0) continue;
    if (state.wUnknownSerialFlag_d499 !== 0) {
      count &= 3;
      if (count === 0) continue;
    }
    break;
  }
  m[t.status] = count;
  yield* playCurrentMoveAnimation2(state, env);
  yield* env.host.printText('FellAsleepText');
}

/** pret effects.asm:88-172: Substitute, status and both Poison-type gates precede either chance or accuracy. */
export function* poisonEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  const t = target(state), m = state.mem;
  if (!checkTargetSubstitute(state).zero || m[t.status] !== 0
    || m[t.status + 1] === 3 || m[t.status + 2] === 3) {
    if (effect(state) === 0x42) { yield* delayFrames(50); yield* printDidntAffectText(env.host); }
    return;
  }
  const id = effect(state);
  if (id === 0x02 || id === 0x21) {
    if (battleRandom(state) >= (id === 0x02 ? 52 : 103)) return;
  } else {
    moveHitTest(state);
    if (state.wMoveMissed !== 0) { yield* delayFrames(50); yield* printDidntAffectText(env.host); return; }
  }
  m[t.status] |= 8;
  const toxic = move(state) === 92;
  if (toxic) { m[t.flags3] |= 1; m[t.toxic] = 0; }
  if (effect(state) === 0x42) yield* playCurrentMoveAnimation2(state, env);
  else yield* playBattleAnimation2(state, env, state.hWhoseTurn === 0 ? 0xa9 : 0xc7);
  yield* env.host.printText(toxic ? 'BadlyPoisonedText' : 'PoisonedText');
}

/** pret effects.asm:348-381: only frozen + FIRE thaws, with an unconditional selected-roster write. */
export function* checkDefrost(state: BattleState, env: StatusEffectEnvironment): Program {
  const t = target(state), m = state.mem;
  if ((m[t.status] & 0x20) === 0 || moveType(state) !== 20) return;
  m[t.status] = 0;
  const base = state.hWhoseTurn === 0 ? A.wEnemyMons : A.wPartyMons;
  const slot = state.hWhoseTurn === 0 ? state.wEnemyMonPartyPos : state.wPlayerMonNumber;
  m[base + slot * PARTYMON_STRUCT_LENGTH + 4] = 0;
  yield* env.host.printText('FireDefrostedText');
}

/** pret effects.asm:204-338: status/type gates, Stadium freeze2 threshold and Yellow recharge asymmetry. */
export function* freezeBurnParalyzeEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  state.wAnimationType = 0;
  if (!checkTargetSubstitute(state).zero) return;
  const t = target(state), m = state.mem;
  if (m[t.status] !== 0) { yield* checkDefrost(state, env); return; }
  const type = moveType(state);
  if (m[t.status + 1] === type || m[t.status + 2] === type) return;
  const id = effect(state);
  let normalized: number, threshold: number;
  if (id === 0x23) { normalized = 5; threshold = state.wUnknownSerialFlag_d499 === 0 ? 77 : 26; }
  else { normalized = id < 7 ? id : id - 0x1e; threshold = id < 7 ? 26 : 77; }
  if (battleRandom(state) >= threshold) return;
  let text: string;
  if (normalized === 4) {
    m[t.status] = 0x10;
    halveAttackDueToBurn(state);
    text = 'BurnedText';
  } else if (normalized === 5) {
    if (state.hWhoseTurn === 0) clearHyperBeam(state);
    m[t.status] = 0x20;
    text = 'FrozenText';
  } else {
    m[t.status] = 0x40;
    quarterSpeedDueToParalysis(state);
    text = 'ParalyzedMayNotAttackText';
  }
  if (state.hWhoseTurn === 0) yield* playBattleAnimation(state, env, 0xa9);
  else yield* playBattleAnimation2(state, env, 0xc7);
  yield* env.host.printText(text);
}

/** pret move_effects/paralyze.asm:1-47: no Substitute check; Electric Ground immunity precedes hit. */
export function* paralyzeEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  const t = target(state), m = state.mem;
  if (m[t.status] !== 0) { yield* delayFrames(50); yield* printDidntAffectText(env.host); return; }
  if (moveType(state) === 23 && (m[t.status + 1] === 4 || m[t.status + 2] === 4)) {
    yield* delayFrames(50); yield* printDoesntAffectText(env.host); return;
  }
  moveHitTest(state);
  if (state.wMoveMissed !== 0) { yield* delayFrames(50); yield* printDidntAffectText(env.host); return; }
  m[t.status] |= 0x40;
  quarterSpeedDueToParalysis(state);
  yield* delayFrames(30);
  yield* playCurrentMoveAnimation(state, env);
  yield* printMayNotAttackText(env.host);
}

/** pret effects.asm:1214-1219: compare the actual incoming A, including early primary failures. */
function* confusionFailed(state: BattleState, env: StatusEffectEnvironment, a: number): Program {
  if (a === 0x4c) return;
  yield* delayFrames(50);
  yield* conditionalPrintButItFailed(state, env.host);
}
/** pret effects.asm:1184-1208: set CONFUSED before its duration draw, then optional primary animation. */
function* confusionSuccess(state: BattleState, env: StatusEffectEnvironment): Program {
  const t = target(state), m = state.mem, id = effect(state);
  if ((m[t.flags1] & 0x80) !== 0) { yield* confusionFailed(state, env, id); return; }
  m[t.flags1] |= 0x80;
  m[t.confused] = (battleRandom(state) & 3) + 2;
  if (id !== 0x4c) yield* playCurrentMoveAnimation2(state, env);
  yield* env.host.printText('BecameConfusedText');
}
/** pret effects.asm:1176-1182: primary Substitute gate precedes MoveHitTest. */
export function* confusionEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  if (!checkTargetSubstitute(state).zero) { yield* confusionFailed(state, env, state.hWhoseTurn); return; }
  moveHitTest(state);
  if (state.wMoveMissed !== 0) { yield* confusionFailed(state, env, state.wMoveMissed); return; }
  yield* confusionSuccess(state, env);
}
/** pret effects.asm:1170-1174: secondary chance is 25/256 and bypasses Substitute/accuracy. */
export function* confusionSideEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  if (battleRandom(state) >= 25) return;
  yield* confusionSuccess(state, env);
}

/** pret effects.asm:1007-1032: link recharge clearing precedes the draw, even on failure. */
export function* flinchSideEffect(state: BattleState, _env: StatusEffectEnvironment): Program {
  if (!checkTargetSubstitute(state).zero) return;
  const t = target(state);
  if (state.wLinkState === LINK_STATE_BATTLING) clearHyperBeam(state);
  const threshold = effect(state) === 0x1f ? 26 : 77;
  if (battleRandom(state) >= threshold) return;
  state.mem[t.flags1] |= 8;
  clearHyperBeam(state);
}

/** pret move_effects/leech_seed.asm:1-32: accuracy before either Grass/seed gate; no Substitute check. */
export function* leechSeedEffect(state: BattleState, env: StatusEffectEnvironment): Program {
  moveHitTest(state);
  const t = target(state), m = state.mem;
  if (state.wMoveMissed !== 0 || m[t.status + 1] === 22 || m[t.status + 2] === 22 || (m[t.flags2] & 0x80) !== 0) {
    yield* delayFrames(50); yield* env.host.printText('EvadedAttackText'); return;
  }
  m[t.flags2] |= 0x80;
  yield* playCurrentMoveAnimation(state, env);
  yield* env.host.printText('WasSeededText');
}

/** pret effects.asm dispatch wrappers; data/moves/effects_pointers.asm:4-9,34-40,52,69-70,79,87. */
export function statusEffectHandlers(env: StatusEffectEnvironment): MoveEffectRegistry {
  return {
    SleepEffect: state => sleepEffect(state, env),
    PoisonEffect: state => poisonEffect(state, env),
    FreezeBurnParalyzeEffect: state => freezeBurnParalyzeEffect(state, env),
    ParalyzeEffect: state => paralyzeEffect(state, env),
    ConfusionEffect: state => confusionEffect(state, env),
    ConfusionSideEffect: state => confusionSideEffect(state, env),
    FlinchSideEffect: state => flinchSideEffect(state, env),
    LeechSeedEffect: state => leechSeedEffect(state, env),
  };
}
