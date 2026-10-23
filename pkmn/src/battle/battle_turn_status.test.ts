import { beforeAll, describe, expect, it } from 'vitest';
import { A, encodeText } from './battle_state';
import { loadBattleMoveData, moveNameBinding } from './battle_move_data';
import { handleSelfConfusionDamage, playMoveAnimation } from './battle_turn_status';
import { loadTextPrograms } from '../text/program_data';
import { collect, statusRig } from '../test/battle_status_rig';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); });

describe.each([0, 1] as const)('status checks, actor %i', side => {
  const done = side === 0 ? 'ExecutePlayerMoveDone' : 'ExecuteEnemyMoveDone';
  it('normal continuation has no text, frame, RNG or PP effects', () => {
    const r = statusRig(side), before = r.s.mem.slice();
    expect(collect(r.check())).toEqual({ result: 'normal', frames: [] }); expect(r.s.mem).toEqual(before);
  });
  it.each([1, 2])('sleep count %i precedes every other gate and wake consumes action', count => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.status] = 0x60 | count; m[c.flags] = 0x8b; m[c.flags2] = 0x20; m[c.opposite] = 0x20;
    m[c.confused] = 4; m[c.count] = 3; m[c.disabled] = 0x11;
    const result = collect(r.check()); expect(result.result).toBe(done); expect(m[c.status]).toBe(count - 1);
    expect([m[c.used], m[c.flags], m[c.flags2], m[c.confused], m[c.count], m[c.disabled]]).toEqual([0, 0x8b, 0x20, 4, 3, 0x11]);
    expect(result.frames).toEqual(count === 1 ? [] : Array(15).fill('serviced'));
    const anim = `anim:${side === 0 ? 0xbc : 0xbd}:${side}`;
    expect(r.events).toEqual(count === 1 ? ['text:WokeUpText'] : side === 0
      ? [anim, 'text:FastAsleepText'] : ['text:FastAsleepText', anim]);
    expect(m[side === 0 ? A.wEnemyUsedMove : A.wPlayerUsedMove]).toBe(side === 0 ? 11 : 10);
  });
  it('freeze precedes trapping/flinch/recharge and clears only UsedMove', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.status] = 0x60; m[c.opposite] = 32; m[c.flags] = 0x8b; m[c.flags2] = 32;
    expect(collect(r.check()).result).toBe(done); expect(r.texts).toEqual(['IsFrozenText']);
    expect([m[c.used], m[c.flags], m[c.flags2]]).toEqual([0, 0x8b, 32]);
  });
  it('opponent trapping precedes flinch/recharge and retains UsedMove', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.opposite] = 32; m[c.flags] = 0x8b; m[c.flags2] = 32;
    expect(collect(r.check()).result).toBe(done); expect(r.texts).toEqual(['CantMoveText']);
    expect([m[c.flags], m[c.flags2], m[c.used]]).toEqual([0x8b, 32, side === 0 ? 10 : 11]);
  });
  it('flinch clears its bit before text, before recharge/disable/confusion', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags] = 0x8b; m[c.flags2] = 32; m[c.disabled] = 0x11; m[c.confused] = 4;
    expect(collect(r.check()).result).toBe(done); expect(r.texts).toEqual(['FlinchedText']);
    expect([m[c.flags], m[c.flags2], m[c.disabled], m[c.confused]]).toEqual([0x83, 32, 0x11, 4]);
  });
  it('recharge clears its bit, retaining Rage and later counters', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags2] = 0x60; m[c.disabled] = 0x11;
    expect(collect(r.check()).result).toBe(done); expect(r.texts).toEqual(['MustRechargeText']);
    expect([m[c.flags2], m[c.disabled]]).toEqual([0x40, 0x11]);
  });
  it.each([0, 0x12, 0x11, 0x10])('disable byte %i ticks/expires before confusion, then same action continues', packed => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.disabled] = packed; m[c.disabledId] = 44;
    m[c.flags] = 128; m[c.confused] = 1;
    expect(collect(r.check()).result).toBe('normal');
    expect(m[c.disabled]).toBe(packed === 0x12 ? 0x11 : packed === 0x10 ? 15 : 0);
    expect(m[c.disabledId]).toBe(packed === 0x11 ? 0 : 44);
    expect(r.texts).toEqual(packed === 0x11 ? ['DisabledNoMoreText', 'ConfusedNoMoreText'] : ['ConfusedNoMoreText']);
    expect(m[c.flags]).toBe(0);
  });
  it.each([127, 128])('confusion boundary %i is drawn after its text/animation; self-hit skips PAR', roll => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags] = 0x90; m[c.confused] = 2; m[c.status] = 0x40;
    const random = r.rolls(...(roll === 127 ? [127, 63] : [128]));
    expect(collect(r.check())).toEqual({ result: roll === 127 ? 'normal' : done,
      frames: Array(roll === 127 ? 15 : 30).fill('serviced') });
    expect(m[c.flags]).toBe(roll === 127 ? 0x90 : 128); expect(m[c.confused]).toBe(1);
    expect(r.events.slice(0, 3)).toEqual(['text:IsConfusedText', `anim:${side === 0 ? 0xbe : 0xbf}:${side}`, `random:${roll}`]);
    expect(random).toHaveBeenCalledTimes(roll === 127 ? 2 : 1);
    expect(r.events.includes(`apply:${side}`)).toBe(roll === 128);
  });
  it('a zero confusion counter wraps to255 and still rolls', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 128; r.rolls(127);
    expect(collect(r.check()).result).toBe('normal'); expect(r.s.mem[r.c.confused]).toBe(255);
  });
  it('self-confusion clears every other status1 bit, including invulnerability and multihit', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 0xf7; r.s.mem[r.c.confused] = 2; r.rolls(128);
    expect(collect(r.check()).result).toBe(done); expect(r.s.mem[r.c.flags]).toBe(128);
  });
  it('confusion128 precedes an already-selected disabled move', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 128; r.s.mem[r.c.confused] = 2;
    r.s.mem[r.c.disabledId] = 33; r.rolls(128);
    expect(collect(r.check()).result).toBe(done); expect(r.texts).toEqual(['IsConfusedText', 'HurtItselfText']);
  });
  it('self-hit with Fly also runs the shared status-affected animation after applying damage', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 128; r.s.mem[r.c.confused] = 2;
    r.s.mem[r.c.move + 1] = 0x2b; r.rolls(128);
    expect(collect(r.check())).toEqual({ result: done, frames: Array(45).fill('serviced') });
    expect(r.events.slice(-2)).toEqual([`apply:${side}`, `anim:167:${side}`]);
  });
  it('Bide count0 wraps to255 and holds without release text', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 1;
    expect(collect(r.check()).result).toBe(done); expect(r.s.mem[r.c.count]).toBe(255); expect(r.texts).toEqual([]);
  });
  it('selected disabled ID blocks after confusion but before paralysis, clears charging only', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags] = 0xd0; m[c.confused] = 1; m[c.status] = 64; m[c.disabledId] = 33;
    r.s.setBytes(A.wStringBuffer, encodeText('OLD@'), 4);
    expect(collect(r.check()).result).toBe(done);
    expect(r.events).toEqual(['text:ConfusedNoMoreText', 'text:MoveIsDisabledText', 'name:TACKLE']);
    expect(m[c.flags]).toBe(64); expect(moveNameBinding(r.s)).toBe('OLD');
  });
  it('a disabled different ID does not block', () => {
    const r = statusRig(side); r.s.mem[r.c.disabledId] = 44;
    expect(collect(r.check()).result).toBe('normal'); expect(r.texts).toEqual([]);
  });
  it.each([0, 0x27, 0x2b])('full paralysis cancellation with effect%i preserves invulnerability', effect => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.status] = 64; m[c.flags] = 0x77; m[c.move + 1] = effect; m[c.count] = 3;
    r.rolls(62); const result = collect(r.check());
    expect(result.result).toBe(done); expect(m[c.flags]).toBe(68); expect(m[c.count]).toBe(3);
    expect(result.frames).toEqual(effect === 0 ? [] : Array(15).fill('serviced'));
    expect(r.texts).toEqual(['FullyParalyzedText']);
    if (effect !== 0) expect(r.events[r.events.length - 1]).toBe(`anim:167:${side}`);
  });
  it('paralysis63 allows the same action', () => {
    const r = statusRig(side); r.s.mem[r.c.status] = 64; r.rolls(63);
    expect(collect(r.check())).toEqual({ result: 'normal', frames: [] }); expect(r.texts).toEqual([]);
  });
  it('Bide hold uses shared BE damage and hit-count alias, no SavingEnergyText or RNG', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags] = 3; m[c.count] = 2; r.s.writeBE(c.bide, 0x01ff); r.s.wDamage = 2;
    expect(collect(r.check())).toEqual({ result: done, frames: [] });
    expect(r.s.readBE(c.bide)).toBe(0x0201); expect(m[c.bide]).toBe(2);
    expect([m[c.move], m[c.count], r.s.wDamage, m[c.flags]]).toEqual([0, 1, 2, 3]);
  });
  it.each([0, 1, 0x8000, 0xffff])('Bide release accumulator%i wraps, clears aliases, returns miss/apply entry', accumulated => {
    const r = statusRig(side), m = r.s.mem, c = r.c;
    m[c.flags] = 3; m[c.count] = 1; r.s.writeBE(c.bide, accumulated); r.s.wDamage = 1;
    r.s.wMoveMissed = 0;
    expect(collect(r.check()).result).toBe(side === 0 ? 'HandleIfPlayerMoveMissed' : 'HandleIfEnemyMoveMissed');
    const damage = ((accumulated + 1) * 2) & 65535;
    expect([r.s.wDamage, r.s.wMoveMissed, r.s.readBE(c.bide), m[c.bide], m[c.move], m[c.move + 2], m[c.flags]])
      .toEqual([damage, damage === 0 ? 1 : 0, 0, 0, 117, 1, 2]);
    expect([r.s.wBattleMonLevel, r.s.wEnemyMonLevel]).toEqual(side === 0 ? [20, 30] : [30, 20]);
    expect(r.texts).toEqual(['UnleashedEnergyText']);
  });
  it('Bide nonzero release does not clear a preexisting missed byte', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 1; r.s.mem[r.c.count] = 1; r.s.wDamage = 2; r.s.wMoveMissed = 1;
    collect(r.check()); expect(r.s.wMoveMissed).toBe(1);
  });
  it('Bide accumulation and flag clear precede its text, while doubling/alias clearing follow it', () => {
    const r = statusRig(side), s = r.s, m = s.mem, c = r.c;
    m[c.flags] = 1; m[c.count] = 1; s.writeBE(c.bide, 0x1234); s.wDamage = 2;
    r.host.printText = function* (label) {
      expect(label).toBe('UnleashedEnergyText');
      expect([m[c.move], m[c.flags], s.readBE(c.bide), s.wDamage]).toEqual([0, 0, 0x1236, 2]);
      yield 'serviced';
    };
    const p = r.check(); expect(p.next().value).toBe('serviced'); expect(s.wDamage).toBe(2);
    expect(p.next().done).toBe(true); expect(s.wDamage).toBe(0x246c); expect(s.readBE(c.bide)).toBe(0);
  });
  it.each([
    [35, 64, 'ExecuteMoveDone', []],
    [34, 64, 'CalcMoveDamage', ['ThrashingAboutText']],
    [32, 64, 'AnimationType', ['AttackContinuesText']],
  ] as const)('Bide, Thrash, trapping and Rage precedence flags%i', (flags, flags2, entry, texts) => {
    const r = statusRig(side); r.s.mem[r.c.flags] = flags; r.s.mem[r.c.flags2] = flags2; r.s.mem[r.c.count] = 2;
    const expected = entry === 'ExecuteMoveDone' ? done : entry === 'CalcMoveDamage'
      ? side === 0 ? 'PlayerCalcMoveDamage' : 'EnemyCalcMoveDamage'
      : side === 0 ? 'GetPlayerAnimationType' : 'GetEnemyAnimationType';
    expect(collect(r.check()).result).toBe(expected); expect(r.texts).toEqual(texts);
  });
  it.each([0, 1, 2])('Thrash count%i decrements; final attack adds silent confusion only at zero', count => {
    const r = statusRig(side), m = r.s.mem, c = r.c; m[c.flags] = 2; m[c.count] = count;
    if (count === 1) r.rolls(3);
    expect(collect(r.check()).result).toBe(side === 0 ? 'PlayerCalcMoveDamage' : 'EnemyCalcMoveDamage');
    expect([m[c.move], m[c.count], m[c.flags], m[c.confused]]).toEqual([37, (count - 1) & 255, count === 1 ? 128 : 2, count === 1 ? 5 : 0]);
    expect(r.texts).toEqual(['ThrashingAboutText']);
  });
  it('Thrash duration uses low two bits plus2', () => {
    const r = statusRig(side); r.s.mem[r.c.flags] = 2; r.s.mem[r.c.count] = 1; r.rolls(0xfc);
    collect(r.check()); expect(r.s.mem[r.c.confused]).toBe(2);
  });
  it.each([0, 1, 2])('trapping count%i returns animation entry even on zero, preserving damage/flag', count => {
    const r = statusRig(side), m = r.s.mem, c = r.c; m[c.flags] = 32; m[c.count] = count; r.s.wDamage = 456;
    expect(collect(r.check()).result).toBe(side === 0 ? 'GetPlayerAnimationType' : 'GetEnemyAnimationType');
    expect([m[c.count], m[c.flags], r.s.wDamage]).toEqual([(count - 1) & 255, 32, 456]);
    expect(r.texts).toEqual(['AttackContinuesText']);
  });
  it('Rage reloads name but preserves cached record/selected move and clears effect only', () => {
    const r = statusRig(side), m = r.s.mem, c = r.c; m[c.flags2] = 64; m[c.move + 1] = 0x51;
    const before = [...m.slice(c.move, c.move + 6)];
    expect(collect(r.check()).result).toBe(side === 0 ? 'PlayerCanExecuteMove' : 'EnemyCanExecuteMove');
    expect([...m.slice(c.move, c.move + 6)]).toEqual(before.map((value, i) => i === 1 ? 0 : value));
    expect(moveNameBinding(r.s)).toBe('RAGE'); expect(r.s.wNamedObjectIndex).toBe(99);
    expect([r.s.wPlayerSelectedMove, r.s.wEnemySelectedMove]).toEqual([33, 33]);
    expect(r.events).toEqual([]);
  });
  it('self-hit calculation, animation, player-only HUD and apply see the exact temporary state', () => {
    const r = statusRig(side), s = r.s, m = s.mem, c = r.c;
    s.wBattleMonDefense = 0x0123; s.wEnemyMonDefense = 0x0456;
    m[c.move + 1] = 0x2b; m[c.move + 2] = 88; m[c.move + 3] = 23; s.wCriticalHitOrOHKO = 1;
    r.ports.calculateSelfHit = function* (state, actor) {
      expect([actor, state.hWhoseTurn, state.wBattleMonDefense, state.wEnemyMonDefense])
        .toEqual([side, side, side === 0 ? 0x123 : 0x456, side === 0 ? 0x123 : 0x456]);
      expect([...m.slice(c.move + 1, c.move + 4)]).toEqual([0, 40, 0]); expect(state.wCriticalHitOrOHKO).toBe(0);
      state.wDamage = 345; r.events.push('calc'); yield 'session';
    };
    r.ports.animation = function* (state) {
      expect([state.hWhoseTurn, state.wAnimationType, state.wAnimationID]).toEqual([side ^ 1, 0, 1]);
      expect([state.wBattleMonDefense, state.wEnemyMonDefense, m[c.move + 1]]).toEqual([0x123, 0x456, 0x2b]);
      r.events.push('animation'); yield 'held';
    };
    r.ports.applySelfHit = function* (state, actor) {
      expect([state.hWhoseTurn, actor, state.wDamage]).toEqual([side, side, 345]); r.events.push('apply');
    };
    const result = collect(handleSelfConfusionDamage(s, r.host, r.ports, side));
    expect(result.frames).toEqual(['session', 'serviced', 'serviced', 'serviced', 'held', ...Array(12).fill('serviced')]);
    expect(r.events).toEqual(side === 0 ? ['text:HurtItselfText', 'calc', 'animation', 'hud:1', 'apply']
      : ['text:HurtItselfText', 'calc', 'animation', 'apply']);
    expect([...m.slice(c.move + 1, c.move + 4)]).toEqual([0x2b, 40, 0]); expect(s.hWhoseTurn).toBe(side);
  });
});

it('PlayMoveAnimation writes ID before its three serviced frames, then delegates exactly once', () => {
  const r = statusRig(); const p = playMoveAnimation(r.s, r.ports, 0xa7);
  expect(p.next()).toEqual({ value: 'serviced', done: false }); expect(r.s.wAnimationID).toBe(0xa7);
  expect(r.events).toEqual([]); expect(p.next().value).toBe('serviced'); expect(p.next().value).toBe('serviced');
  expect(collect(p).frames).toEqual(Array(12).fill('serviced')); expect(r.events).toEqual(['anim:167:0']);
});
