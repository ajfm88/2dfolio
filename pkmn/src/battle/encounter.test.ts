import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { loadWildEncounters, tryWildEncounter, encounterTerrain } from './encounter';
import type { EncounterContext } from './encounter';
import { loadBattleData } from './data';
import { mockRandom, mockRandomFixed, restoreRandom } from '../test/helpers';

const grass: EncounterContext = {
  inGrass: true, inWater: false, indoor: false, forest: false,
  controlled: false, movementBlocked: false, onDoorOrWarp: false,
  outsideMap: false, cooldown: 0, disabled: false,
};

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
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
    expect(result!.species).toBeDefined();
    expect(result!.level).toBeGreaterThan(0);
  });

  it('returns null when rate check fails', () => {
    mockRandomFixed(0.99); // floor(0.99*256) = 253 >= 25 → no encounter
    const result = tryWildEncounter(grass);
    expect(result).toBeNull();
  });

  it('slot selection: slot 0 for low random', () => {
    // threshold for slot 0 = 51
    mockRandom([0, 0.1]); // rate pass, slot roll = floor(0.1*256) = 25 < 51 → slot 0
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
  });

  it('slot selection: last slot for high random', () => {
    mockRandom([0, 0.99]); // rate pass, slot roll = floor(0.99*256) = 253 → slot 8 or 9
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
  });
});

describe('TryDoWildEncounter conditions', () => {
  it.each(['controlled', 'movementBlocked', 'onDoorOrWarp', 'outsideMap', 'disabled'] as const)(
    'does not roll when %s is set', gate => {
      const context = { ...grass, [gate]: true };
      mockRandomFixed(0);
      expect(encounterTerrain(context)).toBeNull();
      expect(tryWildEncounter(context)).toBeNull();
    });

  it('blocks turns as well as steps while the cooldown is nonzero', () => {
    mockRandomFixed(0);
    expect(tryWildEncounter({ ...grass, cooldown: 1 })).toBeNull();
    expect(tryWildEncounter({ ...grass, cooldown: 0 })).not.toBeNull();
  });

  it('uses grass on indoor floor tiles, with a real encounter pool', () => {
    const floor = { ...grass, inGrass: false, indoor: true };
    mockRandomFixed(0);
    expect(encounterTerrain(floor)).toBe('grass');
    expect(tryWildEncounter(floor)).not.toBeNull();
  });

  it('FOREST maps still require grass or water even though numerically indoor', () => {
    expect(encounterTerrain({ ...grass, indoor: true, forest: true, inGrass: false })).toBeNull();
    expect(encounterTerrain({ ...grass, indoor: true, forest: true })).toBe('grass');
  });

  it('outdoor floor tiles cannot roll', () => {
    expect(encounterTerrain({ ...grass, inGrass: false })).toBeNull();
  });

  it('water uses its own pool; an empty water table never falls back to grass', () => {
    const water = { ...grass, inGrass: false, inWater: true, indoor: true };
    mockRandomFixed(0);
    expect(encounterTerrain(water)).toBe('water');
    expect(tryWildEncounter(water)).toBeNull(); // Route 1 has no water encounters
  });
});
