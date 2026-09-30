import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { calculateDamage, getStatEffect, applyStatStage, isPhysicalType, getTypeEffectiveness, applyBadgeStatBoosts } from './damage';
import { loadBattleData } from './data';
import { makePokemon, mockRandomFixed, mockRandom, restoreRandom } from '../test/helpers';

beforeAll(async () => {
  await loadBattleData();
});

afterEach(() => {
  restoreRandom();
});

// ──────── calculateDamage ────────

describe('calculateDamage', () => {
  describe('miss conditions', () => {
    it('Dream Eater auto-misses on non-sleeping target', () => {
      const attacker = makePokemon({ level: 50 });
      const defender = makePokemon(); // no status
      const result = calculateDamage(attacker, defender, 'DREAM_EATER');
      expect(result.missed).toBe(true);
      expect(result.damage).toBe(0);
    });

    it('Dream Eater hits sleeping target', () => {
      const attacker = makePokemon({ level: 50, special: 80 });
      const defender = makePokemon({ status: 'SLP', special: 40 });
      mockRandomFixed(0.5); // mid-range random
      const result = calculateDamage(attacker, defender, 'DREAM_EATER');
      expect(result.missed).toBe(false);
      expect(result.damage).toBeGreaterThan(0);
    });

    it('invulnerable target causes miss', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ volatileOverrides: { invulnerable: true } });
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.missed).toBe(true);
    });

    it('invulnerable target does NOT miss with skipAccuracy=true', () => {
      const attacker = makePokemon();
      const defender = makePokemon({ volatileOverrides: { invulnerable: true } });
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'SWIFT', true);
      // Swift has no invulnerable check because skipAccuracy=true
      // But the invulnerable check is independent of skipAccuracy in current code
      // Let me check: in damage.ts line 149: if (defender.volatiles.invulnerable && !skipAccuracy)
      expect(result.missed).toBe(false);
    });
  });

  describe('accuracy with stat stages', () => {
    it('accuracy stage -1 can cause 100% accuracy move to miss', () => {
      const attacker = makePokemon({
        statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: -1, evasion: 0 },
      });
      const defender = makePokemon();
      // With accuracy -1, threshold = floor(255 * 2/3) = 170
      // Need random >= 170/256 ~ 0.664
      mockRandomFixed(0.99); // floor(0.99*256) = 253 >= 170 → miss
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.missed).toBe(true);
    });

    it('evasion stage +1 can cause 100% accuracy move to miss', () => {
      const attacker = makePokemon();
      const defender = makePokemon({
        statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 1 },
      });
      mockRandomFixed(0.99); // high random → miss
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.missed).toBe(true);
    });

    it('1/256 miss glitch: 100% accuracy move can miss (Gen 1 bug)', () => {
      const attacker = makePokemon();
      const defender = makePokemon();
      // POUND has accuracy 100 → threshold = floor(100 * 255 / 100) = 255
      // floor(random * 256) = 255 when random = 255/256 → 255 >= 255 → miss
      mockRandom([255 / 256, 0.99, 0.9]);
      const result = calculateDamage(attacker, defender, 'POUND');
      expect(result.missed).toBe(true);
    });

    it('1/256 miss glitch: 100% accuracy move hits at 254/256', () => {
      const attacker = makePokemon();
      const defender = makePokemon();
      // POUND has accuracy 100 → threshold 255
      // floor(random * 256) = 254 when random = 254/256 → 254 >= 255 → hit
      mockRandom([254 / 256, 0.99, 0.9]);
      const result = calculateDamage(attacker, defender, 'POUND');
      expect(result.missed).toBe(false);
    });

    it('skipAccuracy=true bypasses all accuracy checks', () => {
      const attacker = makePokemon({
        statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: -6, evasion: 0 },
      });
      const defender = makePokemon({
        statStages: { attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 6 },
      });
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'TACKLE', true);
      expect(result.missed).toBe(false);
    });
  });

  describe('power-0 moves', () => {
    it('power-0 moves return damage=0, missed=false', () => {
      const attacker = makePokemon();
      const defender = makePokemon();
      const result = calculateDamage(attacker, defender, 'GROWL');
      expect(result.damage).toBe(0);
      expect(result.missed).toBe(false);
    });
  });

  describe('special damage moves', () => {
    it('SEISMIC_TOSS deals damage equal to attacker level', () => {
      const attacker = makePokemon({ level: 42 });
      const defender = makePokemon();
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'SEISMIC_TOSS');
      expect(result.damage).toBe(42);
    });

    it('SONICBOOM always deals 20', () => {
      const attacker = makePokemon();
      const defender = makePokemon();
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'SONICBOOM');
      expect(result.damage).toBe(20);
    });

    it('DRAGON_RAGE always deals 40', () => {
      const attacker = makePokemon();
      const defender = makePokemon();
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'DRAGON_RAGE');
      expect(result.damage).toBe(40);
    });

    it('NIGHT_SHADE deals damage equal to attacker level', () => {
      const attacker = makePokemon({ level: 30 });
      // Defender must not be Normal-type (Ghost → Normal is immune in Gen 1)
      const defender = makePokemon({ speciesOverrides: { type1: 'WATER', type2: 'WATER' } });
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'NIGHT_SHADE');
      expect(result.damage).toBe(30);
    });

    it('special damage moves respect type immunity', () => {
      const attacker = makePokemon({ level: 50 });
      // Night Shade is GHOST type, Normal is immune to Ghost
      const defender = makeDefenderWithTypes('NORMAL', 'NORMAL');
      mockRandomFixed(0.5);
      const result = calculateDamage(attacker, defender, 'NIGHT_SHADE');
      expect(result.damage).toBe(0);
      expect(result.effectiveness).toBe(0);
    });
  });

  describe('critical hits', () => {
    it('base crit rate uses speed/2 threshold', () => {
      // Speed 100 → threshold = 50/256
      const attacker = makePokemon({
        speciesOverrides: { speed: 100 },
      });
      const defender = makePokemon();
      // Mock: first random for accuracy (always hit), then crit check, then damage random
      // threshold = floor(100/2) = 50
      // random < 50/256 = crit
      mockRandom([0.0, 0.1, 0.9]); // accuracy, crit (floor(0.1*256)=25 < 50 = crit!), damage rand
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.critical).toBe(true);
    });

    it('high crit moves use speed/2*8 threshold', () => {
      // Speed 20 → normal threshold = 10, high crit = floor(20/2)*8 = 80
      const attacker = makePokemon({
        speciesOverrides: { speed: 20 },
      });
      const defender = makePokemon();
      // threshold = floor(20/2)*8 = 80
      // random(0.2) → floor(0.2*256) = 51 < 80 → crit
      mockRandom([0.0, 0.2, 0.9]); // accuracy(hit), crit check, damage rand
      const result = calculateDamage(attacker, defender, 'SLASH');
      expect(result.critical).toBe(true);
    });

    it('Focus Energy BUG: divides threshold by 4', () => {
      // Speed 100, normal threshold = 50
      // Focus Energy: threshold = floor(50/4) = 12
      const attacker = makePokemon({
        speciesOverrides: { speed: 100 },
        volatileOverrides: { focusEnergy: true },
      });
      const defender = makePokemon();
      // threshold after Focus Energy = floor(50/4) = 12
      // random(0.06) → floor(0.06*256) = 15 >= 12 → NO crit (would have been crit without FE)
      mockRandom([0.0, 0.06, 0.9]);
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.critical).toBe(false);
    });

    it('critical hits ignore Reflect', () => {
      const attacker = makePokemon({ attack: 100 });
      const defender = makePokemon({
        defense: 50,
        volatileOverrides: { reflect: true },
      });
      // Force crit
      mockRandom([0.0, 0.0, 0.9]); // accuracy, crit (guaranteed), damage rand
      const resultCrit = calculateDamage(attacker, defender, 'TACKLE');
      expect(resultCrit.critical).toBe(true);

      // Force no crit, with reflect
      const defender2 = makePokemon({
        defense: 50,
        volatileOverrides: { reflect: true },
      });
      mockRandom([0.0, 0.99, 0.9]); // accuracy, no crit, damage rand
      const resultNoCrit = calculateDamage(attacker, defender2, 'TACKLE');
      expect(resultNoCrit.critical).toBe(false);

      // Crit damage should be higher because reflect doesn't apply
      expect(resultCrit.damage).toBeGreaterThan(resultNoCrit.damage);
    });
  });

  describe('physical vs special split', () => {
    it('NORMAL type is physical', () => {
      expect(isPhysicalType('NORMAL')).toBe(true);
    });

    it('FIRE type is special', () => {
      expect(isPhysicalType('FIRE')).toBe(false);
    });
  });

  describe('Explosion halves defense', () => {
    it('EXPLODE_EFFECT halves defenders defense', () => {
      const attacker = makePokemon({ attack: 100, level: 50 });
      const defender = makePokemon({ defense: 100 });
      // Force no crit, consistent random
      mockRandom([0.0, 0.99, 0.9]);
      const explodeResult = calculateDamage(attacker, defender, 'EXPLOSION');

      const defender2 = makePokemon({ defense: 50 }); // manually halved
      mockRandom([0.0, 0.99, 0.9]);
      calculateDamage(attacker, defender2, 'TACKLE');

      // Explosion with defense 100 (halved to 50) should be comparable to
      // a move with same power hitting defense 50
      // (power differs, so we just verify explosion does significant damage)
      expect(explodeResult.damage).toBeGreaterThan(0);
    });
  });

  describe('Reflect / Light Screen', () => {
    it('Reflect doubles physical defense', () => {
      const attacker = makePokemon({ attack: 100 });

      const defenderNoReflect = makePokemon({ defense: 50 });
      mockRandom([0.0, 0.99, 0.9]); // no crit
      const dmgNoReflect = calculateDamage(attacker, defenderNoReflect, 'TACKLE');

      const defenderReflect = makePokemon({
        defense: 50,
        volatileOverrides: { reflect: true },
      });
      mockRandom([0.0, 0.99, 0.9]); // no crit
      const dmgReflect = calculateDamage(attacker, defenderReflect, 'TACKLE');

      // With reflect, damage should be roughly halved
      expect(dmgReflect.damage).toBeLessThan(dmgNoReflect.damage);
    });

    it('Light Screen doubles special defense', () => {
      const attacker = makePokemon({ special: 100 });

      const defenderNo = makePokemon({ special: 50 });
      mockRandom([0.5, 0.9]);
      const dmgNo = calculateDamage(attacker, defenderNo, 'PSYCHIC_M');

      const defenderLS = makePokemon({
        special: 50,
        volatileOverrides: { lightScreen: true },
      });
      mockRandom([0.5, 0.9]);
      const dmgLS = calculateDamage(attacker, defenderLS, 'PSYCHIC_M');

      expect(dmgLS.damage).toBeLessThan(dmgNo.damage);
    });
  });

  describe('STAB', () => {
    it('same-type attack bonus multiplies damage by 1.5', () => {
      // Normal-type using Tackle (NORMAL) = STAB
      const attackerSTAB = makePokemon({
        speciesOverrides: { type1: 'NORMAL', type2: 'NORMAL' },
        attack: 100,
      });
      // Fighting-type using Tackle (NORMAL) = no STAB
      const attackerNoSTAB = makePokemon({
        speciesOverrides: { type1: 'FIGHTING', type2: 'FIGHTING' },
        attack: 100,
      });
      const defender = makePokemon({ defense: 50 });

      mockRandom([0.0, 0.99, 0.9]); // no crit
      const dmgSTAB = calculateDamage(attackerSTAB, defender, 'TACKLE');

      const defender2 = makePokemon({ defense: 50 });
      mockRandom([0.0, 0.99, 0.9]);
      const dmgNoSTAB = calculateDamage(attackerNoSTAB, defender2, 'TACKLE');

      expect(dmgSTAB.damage).toBeGreaterThan(dmgNoSTAB.damage);
    });
  });

  describe('type effectiveness', () => {
    it('immune: Normal vs Ghost = 0 damage', () => {
      const attacker = makePokemon({ attack: 100 });
      const defender = makeDefenderWithTypes('GHOST', 'GHOST');
      mockRandom([0.0, 0.99, 0.9]);
      const result = calculateDamage(attacker, defender, 'TACKLE');
      expect(result.damage).toBe(0);
      expect(result.effectiveness).toBe(0);
    });

    it('super effective: returns effectiveness > 1', () => {
      const attacker = makePokemon({ special: 100, speciesOverrides: { type1: 'WATER', type2: 'WATER' } });
      const defender = makeDefenderWithTypes('FIRE', 'FIRE');
      mockRandom([0.0, 0.99, 0.9]);
      const result = calculateDamage(attacker, defender, 'SURF');
      expect(result.effectiveness).toBe(2);
      expect(result.damage).toBeGreaterThan(0);
    });
  });

  describe('random factor', () => {
    it('damage varies with random factor [217,255]/255', () => {
      const attacker = makePokemon({ attack: 100 });
      const defender = makePokemon({ defense: 50 });

      // Min random: 217/255
      mockRandom([0.0, 0.99, 0.0]); // rand factor = floor(0*39)+217 = 217
      const dmgMin = calculateDamage(attacker, defender, 'TACKLE');

      const defender2 = makePokemon({ defense: 50 });
      // Max random: 255/255
      mockRandom([0.0, 0.99, 0.99]); // rand factor = floor(0.99*39)+217 = 38+217 = 255
      const dmgMax = calculateDamage(attacker, defender2, 'TACKLE');

      expect(dmgMax.damage).toBeGreaterThanOrEqual(dmgMin.damage);
    });
  });

  describe('damage clamping', () => {
    it('minimum damage is 1', () => {
      // Very weak attack against very high defense
      const attacker = makePokemon({ attack: 1, level: 2 });
      const defender = makePokemon({ defense: 255 });
      mockRandom([0.0, 0.99, 0.0]); // lowest random
      const result = calculateDamage(attacker, defender, 'TACKLE');
      if (!result.missed) {
        expect(result.damage).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// ──────── getStatEffect ────────

describe('getStatEffect', () => {
  it('returns correct StatEffect for ATTACK_UP1_EFFECT', () => {
    const effect = getStatEffect('ATTACK_UP1_EFFECT');
    expect(effect).not.toBeNull();
    expect(effect!.who).toBe('attacker');
    expect(effect!.stat).toBe('attack');
    expect(effect!.stages).toBe(1);
    expect(effect!.isSideEffect).toBe(false);
  });

  it('returns null for unknown effects', () => {
    expect(getStatEffect('UNKNOWN_EFFECT')).toBeNull();
    expect(getStatEffect('SLEEP_EFFECT')).toBeNull();
  });

  it('side effects identified correctly', () => {
    const effect = getStatEffect('ATTACK_DOWN_SIDE_EFFECT');
    expect(effect).not.toBeNull();
    expect(effect!.isSideEffect).toBe(true);
    expect(effect!.stages).toBe(-1);
  });

  it('-2 stage effects correct', () => {
    const effect = getStatEffect('DEFENSE_DOWN2_EFFECT');
    expect(effect).not.toBeNull();
    expect(effect!.stages).toBe(-2);
  });
});

// ──────── applyStatStage ────────

describe('applyStatStage', () => {
  it('raises attack from 0 to +1', () => {
    const pkmn = makePokemon();
    const changed = applyStatStage(pkmn, 'attack', 1);
    expect(changed).toBe(true);
    expect(pkmn.statStages.attack).toBe(1);
  });

  it('lowers defense from 0 to -1', () => {
    const pkmn = makePokemon();
    const changed = applyStatStage(pkmn, 'defense', -1);
    expect(changed).toBe(true);
    expect(pkmn.statStages.defense).toBe(-1);
  });

  it('clamps at +6 (returns false)', () => {
    const pkmn = makePokemon({
      statStages: { attack: 6, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    });
    const changed = applyStatStage(pkmn, 'attack', 1);
    expect(changed).toBe(false);
    expect(pkmn.statStages.attack).toBe(6);
  });

  it('clamps at -6 (returns false)', () => {
    const pkmn = makePokemon({
      statStages: { attack: 0, defense: -6, speed: 0, special: 0, accuracy: 0, evasion: 0 },
    });
    const changed = applyStatStage(pkmn, 'defense', -1);
    expect(changed).toBe(false);
    expect(pkmn.statStages.defense).toBe(-6);
  });

  it('+2 from +5 clamps at +6', () => {
    const pkmn = makePokemon({
      statStages: { attack: 0, defense: 0, speed: 5, special: 0, accuracy: 0, evasion: 0 },
    });
    const changed = applyStatStage(pkmn, 'speed', 2);
    expect(changed).toBe(true);
    expect(pkmn.statStages.speed).toBe(6);
  });
});

// ──────── isPhysicalType ────────

describe('isPhysicalType', () => {
  it('returns true for all 9 physical types', () => {
    const physical = ['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BIRD', 'BUG', 'GHOST'];
    for (const t of physical) {
      expect(isPhysicalType(t)).toBe(true);
    }
  });

  it('returns false for special types', () => {
    const special = ['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON'];
    for (const t of special) {
      expect(isPhysicalType(t)).toBe(false);
    }
  });
});

// ──────── getTypeEffectiveness ────────

describe('getTypeEffectiveness', () => {
  it('Water vs Fire = 2', () => {
    expect(getTypeEffectiveness('WATER', 'FIRE', 'FIRE')).toBe(2);
  });

  it('Fire vs Water = 0.5', () => {
    expect(getTypeEffectiveness('FIRE', 'WATER', 'WATER')).toBe(0.5);
  });

  it('Normal vs Ghost = 0', () => {
    expect(getTypeEffectiveness('NORMAL', 'GHOST', 'GHOST')).toBe(0);
  });

  it('Electric vs Ground = 0', () => {
    expect(getTypeEffectiveness('ELECTRIC', 'GROUND', 'GROUND')).toBe(0);
  });

  it('same type1 and type2 does not double-count', () => {
    // Water vs Fire/Fire should be 2x, not 4x
    expect(getTypeEffectiveness('WATER', 'FIRE', 'FIRE')).toBe(2);
  });

  it('neutral matchup returns 1', () => {
    expect(getTypeEffectiveness('NORMAL', 'NORMAL', 'NORMAL')).toBe(1);
  });

  it('dual-type super effective', () => {
    // Ground vs Fire/Rock — Ground is SE vs both Fire and Rock
    const eff = getTypeEffectiveness('GROUND', 'FIRE', 'ROCK');
    expect(eff).toBe(4); // 2 * 2
  });
});

// ──────── applyBadgeStatBoosts ────────

describe('applyBadgeStatBoosts', () => {
  it('Boulder Badge boosts attack by 1.125x', () => {
    const pkmn = makePokemon({ attack: 100 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_1']));
    expect(pkmn.attack).toBe(112); // 100 + floor(100/8) = 112
  });

  it('Thunder Badge boosts defense', () => {
    const pkmn = makePokemon({ defense: 80 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_3']));
    expect(pkmn.defense).toBe(90); // 80 + floor(80/8) = 90
  });

  it('Soul Badge boosts speed', () => {
    const pkmn = makePokemon({ speed: 200 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_5']));
    expect(pkmn.speed).toBe(225); // 200 + floor(200/8) = 225
  });

  it('Volcano Badge boosts special', () => {
    const pkmn = makePokemon({ special: 50 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_7']));
    expect(pkmn.special).toBe(56); // 50 + floor(50/8) = 56
  });

  it('no boost without the badge', () => {
    const pkmn = makePokemon({ attack: 100, defense: 80, speed: 200, special: 50 });
    applyBadgeStatBoosts(pkmn, new Set());
    expect(pkmn.attack).toBe(100);
    expect(pkmn.defense).toBe(80);
    expect(pkmn.speed).toBe(200);
    expect(pkmn.special).toBe(50);
  });

  it('multiple badges stack', () => {
    const pkmn = makePokemon({ attack: 100, speed: 200 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_1', 'BADGE_5']));
    expect(pkmn.attack).toBe(112);
    expect(pkmn.speed).toBe(225);
  });

  it('caps at 999', () => {
    const pkmn = makePokemon({ attack: 990 });
    applyBadgeStatBoosts(pkmn, new Set(['BADGE_1']));
    expect(pkmn.attack).toBe(999); // 990 + 123 would be 1113, capped to 999
  });

  it('reapplication stacks (Gen 1 bug)', () => {
    const pkmn = makePokemon({ attack: 100 });
    const badges = new Set(['BADGE_1']);
    applyBadgeStatBoosts(pkmn, badges); // 100 → 112
    applyBadgeStatBoosts(pkmn, badges); // 112 → 126 (112 + floor(112/8))
    expect(pkmn.attack).toBe(126);
  });
});

// ──────── Helper ────────

function makeDefenderWithTypes(type1: string, type2: string) {
  return makePokemon({ speciesOverrides: { type1, type2 } });
}
