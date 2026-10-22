import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { A } from './battle_state';
import { battleGlyphTile } from './battle_screen';
import { readHpBarWord, writeHpBarWord, updateHPBar2, updateCurMonHPBar } from './battle_hp';
import { finish, hpRig } from '../test/battle_hp_rig';

function pixels(cells: readonly (number | string)[]): number {
  return cells.reduce<number>((sum, cell) => sum + (cell === 0x6b ? 8 : Number(cell) - 0x63), 0);
}
function numberCells(n: number) { return [...String(n).padStart(3, ' ')].map(battleGlyphTile); }

describe('UpdateHPBar2 Program ledger, hp_bar.asm:48–159,204–283', () => {
  const cases = [[45, 0, 45], [0, 45, 45], [300, 299, 300], [299, 300, 300],
    [13, 33, 39], [1, 21, 300], [1, 2, 300], [0, 1, 20]];
  for (const [old, target, max] of cases) for (const type of [0, 1] as const) {
    it(`matches the cartridge ledger ${old}->${target}/${max} type${type}, including terminal tick`, () => {
      const r = hpRig(); const x = type ? 10 : 2, y = type ? 9 : 2;
      const number = () => [1, 2, 3].map(i => r.screen.at(x + i, y + 1));
      for (let i = 1; i <= 3; i++) r.screen.put(x + i, y + 1, 999);
      const rows = readFileSync(resolve(__dirname,
        `../../../notes/66-a5c1-cp1/hp_${old}_${target}_max${max}_type${type}.csv`), 'utf8')
        .trim().split(/\r?\n/).slice(1).map(line => line.split(','));
      let index = 0;
      const p = updateHPBar2(r.s, r.screen, x, y, type, old, target, max);
      const out = finish(p, frame => {
        expect(frame).toBe('serviced');
        const row = rows[index++]; expect(row, 'no extra final frame').toBeDefined();
        expect(pixels(Array.from({ length: 6 }, (_, i) => r.screen.at(x + 2 + i, y)!))).toBe(Number(row[1]));
        expect(r.screen.at(x, y)).toBe(0x71); expect(r.screen.at(x + 1, y)).toBe(0x62);
        expect(r.screen.at(x + 8, y)).toBe(type ? 0x6d : 0x6c);
        expect(number()).toEqual(type ? numberCells(Number(row[2])) : [999, 999, 999]);
        if (type) expect(r.s.readBE(A.wHPBarTempHP)).toBe(Number(row[2]));
      });
      expect(out.frames).toHaveLength(rows.length);
      expect(readHpBarWord(r.s, A.wHPBarOldHP)).toBe(target);
      expect(readHpBarWord(r.s, A.wHPBarNewHP)).toBe(target);
      expect(readHpBarWord(r.s, A.wHPBarMaxHP)).toBe(max);
      expect(r.s.readBE(A.wHPBarHPDifference)).toBe(Math.abs(target - old));
      expect(r.s.wHPBarDelta).toBe(target > old ? 1 : 255);
      expect(r.s.wBattleMonHP).toBe(100); // Animation does not apply HP or touch the turn/damage.
      expect(r.s.hWhoseTurn).toBe(0);
    });
  }
  it.each([0, 1] as const)('equal HP type%i writes scratch words and yields nothing or screen writes', type => {
    const r = hpRig(), before = r.screen.cells; r.s.wHPBarDelta = 77; r.s.wHPBarTempHP = 88;
    expect(finish(updateHPBar2(r.s, r.screen, 2, 2, type, 300, 300, 703)).frames).toEqual([]);
    expect(r.screen.cells).toEqual(before); expect(r.s.wHPBarDelta).toBe(77); expect(r.s.wHPBarTempHP).toBe(88);
    expect([...r.s.bytes(A.wHPBarMaxHP, 6)]).toEqual([191, 2, 44, 1, 44, 1]);
    expect(r.s.readBE(A.wHPBarHPDifference)).toBe(0); expect(r.s.wHPBarType).toBe(type);
  });
  it.each([0, 1] as const)('UpdateCurMonHPBar uses side%i coordinates, type and LE temporaries', side => {
    const r = hpRig(side); writeHpBarWord(r.s, A.wHPBarOldHP, 1);
    writeHpBarWord(r.s, A.wHPBarNewHP, 2); writeHpBarWord(r.s, A.wHPBarMaxHP, 300);
    r.s.wDamage = 0x3456;
    expect(finish(updateCurMonHPBar(r.s, r.screen)).frames).toHaveLength(side ? 5 : 7);
    expect(r.s.wHPBarType).toBe(side ? 0 : 1);
    expect(r.screen.at(side ? 2 : 10, side ? 2 : 9)).toBe(0x71);
    expect(r.screen.at(side ? 10 : 2, side ? 9 : 2)).toBe(' ');
    expect([r.s.wDamage, r.s.hWhoseTurn]).toEqual([0x3456, side]);
  });
  it('writes LE words including high-byte wrap, independently of BE battle HP', () => {
    const r = hpRig(); writeHpBarWord(r.s, A.wHPBarOldHP, 0x12345);
    expect([...r.s.bytes(A.wHPBarOldHP, 2)]).toEqual([0x45, 0x23]);
    expect(readHpBarWord(r.s, A.wHPBarOldHP)).toBe(0x2345);
  });
});
