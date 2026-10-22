import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { A } from './battle_state';
import { readHpBarWord } from './battle_hp';
import * as hpBar from './battle_hp';
import { finish, hpRig } from '../test/battle_hp_rig';
import { namedBattleRandom } from '../test/battle_random_log';
import type { BattleTurnTextHost } from './battle_turn_text';
import * as hud from './battle_hud_state';
import { BattleUnsupportedState } from './battle_move_data';
import {
  applyAttackToEnemyPokemon, applyAttackToPlayerPokemon, applyDamageToEnemyPokemon, applyDamageToPlayerPokemon,
  attackSubstitute, displayEffectiveness, printCriticalOHKOText, printDoesntAffectText, printMoveFailureText,
  type ApplyPorts,
} from './battle_apply';
import { adjustDamageForMoveType } from './battle_damage_asm';
import { moveHitTest } from './battle_hit';

beforeAll(loadTextPrograms);
afterEach(() => vi.restoreAllMocks());

function rig(side: 0 | 1) {
  const r = hpRig(side), s = r.s, events: string[] = [];
  s.readDIV = () => { throw new Error('unexpected application draw'); };
  s.wDamage = 10; s.wPlayerMovePower = 40; s.wEnemyMovePower = 40;
  const c = side === 0 ? {
    effect: A.wPlayerMoveEffect, otherEffect: A.wEnemyMoveEffect, move: A.wPlayerMoveNum, level: A.wBattleMonLevel,
    ownSub: A.wPlayerSubstituteHP, targetSub: A.wEnemySubstituteHP,
    own2: A.wPlayerBattleStatus2, target2: A.wEnemyBattleStatus2,
  } : {
    effect: A.wEnemyMoveEffect, otherEffect: A.wPlayerMoveEffect, move: A.wEnemyMoveNum, level: A.wEnemyMonLevel,
    ownSub: A.wEnemySubstituteHP, targetSub: A.wPlayerSubstituteHP,
    own2: A.wEnemyBattleStatus2, target2: A.wPlayerBattleStatus2,
  };
  const host: BattleTurnTextHost = { printText: function* (label) {
    expect(getTextPrograms()[label]).toBeDefined(); events.push(`${label}:${s.hWhoseTurn}:${s.wCriticalHitOrOHKO}`);
  } };
  const ports: ApplyPorts = {
    substituteBreak: function* (state) { events.push(`break:${state.hWhoseTurn}`); yield 'held'; yield 'session'; },
    shake: function* (state, b) { events.push(`shake:${state.hWhoseTurn}:${b}`); yield 'held'; },
  };
  const attack = () => (side === 0 ? applyAttackToEnemyPokemon : applyAttackToPlayerPokemon)(s, r.screen, host, ports);
  const damage = () => (side === 0 ? applyDamageToEnemyPokemon : applyDamageToPlayerPokemon)(s, r.screen, host, ports);
  return { ...r, c: { ...r.c, ...c }, events, host, ports, attack, damage };
}

