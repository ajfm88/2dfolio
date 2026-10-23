import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, BattleState, PARTYMON_STRUCT_LENGTH, encodeText } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleHost } from './battle_host';
import { bindBattleScreen } from './battle_screen';
import { jumpMoveEffect } from './battle_effects';
import { statusEffectHandlers, checkDefrost, type StatusEffectEnvironment } from './battle_effects_status';
import * as random from './battle_random';
import * as hit from './battle_hit';
import * as penalties from './battle_loaders';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { isHeld } from '../input';
import { finish } from '../test/battle_hp_rig';
import type { Program } from './battle_menu_context';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast'); vi.mocked(isHeld).mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

// Mechanical ledgers use CPU-only text/animation ports; the real printer integrations below own all text frames.
function rig(side: 0 | 1, id: number, draws: readonly number[] = []) {
  vi.restoreAllMocks();
  const s = new BattleState(), video = new BattleMenuScreen(), events: string[] = [];
  bindBattleScreen(s, video.screen); s.hWhoseTurn = side;
  s.wBattleMonHP = s.wEnemyMonHP = 100; s.wBattleMonMaxHP = s.wEnemyMonMaxHP = 160;
  s.wBattleMonSpeed = s.wEnemyMonSpeed = 160; s.wBattleMonAttack = s.wEnemyMonAttack = 200;
  s.wPlayerMoveEffect = s.wEnemyMoveEffect = id; s.wPlayerMoveNum = s.wEnemyMoveNum = 47;
  s.wPlayerMoveType = s.wEnemyMoveType = 20; s.wPlayerMoveAccuracy = s.wEnemyMoveAccuracy = 255;
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8); s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  s.wPlayerMonNumber = 3; s.wEnemyMonPartyPos = 2;
  s.mem.fill(0xa5, A.wPartyMons, A.wPartyMons + PARTYMON_STRUCT_LENGTH * 6);
  s.mem.fill(0x5a, A.wEnemyMons, A.wEnemyMons + PARTYMON_STRUCT_LENGTH * 6);
  s.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11); s.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
  const t = side === 0
    ? { status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2, flags3: A.wEnemyBattleStatus3,
      toxic: A.wEnemyToxicCounter, confused: A.wEnemyConfusedCounter, speed: A.wEnemyMonSpeed, attack: A.wEnemyMonAttack,
      party: A.wEnemyMons, slot: 2 }
    : { status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2, flags3: A.wPlayerBattleStatus3,
      toxic: A.wPlayerToxicCounter, confused: A.wPlayerConfusedCounter, speed: A.wBattleMonSpeed, attack: A.wBattleMonAttack,
      party: A.wPartyMons, slot: 3 };
  let index = 0;
  const observer = { onDraw: (_index: number) => {} };
  vi.spyOn(random, 'battleRandom').mockImplementation(state => {
    expect(state).toBe(s); observer.onDraw(index);
    if (index >= draws.length) throw new Error('unexpected BattleRandom');
    const draw = draws[index++]; events.push(`R${draw}`); return draw;
  });
  const originalHit = hit.moveHitTest;
  vi.spyOn(hit, 'moveHitTest').mockImplementation(state => { events.push('hit'); return originalHit(state); });
  const quarter = penalties.quarterSpeedDueToParalysis, halve = penalties.halveAttackDueToBurn;
  vi.spyOn(penalties, 'quarterSpeedDueToParalysis').mockImplementation(state => { events.push('quarter'); quarter(state); });
  vi.spyOn(penalties, 'halveAttackDueToBurn').mockImplementation(state => { events.push('halve'); halve(state); });
  const env: StatusEffectEnvironment = {
    host: { printText: function* (key) { expect(getTextPrograms()[key], key).toBeDefined(); events.push(`text:${key}`); } },
    animation: function* (state) { events.push(`anim:${state.wAnimationID}:${state.wAnimationType}`); },
  };
  const registry = statusEffectHandlers(env);
  const run = (program: Program<number | void> = jumpMoveEffect(s, 'call', registry)) => {
    const out = finish(program, frame => { events.push(frame === 'serviced' ? 'S' : frame); if (frame === 'serviced') video.vblank(); });
    expect(index).toBe(draws.length);
    const ledger: string[] = [];
    for (const e of events) {
      if (e === 'S' && /^S\d*$/.test(ledger[ledger.length - 1] ?? '')) {
        const n = Number(ledger[ledger.length - 1].slice(1) || 1); ledger[ledger.length - 1] = `S${n + 1}`;
      } else ledger.push(e);
    }
    return { ...out, ledger };
  };
  const expected = (ledger: string[], frames: number) => {
    const out = run(); expect(out.result).toBe(1); expect(out.frames).toEqual(Array(frames).fill('serviced'));
    expect(out.ledger).toEqual(ledger); return out;
  };
  return { s, t, video, env, registry, events, observer, run, expected, anim: (id = 47, type = side === 0 ? 6 : 3) => `anim:${id}:${type}` };
}

