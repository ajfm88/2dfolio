import { expect, it } from 'vitest';
import { loadBattleData } from './data';
import { typeChart } from './battle_damage_asm';

it('requires boot data, then builds the 82-row chart once', async () => {
  expect(() => typeChart()).toThrow('type chart not loaded');
  await loadBattleData();
  const first = typeChart();
  expect(first).toHaveLength(82);
  expect(typeChart()).toBe(first);
  expect(first[0]).toEqual({ attack: 21, defend: 20, multiplier: 20 });
});
