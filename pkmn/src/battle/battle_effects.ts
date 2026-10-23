// Unused move-effect dispatch and shared helpers. pret e89ead15 effects.asm:1-22,1237-1247,1447-1558.
import type { BattleState } from './battle_state';
import { BattleUnsupportedState } from './battle_move_data';
import type { ExecutePorts } from './battle_execute';
import type { BattleTurnTextHost } from './battle_turn_text';
import type { Program } from './battle_menu_context';
import { battleScreenFor } from './battle_screen';
export { printDoesntAffectText } from './battle_apply';

// pret data/moves/effects_pointers.asm:4-89; origin/symbols 573535d7, 0f:70c5.
// These are bank-0f wrapper addresses, not the far implementation addresses.
export const MOVE_EFFECT_POINTERS = [
  { label: 'SleepEffect', address: 0x7171 },
  { label: 'PoisonEffect', address: 0x71d2 },
  { label: 'DrainHPEffect', address: 0x726c },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'ExplodeEffect', address: 0x7274 },
  { label: 'DrainHPEffect', address: 0x726c },
  null,
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'PayDayEffect', address: 0x7ae9 },
  null,
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'ConversionEffect', address: 0x7af1 },
  { label: 'HazeEffect', address: 0x7af9 },
  { label: 'BideEffect', address: 0x769b },
  { label: 'ThrashPetalDanceEffect', address: 0x76cd },
  { label: 'SwitchAndTeleportEffect', address: 0x76ef },
  { label: 'TwoToFiveAttacksEffect', address: 0x77c7 },
  { label: 'TwoToFiveAttacksEffect', address: 0x77c7 },
  { label: 'FlinchSideEffect', address: 0x7811 },
  { label: 'SleepEffect', address: 0x7171 },
  { label: 'PoisonEffect', address: 0x71d2 },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'FreezeBurnParalyzeEffect', address: 0x728f },
  { label: 'FlinchSideEffect', address: 0x7811 },
  { label: 'OneHitKOEffect', address: 0x7842 },
  { label: 'ChargeEffect', address: 0x784a },
  null,
  null,
  { label: 'TrappingEffect', address: 0x78f2 },
  { label: 'ChargeEffect', address: 0x784a },
  { label: 'TwoToFiveAttacksEffect', address: 0x77c7 },
  null,
  { label: 'MistEffect', address: 0x791c },
  { label: 'FocusEnergyEffect', address: 0x7924 },
  { label: 'RecoilEffect', address: 0x792c },
  { label: 'ConfusionEffect', address: 0x793c },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'StatModifierUpEffect', address: 0x73de },
  { label: 'HealEffect', address: 0x7b01 },
  { label: 'TransformEffect', address: 0x7b09 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'ReflectLightScreenEffect', address: 0x7b11 },
  { label: 'ReflectLightScreenEffect', address: 0x7b11 },
  { label: 'PoisonEffect', address: 0x71d2 },
  { label: 'ParalyzeEffect', address: 0x798c },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'StatModifierDownEffect', address: 0x7502 },
  { label: 'ConfusionSideEffect', address: 0x7934 },
  { label: 'TwoToFiveAttacksEffect', address: 0x77c7 },
  null,
  { label: 'SubstituteEffect', address: 0x7994 },
  { label: 'HyperBeamEffect', address: 0x799c },
  { label: 'RageEffect', address: 0x79ba },
  { label: 'MimicEffect', address: 0x79c8 },
  null,
  { label: 'LeechSeedEffect', address: 0x7a57 },
  { label: 'SplashEffect', address: 0x7a5f },
  { label: 'DisableEffect', address: 0x7a65 },
] as const;
export type MoveEffectLabel = NonNullable<(typeof MOVE_EFFECT_POINTERS)[number]>['label'];
export type MoveEffectHandler = (state: BattleState) => Program<number | void>;
export type MoveEffectRegistry = Partial<Record<MoveEffectLabel, MoveEffectHandler>>;
export interface EffectAnimationPort {
  /** MoveAnimation only; the shared helper owns Func_78e98. */
  animation(state: BattleState): Program;
}

/** pret effects.asm:1-22. Both CALL and JP reach the same b=1 return wrapper. */
export function* jumpMoveEffect(
  state: BattleState, _mode: 'call' | 'tail', registry: MoveEffectRegistry,
): Program<number> {
  const effect = state.hWhoseTurn === 0 ? state.wPlayerMoveEffect : state.wEnemyMoveEffect;
  if (effect < 1 || effect > MOVE_EFFECT_POINTERS.length) {
    throw new BattleUnsupportedState(`move effect $${effect.toString(16).padStart(2, '0')}`);
  }
  const pointer = MOVE_EFFECT_POINTERS[effect - 1];
  if (pointer === null) throw new BattleUnsupportedState(`NULL move effect $${effect.toString(16)}`);
  const handler = registry[pointer.label];
  if (!handler) throw new BattleUnsupportedState(`unregistered move effect ${pointer.label}`);
  yield* handler(state);
  return 1;
}

