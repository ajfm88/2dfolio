import { expect } from 'vitest';
import type { BattleState } from '../battle/battle_state';

/** Script actual seeded BattleRandom outputs through DIV, recording each consumed named draw. */
export function namedBattleRandom(state: BattleState, phase: string, bytes: readonly number[]): string[] {
  const log: string[] = [];
  let i = 0, second = false;
  state.readDIV = () => {
    expect(i, `unexpected ${phase} draw`).toBeLessThan(bytes.length);
    if (!second) {
      second = true;
      return (bytes[i] - state.hRandomAdd - 1) & 0xff;
    }
    second = false;
    log.push(`${state.hWhoseTurn}:${phase}:${state.hRandomAdd}`);
    expect(state.hRandomAdd).toBe(bytes[i++]);
    return 0;
  };
  return log;
}
