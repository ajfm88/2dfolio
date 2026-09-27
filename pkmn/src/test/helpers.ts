// Test helper factories for building BattlePokemon and mocking randomness

import type { BattlePokemon, PokemonSpecies, BattleMove, StatStages } from '../battle/types';
import { createVolatiles } from '../battle/volatiles';
import type { Volatiles } from '../battle/volatiles';
import { vi } from 'vitest';

/** Default species for test Pokemon. */
export function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'TESTMON',
    hp: 50,
    attack: 50,
    defense: 50,
    speed: 50,
    special: 50,
    type1: 'NORMAL',
    type2: 'NORMAL',
    catchRate: 255,
    baseExp: 64,
    startMoves: ['TACKLE'],
    growthRate: 'MEDIUM_FAST',
    learnset: [],
    evolutions: [],
    ...overrides,
  };
}

/** Build a BattlePokemon with sensible defaults. Every field overridable. */
export function makePokemon(overrides?: Partial<BattlePokemon> & {
  speciesOverrides?: Partial<PokemonSpecies>;
  volatileOverrides?: Partial<Volatiles>;
}): BattlePokemon {
  const species = makeSpecies(overrides?.speciesOverrides);
  const moves: BattleMove[] = overrides?.moves ?? [
    { id: 'TACKLE', pp: 35, maxPp: 35 },
  ];
  const attack = overrides?.attack ?? 50;
  const defense = overrides?.defense ?? 50;
  const speed = overrides?.speed ?? 50;
  const special = overrides?.special ?? 50;

  const volatiles = overrides?.volatileOverrides
    ? { ...createVolatiles(), ...overrides.volatileOverrides }
    : overrides?.volatiles ?? createVolatiles();

  const pkmn: BattlePokemon = {
    species,
    nickname: overrides?.nickname ?? species.name,
    level: overrides?.level ?? 50,
    currentHp: overrides?.currentHp ?? 100,
    maxHp: overrides?.maxHp ?? 100,
    attack,
    defense,
    speed,
    special,
    moves,
    statStages: overrides?.statStages ?? { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    status: overrides?.status ?? null,
    atkDV: overrides?.atkDV ?? 8,
    defDV: overrides?.defDV ?? 8,
    spdDV: overrides?.spdDV ?? 8,
    spcDV: overrides?.spcDV ?? 8,
    exp: overrides?.exp ?? 125000,
    sleepTurns: overrides?.sleepTurns ?? 0,
    toxicCounter: overrides?.toxicCounter ?? 0,
    badlyPoisoned: overrides?.badlyPoisoned ?? false,
    volatiles,
    originalStats: overrides?.originalStats ?? { attack, defense, speed, special },
    otName: overrides?.otName ?? '',
    otId: overrides?.otId ?? 0,
  };
  return pkmn;
}

/** Make a Pokemon with specific types. */
export function makeTypedPokemon(type1: string, type2?: string): BattlePokemon {
  return makePokemon({
    speciesOverrides: { type1, type2: type2 ?? type1 },
  });
}

/** Default stat stages (all 0). */
export function defaultStages(): StatStages {
  return { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 };
}

// ──────── Random mocking ────────

let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

/** Mock Math.random to return values from a sequence (cycling). */
export function mockRandom(values: number[]): void {
  let idx = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    const val = values[idx % values.length];
    idx++;
    return val;
  });
}

/** Mock Math.random to always return a fixed value. */
export function mockRandomFixed(value: number): void {
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(value);
}

/** Restore Math.random to its original implementation. */
export function restoreRandom(): void {
  if (randomSpy) {
    randomSpy.mockRestore();
    randomSpy = null;
  }
}
