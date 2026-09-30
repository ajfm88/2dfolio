import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { tryInflictStatus, checkPreTurnStatus, applyEndOfTurnDamage, isStatusEffect, checkFireThaw } from './status';
import { loadBattleData } from './data';
import { makePokemon, makeTypedPokemon, mockRandomFixed, mockRandom, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

// ──────── tryInflictStatus ────────

describe('tryInflictStatus', () => {
  describe('type immunity', () => {
    it('Poison-type cannot be poisoned', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('POISON');
      const result = tryInflictStatus('POISON_EFFECT', attacker, defender, 'POISON_POWDER');
      expect(result).toBeNull();
    });

    it('Poison as type2 also blocks poison', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ speciesOverrides: { type1: 'GRASS', type2: 'POISON' } });
      const result = tryInflictStatus('POISON_EFFECT', attacker, defender, 'POISON_POWDER');
      expect(result).toBeNull();
    });

    it('Fire-type blocks burn from Fire moves', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('FIRE');
      const result = tryInflictStatus('BURN_SIDE_EFFECT1', attacker, defender, 'EMBER');
      expect(result).toBeNull();
    });

    it('Ice-type blocks freeze from Ice moves', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('ICE');
      const result = tryInflictStatus('FREEZE_SIDE_EFFECT1', attacker, defender, 'ICE_BEAM');
      expect(result).toBeNull();
    });

    it('Electric-type blocks paralysis from Electric moves', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('ELECTRIC');
      const result = tryInflictStatus('PARALYZE_SIDE_EFFECT1', attacker, defender, 'THUNDERBOLT');
      expect(result).toBeNull();
    });

    it('Normal-type blocks paralysis from Normal moves (Body Slam)', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      const result = tryInflictStatus('PARALYZE_SIDE_EFFECT2', attacker, defender, 'BODY_SLAM');
      expect(result).toBeNull();
    });

    it('non-matching types DO inflict status', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('WATER');
      mockRandomFixed(0); // guaranteed to pass threshold
      const result = tryInflictStatus('BURN_SIDE_EFFECT1', attacker, defender, 'EMBER');
      expect(result).not.toBeNull();
      expect(result!.inflicted).toBe('BRN');
    });
  });

  describe('already has status', () => {
    it('returns null if defender already has PSN', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ status: 'PSN' });
      const result = tryInflictStatus('POISON_EFFECT', attacker, defender, 'POISON_POWDER');
      expect(result).toBeNull();
    });

    it('returns null if defender already has BRN', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ status: 'BRN' });
      mockRandomFixed(0);
      const result = tryInflictStatus('BURN_SIDE_EFFECT1', attacker, defender, 'EMBER');
      expect(result).toBeNull();
    });
  });

  describe('substitute blocks pure status', () => {
    it('substitute blocks SLEEP_EFFECT', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ volatileOverrides: { substitute: 25 } });
      const result = tryInflictStatus('SLEEP_EFFECT', attacker, defender, 'SLEEP_POWDER');
      expect(result).toBeNull();
    });

    it('substitute does NOT block BURN_SIDE_EFFECT1 (side effect)', () => {
      const attacker = makePokemon();
      const defender = makePokemon({
        volatileOverrides: { substitute: 25 },
        speciesOverrides: { type1: 'WATER', type2: 'WATER' },
      });
      mockRandomFixed(0); // pass threshold
      const result = tryInflictStatus('BURN_SIDE_EFFECT1', attacker, defender, 'EMBER');
      expect(result).not.toBeNull();
    });
  });

  describe('side effect probability', () => {
    it('POISON_SIDE_EFFECT1 (20%): low random inflicts', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      // threshold = 52/256 ~ 0.203
      mockRandomFixed(0.1); // floor(0.1 * 256) = 25 < 52 → inflict
      const result = tryInflictStatus('POISON_SIDE_EFFECT1', attacker, defender, 'SLUDGE');
      expect(result).not.toBeNull();
      expect(result!.inflicted).toBe('PSN');
    });

    it('POISON_SIDE_EFFECT1 (20%): high random does not inflict', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      mockRandomFixed(0.9); // floor(0.9 * 256) = 230 >= 52 → no inflict
      const result = tryInflictStatus('POISON_SIDE_EFFECT1', attacker, defender, 'SLUDGE');
      expect(result).toBeNull();
    });

    it('pure status moves always inflict (no random check)', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      mockRandomFixed(0.99); // high random should not matter
      // SLEEP_EFFECT is a pure status move - no side effect threshold
      // Need to mock sleep turns too (must not be 0)
      mockRandom([0.99, 0.5]); // first for threshold (not checked), second for sleep turns
      const result = tryInflictStatus('SLEEP_EFFECT', attacker, defender, 'SLEEP_POWDER');
      expect(result).not.toBeNull();
      expect(result!.inflicted).toBe('SLP');
    });
  });

  describe('status application', () => {
    it('sleep sets sleepTurns 1-7 (never 0)', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      // Mock: first random for sleep loop: floor(0.125*8)=1 (valid, no retry)
      mockRandom([0.125]);
      const result = tryInflictStatus('SLEEP_EFFECT', attacker, defender, 'SLEEP_POWDER');
      expect(result).not.toBeNull();
      expect(defender.status).toBe('SLP');
      expect(defender.sleepTurns).toBe(1);
    });

    it('sleep retries if random gives 0', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      // Mock: first floor(0*8)=0 (retry), then floor(0.5*8)=4 (valid)
      mockRandom([0, 0.5]);
      const result = tryInflictStatus('SLEEP_EFFECT', attacker, defender, 'SLEEP_POWDER');
      expect(result).not.toBeNull();
      expect(defender.sleepTurns).toBe(4);
    });

    it('TOXIC sets badlyPoisoned and toxicCounter=0', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      const result = tryInflictStatus('POISON_EFFECT', attacker, defender, 'TOXIC');
      expect(result).not.toBeNull();
      expect(defender.status).toBe('PSN');
      expect(defender.badlyPoisoned).toBe(true);
      expect(defender.toxicCounter).toBe(0);
    });

    it('regular poison does not set badlyPoisoned', () => {
      const attacker = makePokemon();
      const defender = makeTypedPokemon('NORMAL');
      const result = tryInflictStatus('POISON_EFFECT', attacker, defender, 'POISON_POWDER');
      expect(result).not.toBeNull();
      expect(defender.badlyPoisoned).toBe(false);
    });

    it('burn halves attack (min 1)', () => {
      const attacker = makePokemon();
      const defender = makePokemon({
        attack: 80,
        speciesOverrides: { type1: 'NORMAL', type2: 'NORMAL' },
      });
      mockRandomFixed(0);
      const result = tryInflictStatus('BURN_SIDE_EFFECT1', attacker, defender, 'EMBER');
      expect(result).not.toBeNull();
      expect(defender.status).toBe('BRN');
      expect(defender.attack).toBe(40); // 80/2
    });

    it('paralysis quarters speed (min 1)', () => {
      const attacker = makePokemon();
      const defender = makePokemon({
        speed: 100,
        speciesOverrides: { type1: 'WATER', type2: 'WATER' },
      });
      mockRandomFixed(0);
      const result = tryInflictStatus('PARALYZE_SIDE_EFFECT1', attacker, defender, 'THUNDERBOLT');
      expect(result).not.toBeNull();
      expect(defender.status).toBe('PAR');
      expect(defender.speed).toBe(25); // 100/4
    });

    it('freeze sets FRZ without stat changes', () => {
      const attacker = makePokemon();
      const defender = makePokemon({
        speciesOverrides: { type1: 'NORMAL', type2: 'NORMAL' },
      });
      mockRandomFixed(0);
      const result = tryInflictStatus('FREEZE_SIDE_EFFECT1', attacker, defender, 'ICE_BEAM');
      expect(result).not.toBeNull();
      expect(defender.status).toBe('FRZ');
      expect(defender.attack).toBe(50); // unchanged
      expect(defender.speed).toBe(50); // unchanged
    });
  });
});