it('factory exposes exactly the eight status wrapper labels, without touching state or dispatching families early', () => {
  const r = rig(0, 1);
  expect(Object.keys(r.registry).sort()).toEqual(['ConfusionEffect', 'ConfusionSideEffect', 'FlinchSideEffect',
    'FreezeBurnParalyzeEffect', 'LeechSeedEffect', 'ParalyzeEffect', 'PoisonEffect', 'SleepEffect']);
  expect(r.events).toEqual([]);
});

// Real committed PrintText programs: full printer waits plus the effects' explicit waits/refresh.
describe.each([0, 1] as const)('real printer ledgers side %i', side => {
  it.each(['sleep', 'asleep', 'sleepMiss', 'poison', 'toxic', 'poisonFail', 'burn', 'freeze',
    'secondaryParalyze', 'defrost', 'paralyze', 'ground', 'paralyzeMiss', 'confusion', 'confusionSide',
    'confusionFail', 'flinch', 'seed', 'seedFail'] as const)('%s', scenario => {
    const id = { sleep: 0x20, asleep: 0x20, sleepMiss: 0x20, poison: 2, toxic: 0x42, poisonFail: 0x42,
      burn: 4, freeze: 5, secondaryParalyze: 6, defrost: 4, paralyze: 0x43, ground: 0x43,
      paralyzeMiss: 0x43, confusion: 0x31, confusionSide: 0x4c, confusionFail: 0x31,
      flinch: 0x1f, seed: 0x54, seedFail: 0x54 }[scenario];
    const draws = scenario === 'sleep' || scenario === 'confusion' || scenario === 'confusionSide' ? [0, 2]
      : ['asleep', 'poisonFail', 'defrost', 'ground', 'confusionFail'].includes(scenario) ? []
      : scenario === 'sleepMiss' || scenario === 'paralyzeMiss' ? [255] : [0];
    const r = rig(side, id, draws);
    if (scenario === 'asleep') r.s.mem[r.t.status] = 3;
    if (scenario === 'toxic') r.s.wPlayerMoveNum = r.s.wEnemyMoveNum = 92;
    if (scenario === 'poisonFail' || scenario === 'confusionFail') r.s.mem[r.t.flags2] = 0x10;
    if (scenario === 'defrost') r.s.mem[r.t.status] = 0x20;
    if (scenario === 'ground') { r.s.wPlayerMoveType = r.s.wEnemyMoveType = 23; r.s.mem[r.t.status + 1] = 4; }
    if (scenario === 'seedFail') r.s.mem[r.t.status + 1] = 22;
    const host = new BattleHost<number>(r.s, r.video);
    const env: StatusEffectEnvironment = { animation: r.env.animation, host: {
      printText: function* (key) { r.events.push(`text:${key}`); yield* host.printText(key); r.events.push('textDone'); },
    } };
    host.start(jumpMoveEffect(r.s, 'call', statusEffectHandlers(env)));
    let frames = 0, pressed = false;
    while (!host.done && frames < 1500) {
      pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      // Record before resuming CPU so a text/animation transition cannot move across its frame.
      r.events.push('S'); expect(host.step()).toBe('serviced'); frames++;
    }
    expect(host.done).toBe(true); expect(host.result).toBe(1);
    expect(vi.mocked(random.battleRandom)).toHaveBeenCalledTimes(draws.length);
    const ledger: string[] = [];
    for (const e of r.events) {
      const previous = ledger[ledger.length - 1] ?? '';
      if (e === 'S' && /^S\d*$/.test(previous)) ledger[ledger.length - 1] = `S${Number(previous.slice(1) || 1) + 1}`;
      else ledger.push(e);
    }
    expect({ frames, ledger, status: r.s.mem[r.t.status], flags1: r.s.mem[r.t.flags1],
      flags2: r.s.mem[r.t.flags2] }).toMatchSnapshot();
  });
});

