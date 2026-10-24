import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, PARTYMON_STRUCT_LENGTH, encodeText } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { bindBattleScreen } from './battle_screen';
import { jumpMoveEffect, MOVE_EFFECT_POINTERS } from './battle_effects';
import { turnEffectHandlers, chargeMoveEffectText, type TurnEffectEnvironment } from './battle_effects_turns';
import * as random from './battle_random';
import * as hit from './battle_hit';
import * as loaders from './battle_loaders';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { isHeld } from '../input';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); vi.mocked(isHeld).mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

const p = { hp: A.wBattleMonHP, status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2,
  effect: A.wPlayerMoveEffect, move: A.wPlayerMoveNum, count: A.wPlayerNumAttacksLeft, hits: A.wPlayerNumHits, speed: A.wBattleMonSpeed };
const e = { hp: A.wEnemyMonHP, status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2,
  effect: A.wEnemyMoveEffect, move: A.wEnemyMoveNum, count: A.wEnemyNumAttacksLeft, hits: A.wEnemyNumHits, speed: A.wEnemyMonSpeed };
function compact(events: readonly string[]): string[] {
  const out: string[] = [];
  for (const event of events) {
    const last = out[out.length - 1] ?? '';
    if (event === 'S' && /^S\d*$/.test(last)) out[out.length - 1] = `S${Number(last.slice(1) || 1) + 1}`;
    else out.push(event);
  }
  return out;
}
function sameBytes(actual: Uint8Array, expected: Uint8Array): void {
  const differences: { address: string; actual: number; expected: number }[] = [];
  for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) differences.push({ address: i.toString(16), actual: actual[i], expected: expected[i] });
  expect(differences).toEqual([]);
}
function bcd(value: number): number[] {
  const digits = String(value).padStart(6, '0');
  return [0, 2, 4].map(i => Number(digits[i]) * 16 + Number(digits[i + 1]));
}
const samples = [[0], [1], [254, 0], [254, 1], [255, 2], [255, 255]].map(draws => ({ draws }));
function animationBytes(memory: Uint8Array, id: number, type: number): void { memory[A.wAnimationID] = id; memory[A.wAnimationType] = type; }

