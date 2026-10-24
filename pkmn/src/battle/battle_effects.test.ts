import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { A, BattleState } from './battle_state';
import { BattleUnsupportedState } from './battle_move_data';
import { BattleMenuScreen } from './battle_menu_screen';
import { battleScreenFor, bindBattleScreen } from './battle_screen';
import { renderBattleScreen, type BattleRenderTiles } from './battle_screen_render';
import { BattleHost } from './battle_host';
import { playMoveAnimation } from './battle_turn_status';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { finish } from '../test/battle_hp_rig';
import { quarterSpeedDueToParalysis, halveAttackDueToBurn,
  applyBurnAndParalysisPenaltiesToPlayer, applyBurnAndParalysisPenaltiesToEnemy } from './battle_loaders';
import type { Frame, Program } from './battle_menu_context';
import * as effects from './battle_effects';

beforeAll(loadTextPrograms);
beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

// Independent symbol-branch fingerprint of labels and 86 little-endian pointer words (573535d7).
it('pins all 86 labels and bank-0f addresses without a ROM', () => {
  expect(effects.MOVE_EFFECT_POINTERS).toHaveLength(86);
  const pairs = effects.MOVE_EFFECT_POINTERS.map(p => p && [p.label, p.address]);
  expect(createHash('sha256').update(JSON.stringify(pairs)).digest('hex')).toBe('0b8ffa34d57c32b85eb9301309ce37fd836900fb69b344cb1801a0fdec921a72');
  expect(effects.MOVE_EFFECT_POINTERS.flatMap((p, i) => p === null ? [i + 1] : [])).toEqual([9, 17, 40, 41, 45, 78, 83]);
});
it.skipIf(!process.env.ROM_PATH)('matches every ROM word at 0f:70c5 to its hard-coded wrapper address', () => {
  const rom = readFileSync(process.env.ROM_PATH!);
  const start = 0x0f * 0x4000 + 0x70c5 - 0x4000;
  expect(Array.from({ length: 86 }, (_, i) => rom.readUInt16LE(start + i * 2)))
    .toEqual(effects.MOVE_EFFECT_POINTERS.map(p => p?.address ?? 0));
});

describe.each([0, 1] as const)('dispatch side %i', side => {
  it.each(['call', 'tail'] as const)('all registered pointer labels return b=1 in %s mode', mode => {
    const s = new BattleState(); s.hWhoseTurn = side;
    const registry: effects.MoveEffectRegistry = {};
    let calls = 0;
    for (const p of effects.MOVE_EFFECT_POINTERS) if (p) registry[p.label] = function* (state) {
      expect(state).toBe(s); calls++; yield 'session'; return 0;
    };
    for (let i = 1; i <= 86; i++) {
      if (!effects.MOVE_EFFECT_POINTERS[i - 1]) continue;
      s.wPlayerMoveEffect = side === 0 ? i : 0;
      s.wEnemyMoveEffect = side === 1 ? i : 0;
      expect(finish(effects.jumpMoveEffect(s, mode, registry))).toEqual({ result: 1, frames: ['session'] });
    }
    expect(calls).toBe(79);
    const port = effects.bindMoveEffects(registry);
    // Port keeps the executor's signature, but the ASM reads live state rather than a stale effect arg.
    expect(finish(port(s, 0, mode)).result).toBe(1);
  });
  it.each([0, 9, 17, 40, 41, 45, 78, 83, 87, 255])('unsupported id %i throws before any handler/frame', effect => {
    const s = new BattleState(); s.hWhoseTurn = side;
    s.wPlayerMoveEffect = s.wEnemyMoveEffect = effect;
    expect(() => finish(effects.jumpMoveEffect(s, 'tail', {}))).toThrow(BattleUnsupportedState);
  });
  it('unregistered pointer throws its wrapper name', () => {
    const s = new BattleState(); s.hWhoseTurn = side;
    s.wPlayerMoveEffect = s.wEnemyMoveEffect = 0x18;
    expect(() => finish(effects.jumpMoveEffect(s, 'call', {}))).toThrow('unregistered move effect ConversionEffect');
  });
});