describe.each([0, 1] as const)('status effects side %i', side => {
  it('sleep clears recharge before status and hit gates, overwriting the entire prior status', () => {
    const r = rig(side, 0x20, [5]), m = r.s.mem;
    m[r.t.flags2] = 0x30; m[r.t.flags1] = 0x40; m[r.t.status] = 0x52;
    r.observer.onDraw = () => { expect(m[r.t.flags2]).toBe(0x10); expect(m[r.t.status]).toBe(0x52); };
    r.expected(['R5', r.anim(), 'S12', 'text:FellAsleepText'], 12);
    expect(m[r.t.status]).toBe(5); expect(m[r.t.flags2]).toBe(0x10);
  });
  it.each([1, 0x20])('sleep id %i rejects masked zero samples without replacing them with uniform ranges', id => {
    const r = rig(side, id, [0, 0, 8, 7]);
    r.expected(['hit', 'R0', 'R0', 'R8', 'R7', r.anim(), 'S12', 'text:FellAsleepText'], 12);
    expect(r.s.mem[r.t.status]).toBe(7);
  });
  it('Stadium sleep masks again and rejects its own zero results', () => {
    const r = rig(side, 0x20, [0, 0, 4, 8, 12, 7]); r.s.wUnknownSerialFlag_d499 = 1;
    r.expected(['hit', 'R0', 'R0', 'R4', 'R8', 'R12', 'R7', r.anim(), 'S12', 'text:FellAsleepText'], 12);
    expect(r.s.mem[r.t.status]).toBe(3);
  });
  it.each([[3, 'AlreadyAsleepText'], [8, 'DidntAffectText'], [0x40, 'DidntAffectText']] as const)('sleep existing status %i uses %s with no hit/duration roll or delay', (status, text) => {
    const r = rig(side, 0x20); r.s.mem[r.t.status] = status;
    r.expected([`text:${text}`], 0); expect(r.s.mem[r.t.status]).toBe(status);
  });
  it('sleep accuracy failure goes directly to DidntAffectText, without the poison 50-frame wait', () => {
    const r = rig(side, 0x20, [255]); r.expected(['hit', 'R255', 'text:DidntAffectText'], 0);
    expect(r.s.mem[r.t.status]).toBe(0); expect(r.s.wMoveMissed).toBe(1);
  });
  it('sleep has no local Substitute gate', () => {
    const r = rig(side, 0x20, [0, 2]); r.s.mem[r.t.flags2] = 0x10;
    r.expected(['hit', 'R0', 'R2', r.anim(), 'S12', 'text:FellAsleepText'], 12);
  });

  describe.each([2, 0x21, 0x42])('poison id %i', id => {
    it.each(['substitute', 'status', 'type1', 'type2'] as const)('%s gate precedes every draw and the hit test', gate => {
      const r = rig(side, id);
      if (gate === 'substitute') r.s.mem[r.t.flags2] = 0x10;
      if (gate === 'status') r.s.mem[r.t.status] = 8;
      if (gate === 'type1') r.s.mem[r.t.status + 1] = 3;
      if (gate === 'type2') r.s.mem[r.t.status + 2] = 3;
      r.expected(id === 0x42 ? ['S50', 'text:DidntAffectText'] : [], id === 0x42 ? 50 : 0);
    });
  });
  it.each([[2, 51, true], [2, 52, false], [0x21, 102, true], [0x21, 103, false]] as const)('poison threshold id%i R%i succeeds=%s', (id, roll, succeeds) => {
    const r = rig(side, id, [roll]);
    r.expected([`R${roll}`, ...(succeeds ? [r.anim(side === 0 ? 0xa9 : 0xc7), 'S12', 'text:PoisonedText'] : [])], succeeds ? 12 : 0);
    expect(r.s.mem[r.t.status]).toBe(succeeds ? 8 : 0);
  });
  it.each([[0x42, 92], [2, 92], [0x42, 66]] as const)('Toxic is move-number based (effect%i move%i) and writes only the target bookkeeping', (id, move) => {
    const r = rig(side, id, [0]), m = r.s.mem;
    r.s.wPlayerMoveNum = r.s.wEnemyMoveNum = move; m[r.t.flags3] = 0xa0; m[r.t.toxic] = 17;
    const other = side === 0 ? A.wPlayerToxicCounter : A.wEnemyToxicCounter; m[other] = 33;
    const toxic = move === 92;
    r.expected([...(id === 0x42 ? ['hit'] : []), 'R0', r.anim(id === 0x42 ? move : side === 0 ? 0xa9 : 0xc7), 'S12',
      `text:${toxic ? 'BadlyPoisonedText' : 'PoisonedText'}`], 12);
    expect([m[r.t.status], m[r.t.flags3], m[r.t.toxic], m[other]]).toEqual([8, toxic ? 0xa1 : 0xa0, toxic ? 0 : 17, 33]);
  });
  it('standalone poison miss waits 50 then DidntAffectText, without a chance/duration draw', () => {
    const r = rig(side, 0x42, [255]); r.expected(['hit', 'R255', 'S50', 'text:DidntAffectText'], 50);
    expect(r.s.mem[r.t.status]).toBe(0);
  });

  describe.each([[4, 0, 26, 0x10, 'BurnedText'], [5, 0, 26, 0x20, 'FrozenText'], [6, 0, 26, 0x40, 'ParalyzedMayNotAttackText'],
    [0x22, 0, 77, 0x10, 'BurnedText'], [0x23, 0, 77, 0x20, 'FrozenText'], [0x23, 1, 26, 0x20, 'FrozenText'],
    [0x24, 0, 77, 0x40, 'ParalyzedMayNotAttackText']] as const)('secondary status id%i Stadium%i threshold%i', (id, stadium, threshold, status, text) => {
    it.each([true, false])('boundary succeeds=%s consumes exactly one byte and uses the correct animation', succeeds => {
      const roll = threshold - (succeeds ? 1 : 0), r = rig(side, id, [roll]);
      r.s.wUnknownSerialFlag_d499 = stadium; r.s.wAnimationType = 99; r.s.mem[r.t.flags2] = 0x20;
      r.observer.onDraw = () => expect(r.s.wAnimationType).toBe(0);
      const penalty = status === 0x10 ? ['halve'] : status === 0x40 ? ['quarter'] : [];
      r.expected([`R${roll}`, ...(succeeds ? [...penalty, r.anim(side === 0 ? 0xa9 : 0xc7, side === 0 ? 0 : 3), 'S12', `text:${text}`] : [])], succeeds ? 12 : 0);
      expect(r.s.mem[r.t.status]).toBe(succeeds ? status : 0);
      expect(r.s.mem[r.t.flags2]).toBe(succeeds && status === 0x20 && side === 0 ? 0 : 0x20);
      expect(r.s.readBE(r.t.speed)).toBe(succeeds && status === 0x40 ? 40 : 160);
      expect(r.s.readBE(r.t.attack)).toBe(succeeds && status === 0x10 ? 100 : 200);
    });
  });
  it('secondary status writes type zero before Substitute, and Substitute precedes even defrost', () => {
    const r = rig(side, 4); r.s.wAnimationType = 99; r.s.mem[r.t.flags2] = 0x10; r.s.mem[r.t.status] = 0x20;
    r.expected([], 0); expect(r.s.wAnimationType).toBe(0); expect(r.s.mem[r.t.status]).toBe(0x20);
  });
  it.each([1, 2])('Normal Body Slam matches target type%i before the chance draw', type => {
    const r = rig(side, 0x24); r.s.wPlayerMoveType = r.s.wEnemyMoveType = 0;
    r.s.mem[r.t.status + 1] = r.s.mem[r.t.status + 2] = 21; r.s.mem[r.t.status + type] = 0;
    r.expected([], 0); expect(r.s.mem[r.t.status]).toBe(0);
  });
  it.each([1, 8, 0x40])('existing non-frozen status %i returns via CheckDefrost with no roll', status => {
    const r = rig(side, 4); r.s.mem[r.t.status] = status; r.expected([], 0); expect(r.s.mem[r.t.status]).toBe(status);
  });
  it('frozen + FIRE defrosts before type match or roll and clears exactly the selected roster status', () => {
    const r = rig(side, 4), m = r.s.mem; m[r.t.status] = 0x28;
    m[r.t.status + 1] = m[r.t.status + 2] = 20;
    const before = m.slice(r.t.party, r.t.party + PARTYMON_STRUCT_LENGTH * 6);
    r.expected(['text:FireDefrostedText'], 0); expect(m[r.t.status]).toBe(0);
    before[r.t.slot * PARTYMON_STRUCT_LENGTH + 4] = 0;
    expect(m.slice(r.t.party, r.t.party + PARTYMON_STRUCT_LENGTH * 6)).toEqual(before);
    expect(r.s.wEnemySelectedMove).toBe(0); expect(r.s.wPlayerSelectedMove).toBe(0);
  });
  it('frozen target is not thawed by a non-FIRE move', () => {
    const r = rig(side, 4); r.s.mem[r.t.status] = 0x20; r.s.wPlayerMoveType = r.s.wEnemyMoveType = 21;
    r.expected([], 0); expect(r.s.mem[r.t.status]).toBe(0x20);
  });
  it('direct CheckDefrost silently returns when not frozen', () => {
    const r = rig(side, 4); r.s.mem[r.t.status] = 8;
    expect(r.run(checkDefrost(r.s, r.env)).ledger).toEqual([]); expect(r.s.mem[r.t.status]).toBe(8);
  });

  it('standalone paralysis checks status before Electric/Ground and uses DidntAffectText', () => {
    const r = rig(side, 0x43); r.s.mem[r.t.status] = 8; r.s.mem[r.t.status + 1] = 4;
    r.s.wPlayerMoveType = r.s.wEnemyMoveType = 23;
    r.expected(['S50', 'text:DidntAffectText'], 50);
  });
  it.each([1, 2])('Electric paralysis immunity against Ground type%i waits 50 then DoesntAffectMonText', type => {
    const r = rig(side, 0x43); r.s.wPlayerMoveType = r.s.wEnemyMoveType = 23; r.s.mem[r.t.status + type] = 4;
    r.expected(['S50', 'text:DoesntAffectMonText'], 50); expect(r.s.mem[r.t.status]).toBe(0);
  });
  it('paralysis passes Substitute, quarters Speed before its 30 frames, then animates with type zero', () => {
    const r = rig(side, 0x43, [0]); r.s.mem[r.t.flags2] = 0x10;
    r.expected(['hit', 'R0', 'quarter', 'S30', r.anim(47, 0), 'S12', 'text:ParalyzedMayNotAttackText'], 42);
    expect(r.s.mem[r.t.status]).toBe(0x40); expect(r.s.readBE(r.t.speed)).toBe(40); expect(r.s.readBE(r.t.attack)).toBe(200);
  });
  it('non-Electric paralysis can hit a Ground target', () => {
    const r = rig(side, 0x43, [0]); r.s.mem[r.t.status + 2] = 4;
    r.expected(['hit', 'R0', 'quarter', 'S30', r.anim(47, 0), 'S12', 'text:ParalyzedMayNotAttackText'], 42);
  });
  it('standalone paralysis miss waits 50 then DidntAffectText', () => {
    const r = rig(side, 0x43, [255]); r.expected(['hit', 'R255', 'S50', 'text:DidntAffectText'], 50);
    expect(r.s.mem[r.t.status]).toBe(0); expect(r.s.readBE(r.t.speed)).toBe(160);
  });

  it.each([0, 1, 2, 3])('primary confusion sets its bit before duration draw %i and animates', duration => {
    const r = rig(side, 0x31, [0, duration]); r.s.mem[r.t.flags1] = 2; r.s.mem[r.t.confused] = 7;
    r.observer.onDraw = i => { if (i === 1) expect([r.s.mem[r.t.flags1], r.s.mem[r.t.confused]]).toEqual([130, 7]); };
    r.expected(['hit', 'R0', `R${duration}`, r.anim(), 'S12', 'text:BecameConfusedText'], 12);
    expect(r.s.mem[r.t.confused]).toBe(duration + 2);
  });
  it('secondary confusion R24 passes Substitute and invulnerability without HIT, rolls duration and does not animate', () => {
    const r = rig(side, 0x4c, [24, 3]); r.s.mem[r.t.flags2] = 0x10; r.s.mem[r.t.flags1] = 0x40;
    r.expected(['R24', 'R3', 'text:BecameConfusedText'], 0); expect(r.s.mem[r.t.confused]).toBe(5); expect(r.s.mem[r.t.flags1]).toBe(0xc0);
  });
  it('secondary confusion R25 fails silently, without a duration draw', () => {
    const r = rig(side, 0x4c, [25]); r.expected(['R25'], 0); expect(r.s.mem[r.t.flags1]).toBe(0);
  });
  it.each([0, 1])('already-confused primary waits 50 and conditionally prints (MoveDidntMiss=%i)', moveDidntMiss => {
    const r = rig(side, 0x31, [0]); r.s.mem[r.t.flags1] = 128; r.s.wMoveDidntMiss = moveDidntMiss;
    r.expected(['hit', 'R0', 'S50', ...(moveDidntMiss ? [] : ['text:ButItFailedText'])], 50);
  });
  it('already-confused secondary rolls chance but not duration and stays silent', () => {
    const r = rig(side, 0x4c, [24]); r.s.mem[r.t.flags1] = 128; r.expected(['R24'], 0);
  });
  it('primary confusion checks Substitute before HIT', () => {
    const r = rig(side, 0x31); r.s.mem[r.t.flags2] = 0x10;
    r.expected(['S50', 'text:ButItFailedText'], 50);
  });
  it('primary confusion HIT miss waits 50 then conditional failure', () => {
    const r = rig(side, 0x31, [255]); r.expected(['hit', 'R255', 'S50', 'text:ButItFailedText'], 50);
  });

  describe.each([[0x1f, 26], [0x25, 77]] as const)('flinch id%i threshold%i', (id, threshold) => {
    it.each([[0, true], [0, false], [4, true], [4, false]] as const)('link%i success=%s clears recharge at the correct point', (link, succeeds) => {
      const roll = threshold - (succeeds ? 1 : 0), r = rig(side, id, [roll]); r.s.wLinkState = link;
      r.s.mem[r.t.flags1] = 0x80; r.s.mem[r.t.flags2] = 0x22;
      r.observer.onDraw = () => expect(r.s.mem[r.t.flags2]).toBe(link === 4 ? 2 : 0x22);
      r.expected([`R${roll}`], 0);
      expect(r.s.mem[r.t.flags1]).toBe(succeeds ? 0x88 : 0x80); expect(r.s.mem[r.t.flags2]).toBe(succeeds || link === 4 ? 2 : 0x22);
    });
  });
  it('Substitute blocks flinch before link recharge clearing and any roll', () => {
    const r = rig(side, 0x1f); r.s.wLinkState = 4; r.s.mem[r.t.flags2] = 0x30;
    r.expected([], 0); expect(r.s.mem[r.t.flags2]).toBe(0x30);
  });

  it.each(['grass1', 'grass2', 'seeded', 'miss'] as const)('Leech Seed %s failure calls HIT first and waits 50', gate => {
    const roll = gate === 'miss' ? 255 : 0, r = rig(side, 0x54, [roll]);
    if (gate === 'grass1') r.s.mem[r.t.status + 1] = 22;
    if (gate === 'grass2') r.s.mem[r.t.status + 2] = 22;
    if (gate === 'seeded') r.s.mem[r.t.flags2] = 0x80;
    r.expected(['hit', `R${roll}`, 'S50', 'text:EvadedAttackText'], 50);
    expect(r.s.wMoveMissed).toBe(gate === 'miss' ? 1 : 0);
  });
  it('Leech Seed passes Substitute, sets SEEDED before its type-zero current animation and prints WasSeededText', () => {
    const r = rig(side, 0x54, [0]); r.s.mem[r.t.flags2] = 0x10;
    r.expected(['hit', 'R0', r.anim(47, 0), 'S12', 'text:WasSeededText'], 12);
    expect(r.s.mem[r.t.flags2]).toBe(0x90);
  });
  it.each([0x20, 2, 4, 0x43, 0x31, 0x1f, 0x54])('status id%i never writes a party copy except CheckDefrost', id => {
    const draws = id === 0x20 || id === 0x31 ? [0, 1] : [0], r = rig(side, id, draws);
    const party = r.s.mem.slice(A.wPartyMons, A.wPartyMons + PARTYMON_STRUCT_LENGTH * 6);
    const enemy = r.s.mem.slice(A.wEnemyMons, A.wEnemyMons + PARTYMON_STRUCT_LENGTH * 6);
    r.run(); expect(r.s.mem.slice(A.wPartyMons, A.wPartyMons + PARTYMON_STRUCT_LENGTH * 6)).toEqual(party);
    expect(r.s.mem.slice(A.wEnemyMons, A.wEnemyMons + PARTYMON_STRUCT_LENGTH * 6)).toEqual(enemy);
  });
});
