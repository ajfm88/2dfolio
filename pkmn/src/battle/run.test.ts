import { describe, it, expect, afterEach } from 'vitest';
import { tryRunFromBattle } from './run';
import { mockRandomFixed, restoreRandom } from '../test/helpers';

afterEach(() => {
  restoreRandom();
});

describe('tryRunFromBattle', () => {
  describe('auto-escape conditions', () => {
    it('always escapes when player speed > enemy speed', () => {
      const result = tryRunFromBattle(100, 50, 1);
      expect(result.escaped).toBe(true);
      expect(result.message).toEqual(['Got away safely!']);
    });

    it('always escapes when player speed equals enemy speed', () => {
      expect(tryRunFromBattle(100, 100, 1).escaped).toBe(true);
    });

    it('always escapes when enemy speed is 0-3 (divisor becomes 0)', () => {
      expect(tryRunFromBattle(1, 3, 1).escaped).toBe(true);
      expect(tryRunFromBattle(1, 0, 1).escaped).toBe(true);
    });

    it('always escapes when (enemySpeed / 4) mod 256 is 0', () => {
      // floor(1024/4) = 256, 256 & 0xFF = 0
      expect(tryRunFromBattle(1, 1024, 1).escaped).toBe(true);
    });
  });

  describe('escape formula', () => {
    it('succeeds when random value is below escape factor', () => {
      // playerSpeed=50, enemySpeed=100
      // divisor = floor(100/4) & 0xFF = 25
      // quotient = floor(50 * 32 / 25) = 64
      // escapeFactor = 64, first attempt adds nothing
      // Need random < 64 to escape (since escapeFactor >= randomValue)
      mockRandomFixed(63 / 256); // random returns 63
      expect(tryRunFromBattle(50, 100, 1).escaped).toBe(true);
    });

    it('succeeds when random value equals escape factor', () => {
      // escapeFactor = 64, random = 64 → 64 >= 64 is true
      mockRandomFixed(64 / 256);
      expect(tryRunFromBattle(50, 100, 1).escaped).toBe(true);
    });

    it('fails when random value exceeds escape factor', () => {
      // escapeFactor = 64, random = 65 → 64 >= 65 is false
      mockRandomFixed(65 / 256);
      const result = tryRunFromBattle(50, 100, 1);
      expect(result.escaped).toBe(false);
      expect(result.message).toEqual(["Can't escape!"]);
    });

    it('adds 30 per additional attempt', () => {
      // escapeFactor = 64 + 30 = 94 on second attempt
      mockRandomFixed(94 / 256);
      expect(tryRunFromBattle(50, 100, 2).escaped).toBe(true);

      // third attempt: 64 + 60 = 124
      mockRandomFixed(124 / 256);
      expect(tryRunFromBattle(50, 100, 3).escaped).toBe(true);
    });

    it('auto-escapes when bonus overflows past 255', () => {
      // playerSpeed=10, enemySpeed=200
      // divisor = floor(200/4) & 0xFF = 50
      // quotient = floor(10 * 32 / 50) = 6
      // 10th attempt: 6 + 30*9 = 276 > 255 → overflow auto-escape
      expect(tryRunFromBattle(10, 200, 10).escaped).toBe(true);
    });

    it('auto-escapes when quotient exceeds 255', () => {
      // enemySpeed=1028 → divisor = floor(1028/4) & 0xFF = 257 & 0xFF = 1
      // playerSpeed=10 → quotient = floor(10*32/1) = 320 > 255
      expect(tryRunFromBattle(10, 1028, 1).escaped).toBe(true);
    });

    it('fails with very slow player against fast enemy on first attempt', () => {
      // playerSpeed=10, enemySpeed=200
      // divisor = 50, quotient = 6, escapeFactor = 6
      // random = 255 → 6 >= 255 is false
      mockRandomFixed(255 / 256);
      expect(tryRunFromBattle(10, 200, 1).escaped).toBe(false);
    });
  });
});