describe.each([0, 1] as const)('shared CPU helpers side %i', side => {
  it.each([0, 0x10, 0xef, 0xff])('Substitute flags and recharge write preserve other bits (%i)', bits => {
    const s = new BattleState(); s.hWhoseTurn = side;
    const target = side === 0 ? A.wEnemyBattleStatus2 : A.wPlayerBattleStatus2;
    const own = side === 0 ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
    s.mem[target] = bits; s.mem[own] = 0xa7;
    const before = s.mem.slice();
    expect(effects.checkTargetSubstitute(s)).toEqual({ zero: (bits & 0x10) === 0, carry: false, halfCarry: true, subtract: false });
    expect(s.mem).toEqual(before);
    expect(effects.clearHyperBeam(s)).toEqual({ zero: side === 0, carry: false, halfCarry: false, subtract: false });
    before[target] &= ~0x20; expect(s.mem).toEqual(before); expect(s.mem[own]).toBe(0xa7);
  });
});

function animationRig(side: 0 | 1 = 0) {
  const s = new BattleState(), video = new BattleMenuScreen(), calls: number[][] = [];
  s.hWhoseTurn = side; s.wPlayerMoveNum = 33; s.wEnemyMoveNum = 44;
  bindBattleScreen(s, video.screen);
  const ports: effects.EffectAnimationPort = { animation: function* (state) {
    calls.push([state.wAnimationID, state.wAnimationType]); yield 'held';
  } };
  return { s, video, calls, ports };
}
describe.each([0, 1] as const)('animation helpers side %i', side => {
  it('current move resets type; helper2 selects 6/3; explicit IDs preserve or replace type', () => {
    const r = animationRig(side), id = side === 0 ? 33 : 44;
    r.s.wAnimationType = 77;
    expect(finish(effects.playCurrentMoveAnimation(r.s, r.ports)).frames).toEqual(['held', ...Array(12).fill('serviced')]);
    expect(r.calls).toEqual([[id, 0]]);
    finish(effects.playCurrentMoveAnimation2(r.s, r.ports));
    expect(r.calls[r.calls.length - 1]).toEqual([id, side === 0 ? 6 : 3]);
    r.s.wAnimationType = 5; finish(effects.playBattleAnimation(r.s, r.ports, 0xc7));
    expect(r.calls[r.calls.length - 1]).toEqual([0xc7, 5]);
    finish(effects.playBattleAnimation2(r.s, r.ports, 0xa9));
    expect(r.calls[r.calls.length - 1]).toEqual([0xa9, side === 0 ? 6 : 3]);
    r.s.wAnimationID = 0xae; finish(effects.playBattleAnimationGotID(r.s, r.ports));
    expect(r.calls[r.calls.length - 1]).toEqual([0xae, side === 0 ? 6 : 3]);
  });
  it('zero current move skips both animation and refresh at each ASM guard', () => {
    const r = animationRig(side);
    r.s.wPlayerMoveNum = r.s.wEnemyMoveNum = 0; r.s.wAnimationID = 88; r.s.wAnimationType = 99;
    expect(finish(effects.playCurrentMoveAnimation2(r.s, r.ports)).frames).toEqual([]);
    expect([r.s.wAnimationID, r.s.wAnimationType]).toEqual([88, 99]);
    expect(finish(effects.playCurrentMoveAnimation(r.s, r.ports)).frames).toEqual([]);
    expect([r.s.wAnimationID, r.s.wAnimationType]).toEqual([88, 0]);
    expect(r.calls).toEqual([]); expect(r.video.screen.transferDestination).toBe(0x9c);
  });
});

