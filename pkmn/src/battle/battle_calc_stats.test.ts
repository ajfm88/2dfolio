import { describe, expect, it } from 'vitest';
import { A, BattleState } from './battle_state';
import { calcStat, calcStats } from './battle_calc_stats';
import { getEnemyMonStat } from './battle_damage_asm';

// Independent examples from home/move_mon.asm:73-92 and 154-226, not production-generated fixtures.
const boundaries = [[0, 0], [1, 0], [9, 0], [10, 1], [16, 1], [17, 1], [63001, 62],
  [63002, 63], [63504, 63], [64516, 63], [64517, 63], [65025, 63], [65535, 63]];
const base = A.wPartyMons + 16;

function fixture(): BattleState {
  const state = new BattleState();
  state.setBytes(A.wMonHBaseStats, [35, 55, 40, 90, 50], 5);
  state.mem[base + 11] = 0x98; state.mem[base + 12] = 0x76;
  state.wCurEnemyLevel = 50;
  return state;
}

describe('CalcStat with stat experience', () => {
  it.each(boundaries)('stat experience %i contributes bonus %i on every stat', (experience, bonus) => {
    const s = fixture(); s.wCurEnemyLevel = 100;
    for (let stat = 1; stat <= 5; stat++) {
      s.writeBE(base + stat * 2 - 1, experience);
      const untrained = [200, 133, 101, 199, 117][stat - 1];
      expect(calcStat(s, stat, 1, base)).toBe(untrained + bonus);
      expect(calcStat(s, stat, 0, base)).toBe(untrained);
    }
  });

  it('CalcStats writes five BE words at DE, using each stat-exp word and derived HP DV', () => {
    const s = fixture(); const values = [0, 10, 63001, 63002, 65535];
    values.forEach((value, i) => s.writeBE(base + 1 + i * 2, value));
    const before = s.mem.slice(); const destination = A.wPartyMons + 34;
    calcStats(s, 1, base, destination);
    expect([...s.mem.slice(destination, destination + 10)]).toEqual([0, 105, 0, 69, 0, 84, 0, 133, 0, 92]);
    before.set(s.mem.subarray(destination, destination + 10), destination);
    expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true); // No party HP/level/EXP write and no frame/RNG side effects.
  });

  it('caps all five stats at 999, including HP and stat-exp maxima', () => {
    const s = fixture(); s.setBytes(A.wMonHBaseStats, [255, 255, 255, 255, 255], 5);
    s.mem[base + 11] = s.mem[base + 12] = 0xff; s.wCurEnemyLevel = 255;
    for (let stat = 1; stat <= 5; stat++) {
      s.writeBE(base + stat * 2 - 1, 65535);
      expect(calcStat(s, stat, 0, base)).toBe(999);
      expect(calcStat(s, stat, 1, base)).toBe(999);
    }
  });

  it('b=0 preserves the previous numbers over base, level and DV boundaries without touching memory', () => {
    const s = fixture();
    for (const statBase of [0, 1, 35, 127, 255]) for (const level of [1, 5, 50, 100, 255]) {
      for (const dv of [0, 1, 8, 15]) {
        s.setBytes(A.wMonHBaseStats, Array(5).fill(statBase), 5); s.wCurEnemyLevel = level;
        s.mem[base + 11] = s.mem[base + 12] = dv * 17;
        s.mem.fill(255, base + 1, base + 11);
        const hpDv = (dv & 1) * 15; const before = s.mem.slice();
        for (let stat = 1; stat <= 5; stat++) {
          const expected = Math.min(999, Math.floor(2 * (statBase + (stat === 1 ? hpDv : dv)) * level / 100)
            + (stat === 1 ? level + 10 : 5));
          expect(calcStat(s, stat, 0, base)).toBe(expected);
        }
        expect(Buffer.from(s.mem).equals(Buffer.from(before))).toBe(true);
      }
    }
  });

  it('GetEnemyMonStat still supplies its unusual loaded-SpeedExp DV pointer to the shared b=0 body', () => {
    const s = fixture(); s.wEnemyMonSpecies = 84; s.wEnemyMonLevel = 50;
    s.setBytes(A.wEnemyMonDVs, [0x98, 0x76], 2);
    s.species = () => ({ name: 'PIKACHU', base: [35, 55, 40, 90, 50], type1: 23, type2: 23,
      catchRate: 190, baseExp: 82, moves: [84, 45, 0, 0], learnset: [] });
    expect([1, 2, 3, 4, 5].map(stat => getEnemyMonStat(s, stat))).toEqual([105, 69, 53, 102, 61]);
  });
});