// ──────── checkPreTurnStatus ────────

describe('checkPreTurnStatus', () => {
  describe('sleep', () => {
    it('decrements sleepTurns', () => {
      const pkmn = makePokemon({ status: 'SLP', sleepTurns: 3 });
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(false);
      expect(pkmn.sleepTurns).toBe(2);
    });

    it('wakes up when sleepTurns reaches 0', () => {
      const pkmn = makePokemon({ status: 'SLP', sleepTurns: 1 });
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(true);
      expect(pkmn.status).toBeNull();
      expect(pkmn.sleepTurns).toBe(0);
      expect(result.messages[0][0]).toContain('woke up!');
    });
  });

  describe('freeze', () => {
    it('frozen Pokemon cannot act', () => {
      const pkmn = makePokemon({ status: 'FRZ' });
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(false);
      expect(pkmn.status).toBe('FRZ'); // no auto-thaw
    });
  });

  describe('paralysis', () => {
    it('25% chance fully paralyzed (random < 64/256)', () => {
      const pkmn = makePokemon({ status: 'PAR' });
      mockRandomFixed(0.1); // floor(0.1*256) = 25 < 64
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(false);
    });

    it('75% chance to act normally (random >= 64/256)', () => {
      const pkmn = makePokemon({ status: 'PAR' });
      mockRandomFixed(0.5); // floor(0.5*256) = 128 >= 64
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(true);
    });
  });

  describe('no status', () => {
    it('returns canAct: true with empty messages', () => {
      const pkmn = makePokemon();
      const result = checkPreTurnStatus(pkmn);
      expect(result.canAct).toBe(true);
      expect(result.messages).toHaveLength(0);
    });
  });
});

