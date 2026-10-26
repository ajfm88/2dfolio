import { expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isPassPressed: () => false, isHeld: () => false }));
import { BattleState } from './battle_state';
import { random } from './battle_random';

it('Random uses the supplied carry for ADC, propagating its overflow into SBC with two DIV reads', () => {
  const results: number[][] = [];
  for (const carry of [0, 1] as const) {
    const s = new BattleState(); s.hRandomAdd = 254; s.hRandomSub = 10;
    s.readDIV = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(3);
    results.push([random(s, carry), s.hRandomAdd, s.hRandomSub]);
    expect(s.readDIV).toHaveBeenCalledTimes(2);
  }
  expect(results).toEqual([[255, 255, 7], [0, 0, 6]]);
});
