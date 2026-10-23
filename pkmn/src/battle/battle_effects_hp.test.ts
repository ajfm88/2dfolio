import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, PARTYMON_STRUCT_LENGTH, encodeText } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { hpEffectHandlers, type HpEffectEnvironment } from './battle_effects_hp';
import { jumpMoveEffect, MOVE_EFFECT_POINTERS } from './battle_effects';
import * as hp from './battle_hp';
import * as hud from './battle_hud_state';
import * as loaders from './battle_loaders';
import * as random from './battle_random';
import * as hit from './battle_hit';
import { hpBarColor, staticHpBarPixels } from '../menus/hp_bar';
import { textBgTransfer } from '../text/bg_transfer';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { isHeld } from '../input';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast');
  vi.mocked(isHeld).mockReturnValue(false); setLowHealthAlarm(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
const p = { hp: A.wBattleMonHP, max: A.wBattleMonMaxHP, status: A.wBattleMonStatus, move: A.wPlayerMoveNum,
  effect: A.wPlayerMoveEffect, flags2: A.wPlayerBattleStatus2, substitute: A.wPlayerSubstituteHP };
const e = { hp: A.wEnemyMonHP, max: A.wEnemyMonMaxHP, status: A.wEnemyMonStatus, move: A.wEnemyMoveNum,
  effect: A.wEnemyMoveEffect, flags2: A.wEnemyBattleStatus2, substitute: A.wEnemySubstituteHP };
function be(m: Uint8Array, a: number, v: number): void { m[a] = v >> 8; m[a + 1] = v; }
function le(m: Uint8Array, a: number, v: number): void { m[a] = v; m[a + 1] = v >> 8; }
function word(m: Uint8Array, a: number): number { return m[a] * 256 + m[a + 1]; }
function color(current: number, max: number): number { return { green: 0, yellow: 1, red: 2 }[hpBarColor(staticHpBarPixels(current, max))]; }
function sameBytes(actual: Uint8Array, expected: Uint8Array): void {
  const differences: { address: string; actual: number; expected: number }[] = [];
  for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) differences.push({ address: i.toString(16), actual: actual[i], expected: expected[i] });
  expect(differences).toEqual([]);
}
function compact(events: readonly string[]): string[] {
  const out: string[] = [];
  for (const event of events) {
    const last = out[out.length - 1] ?? '';
    if ((event === 'S' || event === 'H') && last[0] === event && /^[SH]\d*$/.test(last)) out[out.length - 1] = `${event}${Number(last.slice(1) || 1) + 1}`;
    else out.push(event);
  }
  return out;
}
function barBytes(m: Uint8Array, side: 0 | 1, old: number, next: number, max: number): void {
  le(m, A.wHPBarMaxHP, max); le(m, A.wHPBarOldHP, next); le(m, A.wHPBarNewHP, next);
  m[A.wHPBarType] = side === 0 ? 1 : 0; be(m, A.wHPBarHPDifference, Math.abs(next - old));
  if (next !== old) { m[A.wHPBarDelta] = next > old ? 1 : 255; if (side === 0) be(m, A.wHPBarTempHP, next); }
}
function hudBytes(m: Uint8Array): void {
  m[A.wPlayerHPBarColor] = color(word(m, p.hp), word(m, p.max)); m[A.wEnemyHPBarColor] = color(word(m, e.hp), word(m, e.max));
  // SET_PAL_BATTLE's ctx writes the zero enemy species2 into PokedexNum in this fixture.
  m[A.wPokedexNum] = 0;
}
function animBytes(m: Uint8Array, move: number): void { m[A.wAnimationType] = 0; if (move !== 0) m[A.wAnimationID] = move; }

