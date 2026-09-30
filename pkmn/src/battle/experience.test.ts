import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { totalExpForLevel, expToNextLevel, calcLevelFromExp, calcExpGain, gainExperience, initExperience, forceLearnMove } from './experience';
import { loadBattleData, createPokemon } from './data';
import { makePokemon, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

// ──────── totalExpForLevel ────────

describe('totalExpForLevel', () => {
  it('level 1 returns 0 for all growth rates', () => {
    expect(totalExpForLevel('MEDIUM_FAST', 1)).toBe(0);
    expect(totalExpForLevel('MEDIUM_SLOW', 1)).toBe(0);
    expect(totalExpForLevel('FAST', 1)).toBe(0);
    expect(totalExpForLevel('SLOW', 1)).toBe(0);
  });

  it('MEDIUM_FAST level 100 = 1,000,000', () => {
    expect(totalExpForLevel('MEDIUM_FAST', 100)).toBe(1000000);
  });

  it('FAST level 100 = 800,000', () => {
    expect(totalExpForLevel('FAST', 100)).toBe(800000);
  });

  it('SLOW level 100 = 1,250,000', () => {
    expect(totalExpForLevel('SLOW', 100)).toBe(1250000);
  });

  it('MEDIUM_FAST level 10 = 1000', () => {
    expect(totalExpForLevel('MEDIUM_FAST', 10)).toBe(1000);
  });

  it('FAST level 10 = 800', () => {
    expect(totalExpForLevel('FAST', 10)).toBe(800);
  });

  it('SLOW level 10 = 1250', () => {
    expect(totalExpForLevel('SLOW', 10)).toBe(1250);
  });

  it('MEDIUM_SLOW level 10', () => {
    // 6*1000/5 - 15*100 + 100*10 - 140 = 1200 - 1500 + 1000 - 140 = 560
    expect(totalExpForLevel('MEDIUM_SLOW', 10)).toBe(560);
  });
});

// ──────── expToNextLevel ────────

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

// ──────── calcLevelFromExp ────────

describe('calcLevelFromExp', () => {
  it('0 exp = level 1', () => {
    expect(calcLevelFromExp('MEDIUM_FAST', 0)).toBe(1);
  });

  it('exact threshold = that level', () => {
    // Level 10 MEDIUM_FAST = 1000 exp
    expect(calcLevelFromExp('MEDIUM_FAST', 1000)).toBe(10);
  });

  it('one below threshold = previous level', () => {
    expect(calcLevelFromExp('MEDIUM_FAST', 999)).toBe(9);
  });

  it('huge exp = level 100', () => {
    expect(calcLevelFromExp('MEDIUM_FAST', 9999999)).toBe(100);
  });
});

// ──────── calcExpGain ────────

describe('calcExpGain', () => {
  it('wild: floor(baseExp * level / 7)', () => {
    const enemy = makePokemon({
      level: 21,
      speciesOverrides: { baseExp: 64 },
    });
    // floor(64 * 21 / 7) = floor(192) = 192
    expect(calcExpGain(enemy, false)).toBe(192);
  });

  it('trainer: 1.5x multiplier', () => {
    const enemy = makePokemon({
      level: 21,
      speciesOverrides: { baseExp: 64 },
    });
    // wild = 192, trainer = floor(192 * 3/2) = 288
    expect(calcExpGain(enemy, true)).toBe(288);
  });

  it('minimum 1', () => {
    const enemy = makePokemon({
      level: 1,
      speciesOverrides: { baseExp: 1 },
    });
    expect(calcExpGain(enemy, false)).toBe(1); // max(1, floor(1*1/7)) = max(1,0) = 1
  });
});

// ──────── gainExperience ────────

describe('gainExperience', () => {
  it('no level up when insufficient exp', () => {
    const pkmn = createPokemon('PIKACHU', 10, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    const results = gainExperience(pkmn, 10); // tiny amount
    expect(results).toHaveLength(0);
    expect(pkmn.level).toBe(10);
  });

  it('single level up recalculates stats', () => {
    const pkmn = createPokemon('PIKACHU', 10, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    const oldMaxHp = pkmn.maxHp;
    // Level 11 MEDIUM_FAST = 1331, level 10 = 1000, need 331 more
    const results = gainExperience(pkmn, 400);
    expect(results).toHaveLength(1);
    expect(pkmn.level).toBe(11);
    expect(pkmn.maxHp).toBeGreaterThan(oldMaxHp);
    expect(results[0].hpGain).toBe(pkmn.maxHp - oldMaxHp);
  });

  it('multiple level ups at once', () => {
    const pkmn = createPokemon('PIKACHU', 5, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    // Level 5 MEDIUM_FAST = 125, level 10 = 1000, need 875+
    const results = gainExperience(pkmn, 5000);
    expect(results.length).toBeGreaterThan(1);
    expect(pkmn.level).toBeGreaterThan(5);
  });

  it('exp capped at level 100 exp', () => {
    const pkmn = createPokemon('PIKACHU', 99, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    gainExperience(pkmn, 99999999);
    expect(pkmn.level).toBe(100);
    expect(pkmn.exp).toBe(1000000); // level 100 MEDIUM_FAST
  });
});

// ──────── initExperience ────────

describe('initExperience', () => {
  it('sets exp to exact amount for current level', () => {
    const pkmn = createPokemon('PIKACHU', 25, undefined, { atk: 8, def: 8, spd: 8, spc: 8 })!;
    initExperience(pkmn);
    expect(pkmn.exp).toBe(15625); // 25^3
  });
});

// ──────── pendingMoves & forceLearnMove ────────

describe('pendingMoves', () => {
  it('move learned normally when moveset has space', () => {
    // Create a pokemon with 3 moves that learns a move at level 6
    const pkmn = makePokemon({
      level: 5,
      exp: 125, // level 5 = 125 exp
      speciesOverrides: {
        growthRate: 'MEDIUM_FAST',
        learnset: [{ level: 6, move: 'SCRATCH' }],
      },
      moves: [
        { id: 'TACKLE', pp: 35, maxPp: 35 },
        { id: 'GROWL', pp: 40, maxPp: 40 },
        { id: 'POUND', pp: 35, maxPp: 35 },
      ],
    });
    const results = gainExperience(pkmn, 200); // enough to reach level 6
    expect(results).toHaveLength(1);
    expect(results[0].newMoves).toContain('SCRATCH');
    expect(results[0].pendingMoves).toHaveLength(0);
    expect(pkmn.moves).toHaveLength(4);
  });

  it('returns pendingMoves when moveset is full', () => {
    const pkmn = makePokemon({
      level: 5,
      exp: 125,
      speciesOverrides: {
        growthRate: 'MEDIUM_FAST',
        learnset: [{ level: 6, move: 'SCRATCH' }],
      },
      moves: [
        { id: 'TACKLE', pp: 35, maxPp: 35 },
        { id: 'GROWL', pp: 40, maxPp: 40 },
        { id: 'POUND', pp: 35, maxPp: 35 },
        { id: 'LEER', pp: 30, maxPp: 30 },
      ],
    });
    const results = gainExperience(pkmn, 200);
    expect(results).toHaveLength(1);
    expect(results[0].newMoves).toHaveLength(0);
    expect(results[0].pendingMoves).toContain('SCRATCH');
    // Moveset unchanged — still has original 4 moves
    expect(pkmn.moves.map(m => m.id)).toEqual(['TACKLE', 'GROWL', 'POUND', 'LEER']);
  });

  it('duplicate moves are silently skipped', () => {
    const pkmn = makePokemon({
      level: 5,
      exp: 125,
      speciesOverrides: {
        growthRate: 'MEDIUM_FAST',
        learnset: [{ level: 6, move: 'TACKLE' }],
      },
      moves: [
        { id: 'TACKLE', pp: 35, maxPp: 35 },
        { id: 'GROWL', pp: 40, maxPp: 40 },
        { id: 'POUND', pp: 35, maxPp: 35 },
        { id: 'LEER', pp: 30, maxPp: 30 },
      ],
    });
    const results = gainExperience(pkmn, 200);
    expect(results[0].newMoves).toHaveLength(0);
    expect(results[0].pendingMoves).toHaveLength(0);
  });
});

describe('forceLearnMove', () => {
  it('replaces the move at the specified index', () => {
    const pkmn = makePokemon({
      moves: [
        { id: 'TACKLE', pp: 35, maxPp: 35 },
        { id: 'GROWL', pp: 40, maxPp: 40 },
        { id: 'POUND', pp: 35, maxPp: 35 },
        { id: 'LEER', pp: 30, maxPp: 30 },
      ],
    });
    forceLearnMove(pkmn, 'SCRATCH', 1);
    expect(pkmn.moves[1].id).toBe('SCRATCH');
    expect(pkmn.moves[1].pp).toBe(35); // SCRATCH has 35 PP
    // Other moves unchanged
    expect(pkmn.moves[0].id).toBe('TACKLE');
    expect(pkmn.moves[2].id).toBe('POUND');
    expect(pkmn.moves[3].id).toBe('LEER');
  });
});
