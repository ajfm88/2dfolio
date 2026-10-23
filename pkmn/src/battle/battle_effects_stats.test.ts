import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, encodeText } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { bindBattleScreen } from './battle_screen';
import { jumpMoveEffect } from './battle_effects';
import { loadStatEffectData, printStatText, monsStatsFellText, statModifierUpEffect, statEffectHandlers, type StatEffectEnvironment } from './battle_effects_stats';
import { handleBuildingRage } from './battle_execute_helpers';
import { moveNameBinding } from './battle_move_data';
import * as random from './battle_random';
import * as hit from './battle_hit';
import * as loaders from './battle_loaders';
import * as arithmetic from './battle_arithmetic';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { isHeld } from '../input';
import { TextScreen } from '../text/text_printer';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';

const raw: number[] = JSON.parse(readFileSync(resolve(__dirname, '../../data/stat_mod_text.json'), 'utf8')).bytes;
const names = ['ATTACK', 'DEFENSE', 'SPEED', 'SPECIAL', 'ACCURACY', 'EVADE'];
const asmContext = { label: 'MonsStatsFellText', row: 14, column: 1 };
beforeAll(async () => { await loadStatEffectData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); vi.mocked(isHeld).mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

function cells(player: boolean) {
  return { mods: player ? A.wPlayerMonStatMods : A.wEnemyMonStatMods,
    stats: player ? A.wBattleMonAttack : A.wEnemyMonAttack,
    original: (player ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3,
    flags1: player ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1,
    flags2: player ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2,
    status: player ? A.wBattleMonStatus : A.wEnemyMonStatus,
    minimized: player ? A.wPlayerMonMinimized : A.wEnemyMonMinimized,
    move: player ? A.wPlayerMoveNum : A.wEnemyMoveNum };
}
function nameBytes(index: number): number[] {
  const offset = names.slice(0, index).reduce((sum, name) => sum + name.length + 1, 0);
  return raw.slice(offset, offset + 10);
}
function rig(side: 0 | 1, id: number, draws: readonly number[] = []) {
  vi.restoreAllMocks();
  const s = new BattleState(), video = new BattleMenuScreen(), events: string[] = [];
  bindBattleScreen(s, video.screen); s.hWhoseTurn = side;
  s.wPlayerMoveNum = s.wEnemyMoveNum = 14; s.wPlayerMoveEffect = s.wEnemyMoveEffect = id;
  s.wPlayerMoveAccuracy = s.wEnemyMoveAccuracy = 255; s.wAnimationType = 99;
  const u = cells(side === 0), t = cells(side !== 0);
  for (const c of [u, t]) {
    s.mem.fill(7, c.mods, c.mods + 8);
    for (let i = 0; i < 4; i++) { s.writeBE(c.stats + i * 2, 200); s.writeBE(c.original + i * 2, 160 + 20 * i); }
  }
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  s.mem.fill(0xaa, A.wStringBuffer, A.wStringBuffer + 11);
  let index = 0;
  const observer = { draw: (_index: number) => {}, text: (_key: string) => {}, animation: () => {}, hide: () => {}, show: () => {} };
  vi.spyOn(random, 'battleRandom').mockImplementation(state => {
    expect(state).toBe(s); observer.draw(index);
    if (index >= draws.length) throw new Error('unexpected BattleRandom');
    const value = draws[index++]; events.push(`R${value}`); return value;
  });
  const originalHit = hit.moveHitTest;
  vi.spyOn(hit, 'moveHitTest').mockImplementation(state => { events.push('hit'); return originalHit(state); });
  const badge = loaders.applyBadgeStatBoosts, quarter = loaders.quarterSpeedDueToParalysis, halve = loaders.halveAttackDueToBurn;
  vi.spyOn(loaders, 'applyBadgeStatBoosts').mockImplementation(state => { events.push('badge'); badge(state); });
  vi.spyOn(loaders, 'quarterSpeedDueToParalysis').mockImplementation(state => { events.push('quarter'); quarter(state); });
  vi.spyOn(loaders, 'halveAttackDueToBurn').mockImplementation(state => { events.push('halve'); halve(state); });
  const env: StatEffectEnvironment = {
    host: { printText: function* (key, bindings, options) {
      observer.text(key); expect(getTextPrograms()[key], key).toBeDefined();
      events.push(`text:${key}`);
      const handler = options?.asm?.[key];
      if (handler) events.push(`suffix:${handler({ ...asmContext, label: key })}:${bindings?.stringBuffer}`);
    } },
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.wAnimationType}`); observer.animation(); },
    hideSubstitute: function* () { events.push('hide'); observer.hide(); },
    reshowSubstitute: function* () { events.push('show'); observer.show(); },
  };
  const registry = statEffectHandlers(env);
  const run = (program: Program<number | void> = jumpMoveEffect(s, 'call', registry)) => {
    const out = finish(program, frame => { events.push(frame === 'serviced' ? 'S' : frame); if (frame === 'serviced') video.vblank(); });
    expect(index).toBe(draws.length);
    const ledger: string[] = [];
    for (const e of events) {
      const last = ledger[ledger.length - 1] ?? '';
      if (e === 'S' && /^S\d*$/.test(last)) ledger[ledger.length - 1] = `S${Number(last.slice(1) || 1) + 1}`;
      else ledger.push(e);
    }
    return { ...out, ledger };
  };
  const expected = (ledger: string[], frames: number) => {
    const out = run(); expect(out.result).toBe(1); expect(out.frames).toEqual(Array(frames).fill('serviced')); expect(out.ledger).toEqual(ledger);
  };
  const text = (up: boolean, stat = 0, double = false) => [`text:MonsStats${up ? 'Rose' : 'Fell'}Text`, `suffix:${double ? 'Greatly' : ''}${up ? 'Rose' : 'Fell'}Text:${names[stat]}`];
  return { s, u, t, video, events, observer, env, registry, run, expected, text };
}

it('factory registers exactly the two wrapper labels without executing them', () => {
  const r = rig(0, 10); expect(Object.keys(r.registry)).toEqual(['StatModifierUpEffect', 'StatModifierDownEffect', 'HazeEffect', 'MistEffect', 'FocusEnergyEffect', 'ReflectLightScreenEffect']); expect(r.events).toEqual([]);
});

describe.each([0, 1] as const)('stat effects side %i', side => {
  describe.each([[true, false, false], [true, true, false], [false, false, false],
    [false, true, false], [false, false, true]] as const)('every index up=%s double=%s secondary=%s', (up, double, secondary) => {
    it.each(secondary ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5])('index %i has the exact ten-byte name, stage, recalculation and ordered ledger', stat => {
      const id = (up ? double ? 0x32 : 0x0a : secondary ? 0x44 : double ? 0x3a : 0x12) + stat;
      const r = rig(side, id, up ? [] : side === 0 ? [0] : [64, 0]), c = up ? r.u : r.t;
      const before = r.s.mem.slice(c.stats, c.stats + 8);
      const badge = up ? side === 0 : side === 1;
      const prefix = up ? [] : [...(side === 1 ? ['R64'] : []), ...(secondary ? [] : ['hit']), 'R0'];
      r.expected([...prefix, ...(secondary ? [] : [`anim:14:${up ? 0 : side === 0 ? 6 : 3}`, 'S12']),
        ...(badge ? ['badge'] : []), ...r.text(up, stat, double), 'quarter', 'halve'], secondary ? 0 : 12);
      expect(r.s.mem[c.mods + stat]).toBe(up ? double ? 9 : 8 : double ? 5 : 6);
      if (stat < 4) expect(r.s.readBE(c.stats + stat * 2)).toBe(Math.floor((160 + stat * 20) * (up ? double ? 2 : 1.5 : double ? 0.5 : 0.66)));
      else expect(r.s.mem.slice(c.stats, c.stats + 8)).toEqual(before);
      expect([...r.s.mem.slice(A.wStringBuffer, A.wStringBuffer + 10)]).toEqual(nameBytes(stat));
      expect(r.s.mem[A.wStringBuffer + 10]).toBe(0xaa); expect(moveNameBinding(r.s)).toBe(names[stat]);
      expect(r.s.mem[(up ? r.t : r.u).mods + stat]).toBe(7);
    });
  });

  it.each([0x0a, 0x32])('up id%i stage13 fails without a stage write, animation, badge or penalty', id => {
    const r = rig(side, id); r.s.mem[r.u.mods] = 13;
    const writes: number[] = []; watchStage(r.s, r.u.mods, writes);
    r.expected(['text:NothingHappenedText'], 0); expect(writes).toEqual([]); expect(r.s.mem[r.u.mods]).toBe(13);
    expect(r.s.mem[A.wStringBuffer]).toBe(0xaa);
  });
  it.each([0x0a, 0x32])('up id%i stage12 caps at13 and succeeds', id => {
    const r = rig(side, id); r.s.mem[r.u.mods] = 12;
    r.expected(['anim:14:0', 'S12', ...(side === 0 ? ['badge'] : []), ...r.text(true, 0, id === 0x32), 'quarter', 'halve'], 12);
    expect(r.s.mem[r.u.mods]).toBe(13); expect(r.s.readBE(r.u.stats)).toBe(640);
  });
  it.each([0x0a, 0x32])('up id%i writes stage before testing exactly999, then rolls back only one', id => {
    const r = rig(side, id); r.s.writeBE(r.u.stats, 999); const writes: number[] = [], reads: number[] = [];
    watchStage(r.s, r.u.mods, writes, r.u.stats, reads);
    r.expected(['text:NothingHappenedText'], 0);
    expect(writes).toEqual(id === 0x32 ? [9, 8] : [8, 7]); expect(reads[0]).toBe(id === 0x32 ? 9 : 8);
    expect(r.s.mem[r.u.mods]).toBe(id === 0x32 ? 8 : 7); expect(r.s.readBE(r.u.stats)).toBe(999);
  });
  it.each([998, 1000, 743])('up current %i is not exactly999 and recalculates from unmodified', current => {
    const r = rig(side, 10); r.s.writeBE(r.u.stats, current); r.run(); expect(r.s.readBE(r.u.stats)).toBe(240); expect(r.s.mem[r.u.mods]).toBe(8);
  });
  it('up caps the low-word result at999 and writes only the selected BE word', () => {
    const r = rig(side, 10); r.s.writeBE(r.u.original, 800); const multiply = vi.spyOn(arithmetic, 'multiply'), divide = vi.spyOn(arithmetic, 'divide');
    r.run(); expect(r.s.readBE(r.u.stats)).toBe(999); expect(r.s.readBE(r.u.stats + 2)).toBe(200);
    expect(multiply).toHaveBeenCalledTimes(1); expect(divide).toHaveBeenCalledTimes(1); expect(divide.mock.calls[0][1]).toBe(4);
  });
  it('recalculation uses only quotient bytes2/3 before the up cap', () => {
    const r = rig(side, 10); r.s.writeBE(r.u.original, 43734); r.run(); // *1.5=65601; low word=65.
    expect(r.s.readBE(r.u.stats)).toBe(65);
  });

  it.each([0x12, 0x3a, 0x44])('down id%i stage1 fails without a stage write or penalty', id => {
    const r = rig(side, id, side === 0 ? [0] : [64, 0]); r.s.mem[r.t.mods] = 1;
    const writes: number[] = []; watchStage(r.s, r.t.mods, writes);
    r.expected([...(side === 1 ? ['R64'] : []), ...(id === 0x44 ? [] : ['hit']), 'R0', ...(id === 0x44 ? [] : ['text:NothingHappenedText'])], 0);
    expect(writes).toEqual([]); expect(r.s.mem[r.t.mods]).toBe(1);
  });
  it.each([0x12, 0x3a, 0x44])('down id%i stat1 rollback is one stage only', id => {
    const r = rig(side, id, side === 0 ? [0] : [64, 0]); r.s.writeBE(r.t.stats, 1);
    const writes: number[] = []; watchStage(r.s, r.t.mods, writes);
    r.expected([...(side === 1 ? ['R64'] : []), ...(id === 0x44 ? [] : ['hit']), 'R0', ...(id === 0x44 ? [] : ['text:NothingHappenedText'])], 0);
    expect(writes).toEqual(id === 0x3a ? [5, 6] : [6, 7]); expect(r.s.readBE(r.t.stats)).toBe(1);
  });
  it.each([0x12, 0x3a, 0x44])('down id%i stat257 is not1 and recalculates from unmodified', id => {
    const r = rig(side, id, side === 0 ? [0] : [64, 0]); r.s.writeBE(r.t.stats, 257); r.run();
    expect(r.s.readBE(r.t.stats)).toBe(id === 0x3a ? 80 : 105);
  });
  it('double-down at stage2 floors its stage and zero quotient to1', () => {
    const r = rig(side, 0x3a, side === 0 ? [0] : [64, 0]); r.s.mem[r.t.mods] = 2; r.s.writeBE(r.t.original, 1); r.run();
    expect(r.s.mem[r.t.mods]).toBe(1); expect(r.s.readBE(r.t.stats)).toBe(1);
  });
  it('secondary subtracts one stage even when id exceeds the double-down threshold', () => {
    const r = rig(side, 0x44, side === 0 ? [84] : [64, 84]); r.run(); expect(r.s.mem[r.t.mods]).toBe(6);
  });
  it('secondary chance85 fails silently, with no hit/stat/write/text/frames', () => {
    const r = rig(side, 0x44, side === 0 ? [85] : [64, 85]); r.expected([...(side === 1 ? ['R64'] : []), 'R85'], 0);
    expect(r.s.mem[r.t.mods]).toBe(7);
  });
  it.each([0x12, 0x44])('Substitute id%i precedes hit/secondary chance (after enemy off-link roll)', id => {
    const r = rig(side, id, side === 0 ? [] : [64]); r.s.mem[r.t.flags2] = 0x10;
    r.expected([...(side === 1 ? ['R64'] : []), ...(id === 0x44 ? [] : ['text:ButItFailedText'])], 0);
  });
  it.each([0, 1])('primary Substitute failure MoveDidntMiss%i uses conditional printer, no wait', moveDidntMiss => {
    const r = rig(side, 0x12, side === 0 ? [] : [64]); r.s.wMoveDidntMiss = moveDidntMiss; r.s.mem[r.t.flags2] = 0x10;
    r.expected([...(side === 1 ? ['R64'] : []), ...(moveDidntMiss ? [] : ['text:ButItFailedText'])], 0);
  });
  it('Mist blocks primary inside real HIT before accuracy RNG', () => {
    const r = rig(side, 0x12, side === 0 ? [] : [64]); r.s.mem[r.t.flags2] = 2;
    r.expected([...(side === 1 ? ['R64'] : []), 'hit', 'text:ButItFailedText'], 0); expect(r.s.wMoveMissed).toBe(1);
  });
  it('secondary bypasses Mist and INVULNERABLE, with no HIT', () => {
    const r = rig(side, 0x44, side === 0 ? [0] : [64, 0]); r.s.mem[r.t.flags2] = 2; r.s.mem[r.t.flags1] = 0x40;
    r.expected([...(side === 1 ? ['R64'] : []), 'R0', ...(side === 1 ? ['badge'] : []), ...r.text(false), 'quarter', 'halve'], 0);
    expect(r.s.mem[r.t.mods]).toBe(6);
  });
  it('primary INVULNERABLE fails through real HIT without accuracy RNG', () => {
    const r = rig(side, 0x12, side === 0 ? [] : [64]); r.s.mem[r.t.flags1] = 0x40;
    r.expected([...(side === 1 ? ['R64'] : []), 'hit', 'text:ButItFailedText'], 0);
  });
  it('post-HIT INVULNERABLE check still runs when HIT returns a successful result', () => {
    const r = rig(side, 0x12, side === 0 ? [] : [64]);
    vi.mocked(hit.moveHitTest).mockImplementation(() => { r.events.push('hit'); r.s.mem[r.t.flags1] = 0x40; return { z: false, carry: true }; });
    r.expected([...(side === 1 ? ['R64'] : []), 'hit', 'text:ButItFailedText'], 0);
  });
  it.each([0, 1])('primary accuracy miss MoveDidntMiss%i uses conditional printer', moveDidntMiss => {
    const r = rig(side, 0x12, side === 0 ? [255] : [64, 255]); r.s.wMoveDidntMiss = moveDidntMiss;
    r.expected([...(side === 1 ? ['R64'] : []), 'hit', 'R255', ...(moveDidntMiss ? [] : ['text:ButItFailedText'])], 0);
  });
  it.each([false, true])('Minimize doll=%s hides user only, copies name before ports, marks after refresh then reshow', doll => {
    const r = rig(side, 0x0f); r.s.mem[r.u.move] = 0x6b; r.s.mem[r.u.flags2] = doll ? 0x10 : 0; r.s.mem[r.t.flags2] = doll ? 0 : 0x10;
    r.observer.hide = () => { expect(moveNameBinding(r.s)).toBe('EVADE'); expect(r.s.mem[r.u.minimized]).toBe(0); };
    r.observer.animation = () => expect(r.s.mem[r.u.minimized]).toBe(0);
    r.observer.show = () => expect(r.s.mem[r.u.minimized]).toBe(1);
    r.expected([...(doll ? ['hide'] : []), 'anim:107:0', 'S12', ...(doll ? ['show'] : []), ...(side === 0 ? ['badge'] : []), ...r.text(true, 5), 'quarter', 'halve'], 12);
    expect(r.s.mem[r.u.minimized]).toBe(1); expect(r.s.mem[r.t.minimized]).toBe(0);
  });
  it('ordinary stat-up does not hide a doll or set Minimized', () => {
    const r = rig(side, 10); r.s.mem[r.u.flags2] = 0x10; r.run(); expect(r.events).not.toContain('hide'); expect(r.s.mem[r.u.minimized]).toBe(0);
  });
  it.each([true, false])('badge side asymmetry and both target penalties after up=%s text', up => {
    const r = rig(side, up ? 10 : 0x12, up ? [] : side === 0 ? [0] : [64, 0]); r.s.wObtainedBadges = 0x55;
    r.s.mem[r.t.status] = 0x50; r.observer.text = key => {
      if (!key.startsWith('MonsStats')) return;
      expect(r.s.readBE(r.t.stats + 4)).toBe(side === 1 && !up ? 225 : 200);
      expect(r.events).not.toContain('quarter'); expect(r.events).not.toContain('halve');
    };
    r.run();
    expect(r.events.slice(-2)).toEqual(['quarter', 'halve']);
    expect(r.s.readBE(A.wBattleMonAttack)).toBe(side === 0 ? up ? 270 : 200 : up ? 100 : 59);
    expect(r.s.readBE(r.t.stats + 4)).toBe(side === 1 && !up ? 56 : 50);
    expect(r.s.hWhoseTurn).toBe(side);
  });
  it.each([true, false])('zero current move skips refresh on up=%s (up still resets type)', up => {
    const r = rig(side, up ? 10 : 0x12, up ? [] : side === 0 ? [0] : [64, 0]); r.s.mem[r.u.move] = 0;
    r.expected([...(up ? [] : [...(side === 1 ? ['R64'] : []), 'hit', 'R0']), ...((up ? side === 0 : side === 1) ? ['badge'] : []), ...r.text(up), 'quarter', 'halve'], 0);
    expect(r.s.wAnimationType).toBe(up ? 0 : 99);
  });
  it.each([true, false])('text_asm reads the live effect on up=%s', up => {
    const r = rig(side, up ? 10 : 0x12, up ? [] : side === 0 ? [0] : [64, 0]);
    r.observer.text = key => { if (key.startsWith('MonsStats')) r.s.mem[r.u.move + 1] = up ? 0x32 : 0x3a; };
    r.run(); expect(r.events).toContain(`suffix:Greatly${up ? 'Rose' : 'Fell'}Text:ATTACK`);
  });
  it('Rage uses the real direct stat-up with flipped turn, zero move, Rose, badges and original-attacker penalties', () => {
    const r = rig(side, 10); r.s.mem[r.t.flags2] = 0x40; r.s.mem[r.u.status] = 0x50; r.s.wObtainedBadges = 0x55;
    r.observer.text = key => {
      expect(r.s.hWhoseTurn).toBe(side ^ 1);
      if (key === 'BuildingRageText') { expect(r.s.mem[r.t.move]).toBe(0); expect(r.s.mem[r.t.move + 1]).toBe(10); }
    };
    const out = r.run(handleBuildingRage(r.s, r.env.host, { ...r.env, statModifierUpEffect: s => statModifierUpEffect(s, r.env) }));
    expect(out.frames).toEqual([]); expect(out.ledger).toEqual(['text:BuildingRageText', ...(side === 1 ? ['badge'] : []), ...r.text(true), 'quarter', 'halve']);
    expect([r.s.hWhoseTurn, r.s.wAnimationType, r.s.mem[r.t.move], r.s.mem[r.t.move + 1], r.s.mem[r.t.mods]]).toEqual([side, 0, 99, 0, 8]);
    expect(r.s.readBE(r.t.stats)).toBe(side === 1 ? 270 : 240); expect(r.s.readBE(r.u.stats)).toBe(100); expect(r.s.readBE(r.u.stats + 4)).toBe(50);
  });
  it.each([false, true])('Rage gate max=%s returns before flip/stat-up/text', max => {
    const r = rig(side, 10); r.s.mem[r.t.flags2] = max ? 0x40 : 0; r.s.mem[r.t.mods] = max ? 13 : 7;
    const before = r.s.mem.slice(); const statUp = vi.fn(function* () {});
    const out = r.run(handleBuildingRage(r.s, r.env.host, { ...r.env, statModifierUpEffect: statUp }));
    expect(out.ledger).toEqual([]); expect(out.frames).toEqual([]); expect(statUp).not.toHaveBeenCalled(); expect(r.s.mem).toEqual(before);
  });
});

// Observe actual WRAM assignments, including same-value writes and transient stages at stat reads.
function watchStage(s: BattleState, address: number, writes: number[], stat?: number, reads: number[] = []): void {
  const memory = s.mem;
  Object.defineProperty(s, 'mem', { value: new Proxy(memory, {
    get(target, key) {
      if (stat !== undefined && (key === String(stat) || key === String(stat + 1))) reads.push(target[address]);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value: number) { if (key === String(address)) writes.push(value); return Reflect.set(target, key, value, target); },
  }) });
}

describe('enemy off-link draw', () => {
  it.each([0x12, 0x44])('id%i roll63 fails before Substitute/HIT/chance and remains a primary-only printer', id => {
    const r = rig(1, id, [63]); r.s.mem[r.t.flags2] = 0x10;
    r.expected(['R63', ...(id === 0x44 ? [] : ['text:ButItFailedText'])], 0);
  });
  it.each([0x12, 0x44])('id%i link omits off-link roll and consumes only accuracy or chance', id => {
    const r = rig(1, id, [0]); r.s.wLinkState = 4;
    r.expected([...(id === 0x44 ? [] : ['hit']), 'R0', ...(id === 0x44 ? [] : ['anim:14:3', 'S12']), 'badge', ...r.text(false), 'quarter', 'halve'], id === 0x44 ? 0 : 12);
  });
});

it.each([0x19, 0x1a, 0x43, 0x44])('fell suffix boundary id%i reads current side/effect at invocation', id => {
  const r = rig(0, 0x12), handler = monsStatsFellText(r.s);
  r.s.wPlayerMoveEffect = id; expect(handler(asmContext)).toBe(id < 0x1a || id >= 0x44 ? 'FellText' : 'GreatlyFellText');
  r.s.hWhoseTurn = 1; r.s.wEnemyMoveEffect = id; expect(handler(asmContext)).toBe(id < 0x1a || id >= 0x44 ? 'FellText' : 'GreatlyFellText');
});

it.each([0, 1, 2, 3, 4, 5])('PrintStatText index%i copies ten bytes without stopping at terminator', index => {
  const r = rig(0, 10); printStatText(r.s, index + 1);
  expect([...r.s.mem.slice(A.wStringBuffer, A.wStringBuffer + 10)]).toEqual(nameBytes(index));
  expect(r.s.mem[A.wStringBuffer + 10]).toBe(0xaa);
  if (index === 5) expect([...r.s.mem.slice(A.wStringBuffer + 6, A.wStringBuffer + 10)]).toEqual([25, 100, 28, 100]);
});

// Full PrintText ledgers: committed programs, real actor/string bindings and text_asm continuations.
describe.each([0, 1] as const)('real stat printer side %i', side => {
  it.each(['rose', 'greatlyRose', 'fell', 'greatlyFell', 'secondary', 'upLimit', 'downLimit',
    'miss', 'minimize', 'rage'] as const)('%s includes all printer and refresh frames', scenario => {
    const up = ['rose', 'greatlyRose', 'upLimit', 'minimize', 'rage'].includes(scenario);
    const id = scenario === 'greatlyRose' ? 0x32 : scenario === 'greatlyFell' ? 0x3a : scenario === 'minimize' ? 0x0f
      : up ? 0x0a : scenario === 'secondary' ? 0x44 : 0x12;
    const r = rig(side, id, up ? [] : side === 0 ? [scenario === 'miss' ? 255 : 0] : [64, scenario === 'miss' ? 255 : 0]);
    if (scenario === 'upLimit') r.s.mem[r.u.mods] = 13;
    if (scenario === 'downLimit') r.s.mem[r.t.mods] = 1;
    if (scenario === 'minimize') { r.s.mem[r.u.move] = 0x6b; r.s.mem[r.u.flags2] = 0x10; }
    if (scenario === 'rage') { r.s.mem[r.t.flags2] = 0x40; r.s.mem[r.u.status] = 0x50; r.s.wObtainedBadges = 0x55; }
    const host = new BattleHost<number | void>(r.s, r.video);
    const env: StatEffectEnvironment = { ...r.env, host: {
      printText: function* (key, bindings, options) {
        r.events.push(`text:${key}:${r.s.hWhoseTurn}`);
        // Log which suffix is actually selected at the real runner's text_asm operation.
        const original = options?.asm?.[key];
        const asm = original ? { [key]: (context: Parameters<typeof original>[0]) => {
          const suffix = original(context); r.events.push(`suffix:${suffix}:${bindings?.stringBuffer}`); return suffix;
        } } : undefined;
        yield* host.printText(key, bindings, { ...options, asm }); r.events.push('textDone');
      },
    } };
    host.start(scenario === 'rage'
      ? handleBuildingRage(r.s, env.host, { ...env, statModifierUpEffect: s => statModifierUpEffect(s, env) })
      : jumpMoveEffect(r.s, 'call', statEffectHandlers(env)));
    let frames = 0, pressed = false;
    while (!host.done && frames < 1500) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      r.events.push('S'); expect(host.step()).toBe('serviced'); frames++;
    }
    expect(host.done).toBe(true);
    expect(vi.mocked(random.battleRandom)).toHaveBeenCalledTimes(up ? 0 : side === 0 ? 1 : 2);
    const ledger: string[] = [];
    for (const event of r.events) {
      const last = ledger[ledger.length - 1] ?? '';
      if (event === 'S' && /^S\d*$/.test(last)) ledger[ledger.length - 1] = `S${Number(last.slice(1) || 1) + 1}`;
      else ledger.push(event);
    }
    expect({ frames, ledger, turn: r.s.hWhoseTurn, type: r.s.wAnimationType,
      playerStats: [...r.s.mem.slice(A.wBattleMonAttack, A.wBattleMonAttack + 8)],
      enemyStats: [...r.s.mem.slice(A.wEnemyMonAttack, A.wEnemyMonAttack + 8)] }).toMatchSnapshot();
  });
  it.each([true, false])('greatly text_pause is exactly30 frames unless A/B held (up=%s)', up => {
    function measure(held: boolean) {
      const r = rig(side, up ? 0x32 : 0x3a, up ? [] : side === 0 ? [0] : [64, 0]);
      const delay = TextScreen.prototype.delay; let pauseFrames = 0;
      vi.spyOn(TextScreen.prototype, 'delay').mockImplementation(function* (this: TextScreen, count: number) {
        for (const frame of delay.call(this, count)) { if (count === 30) pauseFrames++; yield frame; }
      });
      vi.mocked(isHeld).mockReturnValue(false);
      const host = new BattleHost<number>(r.s, r.video);
      host.start(jumpMoveEffect(r.s, 'call', statEffectHandlers({ ...r.env, host })));
      let frames = 0, pressed = false;
      while (!host.done && frames < 1500) {
        pressed = host.video.textBox.isWaitingForInput ? !pressed : held;
        vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
        host.step(); frames++;
      }
      expect(host.done).toBe(true); return pauseFrames;
    }
    // Count actual yields in the real 30-frame delay, independent of held-B glyph/scroll speed.
    expect([measure(false), measure(true)]).toEqual([30, 0]);
  });
});