function rig(side: 0 | 1, id: number, current = 10, max = 40, move = 105) {
  vi.restoreAllMocks();
  const s = new BattleState(), video = new BattleMenuScreen(), events: string[] = [];
  const u = side === 0 ? p : e, t = side === 0 ? e : p;
  for (let i = 0; i < s.mem.length; i++) s.mem[i] = (i * 73 + (i >> 8) * 29 + 37) & 255;
  s.hWhoseTurn = side; s.mem[u.effect] = id; s.mem[t.effect] = 0x55; s.mem[u.move] = move; s.mem[t.move] = 56;
  s.wPlayerMonNumber = 3; s.wEnemyMonPartyPos = 2; s.wBattleMonSpecies = 0; s.wEnemyMonSpecies2 = 0; s.wPokedexNum = 0;
  s.wBattleMonHP = s.wEnemyMonHP = 30; s.wBattleMonMaxHP = s.wEnemyMonMaxHP = 40;
  s.writeBE(u.hp, current); s.writeBE(u.max, max); s.wDamage = 8;
  s.wBattleMonStatus = 0x10; s.wEnemyMonStatus = 0x40;
  s.mem[p.flags2] = 0x62; s.mem[e.flags2] = 0xa4;
  s.wPlayerBattleStatus3 = 0x91; s.wEnemyBattleStatus3 = 0xa9;
  s.wPlayerToxicCounter = 11; s.wEnemyToxicCounter = 17;
  s.wPlayerSubstituteHP = 71; s.wEnemySubstituteHP = 73;
  s.wPlayerHPBarColor = color(s.wBattleMonHP, s.wBattleMonMaxHP); s.wEnemyHPBarColor = color(s.wEnemyMonHP, s.wEnemyMonMaxHP);
  s.wOptions = 0; s.wAnimationType = 91; s.wAnimationID = 92;
  s.wHPBarType = 145;
  s.wBattleMonLevel = 20; s.wEnemyMonLevel = 21;
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const observer = { text: (_key: string) => {}, animation: () => {}, direct: () => {}, frame: (_number: number) => {},
    bar: (_old: number, _next: number, _max: number, _type: 0 | 1) => {}, barDone: () => {} };
  vi.spyOn(random, 'battleRandom').mockImplementation(() => { throw new Error('unexpected RNG'); });
  vi.spyOn(hit, 'moveHitTest').mockImplementation(() => { throw new Error('unexpected HIT'); });
  const bar = hp.updateHPBar2;
  vi.spyOn(hp, 'updateHPBar2').mockImplementation(function* (state, screen, x, y, type, old, next, maximum) {
    expect(screen).toBe(video.screen); expect(state).toBe(s);
    expect([x, y, type]).toEqual(side === 0 ? [10, 9, 1] : [2, 2, 0]);
    expect([hp.readHpBarWord(s, A.wHPBarOldHP), hp.readHpBarWord(s, A.wHPBarMaxHP), hp.readHpBarWord(s, A.wHPBarNewHP), s.wHPBarType]).toEqual([old, maximum, next, type]);
    observer.bar(old, next, maximum, type); events.push(`bar:${old}->${next}/${maximum}:${type}@${x},${y}`);
    yield* bar(state, screen, x, y, type, old, next, maximum); events.push('barDone'); observer.barDone();
  });
  const playerHud = hud.drawPlayerHud, enemyHud = hud.drawEnemyHud, bothHuds = hud.drawHuds;
  vi.spyOn(hud, 'drawPlayerHud').mockImplementation(function* (state, screen) { events.push('hudPlayer'); yield* playerHud(state, screen); events.push('hudPlayerDone'); });
  vi.spyOn(hud, 'drawEnemyHud').mockImplementation(function* (state, screen) { events.push('hudEnemy'); yield* enemyHud(state, screen); events.push('hudEnemyDone'); });
  vi.spyOn(hud, 'drawHuds').mockImplementation(function* (state, screen) { events.push('huds'); yield* bothHuds(state, screen); events.push('hudsDone'); });
  const sync = loaders.readPlayerMonCurHPAndStatus;
  vi.spyOn(loaders, 'readPlayerMonCurHPAndStatus').mockImplementation(state => { events.push('syncPlayer'); sync(state); });
  const refresh = video.screen.refreshAfterAnimation.bind(video.screen);
  vi.spyOn(video.screen, 'refreshAfterAnimation').mockImplementation(function* () { events.push('refresh'); yield* refresh(); events.push('refreshed'); });
  const env: HpEffectEnvironment = {
    screen: video.screen,
    host: { printText: function* (key) { observer.text(key); expect(getTextPrograms()[key], key).toBeDefined(); events.push(`text:${key}`); } },
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.wAnimationType}`); observer.animation(); },
    animationSubstitute: function* () { events.push('animationSubstitute'); observer.direct(); },
  };
  const run = (program: Program<number | void> = jumpMoveEffect(s, 'call', hpEffectHandlers(env))) => {
    let frame = 0;
    const out = finish(program, kind => { events.push(kind === 'serviced' ? 'S' : kind === 'held' ? 'H' : kind); if (kind === 'serviced') video.vblank(); observer.frame(++frame); });
    return { ...out, ledger: compact(events) };
  };
  const expected = (patch: (memory: Uint8Array) => void = () => {}) => {
    const memory = s.mem.slice(); patch(memory); const out = run(); expect(out.result).toBe(1); sameBytes(s.mem, memory);
    expect({ ledger: out.ledger, frames: out.frames.length, held: out.frames.filter(f => f === 'held').length,
      hpBar: [...s.mem.slice(A.wHPBarMaxHP, A.wHPBarTempHP + 2)], difference: [...s.mem.slice(A.wHPBarHPDifference, A.wHPBarHPDifference + 2)],
      type: s.wHPBarType }).toMatchSnapshot();
    return out;
  };
  return { s, u, t, env, video, events, observer, run, expected };
}

it('factory exposes exactly the four HP wrapper labels and both drain aliases', () => {
  const r = rig(0, 3), registry = hpEffectHandlers(r.env);
  expect(Object.keys(registry)).toEqual(['DrainHPEffect', 'RecoilEffect', 'HealEffect', 'SubstituteEffect']); expect(r.events).toEqual([]);
  for (const id of [3, 8, 0x30, 0x38, 0x4f]) expect(registry[MOVE_EFFECT_POINTERS[id - 1]!.label]).toBeTypeOf('function');
});

describe.each([0, 1] as const)('HP effects side %i', side => {
  describe('Drain', () => {
    it.each([{ damage: 0, old: 10, max: 40, next: 11 }, { damage: 1, old: 10, max: 40, next: 11 },
      { damage: 9, old: 10, max: 40, next: 14 }, { damage: 0x103, old: 10, max: 300, next: 139 },
      { damage: 10, old: 38, max: 40, next: 40 }, { damage: 8, old: 40, max: 40, next: 40 },
      { damage: 20, old: 65530, max: 65535, next: 65535 }])('damage$damage HP$old/$max ->$next leaves halved wDamage and syncs player after both real HUDs', c => {
      const r = rig(side, 3, c.old, c.max); r.s.wDamage = c.damage;
      r.observer.bar = (old, next, max) => expect([old, next, max]).toEqual([c.old, c.next, c.max]);
      r.expected(memory => {
        be(memory, A.wDamage, Math.max(1, c.damage >>> 1)); be(memory, r.u.hp, c.next); barBytes(memory, side, c.old, c.next, c.max); hudBytes(memory);
        memory.set(memory.slice(p.hp, p.hp + 4), A.wPartyMons + 3 * PARTYMON_STRUCT_LENGTH + 1);
      });
      expect(r.events.indexOf('hudPlayer')).toBeLessThan(r.events.indexOf('hudEnemy')); expect(r.events.indexOf('hudEnemyDone')).toBeLessThan(r.events.indexOf('syncPlayer'));
      expect(r.events[r.events.length - 1]).toBe('text:SuckedHealthText');
    });
    it.each([false, true])('Dream Eater is selected from the live effect after HUDs (changed=%s)', changed => {
      const r = rig(side, changed ? 3 : 8);
      if (changed) r.observer.barDone = () => { r.s.mem[r.u.effect] = 8; };
      r.run(); expect(r.events[r.events.length - 1]).toBe('text:DreamWasEatenText'); expect(r.s.wDamage).toBe(4);
    });
  });
  describe('Recoil', () => {
    it.each([{ damage: 0, move: 36, old: 10, next: 9 }, { damage: 3, move: 36, old: 10, next: 9 },
      { damage: 9, move: 36, old: 10, next: 8 }, { damage: 9, move: 165, old: 10, next: 6 },
      { damage: 0, move: 165, old: 10, next: 9 }, { damage: 80, move: 36, old: 10, next: 0 },
      { damage: 40, move: 36, old: 10, next: 0 }])('damage$damage move$move HP$old ->$next leaves Damage/rosters/HUDs alone', c => {
      const r = rig(side, 0x30, c.old, 40, c.move); r.s.wDamage = c.damage;
      r.observer.bar = (old, next, max) => expect([old, next, max]).toEqual([c.old, c.next, 40]);
      r.expected(memory => { be(memory, r.u.hp, c.next); barBytes(memory, side, c.old, c.next, 40); });
      expect(loaders.readPlayerMonCurHPAndStatus).not.toHaveBeenCalled(); expect(hud.drawPlayerHud).not.toHaveBeenCalled(); expect(hud.drawEnemyHud).not.toHaveBeenCalled(); expect(hud.drawHuds).not.toHaveBeenCalled();
    });
  });
  describe('Heal', () => {
    it.each([{ old: 1, max: 256 }, { old: 45, max: 300 }, { old: 1, max: 512 }, { old: 40, max: 40 }])('carry test HP$old/$max fails with wait50 then unconditional printer, no writes', c => {
      const r = rig(side, 0x38, c.old, c.max); r.expected();
      expect(r.events).toEqual([...Array(50).fill('S'), 'text:ButItFailedText']);
    });
    it.each([{ old: 0, max: 255, next: 127, move: 105 }, { old: 10, max: 40, next: 30, move: 105 },
      { old: 30, max: 40, next: 40, move: 135 }, { old: 10, max: 41, next: 30, move: 105 }])('move$move HP$old/$max ->$next uses half max, type0 refresh, real bar then HUDs', c => {
      const r = rig(side, 0x38, c.old, c.max, c.move);
      r.observer.animation = () => {
        expect([hp.readHpBarWord(r.s, A.wHPBarOldHP), hp.readHpBarWord(r.s, A.wHPBarMaxHP), hp.readHpBarWord(r.s, A.wHPBarNewHP)]).toEqual([c.old, c.max, c.next]);
        expect(r.s.wHPBarType).toBe(145); // fixture sentinel; set only after the refresh, before the bar.
      };
      r.expected(memory => { be(memory, r.u.hp, c.next); animBytes(memory, c.move); barBytes(memory, side, c.old, c.next, c.max); hudBytes(memory); });
      expect(loaders.readPlayerMonCurHPAndStatus).not.toHaveBeenCalled();
    });
    it.each([0, 8, 16, 32, 64, 5])('Rest previous status%i waits first, writes2, prints before HP/bar changes, preserves toxic/penalties/roster', status => {
      const r = rig(side, 0x38, 10, 40, 156); r.s.mem[r.u.status] = status;
      const before = r.s.mem.slice();
      r.observer.frame = n => { if (n <= 50) { expect(r.s.mem[r.u.status]).toBe(status); expect(r.s.readBE(r.u.hp)).toBe(10); } };
      r.observer.text = key => {
        if (key === 'RegainedHealthText') return;
        expect(key).toBe(status ? 'FellAsleepBecameHealthyText' : 'StartedSleepingEffect'); expect(r.s.mem[r.u.status]).toBe(2);
        expect(r.s.readBE(r.u.hp)).toBe(10); expect(r.s.mem.slice(A.wHPBarMaxHP, A.wHPBarMaxHP + 6)).toEqual(before.slice(A.wHPBarMaxHP, A.wHPBarMaxHP + 6));
      };
      r.expected(memory => { memory[r.u.status] = 2; be(memory, r.u.hp, 40); animBytes(memory, 156); barBytes(memory, side, 10, 40, 40); hudBytes(memory); });
    });
    it('Rest at full HP fails before sleep or its text', () => {
      const r = rig(side, 0x38, 40, 40, 156); r.expected(); expect(r.events[r.events.length - 1]).toBe('text:ButItFailedText');
    });
    it('zero move still heals and resets type but skips animation/refresh', () => {
      const r = rig(side, 0x38, 10, 40, 0);
      r.expected(memory => { be(memory, r.u.hp, 30); animBytes(memory, 0); barBytes(memory, side, 10, 30, 40); hudBytes(memory); });
    });
  });
  describe('Substitute', () => {
    it('already present waits50 first, then HasSubstituteText, without scratch/HP/HUD/animation writes', () => {
      const r = rig(side, 0x4f); r.s.mem[r.u.flags2] |= 0x10; r.expected();
      expect(r.events).toEqual([...Array(50).fill('S'), 'text:HasSubstituteText']);
    });
    it('insufficient HP waits50 and leaves only the cost scratch write before TooWeakSubstituteText', () => {
      const r = rig(side, 0x4f, 9, 40, 164);
      r.observer.text = () => { expect(r.s.mem[r.u.substitute]).toBe(10); expect(r.s.readBE(r.u.hp)).toBe(9); };
      r.expected(memory => { memory[r.u.substitute] = 10; });
    });
    it.each([{ old: 10, max: 40, cost: 10 }, { old: 20, max: 41, cost: 10 }, { old: 0, max: 3, cost: 0 },
      { old: 255, max: 1023, cost: 255 }, { old: 10, max: 1024, cost: 0 }, { old: 10, max: 1028, cost: 1 }])('HP$old/$max cost$cost accepts equality/zero and pins one-byte truncation', c => {
      const r = rig(side, 0x4f, c.old, c.max, 164), next = c.old - c.cost;
      const before = r.s.mem.slice();
      r.observer.frame = n => { if (n <= 50) sameBytes(r.s.mem, before); };
      r.observer.animation = () => { expect(r.s.readBE(r.u.hp)).toBe(next); expect(r.s.mem[r.u.substitute]).toBe(c.cost); expect(r.s.mem[r.u.flags2] & 0x10).toBe(0x10); };
      r.expected(memory => { be(memory, r.u.hp, next); memory[r.u.substitute] = c.cost; memory[r.u.flags2] |= 0x10; animBytes(memory, 164); hudBytes(memory); });
      expect(hp.updateHPBar2).not.toHaveBeenCalled(); expect(r.events.indexOf('text:SubstituteText')).toBeLessThan(r.events.indexOf('huds'));
    });
    it.each([0x80, 0xff])('animations-off options%i uses direct CPU port with no refresh and no type reset', options => {
      const r = rig(side, 0x4f, 20, 40, 164); r.s.wOptions = options;
      r.observer.direct = () => { expect(r.s.readBE(r.u.hp)).toBe(10); expect(r.s.mem[r.u.flags2] & 0x10).toBe(0x10); };
      r.expected(memory => { be(memory, r.u.hp, 10); memory[r.u.substitute] = 10; memory[r.u.flags2] |= 0x10; hudBytes(memory); });
      expect(r.events).not.toContain('refresh'); expect(r.events).toContain('animationSubstitute');
    });
  });
});

const printerCases = [
  { name: 'drain', id: 3, old: 10, max: 40, move: 71 },
  { name: 'Dream Eater', id: 8, old: 10, max: 40, move: 138 },
  { name: 'recoil', id: 0x30, old: 10, max: 40, move: 36 },
  { name: 'Recover', id: 0x38, old: 10, max: 40, move: 105 },
  { name: 'Rest healthy', id: 0x38, old: 10, max: 40, move: 156 },
  { name: 'Rest statused', id: 0x38, old: 10, max: 40, move: 156 },
  { name: 'Heal failure', id: 0x38, old: 40, max: 40, move: 105 },
  { name: 'Substitute', id: 0x4f, old: 20, max: 40, move: 164 },
  { name: 'Substitute off', id: 0x4f, old: 20, max: 40, move: 164 },
  { name: 'Substitute present', id: 0x4f, old: 20, max: 40, move: 164 },
  { name: 'Substitute weak', id: 0x4f, old: 9, max: 40, move: 164 },
] as const;
describe.each([0, 1] as const)('real HP printer side %i', side => {
  it.each(printerCases)('$name complete bar/HUD/text/frame ledger', c => {
    const r = rig(side, c.id, c.old, c.max, c.move);
    if (c.name === 'Rest healthy') r.s.mem[r.u.status] = 0;
    if (c.name === 'Rest statused') r.s.mem[r.u.status] = 8;
    if (c.name === 'Substitute off') r.s.wOptions = 0x80;
    if (c.name === 'Substitute present') r.s.mem[r.u.flags2] |= 0x10;
    const host = new BattleHost<number>(r.s, r.video);
    const env: HpEffectEnvironment = { ...r.env, host: {
      printText: function* (key, bindings, options) {
        r.events.push(`text:${key}`); yield* host.printText(key, bindings, options); r.events.push('textDone');
      },
    } };
    host.start(jumpMoveEffect(r.s, 'call', hpEffectHandlers(env)));
    let frames = 0, pressed = false, held = 0;
    while (!host.done && frames < 2500) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      // Record the pending frame before resuming CPU work that can enter a new phase.
      const marker = r.events.length; r.events.push('pending');
      const kind = host.step(); expect(kind === 'serviced' || kind === 'held').toBe(true);
      r.events[marker] = kind === 'serviced' ? 'S' : 'H'; if (kind === 'held') held++;
      frames++;
    }
    expect(host.done).toBe(true); expect(host.result).toBe(1);
    expect({ frames, held, ledger: compact(r.events), hp: r.s.readBE(r.u.hp), status: r.s.mem[r.u.status], damage: r.s.wDamage,
      hpBar: [...r.s.mem.slice(A.wHPBarMaxHP, A.wHPBarTempHP + 2)], difference: [...r.s.mem.slice(A.wHPBarHPDifference, A.wHPBarHPDifference + 2)],
      type: r.s.wHPBarType }).toMatchSnapshot();
  });
});