/** pret effects.asm:6-22; core.asm execution callers retain their effect/mode port shape. */
export function bindMoveEffects(registry: MoveEffectRegistry): ExecutePorts['jumpMoveEffect'] {
  return (state, _effect, mode) => jumpMoveEffect(state, mode, registry);
}

/** pret effects.asm:1492-1502. BIT sets H, clears N; preceding AND clears carry. */
export function checkTargetSubstitute(state: BattleState): { zero: boolean; carry: false; halfCarry: true; subtract: false } {
  const status = state.hWhoseTurn === 0 ? state.wEnemyBattleStatus2 : state.wPlayerBattleStatus2;
  return { zero: (status & 0x10) === 0, carry: false, halfCarry: true, subtract: false };
}

/** pret effects.asm:1237-1247. RES preserves flags from AND hWhoseTurn. */
export function clearHyperBeam(state: BattleState): { zero: boolean; carry: false; halfCarry: false; subtract: false } {
  if (state.hWhoseTurn === 0) state.wEnemyBattleStatus2 &= ~0x20;
  else state.wPlayerBattleStatus2 &= ~0x20;
  return { zero: state.hWhoseTurn === 0, carry: false, halfCarry: false, subtract: false };
}

/** pret effects.asm:1548-1558. No core PlayMoveAnimation Delay3 prefix here. */
export function* playBattleAnimationGotID(state: BattleState, ports: EffectAnimationPort): Program {
  yield* ports.animation(state);
  yield* battleScreenFor(state).refreshAfterAnimation();
}

/** pret effects.asm:1544-1558. Preserve the caller's animation type. */
export function* playBattleAnimation(state: BattleState, ports: EffectAnimationPort, id: number): Program {
  state.wAnimationID = id;
  yield* playBattleAnimationGotID(state, ports);
}

/** pret effects.asm:1517-1527. Types 6 (player) and 3 (enemy). */
export function* playBattleAnimation2(state: BattleState, ports: EffectAnimationPort, id: number): Program {
  state.wAnimationID = id;
  state.wAnimationType = state.hWhoseTurn === 0 ? 6 : 3;
  yield* playBattleAnimationGotID(state, ports);
}

/** pret effects.asm:1529-1546. Type is reset even when the zero move skips animation. */
export function* playCurrentMoveAnimation(state: BattleState, ports: EffectAnimationPort): Program {
  state.wAnimationType = 0;
  const move = state.hWhoseTurn === 0 ? state.wPlayerMoveNum : state.wEnemyMoveNum;
  if (move === 0) return;
  yield* playBattleAnimation(state, ports, move);
}

/** pret effects.asm:1504-1527. Zero guard precedes ID and type writes. */
export function* playCurrentMoveAnimation2(state: BattleState, ports: EffectAnimationPort): Program {
  const move = state.hWhoseTurn === 0 ? state.wPlayerMoveNum : state.wEnemyMoveNum;
  if (move === 0) return;
  yield* playBattleAnimation2(state, ports, move);
}

/** pret effects.asm:1464-1466. PrintText owns opening/printer waits. */
export function* printButItFailedText(host: BattleTurnTextHost): Program {
  yield* host.printText('ButItFailedText');
}
/** pret effects.asm:1459-1466. A failed secondary never prints after a successful move. */
export function* conditionalPrintButItFailed(state: BattleState, host: BattleTurnTextHost): Program {
  if (state.wMoveDidntMiss !== 0) return;
  yield* printButItFailedText(host);
}
/** pret effects.asm:1472-1474. */
export function* printDidntAffectText(host: BattleTurnTextHost): Program {
  yield* host.printText('DidntAffectText');
}
/** pret effects.asm:1451-1453. */
export function* printNoEffectText(host: BattleTurnTextHost): Program {
  yield* host.printText('NoEffectText');
}
/** pret effects.asm:1484-1486. */
export function* printMayNotAttackText(host: BattleTurnTextHost): Program {
  yield* host.printText('ParalyzedMayNotAttackText');
}
/** pret effects.asm:548-550. */
export function* printNothingHappenedText(host: BattleTurnTextHost): Program {
  yield* host.printText('NothingHappenedText');
}
