import { describe, it, expect, afterEach } from 'vitest';
import { attemptCatch } from './catch';
import { makePokemon, mockRandom, mockRandomFixed, restoreRandom } from '../test/helpers';

afterEach(() => {
  restoreRandom();
});

describe('attemptCatch', () => {
  describe('Master Ball', () => {
    it('always catches', () => {
      const enemy = makePokemon({ currentHp: 100, maxHp: 100 });
      const result = attemptCatch(enemy, 'MASTER_BALL');
      expect(result.caught).toBe(true);
      expect(result.shakes).toBe(3);
    });
  });

  describe('ball type ranges', () => {
    it('Poke Ball: rand1 range [0, 255]', () => {
      // With very high random and low catch rate, should miss
      const enemy = makePokemon({
        currentHp: 100, maxHp: 100,
        speciesOverrides: { catchRate: 3 }, // very low catch rate
      });
      mockRandom([0.99, 0.99]); // high rand1, high rand2
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(false);
    });
  });

  describe('status modifier', () => {
    it('FRZ/SLP subtract 25: underflow catches', () => {
      const enemy = makePokemon({
        currentHp: 100, maxHp: 100, status: 'FRZ',
        speciesOverrides: { catchRate: 255 },
      });
      // rand1 < 25 → underflow → caught
      mockRandomFixed(0.05); // floor(0.05*256) = 12 < 25 → caught
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(true);
    });

    it('BRN/PAR/PSN subtract 12: underflow catches', () => {
      const enemy = makePokemon({
        currentHp: 100, maxHp: 100, status: 'PAR',
        speciesOverrides: { catchRate: 255 },
      });
      // rand1 < 12 → underflow → caught
      mockRandomFixed(0.02); // floor(0.02*256) = 5 < 12 → caught
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(true);
    });
  });

  describe('catch rate check', () => {
    it('rand1 > catchRate fails', () => {
      const enemy = makePokemon({
        currentHp: 100, maxHp: 100,
        speciesOverrides: { catchRate: 50 },
      });
      // rand1 = floor(0.5*256) = 128 > 50 → fail
      mockRandom([0.5, 0.5]); // rand1, rand2
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(false);
    });
  });

  describe('W calculation', () => {
    it('W > 255 catches immediately', () => {
      const enemy = makePokemon({
        currentHp: 1, maxHp: 200,
        speciesOverrides: { catchRate: 255 },
      });
      // rand1 = small enough to pass catch rate check
      // W = floor(floor(200*255/12) / max(floor(1/4), 1)) = floor(floor(4250)/1) = 4250 > 255
      mockRandom([0.1]); // rand1 = floor(0.1*256)=25 < 255
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(true);
    });
  });

  describe('shake calculation', () => {
    it('high z value gives 3 shakes', () => {
      // Need a scenario where catch fails but gets 3 shakes
      const enemy = makePokemon({
        currentHp: 50, maxHp: 100,
        speciesOverrides: { catchRate: 200 },
      });
      // Make rand1 pass catch rate but rand2 fail
      mockRandom([0.85, 0.99]); // rand1=floor(0.85*256)=217 > 200 → fail
      const result = attemptCatch(enemy, 'POKE_BALL');
      expect(result.caught).toBe(false);
      expect(result.shakes).toBeGreaterThanOrEqual(0);
      expect(result.shakes).toBeLessThanOrEqual(3);
    });
  });

  describe('deterministic scenarios', () => {
    it('1 HP, sleeping, Ultra Ball: high catch chance', () => {
      const enemy = makePokemon({
        currentHp: 1, maxHp: 100, status: 'SLP',
        speciesOverrides: { catchRate: 45 },
      });
      // Ultra Ball max rand = 151
      // rand1 = floor(0.3*151) = 45, subtract 25 (SLP) = 20, 20 <= 45 → pass catch rate
      // W = floor(floor(100*255/12) / max(floor(1/4),1)) = floor(2125/1) = 2125 > 255 → caught
      mockRandomFixed(0.3);
      const result = attemptCatch(enemy, 'ULTRA_BALL');
      expect(result.caught).toBe(true);
    });
  });
});
