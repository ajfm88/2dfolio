// Unused composed move-effect registry. The families import battle_effects.ts, so the
// composition lives here (note 69 §10.17). Nothing in the running game imports this module.
import type { StatusEffectEnvironment } from './battle_effects_status';
import type { StatEffectEnvironment } from './battle_effects_stats';
import type { TurnEffectEnvironment } from './battle_effects_turns';
import type { HpEffectEnvironment } from './battle_effects_hp';
import { statusEffectHandlers } from './battle_effects_status';
import { statEffectHandlers } from './battle_effects_stats';
import { turnEffectHandlers } from './battle_effects_turns';
import { hpEffectHandlers } from './battle_effects_hp';
import { bindMoveEffects, type MoveEffectRegistry } from './battle_effects';
import type { ExecutePorts } from './battle_execute';

/** Intersection only: every member stays declared on the family that owns it. */
export type MoveEffectEnvironment =
  StatusEffectEnvironment & StatEffectEnvironment & TurnEffectEnvironment & HpEffectEnvironment;

/** The four factories spread into one table. HP is last, so a later HealEffect override replaces it. */
export function moveEffectHandlers(env: MoveEffectEnvironment): MoveEffectRegistry {
  return {
    ...statusEffectHandlers(env),
    ...statEffectHandlers(env),
    ...turnEffectHandlers(env),
    ...hpEffectHandlers(env),
  };
}

/** pret effects.asm:1-22 via bindMoveEffects. Call and tail both return b=1. */
export function composedJumpMoveEffect(env: MoveEffectEnvironment): ExecutePorts['jumpMoveEffect'] {
  return bindMoveEffects(moveEffectHandlers(env));
}