describe.each([0, 1, 2])('Func_78e98 starting third %i', phase => {
  it.each([true, false])('12-frame ledger, enables, Buffer2, hidden BG0 and shown window (initial enabled=%s)', enabled => {
    const s = new BattleState(), video = new BattleMenuScreen(), screen = video.screen;
    const host = new BattleHost(s, video); // Bind the actual host rather than a second refresh-only buffer.
    expect(battleScreenFor(s)).toBe(screen);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, String.fromCharCode(65 + y));
    for (let i = 0; i < 3; i++) screen.vblank();
    const original = screen.cells, shown = screen.visibleCells;
    screen.putBg(0, 0, 'Z'); screen.putBg(31, 31, 'Z');
    textBgTransfer.resetPortion(); for (let i = 0; i < phase; i++) textBgTransfer.tick();
    textBgTransfer.enabled = enabled;
    host.start(screen.refreshAfterAnimation(video));
    const ledger: (number | boolean)[][] = [];
    while (!host.done) {
      ledger.push([screen.transferDestination, textBgTransfer.enabled, textBgTransfer.nextPortion]);
      expect(host.step()).toBe('serviced');
      expect(screen.visibleCells).toEqual(shown); // Every frame, including the enabled blank transfer to BG0.
    }
    expect(ledger).toEqual([
      ...Array.from({ length: 3 }, () => [0x9c, false, phase]),
      ...Array.from({ length: 3 }, () => [0x98, false, phase]),
      ...Array.from({ length: 3 }, (_, i) => [0x98, true, (phase + i) % 3]),
      ...Array.from({ length: 3 }, (_, i) => [0x9c, true, (phase + i) % 3]),
    ]);
    expect(screen.cells).toEqual(original); expect(screen.visibleCells).toEqual(shown);
    expect(screen.bgAt(0, 0)).toBe(' '); expect(screen.bgAt(19, 17)).toBe(' ');
    expect(screen.bgAt(31, 31)).toBe('Z');
    expect(screen.transferDestination).toBe(0x9c); expect(textBgTransfer.enabled).toBe(true);
    expect(textBgTransfer.nextPortion).toBe(phase);
    screen.put(0, 0, 'X'); video.loadScreenTilesFromBuffer2(); expect(screen.cells).toEqual(original);
  });
});

it('core PlayMoveAnimation is Delay3 then one MoveAnimation then the same 12-frame refresh', () => {
  const r = animationRig(), frames: Frame[] = [];
  const p = playMoveAnimation(r.s, r.ports, 0xa7);
  expect(p.next().value).toBe('serviced'); expect(r.s.wAnimationID).toBe(0xa7);
  expect(r.calls).toEqual([]); frames.push('serviced');
  for (const frame of p) frames.push(frame);
  expect(frames).toEqual([...Array(3).fill('serviced'), 'held', ...Array(12).fill('serviced')]);
  expect(r.calls).toEqual([[0xa7, 0]]);
});

it('renderer keeps the BG1 window picture through all twelve frames and exposes blank BG0 only below wy', () => {
  const r = animationRig(), screen = r.video.screen;
  const font = { width: 128, height: 128, data: new Uint8Array(128 * 128 * 4).fill(255) };
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const index = (y * 128 + x) * 4;
    font.data[index] = font.data[index + 1] = font.data[index + 2] = 0;
  }
  const empty = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(255) };
  const tiles: BattleRenderTiles = { font, extra: empty, hud1: empty, hud2: empty, hud3: empty,
    sprites: empty, pictures: new Map() };
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) screen.put(x, y, 'A');
  for (let i = 0; i < 3; i++) screen.vblank();
  const original = renderBattleScreen(screen, tiles);
  const out = finish(screen.refreshAfterAnimation(r.video), () => {
    screen.vblank(); expect(renderBattleScreen(screen, tiles)).toEqual(original);
  });
  expect(out.frames).toHaveLength(12);
  screen.wy = 144;
  expect(renderBattleScreen(screen, tiles)).not.toEqual(original);
}, 30_000);

it.each([0, 1, 0x80])('refresh is outside the deferred MoveAnimation option/sound port (options=%i)', options => {
  const r = animationRig(); r.s.wOptions = options;
  expect(finish(effects.playBattleAnimation(r.s, r.ports, 1)).frames).toHaveLength(13);
  expect(r.calls).toHaveLength(1);
});

it('failure printers use committed keys and delegate their frame kinds without added waits', () => {
  const keys: string[] = [];
  const host = { printText: function* (key: string): Program { expect(getTextPrograms()[key]).toBeDefined(); keys.push(key); yield 'session'; } };
  for (const print of [effects.printButItFailedText, effects.printDidntAffectText, effects.printNoEffectText,
    effects.printMayNotAttackText, effects.printNothingHappenedText, effects.printDoesntAffectText]) {
    expect(finish(print(host)).frames).toEqual(['session']);
  }
  expect(keys).toEqual(['ButItFailedText', 'DidntAffectText', 'NoEffectText', 'ParalyzedMayNotAttackText', 'NothingHappenedText', 'DoesntAffectMonText']);
  const s = new BattleState();
  expect(finish(effects.conditionalPrintButItFailed(s, host)).frames).toEqual(['session']);
  for (const byte of [1, 255]) { s.wMoveDidntMiss = byte; expect(finish(effects.conditionalPrintButItFailed(s, host)).frames).toEqual([]); }
  expect(keys).toHaveLength(7);
});