for (const side of [0, 1] as const) describe(`application actor ${side}`, () => {
  it('ordinary hit applies first, animates correct HP bar then draws both live HUDs', () => {
    const r = rig(side); const out = finish(r.attack());
    expect(r.s.readBE(r.c.opposite)).toBe(90); expect(r.s.readBE(r.c.hp)).toBe(100);
    expect(r.s.wDamage).toBe(10); expect(r.s.wHPBarType).toBe(side ? 1 : 0);
    expect(out.frames).toEqual(Array(side ? 22 : 11).fill('serviced'));
    expect([r.screen.at(10, 9), r.screen.at(2, 2)]).toEqual([0x71, 0x71]);
    expect(r.events).toEqual([]);
  });
  it.each([0, 1, 0x7fff])('power 0 redraws only, preserving stale damage %i and both HP words', damage => {
    const r = rig(side); r.s.wDamage = damage; r.s.mem[side ? A.wEnemyMovePower : A.wPlayerMovePower] = 0;
    r.s.wHPBarType = 99; const scratch = r.s.bytes(A.wHPBarMaxHP, 6).slice();
    expect(finish(r.attack()).frames).toEqual([]);
    expect([r.s.wDamage, r.s.wBattleMonHP, r.s.wEnemyMonHP]).toEqual([damage, 100, 100]);
    expect(r.s.bytes(A.wHPBarMaxHP, 6).slice()).toEqual(scratch); expect(r.s.wHPBarType).toBe(99);
    expect([r.screen.at(10, 9), r.screen.at(2, 2)]).toEqual([0x71, 0x71]);
  });
  it('OHKO applies prepared damage even at power 0', () => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x26; r.s.wPlayerMovePower = 0; r.s.wEnemyMovePower = 0;
    r.s.wDamage = 99; finish(r.attack()); expect(r.s.readBE(r.c.opposite)).toBe(1);
  });
  it.each([[0, 0], [1, 1], [2, 1], [99, 49], [100, 50], [0x201, 0x100]])(
    'Super Fang current HP %i yields actual damage %i independently of power and max HP', (hp, damage) => {
      const r = rig(side); r.s.writeBE(r.c.opposite, hp); r.s.writeBE(r.c.oppositeMax, 600);
      r.s.mem[r.c.effect] = 0x28; r.s.wPlayerMovePower = 0; r.s.wEnemyMovePower = 0;
      finish(r.attack()); expect(r.s.wDamage).toBe(damage); expect(r.s.readBE(r.c.opposite)).toBe(hp - damage);
    });
  it.each([[69, 37], [101, 37], [49, 20], [82, 40]])('fixed move %i deals %i without a draw or type check', (move, damage) => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = move; r.s.mem[r.c.level] = 37;
    r.s.wPlayerMovePower = 0; r.s.wEnemyMovePower = 0; r.s.wDamageMultipliers = 0;
    finish(r.attack()); expect(r.s.readBE(r.c.opposite)).toBe(100 - damage); expect(r.s.wDamage).toBe(damage);
    expect(r.s.wDamageMultipliers).toBe(0);
  });
  it('Psywave exact named hit and rejection log; samples occur only at application', () => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = 149; r.s.mem[r.c.level] = 10;
    r.s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8);
    r.s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
    r.s.wPlayerMoveAccuracy = 255; r.s.wEnemyMoveAccuracy = 255;
    const hitLog = namedBattleRandom(r.s, 'hit', [254]);
    expect(moveHitTest(r.s)).toEqual({ z: false, carry: true });
    const samples = side === 0 ? [0, 15, 255, 14] : [15, 255, 0];
    const log = namedBattleRandom(r.s, 'Psywave', samples);
    expect(log).toEqual([]); finish(r.attack());
    expect(log).toEqual(samples.map(n => `${side}:Psywave:${n}`));
    expect([...hitLog, ...log]).toEqual([`${side}:hit:254`, ...samples.map(n => `${side}:Psywave:${n}`)]);
    expect(r.s.wDamage).toBe(side ? 0 : 14); expect(r.s.readBE(r.c.opposite)).toBe(side ? 100 : 86);
    expect([r.screen.at(10, 9), r.screen.at(2, 2)]).toEqual([0x71, 0x71]);
  });
  it('Psywave upper bound wraps in one byte: level 172 -> b=2', () => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = 149; r.s.mem[r.c.level] = 172;
    const log = namedBattleRandom(r.s, 'Psywave', [2, 1]); finish(r.attack());
    expect(log).toEqual([`${side}:Psywave:2`, `${side}:Psywave:1`]); expect(r.s.wDamage).toBe(1);
  });
  it('Psywave floors odd-level bound and allows its last legal sample', () => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = 149; r.s.mem[r.c.level] = 3;
    const log = namedBattleRandom(r.s, 'Psywave', [4, 3]); finish(r.attack());
    expect(log).toEqual([`${side}:Psywave:4`, `${side}:Psywave:3`]); expect(r.s.wDamage).toBe(3);
  });
  it('Psywave empty range freezes forever without applying damage or drawing HUDs', () => {
    for (const level of side ? [0, 171] : [0, 1, 171]) {
      const r = rig(side); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = 149; r.s.mem[r.c.level] = level;
      const p = r.attack(), before = r.s.mem.slice();
      for (let i = 0; i < 41; i++) expect(p.next()).toEqual({ done: false, value: 'serviced' });
      expect(r.s.mem).toEqual(before); expect(r.screen.at(10, 9)).toBe(' '); p.return(undefined);
    }
  });
  it('damage 0 bypasses a Substitute and leaves all scratch words untouched, drawing HUDs only', () => {
    const r = rig(side); r.s.wDamage = 0; r.s.mem[r.c.target2] = 0x10;
    const scratch = r.s.bytes(A.wHPBarMaxHP, 6).slice();
    finish(r.damage()); expect(r.events).toEqual([]); expect(r.s.bytes(A.wHPBarMaxHP, 6).slice()).toEqual(scratch);
    expect([r.screen.at(10, 9), r.screen.at(2, 2)]).toEqual([0x71, 0x71]);
  });
  it.each([[300, 299, 1], [45, 0, 45], [45, 0, 46], [257, 255, 2], [257, 256, 1]])(
    'HP ledger old %i -> %i requested %i, every frame matches the cartridge bar', (old, next, damage) => {
      const r = rig(side), max = old === 45 ? 45 : 300;
      r.s.writeBE(r.c.opposite, old); r.s.writeBE(r.c.oppositeMax, max); r.s.wDamage = damage;
      const type = side ? 1 : 0, x = side ? 10 : 2, y = side ? 9 : 2;
      // Existing committed ledger for hit300->299 and KO45->0; extra byte-borrow case checked below.
      const rows = old === 257 ? undefined : readFileSync(resolve(__dirname,
        `../../../notes/66-a5c1-cp1/hp_${old}_${next}_max${max}_type${type}.csv`), 'utf8')
        .trim().split(/\r?\n/).slice(1).map(line => line.split(','));
      const redraw = vi.spyOn(hud, 'drawHuds').mockImplementation(function* (s) {
        expect(s.readBE(r.c.opposite)).toBe(next); expect(s.wDamage).toBe(old - next);
        expect(readHpBarWord(s, A.wHPBarOldHP)).toBe(next);
        expect(readHpBarWord(s, A.wHPBarNewHP)).toBe(next);
        yield 'held'; yield 'session';
      });
      let i = 0;
      const out = finish(r.damage(), frame => {
        if (frame !== 'serviced') return;
        expect(r.s.readBE(r.c.opposite)).toBe(next);
        const pixels = Array.from({ length: 6 }, (_, j) => r.screen.at(x + 2 + j, y)!)
          .reduce<number>((n, cell) => n + (cell === 0x6b ? 8 : Number(cell) - 0x63), 0);
        if (rows) {
          expect(pixels).toBe(Number(rows[i][1]));
          if (type) expect(r.s.readBE(A.wHPBarTempHP)).toBe(Number(rows[i][2]));
        }
        i++;
      });
      if (rows) expect(i).toBe(rows.length);
      expect(out.frames.slice(-2)).toEqual(['held', 'session']); expect(redraw).toHaveBeenCalledTimes(1);
      expect([...r.s.bytes(A.wHPBarMaxHP, 2)]).toEqual([max & 255, max >> 8]);
      expect(r.s.readBE(r.c.hp)).toBe(100); expect(r.s.hWhoseTurn).toBe(side);
    });
  it('HP subtraction writes each side in ASM byte order before the bar Program starts', () => {
    const r = rig(side), writes: [number, number][] = [];
    r.s.writeBE(r.c.opposite, 257); r.s.writeBE(r.c.oppositeMax, 600); r.s.wDamage = 258;
    const mem = r.s.mem;
    Object.defineProperty(r.s, 'mem', { value: new Proxy(mem, {
      get(target, key) {
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value: number) {
        if (typeof key === 'string' && /^\d+$/.test(key)) writes.push([Number(key), value & 255]);
        return Reflect.set(target, key, value, target);
      },
    }) });
    const hp = r.c.opposite;
    const expected: [number, number][] = [
      [A.wHPBarOldHP, 1], [hp + 1, 255],
      ...(side ? [[A.wHPBarNewHP, 255] as [number, number]] : []),
      [A.wHPBarOldHP + 1, 1], [hp, 255],
      ...(side ? [[A.wHPBarNewHP + 1, 255] as [number, number]] : []),
      [A.wDamage, 1], [A.wDamage + 1, 1], [hp, 0], [hp + 1, 0],
      ...(side ? [[A.wHPBarNewHP, 0], [A.wHPBarNewHP + 1, 0]] as [number, number][] : []),
      [A.wHPBarMaxHP, 88], [A.wHPBarMaxHP + 1, 2],
      ...(!side ? [[A.wHPBarNewHP, 0], [A.wHPBarNewHP + 1, 0]] as [number, number][] : []),
    ];
    const bar = vi.spyOn(hpBar, 'updateHPBar2').mockImplementation(function* (s, screen, x, y, type, old, next, max) {
      expect(writes).toEqual(expected); expect(s).toBe(r.s); expect(screen).toBe(r.screen);
      expect(s.wHPBarType).toBe(side ? 1 : 0); // Byte accessors retain the underlying array, not its tracing Proxy.
      expect([x, y, type, old, next, max]).toEqual(side ? [10, 9, 1, 257, 0, 600] : [2, 2, 0, 257, 0, 600]);
      yield 'held';
    });
    const out = finish(r.damage());
    expect(bar).toHaveBeenCalledTimes(1); expect(out.frames[0]).toBe('held');
  });
  it.each([[10, 9, 1, true], [10, 10, 0, true], [10, 11, 255, false], [10, 256, 10, false]])(
    'Substitute HP %i damage %i -> byte%i survives%s, damage never capped', (hp, damage, next, up) => {
      const r = rig(side); r.s.mem[r.c.target2] = 0xb7; r.s.mem[r.c.targetSub] = hp;
      r.s.mem[r.c.ownSub] = 88; r.s.mem[r.c.own2] = 0xff;
      r.s.mem[r.c.effect] = 55; r.s.mem[r.c.otherEffect] = 77; r.s.wDamage = damage;
      const out = finish(r.damage());
      expect(r.s.mem[r.c.targetSub]).toBe(next); expect(r.s.mem[r.c.target2]).toBe(up ? 0xb7 : 0xa7);
      expect(r.s.mem[r.c.ownSub]).toBe(88); expect(r.s.mem[r.c.own2]).toBe(255);
      expect([r.s.wDamage, r.s.wBattleMonHP, r.s.wEnemyMonHP]).toEqual([damage, 100, 100]);
      expect(r.events).toEqual(up ? [`SubstituteTookDamageText:${side}:0`]
        : [`SubstituteTookDamageText:${side}:0`, `SubstituteBrokeText:${side}:0`, `break:${side ^ 1}`]);
      expect(r.s.mem[r.c.effect]).toBe(up ? 55 : 0); expect(r.s.mem[r.c.otherEffect]).toBe(77);
      expect(r.s.hWhoseTurn).toBe(side);
      expect(out.frames).toEqual(up ? [] : ['held', 'session']);
      expect(r.screen.at(10, 9)).toBe(up ? ' ' : 0x71);
    });
  it('Substitute selection and damage reads happen after the took-damage text returns', () => {
    const r = rig(side); r.s.mem[r.c.targetSub] = 30; r.s.mem[r.c.target2] = 0x10;
    r.host.printText = function* () { yield 'serviced'; r.s.wDamage = 5; };
    const p = attackSubstitute(r.s, r.screen, r.host, r.ports);
    expect(p.next()).toEqual({ done: false, value: 'serviced' }); expect(r.s.mem[r.c.targetSub]).toBe(30);
    expect(p.next().done).toBe(true); expect(r.s.mem[r.c.targetSub]).toBe(25);
  });
  it.each([[0, 255, 'DoesntAffectMonText'], [128, 255, 'DoesntAffectMonText'],
    [10, 255, 'UnaffectedText'], [138, 1, 'AttackMissedText'], [10, 0, 'AttackMissedText']])(
    'failure priority multiplier%i crit%i -> %s then clears crit', (multiplier, crit, label) => {
      const r = rig(side); r.s.wDamageMultipliers = multiplier; r.s.wCriticalHitOrOHKO = crit;
      expect(finish(printMoveFailureText(r.s, r.screen, r.host, r.ports)).frames).toEqual([]);
      expect(r.events).toEqual([`${label}:${side}:${crit}`]); expect(r.s.wCriticalHitOrOHKO).toBe(0);
      expect(r.s.wDamage).toBe(10); expect(r.s.readBE(r.c.hp)).toBe(100);
    });
  it.each([[0, 1], [7, 1], [8, 1], [16, 2], [0x810, 0x102]])('Jump Kick shared damage %i -> crash %i on own HP after text/shake', (damage, crash) => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x2d; r.s.mem[r.c.otherEffect] = 1;
    r.s.writeBE(r.c.hp, 600); r.s.writeBE(r.c.max, 600);
    r.s.wDamage = damage; r.s.wDamageMultipliers = 10; r.s.wCriticalHitOrOHKO = 255;
    finish(printMoveFailureText(r.s, r.screen, r.host, r.ports));
    expect(r.events).toEqual([`UnaffectedText:${side}:255`, `KeptGoingAndCrashedText:${side}:0`, `shake:${side}:4`]);
    expect(r.s.readBE(r.c.hp)).toBe(600 - crash); expect(r.s.readBE(r.c.opposite)).toBe(100);
    expect(r.s.wDamage).toBe(crash); expect(r.s.hWhoseTurn).toBe(side);
  });
  it('other actor Jump Kick effect does not trigger crash', () => {
    const r = rig(side); r.s.mem[r.c.otherEffect] = 0x2d;
    finish(printMoveFailureText(r.s, r.screen, r.host, r.ports)); expect(r.s.readBE(r.c.hp)).toBe(100);
    expect(r.events).toEqual([`DoesntAffectMonText:${side}:0`]);
  });
  it('Jump Kick own Substitute gate subtracts from the opponent Substitute (glitch)', () => {
    const r = rig(side); r.s.mem[r.c.effect] = 0x2d; r.s.mem[r.c.own2] = 0x10;
    r.s.mem[r.c.ownSub] = 50; r.s.mem[r.c.targetSub] = 20; r.s.wDamage = 0;
    finish(printMoveFailureText(r.s, r.screen, r.host, r.ports));
    expect(r.s.mem[r.c.ownSub]).toBe(50); expect(r.s.mem[r.c.targetSub]).toBe(19);
    expect([r.s.wBattleMonHP, r.s.wEnemyMonHP, r.s.hWhoseTurn]).toEqual([100, 100, side]);
    expect(r.events).toEqual([`DoesntAffectMonText:${side}:0`, `KeptGoingAndCrashedText:${side}:0`,
      `shake:${side}:4`, `SubstituteTookDamageText:${side}:0`]);
  });
});

