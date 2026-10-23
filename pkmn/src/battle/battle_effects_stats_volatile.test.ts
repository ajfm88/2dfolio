import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, PARTYMON_STRUCT_LENGTH, encodeText } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { bindBattleScreen } from './battle_screen';
import { jumpMoveEffect, MOVE_EFFECT_POINTERS } from './battle_effects';
import { statEffectHandlers, type StatEffectEnvironment } from './battle_effects_stats';
import * as random from './battle_random';
import * as hit from './battle_hit';
import * as loaders from './battle_loaders';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { TextScreen } from '../text/text_printer';
import { isHeld } from '../input';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); vi.mocked(isHeld).mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

const player = { mods: A.wPlayerMonStatMods, stats: A.wBattleMonAttack, original: A.wPlayerMonUnmodifiedLevel + 3,
  status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2, flags3: A.wPlayerBattleStatus3,
  selected: A.wPlayerSelectedMove, move: A.wPlayerMoveNum };
const enemy = { mods: A.wEnemyMonStatMods, stats: A.wEnemyMonAttack, original: A.wEnemyMonUnmodifiedLevel + 3,
  status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2, flags3: A.wEnemyBattleStatus3,
  selected: A.wEnemySelectedMove, move: A.wEnemyMoveNum };
const cases = [
  { name: 'Mist', id: 0x2e, move: 54, block: 'flags2', bit: 2, wait: 0, text: 'ShroudedInMistText' },
  { name: 'Focus Energy', id: 0x2f, move: 116, block: 'flags2', bit: 4, wait: 50, text: 'GettingPumpedText' },
  { name: 'Light Screen', id: 0x40, move: 113, block: 'flags3', bit: 2, wait: 50, text: 'LightScreenProtectedText' },
  { name: 'Reflect', id: 0x41, move: 115, block: 'flags3', bit: 4, wait: 50, text: 'ReflectGainedArmorText' },
] as const;

