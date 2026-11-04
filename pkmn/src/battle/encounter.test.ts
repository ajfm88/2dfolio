import { describe, it, expect, beforeAll } from 'vitest';
import { loadWildEncounters, tryWildEncounter, encounterTerrain } from './encounter';
import type { EncounterContext } from './encounter';
import { loadBattleData } from './data';
import { installOverworldRandom } from '../overworld/overworld_random';
import { pinOverworldRandom } from '../test/overworld_random_pin';

const grass: EncounterContext = {
  inGrass: true, inWater: false, indoor: false, forest: false,
  controlled: false, movementBlocked: false, onDoorOrWarp: false,
  outsideMap: false, cooldown: 0, disabled: false,
};

/** wild_encounters.asm:50-56 reads hRandomAdd for the rate and hRandomSub for the slot, without calling Random. */
function bytes(hRandomAdd: number, hRandomSub: number): void {
  pinOverworldRandom(0); // saved for setup.ts's unpin
  installOverworldRandom({ hRandomAdd, hRandomSub, carry: 0, random: () => { throw new Error('the encounter calls no Random'); } });
}

beforeAll(async () => {
  await loadBattleData();
  await loadWildEncounters('Route1');
});

describe('tryWildEncounter', () => {
  it('returns valid BattlePokemon when encounter triggers', () => {
    bytes(0, 0); // hRandomAdd 0 < rate 25; hRandomSub 0 → slot 0
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
    expect(result!.species).toBeDefined();
    expect(result!.level).toBeGreaterThan(0);
  });

  it('returns null when rate check fails', () => {
    bytes(253, 0); // hRandomAdd 253 >= 25 → no encounter
    const result = tryWildEncounter(grass);
    expect(result).toBeNull();
  });

  it('slot selection: slot 0 for low random', () => {
    bytes(0, 25); // rate pass; hRandomSub 25 < 51 → slot 0
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
  });

  it('slot selection: last slot for high random', () => {
    bytes(0, 253); // rate pass; hRandomSub 253 → slot 8 or 9
    const result = tryWildEncounter(grass);
    expect(result).not.toBeNull();
  });
});

describe('TryDoWildEncounter conditions', () => {
  it.each(['controlled', 'movementBlocked', 'onDoorOrWarp', 'outsideMap', 'disabled'] as const)(
    'does not roll when %s is set', gate => {
      const context = { ...grass, [gate]: true };
      bytes(0, 0);
      expect(encounterTerrain(context)).toBeNull();
      expect(tryWildEncounter(context)).toBeNull();
    });

  it('blocks turns as well as steps while the cooldown is nonzero', () => {
    bytes(0, 0);
    expect(tryWildEncounter({ ...grass, cooldown: 1 })).toBeNull();
    expect(tryWildEncounter({ ...grass, cooldown: 0 })).not.toBeNull();
  });

  it('uses grass on indoor floor tiles, with a real encounter pool', () => {
    const floor = { ...grass, inGrass: false, indoor: true };
    bytes(0, 0);
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
    bytes(0, 0);
    expect(encounterTerrain(water)).toBe('water');
    expect(tryWildEncounter(water)).toBeNull(); // Route 1 has no water encounters
  });
});

describe('the encounter bytes (DECISIONS #91)', () => {
  it('compares hRandomAdd with the rate and picks the slot from hRandomSub, the two bytes Random left', () => {
    // Route 1's grass rate is 25. The rate byte is the Add byte, the slot byte the Sub byte.
    bytes(25, 0);
    expect(tryWildEncounter(grass)).toBeNull();
    bytes(24, 0);
    const first = tryWildEncounter(grass);
    bytes(24, 255);
    const last = tryWildEncounter(grass);
    expect(first).not.toBeNull(); expect(last).not.toBeNull();
    expect([first!.species.name, first!.level]).not.toEqual([last!.species.name, last!.level]);
  });
});
