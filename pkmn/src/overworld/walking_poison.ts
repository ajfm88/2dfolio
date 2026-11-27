import type { BattlePokemon } from '../battle';

export interface WalkingPoisonGuards {
  /** Owned by the step host: simulated movement, Pikachu map script, or link connection. */
  suppressed: boolean;
}

export interface WalkingPoisonResult {
  /** Party indices, in cartridge notification order. */
  fainted: number[];
  poisonEffect: boolean;
  blackout: boolean;
}

/** One pause point in ApplyOutOfBattlePoisonDamage. The next member is unchanged until the caller resumes. */
export type WalkingPoisonEvent =
  | { kind: 'fainted'; index: number }
  | { kind: 'done'; poisonEffect: boolean; blackout: boolean };

/**
 * ApplyOutOfBattlePoisonDamage's HP loop (engine/events/poison.asm), one member at a time.
 * A faint yield returns before the next member loses HP, which is where the cartridge prints.
 * UI, the starter clip and PSNFNT stay with the caller.
 */
export function* walkingPoisonSteps(
  stepCounter: number, party: readonly BattlePokemon[], guards: WalkingPoisonGuards,
): Generator<WalkingPoisonEvent, void, void> {
  if (guards.suppressed || party.length === 0) {
    yield { kind: 'done', poisonEffect: false, blackout: false };
    return;
  }

  const damage = (stepCounter & 3) === 0;
  if (damage) {
    for (let index = 0; index < party.length; index++) {
      const mon = party[index];
      if (mon.status !== 'PSN' || mon.currentHp === 0) continue;
      mon.currentHp--;
      if (mon.currentHp === 0) {
        mon.status = null;
        yield { kind: 'fainted', index };
      }
    }
  }
  yield {
    kind: 'done',
    poisonEffect: damage && party.some(mon => mon.status === 'PSN'),
    blackout: party.every(mon => mon.currentHp === 0),
  };
}

export interface WalkingPoisonPending {
  first: WalkingPoisonEvent;
  steps: Generator<WalkingPoisonEvent, void, void>;
}

/** The live step host: nothing visible stays inline, so the pass is not given up. */
export function beginWalkingPoison(
  stepCounter: number, party: readonly BattlePokemon[],
): WalkingPoisonPending | null {
  const steps = walkingPoisonSteps(stepCounter, party, { suppressed: false });
  const first = steps.next();
  if (first.done || first.value === undefined) return null;
  if (first.value.kind === 'done' && !first.value.poisonEffect && !first.value.blackout) return null;
  return { first: first.value, steps };
}

/** ApplyOutOfBattlePoisonDamage, excluding its UI, audio and Pikachu side effects. */
export function applyWalkingPoison(
  stepCounter: number, party: readonly BattlePokemon[], guards: WalkingPoisonGuards,
): WalkingPoisonResult {
  const result: WalkingPoisonResult = { fainted: [], poisonEffect: false, blackout: false };
  for (const step of walkingPoisonSteps(stepCounter, party, guards)) {
    if (step.kind === 'fainted') result.fainted.push(step.index);
    else {
      result.poisonEffect = step.poisonEffect;
      result.blackout = step.blackout;
    }
  }
  return result;
}
