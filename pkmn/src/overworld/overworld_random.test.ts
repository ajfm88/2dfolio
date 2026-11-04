// DECISIONS #91: the overworld's Random on the page-lifetime hRandomAdd / hRandomSub owner.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { BattleRandomState } from '../battle/battle_random_state';
import { BattleState } from '../battle/battle_state';

function scripted(...div: number[]): BattleRandomState {
  return new BattleRandomState(() => { const next = div.shift(); if (next === undefined) throw new Error('unscripted DIV read'); return next; });
}

describe('BattleRandomState.random (engine/math/random.asm:1-14)', () => {
  it('adds DIV and the caller\'s carry to hRandomAdd, then subtracts the next DIV and the ADC\'s carry from hRandomSub', () => {
    const random = scripted(0x30, 0x31);
    random.hRandomAdd = 0x10; random.hRandomSub = 0x20;
    expect(random.random(1)).toBe(0x41);
    expect([random.hRandomAdd, random.hRandomSub, random.carry]).toEqual([0x41, 0xef, 1]);
  });

  it('carries the ADC\'s overflow into the SBC, and leaves carry clear when the SBC does not borrow', () => {
    const random = scripted(0x20, 0x01);
    random.hRandomAdd = 0xf0; random.hRandomSub = 0x80;
    expect(random.random(0)).toBe(0x10);
    expect([random.hRandomAdd, random.hRandomSub, random.carry]).toEqual([0x10, 0x7e, 0]);
  });

  it('refuses while a battle owns the bytes, and resumes from what the battle returned', () => {
    const random = scripted(0x05, 0x06), state = new BattleState();
    random.attach(state);
    expect(random.isAttached).toBe(true);
    expect(() => random.random(0)).toThrow('a battle owns');
    state.hRandomAdd = 0x77; state.hRandomSub = 0x88;
    random.detach(state);
    expect(random.random(0)).toBe(0x7c);
    expect(random.hRandomSub).toBe(0x82);
  });
});

it('no production module draws Math.random (DECISIONS #91)', () => {
  const src = resolve(__dirname, '..'), offenders: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'test') walk(path); continue; }
      if (!path.endsWith('.ts') || path.endsWith('.test.ts')) continue;
      if (/\bMath\.random\b/.test(readFileSync(path, 'utf8'))) offenders.push(relative(src, path).replace(/\\/g, '/'));
    }
  }
  walk(src);
  expect(offenders).toEqual([]);
});
