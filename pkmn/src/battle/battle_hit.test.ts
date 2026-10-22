import { describe, expect, it } from 'vitest';
import { A, BattleState, LINK_STATE_BATTLING } from './battle_state';
import { calcHitChance, handleCounterMove, moveHitTest } from './battle_hit';
import { namedBattleRandom } from '../test/battle_random_log';
import { BattleUnsupportedState } from './battle_move_data';

function rig(side: 0 | 1) {
  const s = new BattleState(); s.hWhoseTurn = side;
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8);
  s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  s.wPlayerMoveAccuracy = 200; s.wEnemyMoveAccuracy = 200;
  s.wDamage = 0x1234; s.wMoveMissed = 9;
  s.wPlayerBattleStatus1 = 0x21; s.wEnemyBattleStatus1 = 0x22;
  s.readDIV = () => { throw new Error('unexpected hit draw'); };
  const c = side === 0 ? {
    effect: A.wPlayerMoveEffect, status: A.wEnemyMonStatus, target1: A.wEnemyBattleStatus1,
    target2: A.wEnemyBattleStatus2, attacker1: A.wPlayerBattleStatus1, attacker2: A.wPlayerBattleStatus2,
    accuracy: A.wPlayerMoveAccuracy, accMod: A.wPlayerMonAccuracyMod, evaMod: A.wEnemyMonEvasionMod,
    selected: A.wPlayerSelectedMove, opposing: A.wEnemySelectedMove, power: A.wEnemyMovePower, type: A.wEnemyMoveType,
  } : {
    effect: A.wEnemyMoveEffect, status: A.wBattleMonStatus, target1: A.wPlayerBattleStatus1,
    target2: A.wPlayerBattleStatus2, attacker1: A.wEnemyBattleStatus1, attacker2: A.wEnemyBattleStatus2,
    accuracy: A.wEnemyMoveAccuracy, accMod: A.wEnemyMonAccuracyMod, evaMod: A.wPlayerMonEvasionMod,
    selected: A.wEnemySelectedMove, opposing: A.wPlayerSelectedMove, power: A.wPlayerMovePower, type: A.wPlayerMoveType,
  };
  const miss = () => {
    expect([s.wDamage, s.wMoveMissed]).toEqual([0, 1]);
    expect(s.mem[c.attacker1] & 0x20).toBe(0);
    expect(s.mem[c.target1] & 0x20).toBe(0x20);
  };
  return { s, c, miss };
}

