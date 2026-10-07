import { describe, it, expect, vi } from 'vitest';
import { countStep, enterMapCounters, runStepEnd, moodTowardNeutral, walkingHappinessRoll } from './step_end';
import type { StepEndCheck } from './step_end';
import { PlayerWalk } from './walk_pace';
import { getPikachuHappiness, getPikachuMood, restorePikachuHappiness, updatePikachuWalking } from '../pikachu/pikachu_happiness';

describe('step-end checks (home/overworld.asm)', () => {
  it('counts, updates Pikachu, rolls, then checks warps and connections', () => {
    const calls: StepEndCheck[] = [];
    runStepEnd(false, stage => { calls.push(stage); return null; });
    expect(calls).toEqual(['count', 'pikachu', 'encounter', 'warp', 'connection']);
  });

  it('a battle precedes transitions, and a warp precedes a connection', () => {
    for (const end of ['encounter', 'warp'] as const) {
      const calls: StepEndCheck[] = [];
      expect(runStepEnd(false, stage => { calls.push(stage); return stage === end ? end : null; })).toBe(end);
      expect(calls).not.toContain('connection');
      if (end === 'encounter') expect(calls).not.toContain('warp');
    }
  });

  it('each hop half checks transitions without counting or rolling', () => {
    const player = new PlayerWalk();
    player.pass('down', true, () => 'hop', () => {});
    const boundaries: number[] = [];
    const calls: StepEndCheck[] = [];
    for (let pass = 1; pass <= 16; pass++) {
      player.pass(null, false, () => 'hop', () => {});
      if (player.finishedStep) {
        boundaries.push(pass);
        runStepEnd(true, stage => { calls.push(stage); return null; });
      }
    }
    expect(boundaries).toEqual([8, 16]);
    expect(calls).toEqual(['warp', 'connection', 'warp', 'connection']);
    expect(player.landedHop).toBe(true);
  });

  it('the first two steps are calm; the third can roll after decrement', () => {
    let state = { stepCounter: 0, encounterCooldown: 3 };
    const cooldowns: number[] = [];
    for (let i = 0; i < 4; i++) { state = countStep(state); cooldowns.push(state.encounterCooldown); }
    expect(cooldowns).toEqual([2, 1, 0, 0]);
  });

  it('EnterMap resets the 256-step counter and rearms only an active cooldown', () => {
    expect(enterMapCounters({ stepCounter: 8, encounterCooldown: 1 })).toEqual({ stepCounter: 0, encounterCooldown: 3 });
    expect(enterMapCounters({ stepCounter: 8, encounterCooldown: 0 })).toEqual({ stepCounter: 0, encounterCooldown: 0 });
  });

  it('the 8-bit countdown wraps on the 256th step', () => {
    let state = { stepCounter: 0, encounterCooldown: 0 };
    for (let i = 1; i < 256; i++) { state = countStep(state); expect(state.stepCounter).not.toBe(0); }
    expect(countStep(state).stepCounter).toBe(0);
    expect(state.stepCounter).toBe(1);
  });
});

describe('UpdatePikachuHappinessAndMood', () => {
  it('walking happiness is a 50% low-bit roll only at counter zero', () => {
    for (let byte = 0; byte < 256; byte++) {
      expect(walkingHappinessRoll(0, byte)).toBe((byte & 1) !== 0);
      expect(walkingHappinessRoll(1, byte)).toBe(false);
    }
  });

  it.each([[0, 1], [127, 128], [128, 128], [129, 128], [255, 254]])('mood %i converges to %i', (before, after) => {
    expect(moodTowardNeutral(before)).toBe(after);
  });

  it('uses no happiness random number on intervening steps', () => {
    restorePikachuHappiness(90, 100);
    const random = vi.fn(() => 1);
    updatePikachuWalking(255, random, true);
    expect(random).not.toHaveBeenCalled();
    expect(getPikachuHappiness()).toBe(90);
    expect(getPikachuMood()).toBe(101);
  });

  it('the successful walking bonus still drifts mood by exactly one', () => {
    restorePikachuHappiness(90, 100);
    updatePikachuWalking(0, () => 1, true);
    expect(getPikachuHappiness()).toBe(92);
    expect(getPikachuMood()).toBe(101);
    restorePikachuHappiness(90, 100);
    updatePikachuWalking(0, () => 0, true);
    expect(getPikachuHappiness()).toBe(90);
    expect(getPikachuMood()).toBe(101);
  });

  it('an absent or fainted starter skips the bonus but still rolls and drifts mood', () => {
    restorePikachuHappiness(90, 200);
    const random = vi.fn(() => 1);
    updatePikachuWalking(0, random, false);
    expect(random).toHaveBeenCalledOnce();
    expect(getPikachuHappiness()).toBe(90);
    expect(getPikachuMood()).toBe(199);
  });
});
