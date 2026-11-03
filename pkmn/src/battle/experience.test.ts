import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { expToNextLevel, initExperience } from './experience';
import { loadBattleData, createPokemon } from './data';
import { restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

describe('expToNextLevel', () => {
  it('level 100 returns 0', () => {
    expect(expToNextLevel('MEDIUM_FAST', 100, 1000000)).toBe(0);
  });

  it('returns positive value for normal level', () => {
    // Level 10 MEDIUM_FAST: current exp = 1000, next level exp = 1331
    const needed = expToNextLevel('MEDIUM_FAST', 10, 1000);
    expect(needed).toBe(331);
  });
});

describe('initExperience', () => {
  it('sets exp to exact amount for current level', () => {
    const pkmn = createPokemon('PIKACHU', 25, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    initExperience(pkmn);
    expect(pkmn.exp).toBe(15625); // 25^3
  });
});
