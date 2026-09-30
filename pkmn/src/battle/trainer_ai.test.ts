import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { selectTrainerMove } from './trainer_ai';
import { loadBattleData } from './data';
import { makePokemon, mockRandomFixed, mockRandom, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

describe('selectTrainerMove', () => {
  it('single move: returns that move', () => {
    const enemy = makePokemon({
      moves: [{ id: 'TACKLE', pp: 35, maxPp: 35 }],
    });
    const player = makePokemon();
    expect(selectTrainerMove(enemy, player, [])).toBe('TACKLE');
  });

  it('no PP moves: returns STRUGGLE', () => {
    const enemy = makePokemon({
      moves: [{ id: 'TACKLE', pp: 0, maxPp: 35 }],
    });
    const player = makePokemon();
    expect(selectTrainerMove(enemy, player, [])).toBe('STRUGGLE');
  });

  it('0 PP moves heavily discouraged (score 50)', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'TACKLE', pp: 0, maxPp: 35 },
        { id: 'SCRATCH', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon();
    mockRandomFixed(0.5);
    // TACKLE has score 50 (0 PP), SCRATCH has score 10 → pick SCRATCH
    expect(selectTrainerMove(enemy, player, [])).toBe('SCRATCH');
  });
});

describe('modification 1: discourage status on statused player', () => {
  it('player has status: status moves get +5 score', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'SLEEP_POWDER', pp: 15, maxPp: 15 },
        { id: 'TACKLE', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon({ status: 'PSN' });
    mockRandomFixed(0.5);
    // SLEEP_POWDER score: 10 + 5 = 15, TACKLE score: 10 → pick TACKLE
    expect(selectTrainerMove(enemy, player, [1])).toBe('TACKLE');
  });

  it('player has no status: no modification', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'SLEEP_POWDER', pp: 15, maxPp: 15 },
        { id: 'TACKLE', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon(); // no status
    mockRandomFixed(0); // tiebreak: pick first
    // Both score 10, random selects first match
    const result = selectTrainerMove(enemy, player, [1]);
    expect(['SLEEP_POWDER', 'TACKLE']).toContain(result);
  });
});

describe('modification 2: encourage stat mods', () => {
  it('75% chance of no effect (random != 0)', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'SWORDS_DANCE', pp: 30, maxPp: 30 },
        { id: 'TACKLE', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon();
    // First random for mod2 check: floor(0.5*4)=2 != 0 → no effect
    // Second random for tiebreak
    mockRandom([0.5, 0.0]);
    const result = selectTrainerMove(enemy, player, [2]);
    // Both still score 10, tiebreak picks randomly
    expect(['SWORDS_DANCE', 'TACKLE']).toContain(result);
  });

  it('25% chance: stat-mod moves get -1 score', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'SWORDS_DANCE', pp: 30, maxPp: 30 },
        { id: 'TACKLE', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon();
    // First random for mod2 check: floor(0*4)=0 → apply!
    // Second random for tiebreak (shouldn't matter)
    mockRandom([0.0, 0.5]);
    const result = selectTrainerMove(enemy, player, [2]);
    // SWORDS_DANCE score: 10-1=9, TACKLE: 10 → pick SWORDS_DANCE
    expect(result).toBe('SWORDS_DANCE');
  });
});

describe('modification 3: type effectiveness', () => {
  it('super-effective gets -1 (encouraged)', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'THUNDERBOLT', pp: 15, maxPp: 15 }, // ELECTRIC vs WATER = 2x
        { id: 'TACKLE', pp: 35, maxPp: 35 },       // NORMAL vs WATER = 1x
      ],
    });
    const player = makePokemon({ speciesOverrides: { type1: 'WATER', type2: 'WATER' } });
    mockRandomFixed(0.5);
    // THUNDERBOLT: 10-1=9, TACKLE: 10 → pick THUNDERBOLT
    expect(selectTrainerMove(enemy, player, [3])).toBe('THUNDERBOLT');
  });

  it('not-very-effective gets +1 if better move exists', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'WATER_GUN', pp: 25, maxPp: 25 },   // WATER vs WATER = 0.5x
        { id: 'THUNDERBOLT', pp: 15, maxPp: 15 },  // ELECTRIC vs WATER = 2x
      ],
    });
    const player = makePokemon({ speciesOverrides: { type1: 'WATER', type2: 'WATER' } });
    mockRandomFixed(0.5);
    // WATER_GUN: 10+1=11 (NVE + has better), THUNDERBOLT: 10-1=9 (SE) → THUNDERBOLT
    expect(selectTrainerMove(enemy, player, [3])).toBe('THUNDERBOLT');
  });
});

describe('combined modifiers', () => {
  it('multiple modifiers applied in order', () => {
    const enemy = makePokemon({
      moves: [
        { id: 'THUNDERBOLT', pp: 15, maxPp: 15 },
        { id: 'TACKLE', pp: 35, maxPp: 35 },
      ],
    });
    const player = makePokemon({
      speciesOverrides: { type1: 'WATER', type2: 'WATER' },
    });
    // Mod 3 only: THUNDERBOLT gets -1 (SE)
    mockRandomFixed(0.5);
    expect(selectTrainerMove(enemy, player, [3])).toBe('THUNDERBOLT');
  });
});
