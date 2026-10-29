import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, LINK_STATE_BATTLING, NAME_BUFFER_LENGTH, PARTYMON_STRUCT_LENGTH, battleContext, encodeText, type SpeciesHeader } from './battle_state';
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
import { isHeld, isPassPressed } from '../input';
import type { GameButton } from '../core';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';
import { getMoveName, loadBattleMoveData } from './battle_move_data';
const realMoveHitTest = hit.moveHitTest;

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
    hideSubstitute: function* () { events.push('hide'); },
    reshowSubstitute: function* () { events.push('show'); },
    animationTransformMon: function* () { events.push('animationTransformMon'); observer.direct(); },
    moveMenu: {
      ctx: battleContext(s),
      host: {
        tiles: video.tiles,
        getMove: id => {
          events.push(`getMove:${id}`);
          return { id, name: 'M', type: 'NORMAL', pp: 35, power: 40, accuracy: 1, effect: 'NO_EFFECT' };
        },
        readJoypad: () => { events.push('readJoypad'); },
        pressSound: () => { events.push('pressSound'); },
        printText: function* (key) { events.push(`menuText:${key}`); },
        loadScreenTilesFromBuffer1: () => { events.push('restore1'); },
      },
    },
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

it('factory exposes exactly the nine HP wrapper labels and both drain aliases', () => {
  const r = rig(0, 3), registry = hpEffectHandlers(r.env);
  expect(Object.keys(registry)).toEqual(['DrainHPEffect', 'RecoilEffect', 'HealEffect', 'SubstituteEffect', 'TransformEffect', 'ConversionEffect', 'MimicEffect', 'DisableEffect', 'SplashEffect']); expect(r.events).toEqual([]);
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

// A5c3c checkpoint-06b. pret transform.asm, conversion.asm, effects.asm:1259-1430.
type Rig = ReturnType<typeof rig>;
const DITTO = 0x4c;
const SPECIES = 0x19;
function speciesHeader(name: string): SpeciesHeader {
  return { name, base: [1, 1, 1, 1, 1], type1: 0, type2: 0, catchRate: 1, baseExp: 1, moves: [1, 0, 0, 0], learnset: [] };
}
function copy(memory: Uint8Array, from: number, to: number, length: number): void {
  memory.set(memory.slice(from, from + length), to);
}
// home/names.asm:1–25: ten @-padded MonsterNames bytes, @ at +10, +11.. untouched (A5c3f checkpoint-03).
function monName(memory: Uint8Array, name: string): void {
  const bytes = encodeText(`${name}@@@@@@@@@@`.slice(0, 10));
  for (let i = 0; i < 10; i++) memory[A.wNameBuffer + i] = bytes[i];
  memory[A.wNameBuffer + 10] = 0x50;
}
function expectMoveName(memory: Uint8Array, id: number): void {
  const scratch = new BattleState();
  scratch.wNamedObjectIndex = id;
  getMoveName(scratch);
  memory.set(scratch.mem.slice(A.wNameBuffer, A.wNameBuffer + NAME_BUFFER_LENGTH), A.wNameBuffer);
  memory[A.wNamedObjectIndex] = scratch.wNamedObjectIndex;
  memory[A.wNameListIndex] = scratch.wNameListIndex;
  memory[A.wNameListType] = scratch.wNameListType;
  memory[A.wPredefBank] = scratch.wPredefBank;
}
function armHit(r: Rig, link = 0): void {
  const player = r.s.hWhoseTurn === 0;
  r.s.wMoveMissed = 0; r.s.wLinkState = link;
  r.s.wPlayerBattleStatus1 = 0x01; r.s.wEnemyBattleStatus1 = 0x02;
  r.s.mem[player ? A.wPlayerMonAccuracyMod : A.wEnemyMonAccuracyMod] = 7;
  r.s.mem[player ? A.wEnemyMonEvasionMod : A.wPlayerMonEvasionMod] = 7;
  r.s.mem[player ? A.wPlayerMoveAccuracy : A.wEnemyMoveAccuracy] = 255;
}
function scriptDraws(r: Rig, draws: readonly number[]): void {
  let index = 0;
  vi.mocked(hit.moveHitTest).mockImplementation(state => realMoveHitTest(state));
  vi.mocked(random.battleRandom).mockImplementation(() => {
    const value = draws[index++];
    if (value === undefined) throw new Error(`RNG exhausted after ${draws.length}`);
    r.events.push(`R${value}`); return value;
  });
}
function useRealHit(): void {
  vi.mocked(hit.moveHitTest).mockImplementation(state => realMoveHitTest(state));
}
function scriptKeys(r: Rig, keys: readonly GameButton[]): void {
  const queue = [...keys];
  r.env.moveMenu.host.readJoypad = () => {
    const key = queue.shift();
    r.events.push(`readJoypad:${key ?? 'none'}`);
    vi.mocked(isPassPressed).mockImplementation(button => button === key);
  };
}
function drawsOf(events: readonly string[]): string[] { return events.filter(event => event.startsWith('R')); }
function serviced(events: readonly string[]): number { return events.filter(event => event === 'S').length; }

it('dispatches Conversion, Transform, Mimic, Splash and Disable by effect id', () => {
  const r = rig(0, 1), registry = hpEffectHandlers(r.env);
  const ids = [[0x18, 'ConversionEffect'], [0x39, 'TransformEffect'], [0x52, 'MimicEffect'], [0x55, 'SplashEffect'], [0x56, 'DisableEffect']] as const;
  for (const [id, label] of ids) {
    expect(MOVE_EFFECT_POINTERS[id - 1]!.label).toBe(label);
    expect(registry[label]).toBeTypeOf('function');
  }
  expect(r.events).toEqual([]);
});

describe('checkpoint-06b effects', () => {
  beforeAll(async () => { await loadBattleMoveData(); });

  function stageTransform(r: Rig, animate: boolean, doll: 'none' | 'user' | 'target', userInv: boolean, targetInv: boolean): void {
    const s = r.s, player = s.hWhoseTurn === 0;
    const user = player ? A.wBattleMonSpecies : A.wEnemyMonSpecies;
    const target = player ? A.wEnemyMonSpecies : A.wBattleMonSpecies;
    s.species = id => { if (id !== DITTO) throw new Error(`species ${id}`); return speciesHeader('DITTO'); };
    s.wPlayerBattleStatus1 = 0x01; s.wEnemyBattleStatus1 = 0x02;
    if (userInv) s.mem[player ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1] |= 0x40;
    if (targetInv) s.mem[player ? A.wEnemyBattleStatus1 : A.wPlayerBattleStatus1] |= 0x40;
    if (doll === 'user') s.mem[player ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2] |= 0x10;
    if (doll === 'target') s.mem[player ? A.wEnemyBattleStatus2 : A.wPlayerBattleStatus2] |= 0x10;
    s.wOptions = animate ? 0 : 0x80;
    s.wPlayerMoveListIndex = 7;
    s.mem[A.wTransformedEnemyMonOriginalDVs] = 0xab; s.mem[A.wTransformedEnemyMonOriginalDVs + 1] = 0xcd;
    s.mem[A.wBattleMonPartyPos] = 0x11; s.mem[A.wEnemyMonPartyPos] = 0x22;
    s.wPlayerDisabledMove = 0x21; s.wEnemyDisabledMove = 0x43;
    s.wPlayerDisabledMoveNumber = 0xee; s.wEnemyDisabledMoveNumber = 0xff;
    s.wPlayerBattleStatus3 &= ~0x08; s.wEnemyBattleStatus3 &= ~0x08;
    s.writeBE(player ? A.wEnemyMonMaxHP : A.wBattleMonMaxHP, 99);
    const paint = (base: number, species: number, types: number[], moves: number[], dvs: number[], stats: number, pp: number[]) => {
      s.mem[base] = species; s.mem[base + 5] = types[0]; s.mem[base + 6] = types[1]; s.mem[base + 7] = types[2];
      for (let i = 0; i < 4; i++) s.mem[base + 8 + i] = moves[i];
      s.mem[base + 12] = dvs[0]; s.mem[base + 13] = dvs[1];
      for (let i = 0; i < 8; i++) s.mem[base + 17 + i] = stats + i;
      for (let i = 0; i < 4; i++) s.mem[base + 25 + i] = pp[i];
    };
    paint(user, SPECIES, [1, 2, 3], [9, 9, 9, 9], [0x33, 0x44], 0x40, [9, 9, 9, 9]);
    paint(target, DITTO, [0x14, 0x17, 0x66], [1, 0, 8, 0], [0x11, 0x22], 0x80, [4, 4, 4, 4]);
    // Enemy-turn DVs are the user's. Keep the player struct at 33/44 and the enemy struct at 11/22.
    if (!player) {
      s.mem[A.wBattleMonDVs] = 0x33; s.mem[A.wBattleMonDVs + 1] = 0x44;
      s.mem[A.wEnemyMonDVs] = 0x11; s.mem[A.wEnemyMonDVs + 1] = 0x22;
    }
    for (let i = 0; i < 8; i++) {
      s.mem[A.wPlayerMonUnmodifiedLevel + 3 + i] = 0x10 + i; s.mem[A.wEnemyMonUnmodifiedLevel + 3 + i] = 0x30 + i;
      s.mem[A.wPlayerMonStatMods + i] = 0x50 + i; s.mem[A.wEnemyMonStatMods + i] = 0x70 + i;
    }
  }
  function expectTransform(memory: Uint8Array, side: 0 | 1, move: number, animate: boolean): void {
    const player = side === 0;
    if (player) memory[A.wPlayerMoveListIndex] = 0;
    if (animate) animBytes(memory, move);
    memory[player ? A.wPlayerBattleStatus3 : A.wEnemyBattleStatus3] |= 0x08;
    const user = player ? A.wBattleMonSpecies : A.wEnemyMonSpecies;
    const target = player ? A.wEnemyMonSpecies : A.wBattleMonSpecies;
    memory[user] = memory[target];
    copy(memory, target + 5, user + 5, 7);
    if (!player) {
      memory[A.wTransformedEnemyMonOriginalDVs] = memory[user + 12];
      memory[A.wTransformedEnemyMonOriginalDVs + 1] = memory[user + 13];
    }
    copy(memory, target + 12, user + 12, 2);
    copy(memory, target + 17, user + 17, 8);
    for (let i = 0; i < 4; i++) memory[user + 25 + i] = memory[target + 8 + i] === 0 ? 0 : 5;
    memory[A.wNamedObjectIndex] = memory[target];
    monName(memory, 'DITTO');
    copy(memory, (player ? A.wEnemyMonUnmodifiedLevel : A.wPlayerMonUnmodifiedLevel) + 3,
      (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3, 8);
    copy(memory, player ? A.wEnemyMonStatMods : A.wPlayerMonStatMods, player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods, 8);
  }
  function pinTransform(r: Rig, animate: boolean, doll: 'none' | 'user' | 'target'): void {
    const s = r.s, side = s.hWhoseTurn as 0 | 1, player = side === 0;
    const user = player ? A.wBattleMonSpecies : A.wEnemyMonSpecies;
    expect(s.wPlayerMoveListIndex).toBe(player ? 0 : 7);
    expect(s.mem[user]).toBe(DITTO);
    expect([...s.mem.slice(user + 8, user + 12)]).toEqual([1, 0, 8, 0]);
    expect([...s.mem.slice(user + 25, user + 29)]).toEqual([5, 0, 5, 0]);
    expect([...s.mem.slice(user + 14, user + 17)]).toEqual(player
      ? [s.wBattleMonLevel, 0, 40] : [s.wEnemyMonLevel, 0, 40]);
    expect(s.wBattleMonHP).toBe(player ? 10 : 30); expect(s.wEnemyMonHP).toBe(player ? 30 : 10);
    expect(s.wBattleMonMaxHP).toBe(player ? 40 : 99); expect(s.wEnemyMonMaxHP).toBe(player ? 99 : 40);
    expect(s.wBattleMonStatus).toBe(0x10); expect(s.wEnemyMonStatus).toBe(0x40);
    expect(s.mem[A.wBattleMonPartyPos]).toBe(0x11); expect(s.mem[A.wEnemyMonPartyPos]).toBe(0x22);
    expect(s.wPlayerDisabledMove).toBe(0x21); expect(s.wEnemyDisabledMove).toBe(0x43);
    expect(s.wNamedObjectIndex).toBe(DITTO);
    // GetMonName writes 11 bytes; +11..+19 stay as they were (sameBytes in r.expected pins them).
    expect([...s.mem.slice(A.wNameBuffer, A.wNameBuffer + 11)]).toEqual(encodeText('DITTO@@@@@@'));
    const mods = player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods;
    expect([...s.mem.slice(mods, mods + 8)]).toEqual(Array.from({ length: 8 }, (_, i) => (player ? 0x70 : 0x50) + i));
    const unmodified = (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3;
    expect([...s.mem.slice(unmodified, unmodified + 8)]).toEqual(Array.from({ length: 8 }, (_, i) => (player ? 0x30 : 0x10) + i));
    if (player) expect([...s.mem.slice(A.wTransformedEnemyMonOriginalDVs, A.wTransformedEnemyMonOriginalDVs + 2)]).toEqual([0xab, 0xcd]);
    else expect([...s.mem.slice(A.wTransformedEnemyMonOriginalDVs, A.wTransformedEnemyMonOriginalDVs + 2)]).toEqual([0x11, 0x22]);
    expect(s.wPlayerBattleStatus3 & 0x08).toBe(player ? 0x08 : 0);
    expect(s.wEnemyBattleStatus3 & 0x08).toBe(player ? 0 : 0x08);
    expect(drawsOf(r.events)).toEqual([]);
    expect(r.events[r.events.length - 1]).toBe('text:TransformedText');
    if (animate && s.mem[r.u.move] !== 0) {
      expect(s.wAnimationType).toBe(0); expect(s.wAnimationID).toBe(s.mem[r.u.move]);
      expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
    } else if (!animate) {
      expect(s.wAnimationType).toBe(91); expect(s.wAnimationID).toBe(92);
      expect(serviced(r.events)).toBe(0); expect(r.events).not.toContain('refresh');
      expect(r.events).toContain('animationTransformMon');
    } else {
      expect(s.wAnimationType).toBe(0); expect(s.wAnimationID).toBe(92);
      expect(serviced(r.events)).toBe(0); expect(r.events).not.toContain('refresh');
    }
    const hide = r.events.indexOf('hide'), show = r.events.indexOf('show');
    if (doll === 'user') {
      const played = r.events.findIndex(event => event.startsWith('anim:') || event === 'animationTransformMon');
      expect(hide).toBeGreaterThanOrEqual(0); expect(hide).toBeLessThan(played); expect(played).toBeLessThan(show);
    } else {
      expect(hide).toBe(-1); expect(show).toBe(-1);
    }
  }

  describe.each([0, 1] as const)('Transform side %i', side => {
    it.each([
      ['animated copy', true, 'none', 105],
      ['animations off', false, 'none', 105],
      ['user doll around the animation', true, 'user', 105],
      ['user doll around the CPU transform', false, 'user', 105],
      ['target doll is not hidden', true, 'target', 105],
      ['zero move resets type and skips refresh', true, 'none', 0],
    ] as const)('%s', (_name, animate, doll, move) => {
      const r = rig(side, 0x39, 10, 40, move);
      stageTransform(r, animate, doll, false, false);
      r.expected(memory => expectTransform(memory, side, move, animate));
      pinTransform(r, animate, doll);
    });
  });

  it('player INVULNERABLE fails after zeroing wPlayerMoveListIndex and copies nothing', () => {
    const r = rig(0, 0x39); stageTransform(r, true, 'user', true, false);
    r.expected(memory => { memory[A.wPlayerMoveListIndex] = 0; });
    expect(r.events).toEqual(['text:ButItFailedText']);
    expect(r.s.wBattleMonSpecies).toBe(SPECIES); expect(r.s.wPlayerMoveListIndex).toBe(0);
    expect(r.s.wAnimationType).toBe(91); expect(r.events).not.toContain('hide');
  });
  it('enemy turn ignores the user INVULNERABLE bit and does not write wPlayerMoveListIndex', () => {
    const r = rig(1, 0x39); stageTransform(r, true, 'none', true, false);
    r.expected(memory => expectTransform(memory, 1, 105, true));
    pinTransform(r, true, 'none');
    expect(r.events).not.toContain('text:ButItFailedText');
  });
  it('player turn ignores the target INVULNERABLE bit', () => {
    const r = rig(0, 0x39); stageTransform(r, true, 'none', false, true);
    r.expected(memory => expectTransform(memory, 0, 105, true));
    pinTransform(r, true, 'none');
    expect(r.s.wEnemyBattleStatus1 & 0x40).toBe(0x40);
  });

  function stageConversion(r: Rig, userInv: boolean, targetInv: boolean): void {
    const s = r.s, player = s.hWhoseTurn === 0;
    s.wPlayerBattleStatus1 = 0x01; s.wEnemyBattleStatus1 = 0x02;
    if (userInv) s.mem[player ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1] |= 0x40;
    if (targetInv) s.mem[player ? A.wEnemyBattleStatus1 : A.wPlayerBattleStatus1] |= 0x40;
    s.wBattleMonType1 = 0x01; s.wBattleMonType2 = 0x02; s.wBattleMonCatchRate = 0x66;
    s.wEnemyMonType1 = 0x14; s.wEnemyMonType2 = 0x17; s.wEnemyMonCatchRate = 0x77;
    for (let i = 0; i < 4; i++) { s.mem[A.wBattleMonMoves + i] = 9 - i; s.mem[A.wEnemyMonMoves + i] = i + 1; }
  }
  describe.each([0, 1] as const)('Conversion side %i', side => {
    it('copies two target type bytes, then the current-move animation', () => {
      const r = rig(side, 0x18); stageConversion(r, false, false);
      r.expected(memory => {
        if (side === 0) { memory[A.wBattleMonType1] = 0x14; memory[A.wBattleMonType2] = 0x17; }
        else { memory[A.wEnemyMonType1] = 0x01; memory[A.wEnemyMonType2] = 0x02; }
        animBytes(memory, 105);
      });
      expect(r.s.wBattleMonCatchRate).toBe(0x66); expect(r.s.wEnemyMonCatchRate).toBe(0x77);
      expect([...r.s.mem.slice(A.wBattleMonMoves, A.wBattleMonMoves + 4)]).toEqual([9, 8, 7, 6]);
      expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
      expect(r.events[r.events.length - 1]).toBe('text:ConvertedTypeText');
    });
    it('target INVULNERABLE fails with no copy and no animation', () => {
      const r = rig(side, 0x18); stageConversion(r, false, true);
      r.expected();
      expect(r.events).toEqual(['text:ButItFailedText']);
      expect(r.s.wBattleMonType1).toBe(0x01); expect(r.s.wEnemyMonType1).toBe(0x14);
    });
    it('user INVULNERABLE still copies the target types', () => {
      const r = rig(side, 0x18); stageConversion(r, true, false);
      r.expected(memory => {
        if (side === 0) { memory[A.wBattleMonType1] = 0x14; memory[A.wBattleMonType2] = 0x17; }
        else { memory[A.wEnemyMonType1] = 0x01; memory[A.wEnemyMonType2] = 0x02; }
        animBytes(memory, 105);
      });
      expect(r.events[r.events.length - 1]).toBe('text:ConvertedTypeText');
    });
    it('zero move resets type and skips refresh', () => {
      const r = rig(side, 0x18, 10, 40, 0); stageConversion(r, false, false);
      r.expected(memory => {
        if (side === 0) { memory[A.wBattleMonType1] = 0x14; memory[A.wBattleMonType2] = 0x17; }
        else { memory[A.wEnemyMonType1] = 0x01; memory[A.wEnemyMonType2] = 0x02; }
        animBytes(memory, 0);
      });
      expect(r.s.wAnimationType).toBe(0); expect(r.s.wAnimationID).toBe(92); expect(serviced(r.events)).toBe(0);
    });
  });

  function pinMimicMoves(r: Rig, moves: number[], pp: number[], address: number): void {
    expect([...r.s.mem.slice(address, address + 4)]).toEqual(moves);
    expect([...r.s.mem.slice(address === A.wBattleMonMoves ? A.wBattleMonPP : A.wEnemyMonPP, (address === A.wBattleMonMoves ? A.wBattleMonPP : A.wEnemyMonPP) + 4)]).toEqual(pp);
  }
  it('Mimic menu writes the saved slot after Down then A', () => {
    const r = rig(0, 0x52); armHit(r); scriptDraws(r, [0]); scriptKeys(r, ['down', 'a']);
    r.s.wCurrentMenuItem = 2; r.s.wPlayerMoveListIndex = 0; r.s.wMenuItemToSwap = 0x5a; r.s.wMoveMenuType = 0;
    for (let i = 0; i < 4; i++) {
      r.s.mem[A.wEnemyMonMoves + i] = i + 1; r.s.mem[A.wBattleMonMoves + i] = 9;
      r.s.mem[A.wBattleMonPP + i] = 0x11 + i; r.s.mem[A.wEnemyMonPP + i] = 0x21 + i;
    }
    r.expected(memory => {
      memory[A.wMoveMenuType] = 1; memory[A.wCurrentMenuItem] = 1; memory[A.wNumMovesMinusOne] = 3; memory[A.wMenuItemToSwap] = 0;
      memory[A.wBattleMonMoves + 2] = 2; expectMoveName(memory, 2); animBytes(memory, 105);
    });
    pinMimicMoves(r, [9, 9, 2, 9], [0x11, 0x12, 0x13, 0x14], A.wBattleMonMoves);
    expect(r.s.wCurrentMenuItem).toBe(1); expect(r.s.wMoveMenuType).toBe(1); expect(r.s.wPlayerMoveListIndex).toBe(0);
    expect(r.events.filter(event => event.startsWith('readJoypad'))).toEqual(['readJoypad:down', 'readJoypad:a']);
    expect(r.events.filter(event => event === 'pressSound')).toEqual(['pressSound']);
    expect(serviced(r.events)).toBe(68); expect(drawsOf(r.events)).toEqual(['R0']); expect(r.events).toContain('refresh');
    expect(r.events.indexOf('restore1')).toBeLessThan(r.events.findIndex(event => event.startsWith('anim:')));
  });
  it('Mimic menu ignores B and still writes the saved slot', () => {
    const r = rig(0, 0x52); armHit(r); scriptDraws(r, [0]); scriptKeys(r, ['b', 'a']);
    r.s.wCurrentMenuItem = 2; r.s.wPlayerMoveListIndex = 0; r.s.wMenuItemToSwap = 0x5a;
    for (let i = 0; i < 4; i++) {
      r.s.mem[A.wEnemyMonMoves + i] = i + 1; r.s.mem[A.wBattleMonMoves + i] = 9;
      r.s.mem[A.wBattleMonPP + i] = 0x11 + i;
    }
    r.expected(memory => {
      memory[A.wMoveMenuType] = 1; memory[A.wCurrentMenuItem] = 0; memory[A.wNumMovesMinusOne] = 3; memory[A.wMenuItemToSwap] = 0;
      memory[A.wBattleMonMoves + 2] = 1; expectMoveName(memory, 1); animBytes(memory, 105);
    });
    expect([...r.s.mem.slice(A.wBattleMonMoves, A.wBattleMonMoves + 4)]).toEqual([9, 9, 1, 9]);
    expect(r.s.wCurrentMenuItem).toBe(0); expect(r.s.wPlayerMoveListIndex).toBe(0);
    expect(r.events.filter(event => event.startsWith('readJoypad'))).toEqual(['readJoypad:b', 'readJoypad:a']);
    expect(serviced(r.events)).toBe(68); expect(r.events).toContain('refresh');
  });
  it('link Mimic rejection-samples the enemy moves into wPlayerMoveListIndex', () => {
    const r = rig(0, 0x52); armHit(r, LINK_STATE_BATTLING); scriptDraws(r, [0, 0, 1, 2]);
    r.s.wPlayerMoveListIndex = 3; r.s.wCurrentMenuItem = 1; r.s.wMenuItemToSwap = 0x5a; r.s.wMoveMenuType = 0;
    for (let i = 0; i < 4; i++) { r.s.mem[A.wBattleMonMoves + i] = 9; r.s.mem[A.wBattleMonPP + i] = 0x11 + i; }
    r.s.mem[A.wEnemyMonMoves] = 0; r.s.mem[A.wEnemyMonMoves + 1] = 0; r.s.mem[A.wEnemyMonMoves + 2] = 1; r.s.mem[A.wEnemyMonMoves + 3] = 0;
    r.expected(memory => {
      memory[A.wBattleMonMoves + 3] = 1; expectMoveName(memory, 1); animBytes(memory, 105);
    });
    pinMimicMoves(r, [9, 9, 9, 1], [0x11, 0x12, 0x13, 0x14], A.wBattleMonMoves);
    expect(r.s.wPlayerMoveListIndex).toBe(3); expect(r.s.wCurrentMenuItem).toBe(1);
    expect(r.s.wMoveMenuType).toBe(0); expect(r.s.wMenuItemToSwap).toBe(0x5a);
    expect(drawsOf(r.events)).toEqual(['R0', 'R0', 'R1', 'R2']);
    expect(r.events.some(event => event.startsWith('readJoypad'))).toBe(false);
    expect(serviced(r.events)).toBe(62); expect(r.events).toContain('refresh');
  });
  it('enemy Mimic rejection-samples the player moves into wEnemyMoveListIndex', () => {
    const r = rig(1, 0x52); armHit(r); scriptDraws(r, [0, 0, 1]);
    r.s.wEnemyMoveListIndex = 2; r.s.wPlayerMoveListIndex = 0;
    for (let i = 0; i < 4; i++) { r.s.mem[A.wEnemyMonMoves + i] = 7; r.s.mem[A.wEnemyMonPP + i] = 0x31 + i; }
    r.s.mem[A.wBattleMonMoves] = 0; r.s.mem[A.wBattleMonMoves + 1] = 5; r.s.mem[A.wBattleMonMoves + 2] = 0; r.s.mem[A.wBattleMonMoves + 3] = 0;
    r.expected(memory => {
      memory[A.wEnemyMonMoves + 2] = 5; expectMoveName(memory, 5); animBytes(memory, 105);
    });
    pinMimicMoves(r, [7, 7, 5, 7], [0x31, 0x32, 0x33, 0x34], A.wEnemyMonMoves);
    expect(r.s.wEnemyMoveListIndex).toBe(2); expect(drawsOf(r.events)).toEqual(['R0', 'R0', 'R1']);
    expect(r.s.wAnimationType).toBe(0); expect(serviced(r.events)).toBe(62); expect(r.events).toContain('refresh');
  });
  it.each([0, 1] as const)('Mimic side %i misses an invulnerable target after 50 frames and no draw', side => {
    const r = rig(side, 0x52); armHit(r); useRealHit();
    if (side === 0) r.s.wEnemyBattleStatus1 |= 0x40; else r.s.wPlayerBattleStatus1 |= 0x40;
    r.expected(memory => { memory[A.wMoveMissed] = 1; be(memory, A.wDamage, 0); });
    expect(serviced(r.events)).toBe(50); expect(drawsOf(r.events)).toEqual([]);
    expect(r.events[r.events.length - 1]).toBe('text:ButItFailedText');
    expect(r.s.wDamage).toBe(0); expect(r.s.wMoveMissed).toBe(1);
  });
  it.each([0, 1] as const)('Mimic side %i throws before a draw when every target move is zero', side => {
    const r = rig(side, 0x52); armHit(r, side === 0 ? LINK_STATE_BATTLING : 0); scriptDraws(r, [0]);
    for (let i = 0; i < 4; i++) r.s.mem[(side === 0 ? A.wEnemyMonMoves : A.wBattleMonMoves) + i] = 0;
    expect(() => r.run()).toThrow(/mimic target moves are all zero/);
    expect(drawsOf(r.events)).toEqual(['R0']); expect(serviced(r.events)).toBe(50);
    expect(r.events.some(event => event.startsWith('text:'))).toBe(false);
  });

  function disablePack(slot: number, roll: number): number {
    const duration = (roll & 7) + 1;
    let packed = slot + 1;
    packed = ((packed & 0x0f) << 4) | (packed >> 4);
    return (duration + packed) & 0xff;
  }
  it('packs slot 2 and roll 0 as 0x31', () => { expect(disablePack(2, 0)).toBe(0x31); expect(disablePack(0, 0)).toBe(0x11); expect(disablePack(1, 0)).toBe(0x21); });

  function stageDisable(r: Rig, moves: number[], pp: number[], link = 0): void {
    const s = r.s, player = s.hWhoseTurn === 0;
    armHit(r, link);
    const moveAddr = player ? A.wEnemyMonMoves : A.wBattleMonMoves;
    const ppAddr = player ? A.wEnemyMonPP : A.wBattleMonPP;
    for (let i = 0; i < 4; i++) { s.mem[moveAddr + i] = moves[i] ?? 0; s.mem[ppAddr + i] = pp[i] ?? 0; }
    // The other side's PP stays zero unless a test fills it, so the wrong array is visible.
    for (let i = 0; i < 4; i++) s.mem[(player ? A.wBattleMonPP : A.wEnemyMonPP) + i] = 0;
    s.wPlayerDisabledMove = 0; s.wEnemyDisabledMove = 0;
    s.wPlayerDisabledMoveNumber = 0xee; s.wEnemyDisabledMoveNumber = 0xff;
  }
  function expectDisabled(memory: Uint8Array, side: 0 | 1, packed: number, move: number, animateMove: number): void {
    memory[side === 0 ? A.wEnemyDisabledMove : A.wPlayerDisabledMove] = packed;
    memory[side === 0 ? A.wEnemyDisabledMoveNumber : A.wPlayerDisabledMoveNumber] = move;
    expectMoveName(memory, move);
    if (animateMove !== 0) { memory[A.wAnimationID] = animateMove; memory[A.wAnimationType] = side === 0 ? 6 : 3; }
  }

  it('non-link Disable ignores PP, rejects empty slots, and packs the accepted slot', () => {
    const r = rig(0, 0x56); stageDisable(r, [0, 0, 8, 0], [0, 0, 0, 0]); scriptDraws(r, [0, 0, 1, 2, 0]);
    r.expected(memory => expectDisabled(memory, 0, 0x31, 8, 105));
    expect(r.s.wEnemyDisabledMove).toBe(0x31); expect(r.s.wEnemyDisabledMoveNumber).toBe(8);
    expect(r.s.wPlayerDisabledMoveNumber).toBe(0xee); expect(r.s.wPlayerDisabledMove).toBe(0);
    expect(drawsOf(r.events)).toEqual(['R0', 'R0', 'R1', 'R2', 'R0']);
    expect(r.s.wAnimationType).toBe(6); expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
    expect(r.events[r.events.length - 1]).toBe('text:MoveWasDisabledText');
  });
  it('link Disable accepts a PP-Up raw byte of 0x80 and reads the enemy PP', () => {
    const r = rig(0, 0x56); stageDisable(r, [1, 2, 0, 0], [0x80, 0x05, 0, 0], LINK_STATE_BATTLING);
    for (let i = 0; i < 4; i++) r.s.mem[A.wBattleMonPP + i] = 0;
    scriptDraws(r, [0, 0, 0]);
    r.expected(memory => expectDisabled(memory, 0, 0x11, 1, 105));
    expect(r.s.wEnemyDisabledMove).toBe(0x11); expect(r.s.wEnemyDisabledMoveNumber).toBe(1);
    expect(drawsOf(r.events)).toEqual(['R0', 'R0', 'R0']); expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
  });
  it('enemy Disable reads the player PP, redraws a zero raw byte, and packs slot 1', () => {
    const r = rig(1, 0x56); stageDisable(r, [1, 2, 0, 0], [0, 0x05, 0, 0]);
    for (let i = 0; i < 4; i++) r.s.mem[A.wEnemyMonPP + i] = 0;
    scriptDraws(r, [0, 0, 1, 0]);
    r.expected(memory => expectDisabled(memory, 1, 0x21, 2, 105));
    expect(r.s.wPlayerDisabledMove).toBe(0x21); expect(r.s.wPlayerDisabledMoveNumber).toBe(2);
    expect(r.s.wEnemyDisabledMoveNumber).toBe(0xff); expect(r.s.wEnemyDisabledMove).toBe(0);
    expect(drawsOf(r.events)).toEqual(['R0', 'R0', 'R1', 'R0']);
    expect(r.s.wAnimationType).toBe(3); expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
  });
  it('masked-OR zero fails after one accepted draw and does not draw a duration', () => {
    const r = rig(0, 0x56); stageDisable(r, [1, 0, 0, 0], [0, 0, 0, 0], LINK_STATE_BATTLING);
    scriptDraws(r, [0, 0]);
    r.expected(memory => { memory[A.wNamedObjectIndex] = 1; });
    expect(drawsOf(r.events)).toEqual(['R0', 'R0']);
    expect(r.events).toEqual(['R0', 'R0', 'text:ButItFailedText']);
    expect(r.s.wEnemyDisabledMove).toBe(0); expect(r.s.wNamedObjectIndex).toBe(1);
    expect(r.s.wAnimationType).toBe(91); expect(serviced(r.events)).toBe(0);
  });
  it('all-zero Disable moves throw after the hit draw and before a slot draw', () => {
    const r = rig(0, 0x56); stageDisable(r, [0, 0, 0, 0], [5, 5, 5, 5]); scriptDraws(r, [0]);
    expect(() => r.run()).toThrow(/disable target moves are all zero/);
    expect(drawsOf(r.events)).toEqual(['R0']); expect(r.s.wNamedObjectIndex).toBe(0); expect(r.s.wEnemyDisabledMove).toBe(0);
  });
  it('a PP path with no acceptable slot throws before a slot draw', () => {
    const r = rig(1, 0x56); stageDisable(r, [1, 0, 0, 0], [0, 5, 0, 0]); scriptDraws(r, [0]);
    expect(() => r.run()).toThrow(/disable PP path accepts no slot/);
    expect(drawsOf(r.events)).toEqual(['R0']); expect(r.s.wNamedObjectIndex).toBe(0); expect(r.s.wPlayerDisabledMove).toBe(0);
  });
  it.each([0, 1] as const)('Disable side %i spends the hit draw when the target is already disabled', side => {
    const r = rig(side, 0x56); stageDisable(r, [1, 0, 0, 0], [5, 0, 0, 0], side === 0 ? LINK_STATE_BATTLING : 0);
    if (side === 0) r.s.wEnemyDisabledMove = 0x11; else r.s.wPlayerDisabledMove = 0x11;
    scriptDraws(r, [0]);
    r.expected();
    expect(drawsOf(r.events)).toEqual(['R0']); expect(r.events).toEqual(['R0', 'text:ButItFailedText']);
    expect(r.s.mem[side === 0 ? A.wEnemyDisabledMove : A.wPlayerDisabledMove]).toBe(0x11);
    expect(r.s.wNamedObjectIndex).toBe(0);
  });
  it.each([0, 1] as const)('Disable side %i misses an invulnerable target with no draw', side => {
    const r = rig(side, 0x56); armHit(r); useRealHit();
    if (side === 0) r.s.wEnemyBattleStatus1 |= 0x40; else r.s.wPlayerBattleStatus1 |= 0x40;
    r.expected(memory => { memory[A.wMoveMissed] = 1; be(memory, A.wDamage, 0); });
    expect(drawsOf(r.events)).toEqual([]); expect(serviced(r.events)).toBe(0);
    expect(r.events).toEqual(['text:ButItFailedText']); expect(r.s.wDamage).toBe(0);
  });
  it('zero move Disable still disables and does not write the animation id or type', () => {
    const r = rig(0, 0x56, 10, 40, 0); stageDisable(r, [1, 0, 0, 0], [0, 0, 0, 0]); scriptDraws(r, [0, 0, 0]);
    r.expected(memory => expectDisabled(memory, 0, 0x11, 1, 0));
    expect(r.s.wAnimationType).toBe(91); expect(r.s.wAnimationID).toBe(92); expect(serviced(r.events)).toBe(0);
    expect(r.s.wEnemyDisabledMove).toBe(0x11); expect(r.events[r.events.length - 1]).toBe('text:MoveWasDisabledText');
  });

  describe.each([0, 1] as const)('Splash side %i', side => {
    it('plays the current move and prints No effect', () => {
      const r = rig(side, 0x55);
      r.expected(memory => animBytes(memory, 105));
      expect(serviced(r.events)).toBe(12); expect(r.events).toContain('refresh');
      expect(r.s.wAnimationType).toBe(0); expect(r.s.wAnimationID).toBe(105);
      expect(r.events[r.events.length - 1]).toBe('text:NoEffectText');
    });
    it('zero move resets type, skips refresh, and still prints No effect', () => {
      const r = rig(side, 0x55, 10, 40, 0);
      r.expected(memory => animBytes(memory, 0));
      expect(r.s.wAnimationType).toBe(0); expect(r.s.wAnimationID).toBe(92); expect(serviced(r.events)).toBe(0);
      expect(r.events).toEqual(['text:NoEffectText']);
    });
  });

  function boxText(screen: { at(x: number, y: number): unknown }): string {
    return [12, 13, 14, 15, 16, 17].map(y => Array.from({ length: 18 }, (_, x) => String(screen.at(x + 1, y) ?? ' ')).join('')).join('\n');
  }
  function drivePrinter(r: Rig): { frames: number; held: number; shown: string } {
    const host = new BattleHost<number | void>(r.s, r.video);
    const env: HpEffectEnvironment = { ...r.env, host: {
      printText: function* (key, bindings, options) {
        r.events.push(`text:${key}:${bindings?.nameBuffer ?? ''}`);
        yield* host.printText(key, bindings, options); r.events.push('textDone');
      },
    } };
    host.start(jumpMoveEffect(r.s, 'call', hpEffectHandlers(env)));
    let frames = 0, pressed = false, held = 0, shown = '', last = '';
    while (!host.done && frames < 2500) {
      if (host.video.textBox.isWaitingForInput) {
        const page = boxText(host.video.screen);
        if (page !== last) { shown += (shown ? '\f' : '') + page; last = page; }
      }
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      const marker = r.events.length; r.events.push('pending');
      const kind = host.step(); expect(kind === 'serviced' || kind === 'held').toBe(true);
      r.events[marker] = kind === 'serviced' ? 'S' : 'H'; if (kind === 'held') held++;
      frames++;
    }
    expect(host.done).toBe(true); expect(host.result).toBe(1);
    return { frames, held, shown };
  }
  describe.each([0, 1] as const)('real checkpoint-06b printer side %i', side => {
    it('TransformedText names the species and the acting side', () => {
      const r = rig(side, 0x39); stageTransform(r, true, 'none', false, false);
      const out = drivePrinter(r);
      expect(out.shown).toContain('DITTO'); expect(out.shown).toContain('transformed into');
      expect(out.shown).toContain(side === 0 ? 'PIKA' : 'Enemy FOE');
      expect(r.events.some(event => event.startsWith('text:TransformedText:DITTO'))).toBe(true);
      expect({ ...out, ledger: compact(r.events) }).toMatchSnapshot();
    });
    it('ConvertedTypeText names the target side', () => {
      const r = rig(side, 0x18); stageConversion(r, false, false);
      const out = drivePrinter(r);
      expect(out.shown).toContain('Converted type to');
      expect(out.shown).toContain(side === 0 ? 'Enemy FOE' : 'PIKA');
      expect({ ...out, ledger: compact(r.events) }).toMatchSnapshot();
    });
    it('MimicLearnedMoveText names the copied move', () => {
      const r = rig(side, 0x52); armHit(r, side === 0 ? LINK_STATE_BATTLING : 0); scriptDraws(r, [0, 0]);
      for (let i = 0; i < 4; i++) r.s.mem[(side === 0 ? A.wEnemyMonMoves : A.wBattleMonMoves) + i] = i === 0 ? 1 : 0;
      r.s.wPlayerMoveListIndex = 0; r.s.wEnemyMoveListIndex = 0;
      const out = drivePrinter(r);
      expect(out.shown).toContain('learned'); expect(out.shown).toContain(side === 0 ? 'PIKA' : 'Enemy FOE');
      expect(r.events.some(event => event.startsWith('text:MimicLearnedMoveText:'))).toBe(true);
      const named = r.events.find(event => event.startsWith('text:MimicLearnedMoveText:'))!.split(':')[2];
      expect(named.length).toBeGreaterThan(0); expect(out.shown).toContain(named);
      expect({ ...out, ledger: compact(r.events) }).toMatchSnapshot();
    });
    it('MoveWasDisabledText names the disabled move', () => {
      const r = rig(side, 0x56); stageDisable(r, [1, 0, 0, 0], side === 0 ? [0, 0, 0, 0] : [5, 0, 0, 0], side === 0 ? 0 : 0);
      if (side === 1) for (let i = 0; i < 4; i++) r.s.mem[A.wBattleMonPP + i] = i === 0 ? 5 : 0;
      scriptDraws(r, [0, 0, 0]);
      const out = drivePrinter(r);
      expect(out.shown).toContain('disabled');
      expect(out.shown).toContain(side === 0 ? 'Enemy FOE' : 'PIKA');
      const named = r.events.find(event => event.startsWith('text:MoveWasDisabledText:'))!.split(':')[2];
      expect(named.length).toBeGreaterThan(0); expect(out.shown).toContain(named);
      expect({ ...out, ledger: compact(r.events) }).toMatchSnapshot();
    });
    it('Splash prints No effect', () => {
      const r = rig(side, 0x55);
      const out = drivePrinter(r);
      expect(out.shown).toContain('No effect!');
      expect(r.events.some(event => event.startsWith('text:NoEffectText:'))).toBe(true);
      expect({ ...out, ledger: compact(r.events) }).toMatchSnapshot();
    });
  });
});

// pret effects.asm:1342-1423. DisableEffect never reads the Substitute bit; a doll does not stop the pack.
it('retire-L674: fails if substitute blocks — reject legacy rule', async () => {
  await loadBattleMoveData();
  const r = rig(0, 0x56);
  armHit(r);
  for (let i = 0; i < 4; i++) {
    r.s.mem[A.wEnemyMonMoves + i] = [0, 0, 8, 0][i]!;
    r.s.mem[A.wEnemyMonPP + i] = 0;
    r.s.mem[A.wBattleMonPP + i] = 0;
  }
  r.s.wPlayerDisabledMove = 0;
  r.s.wEnemyDisabledMove = 0;
  r.s.wPlayerDisabledMoveNumber = 0xee;
  r.s.wEnemyDisabledMoveNumber = 0xff;
  r.s.mem[r.t.flags2] |= 0x10;
  scriptDraws(r, [0, 0, 1, 2, 0]);
  r.run();
  expect(r.s.wEnemyDisabledMove).toBe(0x31);
  expect(r.s.wEnemyDisabledMoveNumber).toBe(8);
  expect(r.s.mem[r.t.flags2] & 0x10).toBe(0x10);
  expect(r.events[r.events.length - 1]).toBe('text:MoveWasDisabledText');
});

// pret move_effects/conversion.asm:16-21. Both live type bytes are copied. There is no one-type overlay.
it('retire-L1184: partial conversion: only one type overridden — reject legacy rule', () => {
  for (const side of [0, 1] as const) {
    const r = rig(side, 0x18);
    r.s.wPlayerBattleStatus1 = 0x01;
    r.s.wEnemyBattleStatus1 = 0x02;
    r.s.wBattleMonType1 = 0x01;
    r.s.wBattleMonType2 = 0x02;
    r.s.wBattleMonCatchRate = 0x66;
    r.s.wEnemyMonType1 = 0x14;
    r.s.wEnemyMonType2 = 0x17;
    r.s.wEnemyMonCatchRate = 0x77;
    r.run();
    if (side === 0) {
      expect(r.s.wBattleMonType1).toBe(0x14);
      expect(r.s.wBattleMonType2).toBe(0x17);
    } else {
      expect(r.s.wEnemyMonType1).toBe(0x01);
      expect(r.s.wEnemyMonType2).toBe(0x02);
    }
    expect(r.s.wBattleMonCatchRate).toBe(0x66);
    expect(r.s.wEnemyMonCatchRate).toBe(0x77);
  }
});