function rig(side: 0 | 1, id: number, draws: readonly number[] = [], move = 114) {
  vi.restoreAllMocks();
  const s = new BattleState(), video = new BattleMenuScreen(), events: string[] = [];
  bindBattleScreen(s, video.screen);
  for (let i = 0; i < s.mem.length; i++) s.mem[i] = (i * 73 + (i >> 8) * 29 + 37) & 255;
  s.hWhoseTurn = side; const u = side === 0 ? p : e, t = side === 0 ? e : p;
  s.mem[u.effect] = id; s.mem[t.effect] = 0x55; s.mem[u.move] = move; s.mem[t.move] = 56;
  s.wAnimationType = 91; s.wAnimationID = 92; s.wChargeMoveNum = 93;
  s.wIsInBattle = 1; s.wEscapedFromBattle = 0; s.wMoveMissed = 0x5c; s.wMoveDidntMiss = 1;
  s.wBattleMonLevel = 40; s.wEnemyMonLevel = 60; s.wCurEnemyLevel = 50;
  s.wPlayerMonNumber = 3; s.wEnemyMonPartyPos = 2;
  s.wBattleMonHP = 0x123; s.wEnemyMonHP = 0x234;
  s.wBattleMonSpeed = 0x123; s.wEnemyMonSpeed = 0x234;
  s.wBattleMonStatus = 0x50; s.wEnemyMonStatus = 0x28;
  s.mem[p.flags1] = 0x88; s.mem[e.flags1] = 0x08;
  s.mem[p.flags2] = 0x9b; s.mem[e.flags2] = 0xdb;
  s.mem[p.count] = 0x31; s.mem[e.count] = 0x32;
  s.writeBE(p.hits, 0x4567); s.writeBE(e.hits, 0x89ab);
  s.mem.set(bcd(123456), A.wTotalPayDayMoney); s.mem.set([0x51, 0x52, 0x53], A.wPayDayMoney);
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const observer = { draw: (_index: number) => {}, animation: () => {}, hide: () => {}, show: () => {}, text: (_key: string) => {}, frame: (_number: number) => {} };
  let index = 0;
  vi.spyOn(random, 'battleRandom').mockImplementation(state => {
    expect(state).toBe(s); observer.draw(index);
    if (index >= draws.length) throw new Error('unexpected BattleRandom');
    const value = draws[index++]; events.push(`R${value}`); return value;
  });
  const sync = loaders.readPlayerMonCurHPAndStatus;
  vi.spyOn(loaders, 'readPlayerMonCurHPAndStatus').mockImplementation(state => { events.push('syncPlayer'); sync(state); });
  vi.spyOn(hit, 'moveHitTest').mockImplementation(() => { throw new Error('unexpected HIT'); });
  const refresh = video.screen.refreshAfterAnimation.bind(video.screen);
  vi.spyOn(video.screen, 'refreshAfterAnimation').mockImplementation(function* () { events.push('refresh'); yield* refresh(); events.push('refreshed'); });
  const env: TurnEffectEnvironment = {
    host: { printText: function* (key, _bindings, options) {
      observer.text(key); expect(getTextPrograms()[key], key).toBeDefined(); events.push(`text:${key}`);
      const handler = options?.asm?.[key]; if (handler) events.push(`suffix:${handler({ label: key, row: 14, column: 1 })}`);
    } },
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.wAnimationType}`); observer.animation(); },
    hideSubstitute: function* () { events.push('hide'); observer.hide(); },
    reshowSubstitute: function* () { events.push('show'); observer.show(); },
  };
  const registry = turnEffectHandlers(env);
  const run = (program: Program<number | void> = jumpMoveEffect(s, 'call', registry)) => {
    let frames = 0;
    const out = finish(program, frame => { events.push(frame === 'serviced' ? 'S' : frame); if (frame === 'serviced') video.vblank(); observer.frame(++frames); });
    expect(index).toBe(draws.length); return { ...out, ledger: compact(events) };
  };
  const expected = (ledger: string[], frames: number, patch: (memory: Uint8Array) => void = () => {}) => {
    const memory = s.mem.slice(); patch(memory);
    const out = run(); expect(out.result).toBe(1); expect(out.frames).toEqual(Array(frames).fill('serviced')); expect(out.ledger).toEqual(ledger); sameBytes(s.mem, memory);
  };
  const anim = (id: number, type = side === 0 ? 6 : 3) => [`anim:${id}:${type}`, 'refresh', 'S12', 'refreshed'];
  const escapePatch = (memory: Uint8Array) => {
    memory.set(memory.slice(p.hp, p.hp + 4), A.wPartyMons + 3 * PARTYMON_STRUCT_LENGTH + 1);
    memory[A.wEscapedFromBattle] = 1; animationBytes(memory, move, 0);
  };
  return { s, u, t, video, env, registry, events, observer, run, expected, anim, escapePatch };
}

it('factory exposes exactly eleven wrapper labels and every dispatched alias reaches them', () => {
  const r = rig(0, 7), labels = ['ExplodeEffect', 'PayDayEffect', 'BideEffect', 'ThrashPetalDanceEffect', 'SwitchAndTeleportEffect',
    'TwoToFiveAttacksEffect', 'OneHitKOEffect', 'ChargeEffect', 'TrappingEffect', 'HyperBeamEffect', 'RageEffect'];
  expect(Object.keys(r.registry)).toEqual(labels); expect(r.events).toEqual([]);
  for (const id of [7, 0x10, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x2c, 0x4d, 0x26, 0x27, 0x2b, 0x2a, 0x50, 0x51]) {
    const label = MOVE_EFFECT_POINTERS[id - 1]?.label; expect(label).toBeDefined(); expect(r.registry[label!]).toBeTypeOf('function');
  }
});

describe.each([0, 1] as const)('turn effects side %i', side => {
  it('Explode clears only user HP/status/SEEDED, preserving the intervening byte and roster', () => {
    const r = rig(side, 7);
    r.expected([], 0, memory => { memory[r.u.hp] = memory[r.u.hp + 1] = memory[r.u.status] = 0; memory[r.u.flags2] &= 0x7f; });
  });
  it.each([0, 1, 49, 50, 99, 100, 127, 128, 129, 200, 255])('Pay Day level%i doubles with eight-bit wrap and preserves every other byte/alias', level => {
    const r = rig(side, 0x10); if (side === 0) r.s.wBattleMonLevel = level; else r.s.wEnemyMonLevel = level;
    r.s.wCurEnemyLevel = 7;
    const amount = (level * 2) & 255;
    r.expected(['text:CoinsScatteredText'], 0, memory => {
      memory.set(bcd(amount), A.wPayDayMoney); memory.set(bcd(123456 + amount), A.wTotalPayDayMoney);
    });
    expect(A.wPayDayMoney).toBe(0xcd6d); expect(A.wNameBuffer).toBe(A.wPayDayMoney); expect(A.wBattleMenuCurrentPP).toBe(A.wPayDayMoney);
    expect([...r.s.mem.slice(A.wNameBuffer, A.wNameBuffer + 3)]).toEqual(bcd(amount));
  });
  it.each([0, 9, 99, 9999, 999900, 999999])('Pay Day bytewise BCD addition starting%i carries and saturates all three bytes', total => {
    const r = rig(side, 0x10); r.s.wBattleMonLevel = r.s.wEnemyMonLevel = 100; r.s.mem.set(bcd(total), A.wTotalPayDayMoney);
    r.expected(['text:CoinsScatteredText'], 0, memory => { memory.set(bcd(200), A.wPayDayMoney); memory.set(bcd(Math.min(999999, total + 200)), A.wTotalPayDayMoney); });
  });
  it('Pay Day ADC/DAA handles every total low byte and attainable even addend across a carry boundary', () => {
    const r = rig(side, 0x10);
    for (let total = 0; total < 100; total++) for (let amount = 0; amount < 100; amount += 2) {
      r.events.length = 0; r.s.wBattleMonLevel = r.s.wEnemyMonLevel = amount / 2;
      r.s.mem.set(bcd(999900 + total), A.wTotalPayDayMoney); r.run();
      expect([...r.s.mem.slice(A.wTotalPayDayMoney, A.wTotalPayDayMoney + 3)]).toEqual(bcd(Math.min(999999, 999900 + total + amount)));
    }
  });
  it.each([0, 1, 254, 255])('Bide R%i sets flag, clears both effects and both accumulator bytes before the roll', roll => {
    const r = rig(side, 0x1a, [roll]);
    r.observer.draw = () => {
      expect([r.s.mem[r.u.flags1] & 1, r.s.wPlayerMoveEffect, r.s.wEnemyMoveEffect, r.s.readBE(r.u.hits)]).toEqual([1, 0, 0, 0]);
      expect(r.s.mem[r.u.count]).toBe(side === 0 ? 0x31 : 0x32);
    };
    r.expected([`R${roll}`, ...r.anim(0xae + side)], 12, memory => {
      memory[r.u.flags1] |= 1; memory[r.u.hits] = memory[r.u.hits + 1] = 0;
      memory[A.wPlayerMoveEffect] = memory[A.wEnemyMoveEffect] = 0; memory[r.u.count] = (roll & 1) + 2;
      animationBytes(memory, 0xae + side, side === 0 ? 6 : 3);
    });
    expect(side === 0 ? r.s.wPlayerBideAccumulatedDamage : r.s.wEnemyBideAccumulatedDamage).toBe(0);
    expect(side === 0 ? r.s.wPlayerNumHits : r.s.wEnemyNumHits).toBe(0);
  });
  it.each([false, true])('Thrash already-active=%s still draws and resets duration', active => {
    const r = rig(side, 0x1b, [255]); if (active) r.s.mem[r.u.flags1] |= 2;
    r.observer.draw = () => expect(r.s.mem[r.u.flags1] & 2).toBe(2);
    r.expected(['R255', ...r.anim(0xb0 + side)], 12, memory => { memory[r.u.flags1] |= 2; memory[r.u.count] = 3; animationBytes(memory, 0xb0 + side, side === 0 ? 6 : 3); });
  });
  it('Thrash even masked byte stores duration2', () => {
    const r = rig(side, 0x1b, [254]);
    r.expected(['R254', ...r.anim(0xb0 + side)], 12, memory => { memory[r.u.flags1] |= 2; memory[r.u.count] = 2; animationBytes(memory, 0xb0 + side, side === 0 ? 6 : 3); });
  });

  it.each([0x1d, 0x1e, 0x2c, 0x4d])('multi-hit id%i active gate prevents all writes, rolls and Twineedle rewrite', id => {
    const r = rig(side, id); r.s.mem[r.u.flags1] |= 4; r.expected([], 0);
  });
  it.each([0x2c, 0x4d])('fixed two hits id%i consumes no RNG and rewrites only Twineedle', id => {
    const r = rig(side, id);
    r.expected([], 0, memory => { memory[r.u.flags1] |= 4; memory[r.u.count] = memory[r.u.hits] = 2; if (id === 0x4d) memory[r.u.effect] = 2; });
  });
  it.each(samples)('multi-hit samples $draws takes the second byte only when first masked value>=2', ({ draws }) => {
    const r = rig(side, 0x1d, draws), count = (draws[draws.length - 1] & 3) + 2;
    r.observer.draw = () => expect(r.s.mem[r.u.flags1] & 4).toBe(4);
    r.expected(draws.map(value => `R${value}`), 0, memory => { memory[r.u.flags1] |= 4; memory[r.u.count] = memory[r.u.hits] = count; });
  });
  it('Trapping active gate preserves target recharge and both counters, without a roll', () => {
    const r = rig(side, 0x2a); r.s.mem[r.u.flags1] |= 0x20; r.s.mem[r.t.flags2] |= 0x20; r.expected([], 0);
  });
  it.each(samples)('Trapping samples $draws clears target recharge before roll and stores1-4 on user only', ({ draws }) => {
    const r = rig(side, 0x2a, draws); r.s.mem[r.u.flags2] |= 0x20; r.s.mem[r.t.flags2] |= 0x20;
    r.observer.draw = () => { expect(r.s.mem[r.t.flags2] & 0x20).toBe(0); expect(r.s.mem[r.u.flags2] & 0x20).toBe(0x20); expect(r.s.mem[r.u.flags1] & 0x20).toBe(0x20); };
    r.expected(draws.map(value => `R${value}`), 0, memory => { memory[r.t.flags2] &= ~0x20; memory[r.u.flags1] |= 0x20; memory[r.u.count] = (draws[draws.length - 1] & 3) + 1; });
  });
  it.each([[0x123, 0x123], [0x200, 0x1ff], [0x1ff, 0x200], [0x101, 0x102], [0x102, 0x101]])('OHKO live speed %i versus%i preserves full-word borrow/tie and slow FF sentinel', (own, target) => {
    const r = rig(side, 0x26); r.s.writeBE(r.u.speed, own); r.s.writeBE(r.t.speed, target);
    r.expected([], 0, memory => {
      memory[A.wDamage] = memory[A.wDamage + 1] = own >= target ? 255 : 0; memory[A.wCriticalHitOrOHKO] = own >= target ? 2 : 255;
      if (own < target) memory[A.wMoveMissed] = 1;
    });
  });
  it.each([[0x50, 0x20], [0x51, 0x40]])('id%i sets only user flag%i even when already set', (id, bit) => {
    for (const active of [false, true]) {
      const r = rig(side, id); if (active) r.s.mem[r.u.flags2] |= bit;
      r.expected([], 0, memory => { memory[r.u.flags2] |= bit; });
    }
  });

  describe('escape', () => {
    it.each([{ draws: [60] }, { draws: [61, 60] }])('wild rejection boundary samples $draws accepts sum60 and rejects sum+1=61', ({ draws }) => {
      const r = rig(side, 0x1c, draws, 100);
      r.s.wBattleMonLevel = side === 0 ? 20 : 40; r.s.wCurEnemyLevel = side === 0 ? 40 : 20;
      r.expected([...draws.map(value => `R${value}`), 'syncPlayer', ...r.anim(100, 0), 'S20', 'text:RanFromBattleText'], 32, r.escapePatch);
    });
    it.each([0, 2, 3])('trainer/non-wild state%i Roar waits50 then IsUnaffected, never HIT/RNG or state changes', state => {
      const r = rig(side, 0x1c, [], 46); r.s.wIsInBattle = state;
      r.expected(['S50', 'text:IsUnaffectedText'], 50);
    });
    it.each([0, 1])('trainer Teleport MoveDidntMiss%i uses the side-specific failure printer', moveDidntMiss => {
      const r = rig(side, 0x1c, [], 100); r.s.wIsInBattle = 2; r.s.wMoveDidntMiss = moveDidntMiss;
      r.expected(['S50', ...(side === 1 && moveDidntMiss ? [] : ['text:ButItFailedText'])], 50);
    });
    it.each([[100, 'RanFromBattleText'], [46, 'RanAwayScaredText'], [18, 'WasBlownAwayText']])('wild move%i uses %s after refresh12 and wait20, syncing player roster on BOTH sides', (move, text) => {
      const r = rig(side, 0x1c, [], Number(move));
      r.s.wBattleMonLevel = side === 0 ? 60 : 40; r.s.wCurEnemyLevel = side === 0 ? 40 : 60;
      r.s.wEnemyMonLevel = side === 0 ? 100 : 1;
      r.observer.animation = () => {
        expect(r.s.wEscapedFromBattle).toBe(1); expect(r.s.wAnimationType).toBe(0);
        expect([...r.s.mem.slice(A.wPartyMons + 3 * PARTYMON_STRUCT_LENGTH + 1, A.wPartyMons + 3 * PARTYMON_STRUCT_LENGTH + 5)])
          .toEqual([...r.s.mem.slice(p.hp, p.hp + 4)]);
      };
      r.expected(['syncPlayer', ...r.anim(Number(move), 0), 'S20', `text:${text}`], 32, r.escapePatch);
    });
    it('wild equal levels succeed without a draw, using CurEnemyLevel rather than EnemyMonLevel', () => {
      const r = rig(side, 0x1c, [], 100); r.s.wBattleMonLevel = r.s.wCurEnemyLevel = 40; r.s.wEnemyMonLevel = side === 0 ? 100 : 1;
      r.expected(['syncPlayer', ...r.anim(100, 0), 'S20', 'text:RanFromBattleText'], 32, r.escapePatch);
    });
    it.each([100, 46, 18])('wild lower-level move%i records rejected255 and61; accepted10 equals target>>2 and succeeds', move => {
      const r = rig(side, 0x1c, [255, 61, 10], move);
      r.s.wBattleMonLevel = side === 0 ? 20 : 40; r.s.wCurEnemyLevel = side === 0 ? 40 : 20; r.s.wEnemyMonLevel = side === 0 ? 1 : 100;
      r.expected(['R255', 'R61', 'R10', 'syncPlayer', ...r.anim(move, 0), 'S20', `text:${move === 100 ? 'RanFromBattleText' : move === 46 ? 'RanAwayScaredText' : 'WasBlownAwayText'}`], 32, r.escapePatch);
    });
    it.each([100, 46, 18])('wild lower-level move%i accepted9 fails after rejected draws, unconditional Teleport failure both sides', move => {
      const r = rig(side, 0x1c, [255, 61, 9], move);
      r.s.wBattleMonLevel = side === 0 ? 20 : 40; r.s.wCurEnemyLevel = side === 0 ? 40 : 20; r.s.wEnemyMonLevel = side === 0 ? 1 : 100;
      r.expected(['R255', 'R61', 'R9', 'S50', `text:${move === 100 ? 'ButItFailedText' : 'DidntAffectText'}`], 50);
    });
  });

  describe('Charge', () => {
    it.each([
      { id: 0x27, move: 13, suffix: 'MadeWhirlwindText', invulnerable: false },
      { id: 0x27, move: 76, suffix: 'TookInSunlightText', invulnerable: false },
      { id: 0x27, move: 130, suffix: 'LoweredItsHeadText', invulnerable: false },
      { id: 0x27, move: 143, suffix: 'SkyAttackGlowingText', invulnerable: false },
      { id: 0x2b, move: 19, suffix: 'FlewUpHighText', invulnerable: true },
      { id: 0x27, move: 91, suffix: 'DugAHoleText', invulnerable: true },
      { id: 0x27, move: 1, suffix: 'DugAHoleText', invulnerable: false },
      { id: 0x2b, move: 91, suffix: 'DugAHoleText', invulnerable: true },
    ])('effect$id move$move has correct animation, invulnerability and suffix $suffix', c => {
      const r = rig(side, c.id, [], c.move); r.s.mem[r.u.flags2] &= ~0x10;
      const animation = c.move === 91 ? 0xc0 : c.id === 0x2b ? 100 : side === 0 ? 0xae : 0xaf;
      r.observer.animation = () => { expect(r.s.mem[r.u.flags1] & 0x50).toBe(c.invulnerable ? 0x50 : 0x10); expect(r.s.wChargeMoveNum).toBe(93); };
      r.expected([...r.anim(animation, 0), 'text:ChargeMoveEffectText', `suffix:${c.suffix}`], 12, memory => {
        memory[r.u.flags1] |= c.invulnerable ? 0x50 : 0x10; animationBytes(memory, animation, 0); memory[A.wChargeMoveNum] = c.move;
      });
    });
    it.each([false, true])('user doll=%s governs hide/reshow around refresh; ChargeMoveNum is written afterward', doll => {
      const r = rig(side, 0x27, [], 76); r.s.mem[r.u.flags2] = doll ? 0x10 : 0; r.s.mem[r.t.flags2] = doll ? 0 : 0x10;
      r.observer.hide = () => { expect(r.s.mem[r.u.flags1] & 0x10).toBe(0x10); expect(r.s.wAnimationType).toBe(91); };
      r.observer.show = () => expect(r.s.wChargeMoveNum).toBe(93);
      r.observer.text = () => expect(r.s.wChargeMoveNum).toBe(76);
      r.expected([...(doll ? ['hide'] : []), ...r.anim(side === 0 ? 0xae : 0xaf, 0), ...(doll ? ['show'] : []), 'text:ChargeMoveEffectText', 'suffix:TookInSunlightText'], 12, memory => {
        memory[r.u.flags1] |= 0x10; animationBytes(memory, side === 0 ? 0xae : 0xaf, 0); memory[A.wChargeMoveNum] = 76;
      });
    });
    it('Charge suffix handler reads the live ChargeMoveNum when invoked', () => {
      const r = rig(side, 0x27), handler = chargeMoveEffectText(r.s);
      for (const [move, suffix] of [[13, 'MadeWhirlwindText'], [76, 'TookInSunlightText'], [130, 'LoweredItsHeadText'],
        [143, 'SkyAttackGlowingText'], [19, 'FlewUpHighText'], [91, 'DugAHoleText'], [1, 'DugAHoleText']] as const) {
        r.s.wChargeMoveNum = move; expect(handler({ label: 'ChargeMoveEffectText', row: 14, column: 1 })).toBe(suffix);
      }
    });
  });
});

const printerCases = [
  { name: 'Pay Day', id: 0x10, move: 6 },
  { name: 'Razor Wind', id: 0x27, move: 13 },
  { name: 'Solarbeam', id: 0x27, move: 76 },
  { name: 'Skull Bash', id: 0x27, move: 130 },
  { name: 'Sky Attack', id: 0x27, move: 143 },
  { name: 'Fly', id: 0x2b, move: 19 },
  { name: 'Dig', id: 0x27, move: 91 },
  { name: 'non-charge Dig fallback', id: 0x27, move: 1 },
  { name: 'Teleport escape', id: 0x1c, move: 100 },
  { name: 'Roar escape', id: 0x1c, move: 46 },
  { name: 'Whirlwind escape', id: 0x1c, move: 18 },
  { name: 'trainer unaffected', id: 0x1c, move: 46 },
  { name: 'trainer failed Teleport', id: 0x1c, move: 100 },
] as const;

describe.each([0, 1] as const)('real turn printer side %i', side => {
  it.each(printerCases)('$name complete frame/RNG/text ledger', c => {
    const r = rig(side, c.id, [], c.move);
    r.s.wBattleMonLevel = r.s.wCurEnemyLevel = 40;
    if (c.name.startsWith('trainer')) { r.s.wIsInBattle = 2; r.s.wMoveDidntMiss = 0; }
    const host = new BattleHost<number>(r.s, r.video);
    const env: TurnEffectEnvironment = { ...r.env, host: {
      printText: function* (key, bindings, options) {
        r.events.push(`text:${key}`);
        const original = options?.asm?.[key];
        const asm = original ? { [key]: (context: Parameters<typeof original>[0]) => {
          const next = original(context); r.events.push(`suffix:${next}`); return next;
        } } : undefined;
        yield* host.printText(key, bindings, { ...options, asm }); r.events.push('textDone');
      },
    } };
    host.start(jumpMoveEffect(r.s, 'call', turnEffectHandlers(env)));
    let frames = 0, pressed = false;
    while (!host.done && frames < 1500) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      r.events.push('S'); expect(host.step()).toBe('serviced'); frames++;
    }
    expect(host.done).toBe(true); expect(host.result).toBe(1); expect(random.battleRandom).not.toHaveBeenCalled();
    expect({ frames, ledger: compact(r.events), flags1: [r.s.wPlayerBattleStatus1, r.s.wEnemyBattleStatus1],
      escaped: r.s.wEscapedFromBattle, charge: r.s.wChargeMoveNum,
      payDayMoney: [...r.s.mem.slice(A.wPayDayMoney, A.wPayDayMoney + 3)],
      totalPayDayMoney: [...r.s.mem.slice(A.wTotalPayDayMoney, A.wTotalPayDayMoney + 3)] }).toMatchSnapshot();
  });
});

// pret effects.asm:800-825. BideEffect always stores the flag, zeroes the accumulator and rolls; no already-active gate.
it('retire-L789: fails if already in bide — reject legacy rule', () => {
  for (const side of [0, 1] as const) {
    const r = rig(side, 0x1a, [1]);
    r.s.mem[r.u.flags1] |= 1;
    r.s.mem[r.u.count] = 9;
    r.expected(['R1', ...r.anim(0xae + side)], 12, memory => {
      memory[r.u.flags1] |= 1;
      memory[r.u.hits] = memory[r.u.hits + 1] = 0;
      memory[A.wPlayerMoveEffect] = memory[A.wEnemyMoveEffect] = 0;
      memory[r.u.count] = 3;
      animationBytes(memory, 0xae + side, side === 0 ? 6 : 3);
    });
    expect(r.events.some(event => event.startsWith('text:'))).toBe(false);
  }
});
