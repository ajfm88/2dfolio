import { describe, it, expect } from 'vitest';
import { getDungeonLevel, DUNGEON_ENTRANCE_SCREENS } from '../../src/data/dungeon-entrance-data.js';

describe('getDungeonLevel', () => {
  it('L1-6 entrance screens map to correct levels', () => {
    expect(getDungeonLevel(55)).toBe(1);
    expect(getDungeonLevel(60)).toBe(2);
    expect(getDungeonLevel(116)).toBe(3);
    expect(getDungeonLevel(69)).toBe(4);
    expect(getDungeonLevel(11)).toBe(5);
    expect(getDungeonLevel(34)).toBe(6);
  });

  it('L7 entrance screen 66 maps to level 7', () => {
    expect(getDungeonLevel(66)).toBe(7);
  });

  it('L8 entrance screen 109 maps to level 8', () => {
    expect(getDungeonLevel(109)).toBe(8);
  });

  it('L9 entrance screen 5 maps to level 9', () => {
    expect(getDungeonLevel(5)).toBe(9);
  });

  it('Q2 alternate screens map correctly', () => {
    expect(getDungeonLevel(25)).toBe(7);
    expect(getDungeonLevel(108)).toBe(8);
    expect(getDungeonLevel(0)).toBe(9);
  });

  it('unknown screen returns null', () => {
    expect(getDungeonLevel(99)).toBeNull();
    expect(getDungeonLevel(127)).toBeNull();
  });

  it('covers all 9 dungeon levels', () => {
    const levels = new Set(Object.values(DUNGEON_ENTRANCE_SCREENS));
    for (let l = 1; l <= 9; l++) {
      expect(levels.has(l)).toBe(true);
    }
  });
});
