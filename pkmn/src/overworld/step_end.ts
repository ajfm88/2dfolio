// A6b: StepCountCheck → UpdatePikachuHappinessAndMood → ApplyOutOfBattlePoisonDamage →
// NewBattle → CheckWarpsNoCollision → CheckMapConnections (home/overworld.asm).

export interface StepCounters {
  /** wStepCounter: an 8-bit countdown, initially zero. */
  stepCounter: number;
  /** Zero means BIT_WILD_ENCOUNTER_COOLDOWN is clear. */
  encounterCooldown: number;
}

/** EnterMap, including a return from battle. Connections bypass EnterMap. */
export function enterMapCounters(state: StepCounters): StepCounters {
  return { stepCounter: 0, encounterCooldown: state.encounterCooldown > 0 ? 3 : 0 };
}

export function countStep(state: StepCounters): StepCounters {
  return {
    stepCounter: (state.stepCounter - 1) & 0xff,
    encounterCooldown: Math.max(0, state.encounterCooldown - 1),
  };
}

export function moodTowardNeutral(mood: number): number {
  return mood + Math.sign(128 - mood);
}

export function walkingHappinessRoll(stepCounter: number, randomByte: number): boolean {
  return stepCounter === 0 && (randomByte & 1) !== 0;
}

export type StepEndCheck = 'count' | 'pikachu' | 'poison' | 'encounter' | 'warp' | 'connection';

/** Simulated steps (including each ledge-hop half) only check transitions. */
export function stepEndOrder(simulated: boolean): readonly StepEndCheck[] {
  return simulated ? ['warp', 'connection'] : ['count', 'pikachu', 'poison', 'encounter', 'warp', 'connection'];
}

/** Evaluate that order, stopping at the first transition/battle. `from` resumes after a poison suspension. */
export function runStepEnd<T>(
  simulated: boolean, check: (stage: StepEndCheck) => T | null, from?: StepEndCheck,
): T | null {
  const order = stepEndOrder(simulated);
  const start = from === undefined ? 0 : order.indexOf(from);
  if (start < 0) throw new Error(`unknown step-end stage ${from}`);
  for (const stage of order.slice(start)) {
    const action = check(stage);
    if (action !== null) return action;
  }
  return null;
}
