import { beforeAll, describe, expect, it } from 'vitest';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { A } from './battle_state';
import { readHpBarWord } from './battle_hp';
import { decreaseOwnHP, increaseEnemyHP, handlePoisonBurnLeechSeed, checkNumAttacksLeft, type ResidualPorts } from './battle_residual';
import type { BattleTurnTextHost } from './battle_turn_text';
import { finish, hpRig } from '../test/battle_hp_rig';

beforeAll(loadTextPrograms);

function rig(side: 0 | 1 = 0) {
  const r = hpRig(side), events: string[] = [];
  const host: BattleTurnTextHost = { printText: function* (label) {
    expect(getTextPrograms()[label]).toBeDefined();
    events.push(`${label}:${r.s.hWhoseTurn}:${r.s.readBE(r.c.hp)}:${r.s.readBE(r.c.opposite)}`);
  } };
  const ports: ResidualPorts = {
    animation: function* (s) { events.push(`anim:${s.wAnimationID}:${s.hWhoseTurn}:${s.wAnimationType}:${s.readBE(r.c.hp)}`); },
    drawHuds: function* (s) { events.push(`huds:${s.hWhoseTurn}:${s.readBE(r.c.hp)}`); },
  };
  const run = () => finish(handlePoisonBurnLeechSeed(r.s, r.screen, host, ports));
  return { ...r, host, ports, events, run };
}