for (const side of [0, 1] as const) describe(`hit actor ${side}`, () => {
  it('awake Dream Eater misses with no other miss condition', () => {
    const { s, c, miss } = rig(side); s.mem[c.effect] = 8; s.mem[c.attacker2] = 1;
    expect(moveHitTest(s)).toEqual({ z: side === 0, carry: false }); miss();
  });
  it.each([0, 8, 0xf8])('Dream Eater awake status %i misses before invulnerability/X Accuracy', status => {
    const { s, c, miss } = rig(side); s.mem[c.effect] = 8; s.mem[c.status] = status;
    s.mem[c.attacker2] = 1; s.mem[c.target1] |= 0x40;
    expect(moveHitTest(s)).toEqual({ z: side === 0, carry: false }); miss();
    expect(s.mem[c.accuracy]).toBe(200);
  });
  it.each([1, 7, 0xff])('Dream Eater sleeping status %i reaches one hit draw', status => {
    const { s, c } = rig(side); s.mem[c.effect] = 8; s.mem[c.status] = status;
    const log = namedBattleRandom(s, 'hit', [199]);
    expect(moveHitTest(s)).toEqual({ z: false, carry: true });
    expect(log).toEqual([`${side}:hit:199`]); expect([s.wDamage, s.wMoveMissed]).toEqual([0x1234, 9]);
  });
  it('Swift bypasses Substitute, invulnerability, Mist, modifiers and writes', () => {
    const { s, c } = rig(side); s.mem[c.effect] = 0x11; s.mem[c.target1] |= 0x40;
    s.mem[c.target2] = 0x12; s.mem[c.accMod] = 255;
    const before = s.mem.slice(); expect(moveHitTest(s)).toEqual({ z: true, carry: false });
    expect(s.mem).toEqual(before);
  });
  it.each([3, 8])('Substitute does not reject drain/Dream Eater effect %i', effect => {
    const { s, c } = rig(side); s.mem[c.effect] = effect; s.mem[c.target2] = 0x10; s.mem[c.status] = 1;
    const log = namedBattleRandom(s, 'hit', [0]);
    expect(moveHitTest(s)).toEqual({ z: false, carry: true }); expect(log).toEqual([`${side}:hit:0`]);
    expect([s.wDamage, s.wMoveMissed]).toEqual([0x1234, 9]);
  });
  it('invulnerability misses before X Accuracy', () => {
    const { s, c, miss } = rig(side); s.mem[c.target1] |= 0x40; s.mem[c.attacker2] = 1;
    moveHitTest(s); miss();
  });
  it.each([0x12, 0x13, 0x19, 0x3a, 0x40, 0x41])('Mist rejects range effect $%i before X Accuracy', effect => {
    const { s, c, miss } = rig(side); s.mem[c.effect] = effect; s.mem[c.target2] = 2; s.mem[c.attacker2] = 1;
    moveHitTest(s); miss(); expect(s.mem[c.accuracy]).toBe(200);
  });
  it.each([0x10, 0x1a, 0x39, 0x42, 0xff])('Mist allows outside effect $%i; X Accuracy changes no bytes', effect => {
    const { s, c } = rig(side); s.mem[c.effect] = effect; s.mem[c.target2] = 2; s.mem[c.attacker2] = 1;
    const before = s.mem.slice(); expect(moveHitTest(s).z).toBe(false); expect(s.mem).toEqual(before);
  });
  it.each([0x12, 0x19, 0x3a, 0x41])('range effect $%i is allowed without target Mist', effect => {
    const { s, c } = rig(side); s.mem[c.effect] = effect; s.mem[c.attacker2] = 3;
    expect(moveHitTest(s)).toEqual({ z: false, carry: true });
    expect([s.wDamage, s.wMoveMissed]).toEqual([0x1234, 9]);
  });
  it.each([[0, 199, false], [0, 200, true], [0, 255, true], [255, 255, true], [255, 254, false]])(
    'one hit draw accuracy override %i draw %i miss %s', (accuracy, draw, failed) => {
      const { s, c, miss } = rig(side); if (accuracy) s.mem[c.accuracy] = accuracy;
      const log = namedBattleRandom(s, 'hit', [draw]); const out = moveHitTest(s);
      expect(log).toEqual([`${side}:hit:${draw}`]);
      if (failed) { miss(); expect(out).toEqual({ z: side === 0, carry: false }); }
      else { expect(out).toEqual({ z: false, carry: true }); expect([s.wDamage, s.wMoveMissed]).toEqual([0x1234, 9]); }
    });
  it('link hit uses the shared list, with no DIV', () => {
    const { s } = rig(side); s.wLinkState = LINK_STATE_BATTLING; s.mem[A.wLinkBattleRandomNumberList] = 199;
    expect(moveHitTest(s)).toEqual({ z: false, carry: true }); expect(s.wLinkBattleRandomNumberListIndex).toBe(1);
  });
  it.each([[200, 6, 7, 132], [200, 7, 8, 132], [200, 6, 8, 87],
    [255, 13, 13, 255], [255, 13, 1, 255], [1, 1, 1, 4], [0, 7, 7, 1],
    [1, 1, 13, 1], [128, 9, 7, 255]])('CalcHitChance %i mod%i evasion%i ->%i', (accuracy, acc, eva, result) => {
      const { s, c } = rig(side); s.mem[c.accuracy] = accuracy; s.mem[c.accMod] = acc; s.mem[c.evaMod] = eva;
      calcHitChance(s); expect(s.mem[c.accuracy]).toBe(result);
      expect(s.mem[side ? A.wPlayerMoveAccuracy : A.wEnemyMoveAccuracy]).toBe(200);
    });
  it('CalcHitChance writes back and compounds on the next hit test', () => {
    const { s, c } = rig(side); s.mem[c.accMod] = 6;
    const log = namedBattleRandom(s, 'hit', [0, 0]);
    moveHitTest(s); expect(s.mem[c.accuracy]).toBe(132);
    moveHitTest(s); expect(s.mem[c.accuracy]).toBe(87);
    expect(log).toEqual([`${side}:hit:0`, `${side}:hit:0`]);
  });
  it('untraced ratio is rejected explicitly', () => {
    const { s, c } = rig(side); s.mem[c.accMod] = 14;
    expect(() => calcHitChance(s)).toThrow(BattleUnsupportedState);
  });
  it.each(['accuracy', 'evasion'])('modifier-0 ROM-byte ratio is retained for %s', which => {
    const { s, c } = rig(side); s.mem[c.accuracy] = 100;
    if (which === 'accuracy') s.mem[c.accMod] = 0;
    else s.mem[c.evaMod] = 14;
    calcHitChance(s); expect(s.mem[c.accuracy]).toBe(196);
  });
  it.each([1, 69])('not Counter selected %i returns NZ without any write', selected => {
    const { s, c } = rig(side); s.mem[c.selected] = selected; const before = s.mem.slice();
    expect(handleCounterMove(s)).toEqual({ z: false, carry: selected < 68 }); expect(s.mem).toEqual(before);
  });
  it.each(['counter', 'power', 'type', 'damage'])('Counter early rejection %s keeps shared cached fields/damage', gate => {
    const { s, c } = rig(side); s.mem[c.selected] = 68; s.mem[c.opposing] = 1; s.mem[c.power] = 40;
    if (gate === 'counter') s.mem[c.opposing] = 68;
    if (gate === 'power') s.mem[c.power] = 0;
    if (gate === 'type') s.mem[c.type] = 2;
    if (gate === 'damage') s.wDamage = 0;
    const before = s.mem.slice(); before[A.wMoveMissed] = 1;
    expect(handleCounterMove(s)).toEqual({ z: true, carry: false }); expect(s.mem).toEqual(before);
  });
  it.each([[1, 2], [0x80, 0x100], [0x7fff, 0xfffe], [0x8000, 0xffff], [0xffff, 0xffff]])(
    'Counter shared damage %i doubles/saturates %i, then the named hit draw', (damage, doubled) => {
      for (const type of [0, 1]) {
        const { s, c } = rig(side); s.mem[c.selected] = 68; s.mem[c.opposing] = 99; s.mem[c.power] = 1;
        s.mem[c.type] = type; s.wDamage = damage;
        const log = namedBattleRandom(s, 'Counter.hit', [0]);
        expect(handleCounterMove(s)).toEqual({ z: true, carry: false });
        expect([s.wDamage, s.wMoveMissed]).toEqual([doubled, 0]); expect(log).toEqual([`${side}:Counter.hit:0`]);
      }
    });
  it('Counter always returns Z even when its hit test misses', () => {
    const { s, c, miss } = rig(side); s.mem[c.selected] = 68; s.mem[c.power] = 40;
    const log = namedBattleRandom(s, 'Counter.hit', [200]);
    expect(handleCounterMove(s)).toEqual({ z: true, carry: false }); miss(); expect(log).toEqual([`${side}:Counter.hit:200`]);
  });
});