it('enemy Psywave level 1 has a nonempty range containing zero', () => {
  const r = rig(1); r.s.mem[r.c.effect] = 0x29; r.s.mem[r.c.move] = 149; r.s.mem[r.c.level] = 1;
  const log = namedBattleRandom(r.s, 'Psywave', [1, 0]); finish(r.attack());
  expect(log).toEqual(['1:Psywave:1', '1:Psywave:0']); expect(r.s.wDamage).toBe(0);
});

describe('critical and effectiveness text tails', () => {
  it('PrintDoesntAffectText forwards the committed root and every host yield', () => {
    const r = rig(0); r.host.printText = function* (label) { r.events.push(label); yield 'session'; yield 'held'; };
    expect(finish(printDoesntAffectText(r.host)).frames).toEqual(['session', 'held']);
    expect(r.events).toEqual(['DoesntAffectMonText']);
  });
  it.each([0, 1, 2])('critical byte %i text then clear then unconditional 20 frames', crit => {
    const r = rig(0); r.s.wCriticalHitOrOHKO = crit;
    r.host.printText = function* (label) { r.events.push(label); expect(r.s.wCriticalHitOrOHKO).toBe(crit); yield 'session'; };
    const out = finish(printCriticalOHKOText(r.s, r.host), frame => {
      if (frame === 'serviced') expect(r.s.wCriticalHitOrOHKO).toBe(0);
    });
    expect(out.frames).toEqual([...(crit ? ['session'] : []), ...Array(20).fill('serviced')]);
    expect(r.events).toEqual(crit ? [crit === 1 ? 'CriticalHitText' : 'OHKOText'] : []);
  });
  it.each([3, 4, 128, 255])('unsupported critical text pointer %i throws', crit => {
    const r = rig(0); r.s.wCriticalHitOrOHKO = crit;
    expect(() => finish(printCriticalOHKOText(r.s, r.host))).toThrow(BattleUnsupportedState);
    expect(r.s.wCriticalHitOrOHKO).toBe(crit); expect(r.events).toEqual([]);
  });
  it.each([[0, 'NotVeryEffectiveText'], [5, 'NotVeryEffectiveText'], [9, 'NotVeryEffectiveText'], [10, ''],
    [11, 'SuperEffectiveText'], [20, 'SuperEffectiveText'], [127, 'SuperEffectiveText']])(
    'effectiveness byte %i selects %s, ignoring STAB', (value, text) => {
      for (const stab of [0, 128]) {
        const r = rig(0); r.s.wDamageMultipliers = value | stab;
        finish(displayEffectiveness(r.s, r.host)); expect(r.events).toEqual(text ? [`${text}:0:0`] : []);
        expect(r.s.wDamageMultipliers).toBe(value | stab);
      }
    });
  it.each([[1, 0, 2, 0x05, 'NotVeryEffectiveText'], [4, 22, 3, 0x14, 'SuperEffectiveText'],
    [20, 22, 21, 0x05, 'NotVeryEffectiveText']])(
    'dual-type display uses last row: type%i against %i/%i byte%i', (type, target1, target2, byte, label) => {
      const r = rig(0); r.s.wPlayerMoveType = type; r.s.wBattleMonType1 = 0x1a; r.s.wBattleMonType2 = 0x1a;
      r.s.wEnemyMonType1 = target1; r.s.wEnemyMonType2 = target2; r.s.wDamage = 100;
      adjustDamageForMoveType(r.s); expect(r.s.wDamage).toBe(100); expect(r.s.wDamageMultipliers).toBe(byte);
      finish(displayEffectiveness(r.s, r.host)); expect(r.events).toEqual([`${label}:0:0`]);
    });
});
