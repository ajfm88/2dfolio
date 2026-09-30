import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { loadWildEncounters, tryWildEncounter } from './encounter';
import { loadBattleData } from './data';
import { mockRandom, mockRandomFixed, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
  await loadWildEncounters('Route1');
});

afterEach(() => {
  restoreRandom();
});

describe('tryWildEncounter', () => {
  it('returns valid BattlePokemon when encounter triggers', () => {
    // Rate check: random < rate; slot selection: pick slot 0
    mockRandom([0, 0]); // first: rate check (0 < 25), second: slot (0 → slot 0)
    const result = tryWildEncounter(true);
    expect(result).not.toBeNull();
    expect(result!.species).toBeDefined();
    expect(result!.level).toBeGreaterThan(0);
  });

  it('returns null when rate check fails', () => {
    mockRandomFixed(0.99); // floor(0.99*256) = 253 >= 25 → no encounter
    const result = tryWildEncounter(true);
    expect(result).toBeNull();
  });

  it('slot selection: slot 0 for low random', () => {
    // threshold for slot 0 = 51
    mockRandom([0, 0.1]); // rate pass, slot roll = floor(0.1*256) = 25 < 51 → slot 0
    const result = tryWildEncounter(true);
    expect(result).not.toBeNull();
  });

  it('slot selection: last slot for high random', () => {
    mockRandom([0, 0.99]); // rate pass, slot roll = floor(0.99*256) = 253 → slot 8 or 9
    const result = tryWildEncounter(true);
    expect(result).not.toBeNull();
  });
});