function rig(side: 0 | 1, id = 0x19, move = 114) {
  vi.restoreAllMocks();
  const s = new BattleState(), video = new BattleMenuScreen(), events: string[] = [];
  bindBattleScreen(s, video.screen);
  for (let i = 0; i < s.mem.length; i++) s.mem[i] = (i * 73 + (i >> 8) * 29 + 37) & 255;
  s.hWhoseTurn = side; s.wPlayerMoveEffect = s.wEnemyMoveEffect = id;
  s.wPlayerMoveNum = s.wEnemyMoveNum = move; s.wAnimationType = 91; s.wAnimationID = 92;
  s.wObtainedBadges = 0x55; s.wLinkState = 0;
  s.wPlayerMonNumber = 3; s.wEnemyMonPartyPos = 2;
  s.mem.set([1, 2, 3, 4, 5, 6, 8, 9], player.mods);
  s.mem.set([10, 11, 12, 13, 14, 15, 16, 17], enemy.mods);
  // Distinct Level/HP prefix bytes catch a reset copying from three or two bytes too early.
  s.mem.set([0x31, 0x32, 0x33, 1, 71, 2, 82, 3, 93, 4, 104], player.original - 3);
  s.mem.set([0x41, 0x42, 0x43, 5, 115, 6, 126, 7, 137, 8, 148], enemy.original - 3);
  s.mem.set([0, 111, 0, 112, 0, 113, 0, 114], player.stats);
  s.mem.set([0, 121, 0, 122, 0, 123, 0, 124], enemy.stats);
  s.wBattleMonStatus = 0x50; s.wEnemyMonStatus = 0x28;
  s.mem.set([0xfe, 0xff, 0xff], player.flags1); s.mem.set([0xdf, 0xf7, 0x7f], enemy.flags1);
  s.wPlayerSelectedMove = 37; s.wEnemySelectedMove = 49;
  s.wPlayerConfusedCounter = 0x61; s.wEnemyConfusedCounter = 0x62;
  s.wPlayerToxicCounter = 0x63; s.wEnemyToxicCounter = 0x64;
  s.wPlayerMonMinimized = 0x65; s.wEnemyMonMinimized = 0x66;
  s.wPlayerDisabledMove = 0x73; s.wEnemyDisabledMove = 0x74;
  s.wPlayerDisabledMoveNumber = 0x75; s.wEnemyDisabledMoveNumber = 0x76;
  s.wMoveDidntMiss = 1;
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const forbidden = (name: string) => () => { throw new Error(`unexpected ${name}`); };
  vi.spyOn(random, 'battleRandom').mockImplementation(forbidden('BattleRandom'));
  vi.spyOn(hit, 'moveHitTest').mockImplementation(forbidden('MoveHitTest'));
  vi.spyOn(loaders, 'applyBadgeStatBoosts').mockImplementation(forbidden('badges'));
  vi.spyOn(loaders, 'quarterSpeedDueToParalysis').mockImplementation(forbidden('paralysis penalty'));
  vi.spyOn(loaders, 'halveAttackDueToBurn').mockImplementation(forbidden('burn penalty'));
  const observer = { animation: () => {}, text: (_key: string) => {} };
  const env: StatEffectEnvironment = {
    host: { printText: function* (key) { observer.text(key); expect(getTextPrograms()[key], key).toBeDefined(); events.push(`text:${key}`); } },
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.wAnimationType}`); observer.animation(); },
    hideSubstitute: function* () { throw new Error('unexpected hide'); },
    reshowSubstitute: function* () { throw new Error('unexpected reshow'); },
  };
  const u = side === 0 ? player : enemy, t = side === 0 ? enemy : player;
  const run = (program: Program<number | void> = jumpMoveEffect(s, 'call', statEffectHandlers(env))) => {
    const out = finish(program, frame => { events.push(frame === 'serviced' ? 'S' : frame); if (frame === 'serviced') video.vblank(); });
    return { ...out, ledger: compact(events) };
  };
  const expected = (ledger: string[], frames: number) => {
    const out = run(); expect(out.result).toBe(1); expect(out.frames).toEqual(Array(frames).fill('serviced')); expect(out.ledger).toEqual(ledger);
  };
  return { s, u, t, video, events, env, observer, run, expected };
}
function compact(events: readonly string[]): string[] {
  const ledger: string[] = [];
  for (const event of events) {
    const last = ledger[ledger.length - 1] ?? '';
    if (event === 'S' && /^S\d*$/.test(last)) ledger[ledger.length - 1] = `S${Number(last.slice(1) || 1) + 1}`;
    else ledger.push(event);
  }
  return ledger;
}
function expectMemory(actual: Uint8Array, expected: Uint8Array): void {
  const differences: { address: string; actual: number; expected: number }[] = [];
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) differences.push({ address: i.toString(16), actual: actual[i], expected: expected[i] });
  }
  expect(differences).toEqual([]);
}
function hazeMap(before: Uint8Array, side: 0 | 1, animated = true): Uint8Array {
  const expected = before.slice(), t = side === 0 ? enemy : player;
  expected.fill(7, player.mods, player.mods + 8); expected.fill(7, enemy.mods, enemy.mods + 8);
  expected.set(before.slice(player.original, player.original + 8), player.stats);
  expected.set(before.slice(enemy.original, enemy.original + 8), enemy.stats);
  expected[t.status] = 0;
  if ((before[t.status] & 0x27) !== 0) expected[t.selected] = 255;
  for (const addr of [A.wPlayerDisabledMove, A.wEnemyDisabledMove, A.wPlayerDisabledMoveNumber, A.wEnemyDisabledMoveNumber]) expected[addr] = 0;
  expected[player.flags1] = before[player.flags1] & 0x7f; expected[enemy.flags1] = before[enemy.flags1] & 0x7f;
  expected[player.flags2] = before[player.flags2] & 0x78; expected[enemy.flags2] = before[enemy.flags2] & 0x78;
  expected[player.flags3] = before[player.flags3] & 0xf8; expected[enemy.flags3] = before[enemy.flags3] & 0xf8;
  expected[A.wAnimationType] = 0;
  if (animated) expected[A.wAnimationID] = before[side === 0 ? player.move : enemy.move];
  return expected;
}

describe.each([0, 1] as const)('volatile stat effects side %i', side => {
  it('Haze full WRAM map: eight mods/stats each, target cure/selection, four Disable cells, exact masks and every untouched byte', () => {
    const r = rig(side), before = r.s.mem.slice(), after = hazeMap(before, side);
    const fill = vi.spyOn(r.s.mem, 'fill');
    r.observer.animation = () => expectMemory(r.s.mem, after);
    r.expected(['anim:114:0', 'S12', 'text:StatusChangesEliminatedText'], 12);
    expect(fill.mock.calls).toEqual([[7, player.mods, player.mods + 8], [7, enemy.mods, enemy.mods + 8]]);
    expectMemory(r.s.mem, after);
    expect([...r.s.mem.slice(player.flags1, player.flags1 + 3)]).toEqual([0x7e, 0x78, 0xf8]);
    expect([...r.s.mem.slice(enemy.flags1, enemy.flags1 + 3)]).toEqual([0x5f, 0x70, 0x78]);
    expect(r.s.mem[r.u.status]).toBe(before[r.u.status]);
    expect(r.s.mem.slice(A.wPartyMons, A.wPartyMons + PARTYMON_STRUCT_LENGTH * 6)).toEqual(before.slice(A.wPartyMons, A.wPartyMons + PARTYMON_STRUCT_LENGTH * 6));
    expect(r.s.mem.slice(A.wEnemyMons, A.wEnemyMons + PARTYMON_STRUCT_LENGTH * 6)).toEqual(before.slice(A.wEnemyMons, A.wEnemyMons + PARTYMON_STRUCT_LENGTH * 6));
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 32, 64])('Haze target status%i selects FF only for sleep/freeze and only on the target', status => {
    const r = rig(side); r.s.mem[r.t.status] = status; const before = r.s.mem.slice();
    r.expected(['anim:114:0', 'S12', 'text:StatusChangesEliminatedText'], 12);
    expectMemory(r.s.mem, hazeMap(before, side));
    expect(r.s.mem[r.t.selected]).toBe((status & 0x27) !== 0 ? 255 : before[r.t.selected]);
    expect(r.s.mem[r.u.selected]).toBe(before[r.u.selected]);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('Haze mask bit%i independently clears only the specified volatile bits on both sides', bit => {
    const r = rig(side), value = 1 << bit;
    r.s.mem.fill(value, player.flags1, player.flags1 + 3); r.s.mem.fill(value, enemy.flags1, enemy.flags1 + 3);
    const before = r.s.mem.slice(); r.run(); expectMemory(r.s.mem, hazeMap(before, side));
  });
  it('Haze removes both numeric penalties without curing the user status or reapplying penalties/badges', () => {
    const r = rig(side); r.s.mem[r.u.status] = 0x50; r.s.mem[r.t.status] = 0x50;
    r.run();
    for (const c of [player, enemy]) expect(r.s.mem.slice(c.stats, c.stats + 8)).toEqual(r.s.mem.slice(c.original, c.original + 8));
    expect(r.s.mem[r.u.status]).toBe(0x50); expect(r.s.mem[r.t.status]).toBe(0);
  });
  it('Haze zero move still resets all bytes and type but plays no animation or refresh', () => {
    const r = rig(side); r.s.mem[r.u.move] = 0; const before = r.s.mem.slice();
    r.expected(['text:StatusChangesEliminatedText'], 0); expectMemory(r.s.mem, hazeMap(before, side, false));
  });

  describe.each(cases)('$name', c => {
    it.each([false, true])('success ignores target already-set=%s, touches only user bit, before type0 animation', targetSet => {
      const r = rig(side, c.id, c.move), addr = r.u[c.block], target = r.t[c.block];
      r.s.mem[addr] = 0xf9 & ~c.bit; r.s.mem[target] = targetSet ? 0x89 | c.bit : 0x89 & ~c.bit;
      const before = r.s.mem.slice(), after = before.slice(); after[addr] |= c.bit;
      after[A.wAnimationType] = 0; after[A.wAnimationID] = c.move;
      r.observer.animation = () => expectMemory(r.s.mem, after);
      r.expected([`anim:${c.move}:0`, 'S12', `text:${c.text}`], 12); expectMemory(r.s.mem, after);
    });
    it.each([0, 1])('already-set failure is unconditional with MoveDidntMiss%i and its exact wait; no animation/write', moveDidntMiss => {
      const r = rig(side, c.id, c.move); r.s.mem[r.u[c.block]] = 0xb9 | c.bit; r.s.mem[r.t[c.block]] &= ~c.bit;
      r.s.wMoveDidntMiss = moveDidntMiss; const before = r.s.mem.slice();
      r.expected([...(c.wait ? ['S50'] : []), 'text:ButItFailedText'], c.wait); expectMemory(r.s.mem, before);
    });
    it('zero current move sets the user bit and resets type, with no animation/refresh', () => {
      const r = rig(side, c.id, 0); r.s.mem[r.u[c.block]] &= ~c.bit;
      const before = r.s.mem.slice(); r.expected([`text:${c.text}`], 0);
      before[r.u[c.block]] |= c.bit; before[A.wAnimationType] = 0; expectMemory(r.s.mem, before);
    });
  });
});

it('the four wrapper labels and five ids match the cartridge pointer table', () => {
  const registry = statEffectHandlers(rig(0).env);
  expect(Object.keys(registry)).toEqual(['StatModifierUpEffect', 'StatModifierDownEffect',
    'HazeEffect', 'MistEffect', 'FocusEnergyEffect', 'ReflectLightScreenEffect']);
  for (const [id, label] of [[0x19, 'HazeEffect'], [0x2e, 'MistEffect'], [0x2f, 'FocusEnergyEffect'],
    [0x40, 'ReflectLightScreenEffect'], [0x41, 'ReflectLightScreenEffect']] as const) {
    expect(MOVE_EFFECT_POINTERS[id - 1]?.label).toBe(label); expect(registry[label]).toBeTypeOf('function');
  }
});

describe.each([0, 1] as const)('real volatile printer side %i', side => {
  it.each(['haze', 'mist', 'focus', 'lightScreen', 'reflect', 'mistFailure', 'focusFailure', 'screenFailure'] as const)('%s complete frame/RNG/text ledger', scenario => {
    const c = scenario.startsWith('mist') ? cases[0] : scenario.startsWith('focus') ? cases[1]
      : scenario === 'lightScreen' ? cases[2] : cases[3];
    const r = scenario === 'haze' ? rig(side) : rig(side, c.id, c.move);
    if (scenario !== 'haze') {
      if (scenario.endsWith('Failure')) r.s.mem[r.u[c.block]] |= c.bit;
      else r.s.mem[r.u[c.block]] &= ~c.bit;
    }
    const host = new BattleHost<number>(r.s, r.video), pauseYields: number[] = [];
    const delay = TextScreen.prototype.delay;
    vi.spyOn(TextScreen.prototype, 'delay').mockImplementation(function* (this: TextScreen, count: number) {
      let yielded = 0;
      for (const frame of delay.call(this, count)) { yielded++; yield frame; }
      if (count === 30) pauseYields.push(yielded);
    });
    const env: StatEffectEnvironment = { ...r.env, host: {
      printText: function* (key, bindings, options) {
        r.events.push(`text:${key}`); yield* host.printText(key, bindings, options); r.events.push('textDone');
      },
    } };
    host.start(jumpMoveEffect(r.s, 'call', statEffectHandlers(env)));
    let frames = 0, pressed = false;
    while (!host.done && frames < 1500) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      r.events.push('S'); expect(host.step()).toBe('serviced'); frames++;
    }
    expect(host.done).toBe(true); expect(host.result).toBe(1);
    expect(pauseYields).toEqual(scenario === 'focus' ? [30] : []);
    expect({ frames, ledger: compact(r.events), pauseYields,
      player: [...r.s.mem.slice(player.flags1, player.flags1 + 3)],
      enemy: [...r.s.mem.slice(enemy.flags1, enemy.flags1 + 3)] }).toMatchSnapshot();
  });
  it.each([false, true])('Focus Energy real PAUSE yields exactly30 unheld /0 held (held=%s)', held => {
    const r = rig(side, cases[1].id, cases[1].move); r.s.mem[r.u.flags2] &= ~4;
    const delay = TextScreen.prototype.delay; let pause = 0;
    vi.spyOn(TextScreen.prototype, 'delay').mockImplementation(function* (this: TextScreen, count: number) {
      for (const frame of delay.call(this, count)) { if (count === 30) pause++; yield frame; }
    });
    const host = new BattleHost<number>(r.s, r.video);
    host.start(jumpMoveEffect(r.s, 'call', statEffectHandlers({ ...r.env, host })));
    let pressed = false;
    for (let frames = 0; !host.done && frames < 1500; frames++) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : held;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b'); host.step();
    }
    expect(host.done).toBe(true); expect(pause).toBe(held ? 0 : 30);
  });
});