it('six cells have cartridge addresses and PayDayMoney aliases all three NameBuffer bytes', () => {
  const s = new BattleState();
  expect([A.wTotalPayDayMoney, A.wPlayerMonMinimized, A.wChargeMoveNum, A.wPayDayMoney, A.wOptions, A.wUnknownSerialFlag_d499])
    .toEqual([0xcce5, 0xccf7, 0xcd3d, 0xcd6d, 0xd354, 0xd498]);
  s.mem.set([0x12, 0x34, 0x56], A.wPayDayMoney);
  expect([...s.mem.slice(A.wNameBuffer, A.wNameBuffer + 3)]).toEqual([0x12, 0x34, 0x56]);
  expect(s.wBattleMenuCurrentPP).toBe(0x12); s.wBattleMenuCurrentPP = 0x99; expect(s.wPayDayMoney).toBe(0x99);
  s.wTotalPayDayMoney = 0x23; s.wPlayerMonMinimized = 1; s.wChargeMoveNum = 19; s.wOptions = 128; s.wUnknownSerialFlag_d499 = 1;
  expect([s.mem[0xcce5], s.mem[0xccf7], s.mem[0xcd3d], s.mem[0xd354], s.mem[0xd498]]).toEqual([0x23, 1, 19, 128, 1]);
});

describe.each([0, 1] as const)('individual penalties side %i', side => {
  it.each([0, 0x40, 0x10, 0x50])('only the requested penalty runs, for target status %i', status => {
    const s = new BattleState(); s.hWhoseTurn = side;
    s.wBattleMonSpeed = s.wEnemyMonSpeed = 101; s.wBattleMonAttack = s.wEnemyMonAttack = 103;
    s.wBattleMonStatus = s.wEnemyMonStatus = status;
    quarterSpeedDueToParalysis(s);
    expect([s.wBattleMonSpeed, s.wEnemyMonSpeed]).toEqual(side === 0 ? [101, status & 0x40 ? 25 : 101] : [status & 0x40 ? 25 : 101, 101]);
    expect([s.wBattleMonAttack, s.wEnemyMonAttack]).toEqual([103, 103]);
    halveAttackDueToBurn(s);
    expect([s.wBattleMonAttack, s.wEnemyMonAttack]).toEqual(side === 0 ? [103, status & 0x10 ? 51 : 103] : [status & 0x10 ? 51 : 103, 103]);
    expect(s.hWhoseTurn).toBe(side);
  });
  it('both individual routines floor at one; paired wrappers retain their target and order', () => {
    const s = new BattleState(); s.wBattleMonStatus = s.wEnemyMonStatus = 0x50;
    s.wBattleMonSpeed = s.wEnemyMonSpeed = 1; s.wBattleMonAttack = s.wEnemyMonAttack = 1;
    s.hWhoseTurn = side; quarterSpeedDueToParalysis(s); halveAttackDueToBurn(s);
    expect([s.wBattleMonSpeed, s.wEnemyMonSpeed, s.wBattleMonAttack, s.wEnemyMonAttack]).toEqual([1, 1, 1, 1]);
    s.wBattleMonSpeed = s.wEnemyMonSpeed = 104; s.wBattleMonAttack = s.wEnemyMonAttack = 106;
    applyBurnAndParalysisPenaltiesToPlayer(s); expect([s.hWhoseTurn, s.wBattleMonSpeed, s.wBattleMonAttack]).toEqual([1, 26, 53]);
    applyBurnAndParalysisPenaltiesToEnemy(s); expect([s.hWhoseTurn, s.wEnemyMonSpeed, s.wEnemyMonAttack]).toEqual([0, 26, 53]);
  });
});