// ──────── applyEndOfTurnDamage ────────

describe('applyEndOfTurnDamage', () => {
  it('poison deals maxHP/16 damage (min 1)', () => {
    const pkmn = makePokemon({ status: 'PSN', maxHp: 160, currentHp: 160 });
    const result = applyEndOfTurnDamage(pkmn);
    expect(result.damage).toBe(10); // 160/16
    expect(pkmn.currentHp).toBe(150);
  });

  it('burn deals maxHP/16 damage (min 1)', () => {
    const pkmn = makePokemon({ status: 'BRN', maxHp: 80, currentHp: 80 });
    const result = applyEndOfTurnDamage(pkmn);
    expect(result.damage).toBe(5); // 80/16
    expect(pkmn.currentHp).toBe(75);
  });

  it('minimum damage is 1 for low maxHP', () => {
    const pkmn = makePokemon({ status: 'PSN', maxHp: 10, currentHp: 10 });
    const result = applyEndOfTurnDamage(pkmn);
    expect(result.damage).toBe(1); // floor(10/16)=0 → 1
  });

  it('toxic increments toxicCounter and multiplies base damage', () => {
    const pkmn = makePokemon({
      status: 'PSN', badlyPoisoned: true, toxicCounter: 2,
      maxHp: 160, currentHp: 160,
    });
    const result = applyEndOfTurnDamage(pkmn);
    // base = 160/16 = 10, toxicCounter incremented to 3, damage = 10*3 = 30
    expect(pkmn.toxicCounter).toBe(3);
    expect(result.damage).toBe(30);
  });

  it('returns fainted: true when HP reaches 0', () => {
    const pkmn = makePokemon({ status: 'PSN', maxHp: 160, currentHp: 5 });
    const result = applyEndOfTurnDamage(pkmn);
    expect(result.fainted).toBe(true);
    expect(pkmn.currentHp).toBe(0);
  });

  it('no damage for PAR/FRZ/SLP/null', () => {
    for (const status of ['PAR', 'FRZ', 'SLP', null] as const) {
      const pkmn = makePokemon({ status, maxHp: 100, currentHp: 100 });
      const result = applyEndOfTurnDamage(pkmn);
      expect(result.damage).toBe(0);
    }
  });
});

// ──────── isStatusEffect ────────

describe('isStatusEffect', () => {
  it('returns true for status-inflicting effects', () => {
    expect(isStatusEffect('POISON_EFFECT')).toBe(true);
    expect(isStatusEffect('SLEEP_EFFECT')).toBe(true);
    expect(isStatusEffect('BURN_SIDE_EFFECT1')).toBe(true);
    expect(isStatusEffect('FREEZE_SIDE_EFFECT1')).toBe(true);
    expect(isStatusEffect('PARALYZE_SIDE_EFFECT2')).toBe(true);
  });

  it('returns false for non-status effects', () => {
    expect(isStatusEffect('NO_ADDITIONAL_EFFECT')).toBe(false);
    expect(isStatusEffect('ATTACK_UP1_EFFECT')).toBe(false);
    expect(isStatusEffect('HYPER_BEAM_EFFECT')).toBe(false);
  });
});

// ──────── checkFireThaw ────────

describe('checkFireThaw', () => {
  it('fire move thaws frozen target', () => {
    const target = makePokemon({ status: 'FRZ' });
    const result = checkFireThaw('FLAMETHROWER', 'FIRE', target);
    expect(result).not.toBeNull();
    expect(target.status).toBeNull();
  });

  it('Fire Spin does NOT thaw', () => {
    const target = makePokemon({ status: 'FRZ' });
    const result = checkFireThaw('FIRE_SPIN', 'FIRE', target);
    expect(result).toBeNull();
    expect(target.status).toBe('FRZ');
  });

  it('non-fire move on frozen target returns null', () => {
    const target = makePokemon({ status: 'FRZ' });
    const result = checkFireThaw('TACKLE', 'NORMAL', target);
    expect(result).toBeNull();
  });

  it('fire move on non-frozen target returns null', () => {
    const target = makePokemon({ status: 'PSN' });
    const result = checkFireThaw('FLAMETHROWER', 'FIRE', target);
    expect(result).toBeNull();
  });
});