for (const side of [0, 1] as const) describe(`residual actor${side}, core.asm:479–705`, () => {
  it('no condition / positive HP returns NZ with no frames, RNG, writes or HUD call', () => {
    const r = rig(side), before = r.s.mem.slice();
    expect(r.run()).toEqual({ result: { zero: false }, frames: [] });
    expect(r.s.mem).toEqual(before); expect(r.events).toEqual([]);
  });
  it.each([[8, 'HurtByPoisonText'], [16, 'HurtByBurnText'], [24, 'HurtByBurnText']] as const)(
    'status%i: text%s before animation, animation before HP loss', (status, label) => {
      const r = rig(side); r.s.mem[r.c.status] = status; r.s.wAnimationType = 19;
      const out = r.run();
      expect(out.result).toEqual({ zero: false }); expect(new Set(out.frames)).toEqual(new Set(['serviced']));
      expect(r.events).toEqual([`${label}:${side}:100:100`, `anim:186:${side}:0:100`]);
      expect(r.s.readBE(r.c.hp)).toBe(90); expect(r.s.readBE(r.c.opposite)).toBe(100);
      expect(r.s.mem[r.c.status]).toBe(status); expect(r.s.mem[r.c.toxic]).toBe(0);
      expect(r.s.hWhoseTurn).toBe(side);
    });
  it.each([[1, 1], [15, 1], [16, 1], [31, 1], [32, 2], [160, 10], [703, 43]] as const)(
    'maxHP%i uses base damage%i and leaves the opposite side untouched', (max, bc) => {
      const r = rig(side); r.s.writeBE(r.c.max, max); r.s.writeBE(r.c.hp, max);
      const out = finish(decreaseOwnHP(r.s, r.screen));
      expect(out.result).toBe(bc); expect(r.s.readBE(r.c.hp)).toBe(max - bc);
      expect(readHpBarWord(r.s, A.wHPBarMaxHP)).toBe(max);
      expect(readHpBarWord(r.s, A.wHPBarOldHP)).toBe(max - bc);
      expect(r.s.readBE(r.c.opposite)).toBe(100);
    });
  it.each([[0, 10], [1, 20], [254, 2550], [255, 2560]] as const)(
    'Toxic counter%i increments before additions; BC%i retained on overkill', (counter, bc) => {
      const r = rig(side); r.s.mem[r.c.flags3] = 0xff; r.s.mem[r.c.toxic] = counter;
      r.s.writeBE(r.c.hp, 1); const out = finish(decreaseOwnHP(r.s, r.screen));
      expect(out.result).toBe(bc); expect(r.s.mem[r.c.toxic]).toBe((counter + 1) & 255);
      expect(r.s.mem[r.c.flags3]).toBe(255); expect(r.s.readBE(r.c.hp)).toBe(0);
      expect(readHpBarWord(r.s, A.wHPBarNewHP)).toBe(0);
    });
  it('a stale Toxic counter is ignored without BADLY_POISONED, including other status3 bits', () => {
    const r = rig(side); r.s.mem[r.c.flags3] = 254; r.s.mem[r.c.toxic] = 255;
    expect(finish(decreaseOwnHP(r.s, r.screen)).result).toBe(10);
    expect(r.s.mem[r.c.toxic]).toBe(255); expect(r.s.readBE(r.c.hp)).toBe(90);
  });
  it('seed alone flips animation and heal-bar turns, heals first, then prints', () => {
    const r = rig(side); r.s.mem[r.c.flags2] = 128; r.s.wAnimationType = 99;
    const out = r.run();
    expect(out.result).toEqual({ zero: false });
    expect(r.events).toEqual([`anim:71:${side ^ 1}:0:100`, `HurtByLeechSeedText:${side}:90:110`]);
    expect(r.s.hWhoseTurn).toBe(side); expect(r.s.mem[r.c.flags2]).toBe(128);
    expect(r.screen.at(10, 9)).toBe(0x71); expect(r.screen.at(2, 2)).toBe(0x71);
    expect(r.s.wHPBarType).toBe(side === 0 ? 0 : 1);
  });
  it('poison+seed has the exact side-specific HP ledger, no guessed animation delays', () => {
    const r = rig(side); r.s.mem[r.c.status] = 8; r.s.mem[r.c.flags2] = 128;
    const out = r.run();
    // 100->90 and90->80 of160: 3 pixels each, 10 player number steps + final number.
    // Enemy: 6 pixel frames +5 tail; player:10 +6 +6. Opponent heal100->110 same costs.
    expect(out.frames).toEqual(Array(side === 0 ? 85 : 74).fill('serviced'));
    expect(r.events).toEqual([`HurtByPoisonText:${side}:100:100`, `anim:186:${side}:0:100`,
      `anim:71:${side ^ 1}:0:90`, `HurtByLeechSeedText:${side}:80:110`]);
  });
  it('other status2 flags do not trigger seed', () => {
    const r = rig(side); r.s.mem[r.c.flags2] = 127;
    expect(r.run().frames).toEqual([]); expect(r.events).toEqual([]);
  });
  it('poison + seed increments shared Toxic twice and does not stop on poison KO', () => {
    const r = rig(side); r.s.mem[r.c.status] = 8; r.s.mem[r.c.flags2] = 128;
    r.s.mem[r.c.flags3] = 1; r.s.mem[r.c.toxic] = 1; r.s.writeBE(r.c.hp, 1);
    const out = r.run();
    expect(out.result).toEqual({ zero: true }); expect(r.s.mem[r.c.toxic]).toBe(3);
    expect(r.s.readBE(r.c.opposite)).toBe(130); expect(r.s.readBE(r.c.hp)).toBe(0);
    expect(r.events).toEqual([`HurtByPoisonText:${side}:1:100`, `anim:186:${side}:0:1`,
      `anim:71:${side ^ 1}:0:0`, `HurtByLeechSeedText:${side}:0:130`, `huds:${side}:0`]);
    expect(out.frames.slice(-20)).toEqual(Array(20).fill('serviced'));
  });
  it('counter255 wraps for poison (256 additions), then seed gets count1', () => {
    const r = rig(side); r.s.mem[r.c.status] = 24; r.s.mem[r.c.flags2] = 128;
    r.s.mem[r.c.flags3] = 1; r.s.mem[r.c.toxic] = 255;
    expect(r.run().result.zero).toBe(true); expect(r.s.mem[r.c.toxic]).toBe(1);
    expect(r.s.readBE(r.c.opposite)).toBe(110);
  });
  it.each([[100, 10, 110], [155, 10, 160], [150, 10, 160], [160, 10, 160]] as const)(
    'heals opponent from%i by%i to%i, clamp after full BC', (hp, bc, target) => {
      const r = rig(side); r.s.writeBE(r.c.opposite, hp);
      let seen = false;
      finish(increaseEnemyHP(r.s, r.screen, bc), frame => {
        seen = true; expect(frame).toBe('serviced'); expect(r.s.hWhoseTurn).toBe(side ^ 1);
        expect(r.s.readBE(r.c.opposite)).toBe(target); // HP applied before first bar yield.
      });
      expect(seen).toBe(hp !== target); expect(r.s.hWhoseTurn).toBe(side);
      expect(r.s.readBE(r.c.opposite)).toBe(target); expect(r.s.readBE(r.c.hp)).toBe(100);
      expect(readHpBarWord(r.s, A.wHPBarMaxHP)).toBe(160);
    });
  it('seed overkill heals full BC rather than the one HP actually lost', () => {
    const r = rig(side); r.s.mem[r.c.flags2] = 128; r.s.writeBE(r.c.hp, 1);
    expect(r.run().result.zero).toBe(true); expect(r.s.readBE(r.c.opposite)).toBe(110);
  });
  it('fainted no-condition path yields HUD fake frames, then exactly20 serviced before Z', () => {
    const r = rig(side); r.s.writeBE(r.c.hp, 0);
    r.ports.drawHuds = function* () { r.events.push('huds'); yield 'held'; yield 'session'; };
    const out = r.run();
    expect(out.frames).toEqual(['held', 'session', ...Array(20).fill('serviced')]);
    expect(out.result).toEqual({ zero: true }); expect(r.events).toEqual(['huds']);
  });
  it('animation and text fakes retain their declared frame kinds outside the wrapper Delay3', () => {
    const r = rig(side); r.s.mem[r.c.status] = 8;
    r.host.printText = function* () { yield 'session'; };
    r.ports.animation = function* () { yield 'held'; yield 'session'; };
    const out = r.run();
    expect(out.frames.slice(0, 6)).toEqual(['session', 'serviced', 'serviced', 'serviced', 'held', 'session']);
    expect(out.frames.slice(6).every(frame => frame === 'serviced')).toBe(true);
  });
});

it.each([[0, 0], [0, 1], [1, 0], [1, 1]])('CheckNumAttacksLeft player%i enemy%i clears only trapping, no decrement', (p, e) => {
  const r = rig(); r.s.wPlayerNumAttacksLeft = p; r.s.wEnemyNumAttacksLeft = e;
  r.s.wPlayerBattleStatus1 = 255; r.s.wEnemyBattleStatus1 = 255;
  checkNumAttacksLeft(r.s);
  expect([r.s.wPlayerBattleStatus1, r.s.wEnemyBattleStatus1]).toEqual([p ? 255 : 223, e ? 255 : 223]);
  expect([r.s.wPlayerNumAttacksLeft, r.s.wEnemyNumAttacksLeft]).toEqual([p, e]);
});
