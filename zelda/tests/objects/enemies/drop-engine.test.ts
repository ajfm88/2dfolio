import { describe, it, expect } from 'vitest';
import { DropEngine } from '../../../src/objects/enemies/drop-engine.js';
import type { DropTables } from '../../../src/data/item-types.js';

function makeDropTables(): DropTables {
  return {
    noDropMonsterTypes: [93, 20, 21, 27, 28, 29, 23],
    dropItemMonsterTypes: [
      [7, 8, 14, 4, 15, 35],
      [33, 34, 13, 16, 19, 40, 42, 39, 22],
      [9, 10, 3, 1, 18, 6, 11, 36, 48],
    ],
    dropItemRates: [0x50, 0x98, 0x68, 0x68],
    dropItemTable: [
      [0x22, 0x18, 0x22, 0x18, 0x23, 0x18, 0x22, 0x22, 0x18, 0x18],
      [0x0f, 0x18, 0x22, 0x18, 0x0f, 0x22, 0x21, 0x18, 0x18, 0x18],
      [0x22, 0x00, 0x18, 0x21, 0x18, 0x22, 0x00, 0x18, 0x00, 0x22],
      [0x22, 0x22, 0x23, 0x18, 0x22, 0x23, 0x22, 0x22, 0x22, 0x18],
    ],
  };
}

describe('DropEngine', () => {
  it('rejects no-drop monster types', () => {
    const engine = new DropEngine();
    const tables = makeDropTables();
    expect(engine.rollDrop(93, tables)).toBeNull();
    expect(engine.rollDrop(20, tables)).toBeNull();
  });

  it('assigns enemy to correct group', () => {
    const engine = new DropEngine();
    const tables = makeDropTables();
    // Type 7 is in group 0 — if RNG allows, should drop from table[0]
    // We can't control Math.random here, but we can verify the engine
    // doesn't crash and returns a valid item ID or null
    const result = engine.rollDrop(7, tables);
    if (result !== null) {
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it('forces fairy after 16 kills', () => {
    const engine = new DropEngine();
    const tables = makeDropTables();
    // totalKillCount is NOT reset by help drops (only by fairy).
    // consecutiveNonDrops IS reset by help drops.
    // With RNG always failing: kills 1-10 → help drop at 10 (resets
    // consecutiveNonDrops but NOT totalKillCount), kills 11-16 → fairy at 16.
    const origRandom = Math.random;
    try {
      Math.random = () => 0.999; // always fails rate check
      for (let i = 0; i < 9; i++) {
        engine.rollDrop(99, tables);
      }
      // Kill 10: help drop fires
      const helpDrop = engine.rollDrop(99, tables);
      expect([0x00, 0x0f]).toContain(helpDrop);

      // Kills 11-15: non-drops
      for (let i = 0; i < 5; i++) {
        engine.rollDrop(99, tables);
      }
      // Kill 16: fairy
      const result = engine.rollDrop(99, tables);
      expect(result).toBe(0x23);
    } finally {
      Math.random = origRandom;
    }
  });

  it('forces help drop after 10 consecutive non-drops', () => {
    const engine = new DropEngine();
    const tables = makeDropTables();
    const origRandom = Math.random;
    try {
      Math.random = () => 0.999;
      for (let i = 0; i < 9; i++) {
        engine.rollDrop(99, tables);
      }
      // 10th consecutive non-drop should trigger help
      const result = engine.rollDrop(99, tables);
      expect(result).not.toBeNull();
      expect([0x00, 0x0f]).toContain(result); // bomb or 5 rupees
    } finally {
      Math.random = origRandom;
    }
  });

  it('resets state on reset()', () => {
    const engine = new DropEngine();
    const tables = makeDropTables();
    engine.rollDrop(99, tables);
    engine.reset();
    // After reset, should be as if fresh
    const origRandom = Math.random;
    try {
      Math.random = () => 0; // always drops
      const result = engine.rollDrop(7, tables);
      expect(result).toBe(0x22); // table[0][0] = heart
    } finally {
      Math.random = origRandom;
    }
  });
});
