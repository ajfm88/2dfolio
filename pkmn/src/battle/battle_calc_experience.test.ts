import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { A, BattleState } from './battle_state';
import { calcExperience, calcLevelFromExperience, GROWTH_RATE_TABLE } from './battle_calc_experience';

// Independent integer polynomials from data/growth_rates.asm; all six, including unused species rates.
const coefficients = [[1, 1, 0, 0, 0], [3, 4, 10, 0, 30], [3, 4, 20, 0, 70],
  [6, 5, -15, 100, 140], [4, 5, 0, 0, 0], [5, 4, 0, 0, 0]];
function expected(rate: number, level: number): number {
  const [numerator, denominator, square, linear, constant] = coefficients[rate];
  return (Math.floor(numerator * level ** 3 / denominator) + square * level ** 2 + linear * level - constant) & 0xffffff;
}

describe('raw CalcExperience', () => {
  it.each([0, 1, 2, 3, 4, 5])('rate %i matches the integer polynomial with 24-bit wraps, levels 0..255', rate => {
    const s = new BattleState(); s.wMonHGrowthRate = rate;
    for (let level = 0; level < 256; level++) {
      const result = calcExperience(s, level);
      expect(result).toBe(expected(rate, level));
      expect([...s.mem.subarray(A.hExperience, A.hExperience + 3)]).toEqual([
        result >>> 16, (result >>> 8) & 255, result & 255,
      ]);
    }
  });

  it('keeps level-one and level-zero underflows instead of the live helper policy', () => {
    const s = new BattleState();
    expect([0, 1, 2, 3, 4, 5].map(rate => { s.wMonHGrowthRate = rate; return calcExperience(s, 1); }))
      .toEqual([1, 0xffffec, 0xffffce, 0xffffca, 0, 1]);
    s.wMonHGrowthRate = 3;
    expect(calcExperience(s, 0)).toBe(0xffff74);
  });

  it('CalcLevelFromExperience loads the selected header and accepts equality without a level-100 cap', () => {
    const s = new BattleState(); s.mem[A.wLoadedMon] = 84;
    s.species = species => {
      expect(species).toBe(84);
      return { name: 'PIKACHU', base: [35, 55, 40, 90, 50], type1: 23, type2: 23,
        catchRate: 190, baseExp: 82, moves: [84, 45, 0, 0], learnset: [], growthRate: 0 };
    };
    for (const [exp, level] of [[0, 1], [999, 9], [1000, 10], [1000000, 100], [1030301, 101]]) {
      s.mem[A.wLoadedMonExp] = exp >>> 16; s.writeBE(A.wLoadedMonExp + 1, exp);
      expect(calcLevelFromExperience(s)).toBe(level);
      expect(s.wCurSpecies).toBe(84); expect(s.wMonHGrowthRate).toBe(0);
      expect(s.mem[A.wLoadedMonExp] * 65536 + s.readBE(A.wLoadedMonExp + 1)).toBe(exp);
      const exceeded = (level + 1) ** 3;
      expect(s.mem[A.hExperience] * 65536 + s.readBE(A.hExperience + 1)).toBe(exceeded);
    }
  });

  it('rejects unsupported headers/rates rather than inventing medium-fast data', () => {
    const s = new BattleState(); s.wMonHGrowthRate = 6;
    expect(() => calcExperience(s, 5)).toThrow('growth rate outside');
    s.species = () => ({ name: 'OLD FIXTURE', base: [1, 1, 1, 1, 1], type1: 0, type2: 0,
      catchRate: 1, baseExp: 1, moves: [0, 0, 0, 0], learnset: [] });
    expect(() => calcLevelFromExperience(s)).toThrow('missing growth rate');
  });
});

it.skipIf(!process.env.ROM_PATH)('pins all six growth records to ASM, symbols and ROM, including underflows', () => {
  const pret = resolve(__dirname, '../../../refs/pokeyellow');
  const symbols = execFileSync('git', ['-C', pret, 'show', 'origin/symbols:pokeyellow.sym'], { encoding: 'utf8' });
  expect(symbols).toMatch(/^16:4e73 GrowthRateTable$/m);
  const source = readFileSync(resolve(pret, 'data/growth_rates.asm'), 'utf8');
  const rows = [...source.matchAll(/^\s*growth_rate\s+(\d+),\s*(\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)/gm)]
    .map(match => match.slice(1).map(Number));
  expect(rows).toEqual(coefficients);
  const rom = readFileSync(process.env.ROM_PATH!);
  const raw = [...rom.subarray(0x16 * 0x4000 + 0x0e73, 0x16 * 0x4000 + 0x0e73 + 24)];
  expect(raw).toEqual(GROWTH_RATE_TABLE.flat());
  expect(raw).toEqual(rows.flatMap(([a, b, c, d, e]) => [(a << 4) | b, Math.abs(c) | (c < 0 ? 128 : 0), d, e]));
  const s = new BattleState();
  for (let rate = 0; rate < 6; rate++) for (const level of [0, 1, 2, 5, 50, 100, 255]) {
    s.wMonHGrowthRate = rate;
    const [ratio, square, linear, constant] = raw.slice(rate * 4, rate * 4 + 4);
    const polynomial = Math.floor((ratio >>> 4) * level ** 3 / (ratio & 15))
      + (square & 127) * (square & 128 ? -1 : 1) * level ** 2 + linear * level - constant;
    expect(calcExperience(s, level)).toBe(polynomial & 0xffffff);
  }
});
