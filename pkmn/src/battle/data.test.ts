import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { loadBattleData, getSpecies, getSpeciesById, getMove, createPokemon } from './data';
import { mockRandom, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

describe('loadBattleData', () => {
  it('loads data successfully (getSpecies returns non-null)', () => {
    expect(getSpecies('PIKACHU')).not.toBeNull();
  });

  it('subsequent calls are cached (no error)', async () => {
    await loadBattleData(); // should be a no-op
    expect(getSpecies('PIKACHU')).not.toBeNull();
  });
});

describe('getSpecies', () => {
  it('returns Pikachu by name (case-insensitive)', () => {
    const pika = getSpecies('pikachu');
    expect(pika).not.toBeNull();
    expect(pika!.name.toUpperCase()).toBe('PIKACHU');
  });

  it('returns null for non-existent species', () => {
    expect(getSpecies('FAKEMON')).toBeNull();
  });
});

describe('getSpeciesById', () => {
  it('returns Bulbasaur for dexId=1', () => {
    const bulba = getSpeciesById(1);
    expect(bulba).not.toBeNull();
    expect(bulba!.name.toUpperCase()).toBe('BULBASAUR');
  });

  it('returns null for dexId=0', () => {
    expect(getSpeciesById(0)).toBeNull();
  });
});

describe('getMove', () => {
  it('returns THUNDERBOLT with correct fields', () => {
    const move = getMove('THUNDERBOLT');
    expect(move).not.toBeNull();
    expect(move!.power).toBe(95);
    expect(move!.type).toBe('ELECTRIC');
  });

  it('returns null for non-existent move', () => {
    expect(getMove('FAKE_MOVE')).toBeNull();
  });
});

describe('createPokemon', () => {
  describe('stat calculation', () => {
    it('HP formula: floor(((base+DV)*2*level)/100) + level + 10', () => {
      // Pikachu: hp base = 35, with DV 15, level 50
      // hpDV = ((15&1)<<3)|((15&1)<<2)|((15&1)<<1)|(15&1) = 15
      // HP = floor(((35+15)*2*50)/100) + 50 + 10 = floor(5000/100) + 60 = 50 + 60 = 110
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 15, def: 15, spd: 15, spc: 15 });
      expect(pkmn).not.toBeNull();
      expect(pkmn!.maxHp).toBe(110);
    });

    it('other stats: floor(((base+DV)*2*level)/100) + 5', () => {
      // Pikachu: attack base = 55, DV = 15
      // Attack = floor(((55+15)*2*50)/100) + 5 = floor(7000/100) + 5 = 70 + 5 = 75
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 15, def: 15, spd: 15, spc: 15 });
      expect(pkmn!.attack).toBe(75);
    });

    it('DV=0 vs DV=15: stat difference', () => {
      const pkmnLow = createPokemon('PIKACHU', 50, undefined, { atk: 0, def: 0, spd: 0, spc: 0 });
      const pkmnHigh = createPokemon('PIKACHU', 50, undefined, { atk: 15, def: 15, spd: 15, spc: 15 });
      expect(pkmnHigh!.attack).toBeGreaterThan(pkmnLow!.attack);
    });
  });

  describe('HP DV construction', () => {
    it('all DVs odd (15): HP DV = 15', () => {
      // All DVs = 15 (odd), HP DV = ((1<<3)|(1<<2)|(1<<1)|1) = 15
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 15, def: 15, spd: 15, spc: 15 });
      // HP = floor(((35+15)*2*50)/100) + 50 + 10 = 110
      expect(pkmn!.maxHp).toBe(110);
    });

    it('all DVs even (0): HP DV = 0', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 0, def: 0, spd: 0, spc: 0 });
      // HP DV = 0, HP = floor(((35+0)*2*50)/100) + 50 + 10 = floor(3500/100)+60 = 35+60 = 95
      expect(pkmn!.maxHp).toBe(95);
    });
  });

  describe('DV generation', () => {
    it('with dvs param: exact DVs used', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 7, def: 3, spd: 10, spc: 5 });
      expect(pkmn!.atkDV).toBe(7);
      expect(pkmn!.defDV).toBe(3);
      expect(pkmn!.spdDV).toBe(10);
      expect(pkmn!.spcDV).toBe(5);
    });

    it('without dvs param: random DVs 0-15', () => {
      mockRandom([0.5, 0.3, 0.8, 0.1]); // floor(0.5*16)=8, floor(0.3*16)=4, floor(0.8*16)=12, floor(0.1*16)=1
      const pkmn = createPokemon('PIKACHU', 50);
      expect(pkmn!.atkDV).toBe(8);
      expect(pkmn!.defDV).toBe(4);
      expect(pkmn!.spdDV).toBe(12);
      expect(pkmn!.spcDV).toBe(1);
    });
  });

  describe('move learning', () => {
    it('startMoves loaded correctly (filter out NO_MOVE)', () => {
      const pkmn = createPokemon('PIKACHU', 1, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn).not.toBeNull();
      expect(pkmn!.moves.length).toBeGreaterThanOrEqual(1);
      expect(pkmn!.moves.every(m => m.id !== 'NO_MOVE')).toBe(true);
    });

    it('learnset moves added for level <= pokemon level', () => {
      // Pikachu learns THUNDERSHOCK at level 1 (startMove), and more moves at higher levels
      const pkmnLow = createPokemon('PIKACHU', 1, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      const pkmnHigh = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmnHigh!.moves.length).toBeGreaterThanOrEqual(pkmnLow!.moves.length);
    });

    it('max 4 moves with shift', () => {
      // High level Pokemon that learns many moves
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.moves.length).toBeLessThanOrEqual(4);
    });
  });

  describe('experience calculation', () => {
    it('MEDIUM_FAST: exp = n^3', () => {
      // Pikachu is MEDIUM_FAST, level 10
      const pkmn = createPokemon('PIKACHU', 10, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.exp).toBe(1000); // 10^3
    });

    it('level 1: exp = 0', () => {
      const pkmn = createPokemon('PIKACHU', 1, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.exp).toBe(0);
    });
  });

  describe('full object', () => {
    it('volatiles initialized via createVolatiles()', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.volatiles.confusion).toBe(0);
      expect(pkmn!.volatiles.substitute).toBe(0);
      expect(pkmn!.volatiles.leechSeed).toBe(false);
    });

    it('originalStats snapshot matches computed stats', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.originalStats.attack).toBe(pkmn!.attack);
      expect(pkmn!.originalStats.defense).toBe(pkmn!.defense);
      expect(pkmn!.originalStats.speed).toBe(pkmn!.speed);
      expect(pkmn!.originalStats.special).toBe(pkmn!.special);
    });

    it('status is null, sleepTurns=0, toxicCounter=0', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.status).toBeNull();
      expect(pkmn!.sleepTurns).toBe(0);
      expect(pkmn!.toxicCounter).toBe(0);
      expect(pkmn!.badlyPoisoned).toBe(false);
    });

    it('nickname defaults to species name', () => {
      const pkmn = createPokemon('PIKACHU', 50, undefined, { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.nickname.toUpperCase()).toBe('PIKACHU');
    });

    it('custom nickname works', () => {
      const pkmn = createPokemon('PIKACHU', 50, 'SPARKY', { atk: 8, def: 8, spd: 8, spc: 8 });
      expect(pkmn!.nickname).toBe('SPARKY');
    });

    it('returns null for non-existent species', () => {
      const pkmn = createPokemon('FAKEMON', 50);
      expect(pkmn).toBeNull();
    });
  });
});
