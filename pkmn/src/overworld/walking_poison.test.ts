import { describe, expect, it } from 'vitest';
import type { BattlePokemon } from '../battle';
import { countStep } from './step_end';
import { applyWalkingPoison, walkingPoisonSteps } from './walking_poison';

function mon(currentHp: number, status: BattlePokemon['status']): BattlePokemon {
  return { currentHp, status } as BattlePokemon;
}
const normal = { suppressed: false };

describe('walking poison', () => {
  it('uses the countdown, damaging at zero and after the wrap at 252', () => {
    const p = mon(5, 'PSN');
    let state = { stepCounter: 0, encounterCooldown: 0 };
    for (const counter of [255, 254, 253]) {
      state = countStep(state);
      expect(state.stepCounter).toBe(counter);
      expect(applyWalkingPoison(counter, [p], normal)).toEqual({ fainted: [], poisonEffect: false, blackout: false });
      expect(p.currentHp).toBe(5);
    }
    state = countStep(state);
    expect(state.stepCounter).toBe(252);
    expect(applyWalkingPoison(state.stepCounter, [p], normal).poisonEffect).toBe(true);
    expect(p.currentHp).toBe(4);
    expect(applyWalkingPoison(0, [p], normal).poisonEffect).toBe(true);
    expect(p.currentHp).toBe(3);
  });

  it('clears status and emits ordered faint indices before the remaining poison effect', () => {
    const party = [mon(1, 'PSN'), mon(8, 'BRN'), mon(1, 'PSN'), mon(2, 'PSN')];
    expect(applyWalkingPoison(4, party, normal)).toEqual({ fainted: [0, 2], poisonEffect: true, blackout: false });
    expect(party.map(p => [p.currentHp, p.status])).toEqual([[0, null], [8, 'BRN'], [0, null], [1, 'PSN']]);
  });

  it('leaves an already fainted poisoned member unchanged and counts its poison', () => {
    const party = [mon(0, 'PSN'), mon(2, null)];
    expect(applyWalkingPoison(4, party, normal)).toEqual({ fainted: [], poisonEffect: true, blackout: false });
    expect(party[0]).toMatchObject({ currentHp: 0, status: 'PSN' });
  });

  it('checks blackout after damage and even on non-damage steps', () => {
    const party = [mon(1, 'PSN'), mon(0, null)];
    expect(applyWalkingPoison(4, party, normal)).toEqual({ fainted: [0], poisonEffect: false, blackout: true });
    expect(applyWalkingPoison(3, party, normal)).toEqual({ fainted: [], poisonEffect: false, blackout: true });
  });

  it('skips all processing for empty parties and the host guard', () => {
    expect(applyWalkingPoison(0, [], normal)).toEqual({ fainted: [], poisonEffect: false, blackout: false });
    const p = mon(1, 'PSN');
    expect(applyWalkingPoison(0, [p], { suppressed: true })).toEqual({ fainted: [], poisonEffect: false, blackout: false });
    expect(p).toMatchObject({ currentHp: 1, status: 'PSN' });
  });

  it('yields each faint before the next poisoned member loses HP', () => {
    const party = [mon(1, 'PSN'), mon(4, 'PSN')];
    const steps = walkingPoisonSteps(0, party, normal);
    expect(steps.next().value).toEqual({ kind: 'fainted', index: 0 });
    expect(party.map(p => [p.currentHp, p.status])).toEqual([[0, null], [4, 'PSN']]);
    expect(steps.next().value).toEqual({ kind: 'done', poisonEffect: true, blackout: false });
    expect(party[1]).toMatchObject({ currentHp: 3, status: 'PSN' });
  });
});
