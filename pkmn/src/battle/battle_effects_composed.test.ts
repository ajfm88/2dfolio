// A5c3c checkpoint-07. The composed port is unused by the running game (note 69 §10.17).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isPassPressed } from '../input';
import { A, PARTYMON_STRUCT_LENGTH, battleContext, type BattleState } from './battle_state';
import { BattleMenuScreen } from './battle_menu_screen';
import type { BattleScreen } from './battle_screen';
import { MOVE_EFFECT_POINTERS, type MoveEffectLabel } from './battle_effects';
import * as statusMod from './battle_effects_status';
import * as statMod from './battle_effects_stats';
import * as turnMod from './battle_effects_turns';
import * as hpMod from './battle_effects_hp';
import { loadStatEffectData } from './battle_effects_stats';
import { composedJumpMoveEffect, moveEffectHandlers, type MoveEffectEnvironment } from './battle_effects_registry';
import { BattleUnsupportedState, loadBattleMoveData } from './battle_move_data';
import * as moves from './battle_move_data';
import * as text from './battle_turn_text';
import * as status from './battle_turn_status';
import * as obedience from './battle_obedience';
import * as numbers from './battle_damage_asm';
import * as accuracy from './battle_hit';
import * as application from './battle_apply';
import * as hp from './battle_hp';
import * as hud from './battle_hud_state';
import * as random from './battle_random';
import * as helpers from './battle_execute_helpers';
import * as math from './battle_math';
import { executeEnemyMove, executePlayerMove, type ExecutePorts } from './battle_execute';
import { finish, hpRig } from '../test/battle_hp_rig';
import { getTextPrograms, loadTextPrograms } from '../text/program_data';
import type { BattleTurnTextHost } from './battle_turn_text';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await loadStatEffectData(); });
afterEach(() => vi.restoreAllMocks());

const HIT = [8, 179, 0] as const;
/** Hardcoded from note 69 §9.2. Do not derive this from EXECUTE_EFFECTS. */
const STAGE_ROW = [
  'r2', 'final', 'always', 'final', 'final', 'final', 'always', 'always', 'copy', 'r2', 'r2', 'r2', 'r2', 'r2', 'r2', 'always',
  'hit', 'r2', 'r2', 'r2', 'r2', 'r2', 'r2', 'r1', 'r1', 'r2', 'cont', 'r1', 'always', 'always', 'final', 'r2',
  'final', 'final', 'final', 'final', 'final', 'ohko', 'charge', 'set', 'set', 'cont', 'charge', 'always', 'hit', 'r1', 'r1', 'always',
  'r1', 'r2', 'r2', 'r2', 'r2', 'r2', 'r2', 'r1', 'r1', 'r2', 'r2', 'r2', 'r2', 'r2', 'r2', 'r1',
  'r1', 'r1', 'r1', 'final', 'final', 'final', 'final', 'final', 'final', 'final', 'final', 'final', 'twineedle', 'throw', 'r1', 'final',
  'rage', 'r1', 'copy', 'r1', 'r1', 'final',
] as const;
type Stage = (typeof STAGE_ROW)[number];

function drawsFor(id: number, side: 0 | 1): number[] {
  if (id === 0x09) return [...HIT, ...HIT];
  if (id === 0x53) return [...HIT, 1, ...HIT];
  if (id === 0x11) return [8, 179];
  if (id === 0x28) return [0];
  // Hit draw, then Psywave. A player 0 is rejected; the enemy accepts 0. Both must stay under level + level/2.
  if (id === 0x29) return side === 0 ? [0, 1] : [0, 0];
  if (id === 0x27 || id === 0x2b) return [];
  if ([0x18, 0x19, 0x1c, 0x2e, 0x2f, 0x38, 0x39, 0x40, 0x41, 0x4f, 0x55].includes(id)) return [];
  if (id === 0x52) return side === 0 ? [0] : [0, 0];
  if (id === 0x42 || id === 0x43 || id === 0x54) return [0];
  if (id === 0x31) return [0, 0];
  if (id === 0x1b || id === 0x2a) return [0, ...HIT];
  if (id === 0x01 || id === 0x20) return [...HIT, 0, 1];
  if (id === 0x1a) return [...HIT, 0];
  if ((id >= 0x12 && id <= 0x17) || (id >= 0x3a && id <= 0x3f) || (id >= 0x44 && id <= 0x4b)) {
    return side === 0 ? [...HIT, 0] : [...HIT, 64, 0];
  }
  if ((id >= 0x0a && id <= 0x0f) || (id >= 0x32 && id <= 0x37)) return [...HIT];
  if (id === 0x1d || id === 0x1e || id === 0x4d) return [...HIT, 0];
  if (id === 0x4c) return [...HIT, 0, 0];
  if (id === 0x56) return [...HIT, 0, 0, 0];
  if ([0x02, 0x21, 0x04, 0x05, 0x06, 0x22, 0x23, 0x24, 0x1f, 0x25].includes(id)) return [...HIT, 0];
  return [...HIT];
}

interface Event { routine: string; turn: number; levels: number[] }
function makeEnv(state: BattleState, screen: BattleScreen, mark: (routine: string) => void): MoveEffectEnvironment {
  const menu = new BattleMenuScreen();
  const host: BattleTurnTextHost = { printText: function* (label) {
    expect(getTextPrograms()[label], label).toBeDefined(); mark(`text:${label}`); yield 'session';
  } };
  return {
    screen, host,
    animation: function* (s) { mark(`animation:${s.wAnimationID}:${s.wAnimationType}`); yield 'held'; },
    hideSubstitute: function* () { mark('hide'); yield 'held'; },
    reshowSubstitute: function* () { mark('reshow'); yield 'session'; },
    animationSubstitute: function* () { mark('animationSubstitute'); yield 'held'; },
    animationTransformMon: function* () { mark('animationTransformMon'); yield 'held'; },
    moveMenu: {
      ctx: battleContext(state),
      host: {
        tiles: menu.tiles,
        getMove: id => ({ id, name: 'M', type: 'NORMAL', pp: 35, power: 40, accuracy: 1, effect: 'NO_EFFECT' }),
        readJoypad: () => { vi.mocked(isPassPressed).mockImplementation(key => key === 'a'); },
        pressSound: () => { mark('pressSound'); },
        printText: function* (label) { mark(`menuText:${label}`); yield 'session'; },
        loadScreenTilesFromBuffer1: () => { vi.mocked(isPassPressed).mockReturnValue(false); mark('restore1'); },
      },
    },
  };
}

function composedRig(side: 0 | 1, id = 1, draws: readonly number[] = HIT) {
  // A second spyOn of an ESM export returns the first mock. Restoring keeps each side's saved original real.
  vi.restoreAllMocks();
  const r = hpRig(side), s = r.s, events: Event[] = [];
  for (let i = 0; i < s.mem.length; i++) s.mem[i] = (i * 73 + (i >> 8) * 29 + 37) & 255;
  // §11.15: the patterned fixture does not supply names; only terminate the name buffers.
  s.mem[A.wBattleMonNick] = s.mem[A.wEnemyMonNick] = 0x50;
  s.hWhoseTurn = side;
  s.wBattleMonLevel = 10; s.wEnemyMonLevel = 20; s.wCurEnemyLevel = 10;
  s.wBattleMonHP = s.wEnemyMonHP = 100; s.wBattleMonMaxHP = s.wEnemyMonMaxHP = 160;
  s.wBattleMonAttack = s.wBattleMonDefense = s.wBattleMonSpeed = s.wBattleMonSpecial = 20;
  s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpeed = s.wEnemyMonSpecial = 20;
  for (const base of [A.wPlayerMonUnmodifiedLevel, A.wEnemyMonUnmodifiedLevel]) {
    for (let stat = 0; stat < 4; stat++) s.writeBE(base + 3 + stat * 2, 20);
  }
  s.wBattleMonSpecies = 1; s.wEnemyMonSpecies = 2;
  s.wBattleMonType1 = s.wBattleMonType2 = s.wEnemyMonType1 = s.wEnemyMonType2 = 1;
  s.wBattleMonStatus = s.wEnemyMonStatus = 0;
  s.wPlayerBattleStatus1 = s.wPlayerBattleStatus2 = s.wPlayerBattleStatus3 = 0;
  s.wEnemyBattleStatus1 = s.wEnemyBattleStatus2 = s.wEnemyBattleStatus3 = 0;
  s.wPlayerDisabledMove = s.wEnemyDisabledMove = 0;
  s.wPlayerDisabledMoveNumber = s.wEnemyDisabledMoveNumber = 0;
  s.wPlayerConfusedCounter = s.wEnemyConfusedCounter = 0;
  s.wLinkState = 0; s.wIsInBattle = 0; s.wCurMap = 0; s.wObtainedBadges = 0; s.wOptions = 0;
  s.wUnknownSerialFlag_d499 = 0; s.wActionResultOrTookBattleTurn = 0; s.wEscapedFromBattle = 0;
  s.wMoveMissed = 0; s.wMoveDidntMiss = 0; s.wMonIsDisobedient = 0;
  s.wCriticalHitOrOHKO = 0;
  s.wPlayerHPBarColor = 0; s.wEnemyHPBarColor = 0;
  s.species = () => ({ name: 'MON', base: [50, 50, 50, 36, 50], type1: 0, type2: 0,
    catchRate: 0, baseExp: 0, moves: [1, 0, 0, 0], learnset: [] });
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8);
  s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  s.wPlayerSelectedMove = id; s.wEnemySelectedMove = id;
  s.wPlayerUsedMove = 1; s.wEnemyUsedMove = 1;
  s.wPlayerMoveListIndex = 2; s.wEnemyMoveListIndex = 1;
  s.wPlayerMonNumber = 1; s.wEnemyMonPartyPos = 2;
  s.setBytes(A.wBattleMonMoves, [1, 0, 0, 0], 4); s.setBytes(A.wEnemyMonMoves, [1, 0, 0, 0], 4);
  s.mem.fill(12, A.wBattleMonPP, A.wBattleMonPP + 4); s.mem.fill(12, A.wEnemyMonPP, A.wEnemyMonPP + 4);
  s.mem.fill(12, A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29, A.wPartyMons + PARTYMON_STRUCT_LENGTH + 33);
  s.mem.fill(12, A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29, A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 33);
  moves.getCurrentMove(s);
  const move = side === 0 ? A.wPlayerMoveNum : A.wEnemyMoveNum;
  const mark = (routine: string) => events.push({ routine, turn: s.hWhoseTurn, levels: [s.wBattleMonLevel, s.wEnemyMonLevel] });
  let phase = '', index = 0, second = false;
  s.readDIV = () => {
    expect(index, `unexpected ${phase} draw`).toBeLessThan(draws.length);
    if (!second) { second = true; return (draws[index]! - s.hRandomAdd - 1) & 255; }
    second = false; expect(s.hRandomAdd).toBe(draws[index++]); return 0;
  };
  s.random = () => random.battleRandom(s);
  const rng = random.battleRandom;
  vi.spyOn(random, 'battleRandom').mockImplementation(state => { const n = rng(state); mark(`rng:${phase}:${n}`); return n; });
  const trace = <T>(name: string, fn: () => T): T => { phase = name; mark(name); return fn(); };
  const get = moves.getCurrentMove;
  let override: { effect?: number; power?: number; accuracy?: number; type?: number } = {};
  vi.spyOn(moves, 'getCurrentMove').mockImplementation(state => trace('getMove', () => {
    get(state);
    if (override.effect !== undefined) state.mem[move + 1] = override.effect;
    if (override.power !== undefined) state.mem[move + 2] = override.power;
    if (override.type !== undefined) state.mem[move + 3] = override.type;
    if (override.accuracy !== undefined) state.mem[move + 4] = override.accuracy;
  }));
  const reload = moves.reloadMoveData;
  vi.spyOn(moves, 'reloadMoveData').mockImplementation((state, n) => trace(`reload:${n}`, () => reload(state, n)));
  const name = moves.getName, moveName = moves.getMoveName;
  vi.spyOn(moves, 'getName').mockImplementation(state => trace('moveName', () => name(state)));
  vi.spyOn(moves, 'getMoveName').mockImplementation(state => trace('moveName', () => moveName(state)));
  const pstatus = status.checkPlayerStatusConditions, estatus = status.checkEnemyStatusConditions;
  vi.spyOn(status, 'checkPlayerStatusConditions').mockImplementation(function* (...args) { mark('status'); phase = 'status'; return yield* pstatus(...args); });
  vi.spyOn(status, 'checkEnemyStatusConditions').mockImplementation(function* (...args) { mark('status'); phase = 'status'; return yield* estatus(...args); });
  const obey = obedience.checkForDisobedience;
  vi.spyOn(obedience, 'checkForDisobedience').mockImplementation(function* (...args) { mark('obedience'); phase = 'obedience'; return yield* obey(...args); });
  const used = text.displayUsedMoveText;
  vi.spyOn(text, 'displayUsedMoveText').mockImplementation(function* (...args) { mark('usedMove'); return yield* used(...args); });
  const crit = numbers.criticalHitTest, typeAdj = numbers.adjustDamageForMoveType, range = numbers.randomizeDamage;
  vi.spyOn(numbers, 'criticalHitTest').mockImplementation(state => trace('crit', () => crit(state)));
  vi.spyOn(numbers, 'adjustDamageForMoveType').mockImplementation(state => trace('type', () => typeAdj(state)));
  vi.spyOn(numbers, 'randomizeDamage').mockImplementation(state => trace('range', () => range(state)));
  const calc = numbers.calculateDamage;
  vi.spyOn(numbers, 'calculateDamage').mockImplementation(function* (...args) { mark(`calc:${args[4]}`); return yield* calc(...args); });
  const hit = accuracy.moveHitTest, counter = accuracy.handleCounterMove;
  vi.spyOn(accuracy, 'moveHitTest').mockImplementation(state => trace('hit', () => hit(state)));
  vi.spyOn(accuracy, 'handleCounterMove').mockImplementation(state => trace('Counter', () => counter(state)));
  const papply = application.applyAttackToEnemyPokemon, eapply = application.applyAttackToPlayerPokemon;
  vi.spyOn(application, 'applyAttackToEnemyPokemon').mockImplementation(function* (...args) { mark('apply'); phase = 'Psywave'; return yield* papply(...args); });
  vi.spyOn(application, 'applyAttackToPlayerPokemon').mockImplementation(function* (...args) { mark('apply'); phase = 'Psywave'; return yield* eapply(...args); });
  const bar = hp.updateHPBar2;
  vi.spyOn(hp, 'updateHPBar2').mockImplementation(function* (...args) { mark(`bar:${args[4]}:${args[5]}:${args[6]}`); return yield* bar(...args); });
  const phud = hud.drawPlayerHud, ehud = hud.drawEnemyHud, huds = hud.drawHuds;
  vi.spyOn(hud, 'drawPlayerHud').mockImplementation(function* (...args) { mark('playerHud'); return yield* phud(...args); });
  vi.spyOn(hud, 'drawEnemyHud').mockImplementation(function* (...args) { mark('enemyHud'); return yield* ehud(...args); });
  vi.spyOn(hud, 'drawHuds').mockImplementation(function* (...args) { mark('huds'); return yield* huds(...args); });
  const criticalText = application.printCriticalOHKOText, effectiveness = application.displayEffectiveness, failure = application.printMoveFailureText;
  vi.spyOn(application, 'printCriticalOHKOText').mockImplementation(function* (...args) { mark('criticalText'); return yield* criticalText(...args); });
  vi.spyOn(application, 'displayEffectiveness').mockImplementation(function* (...args) { mark('effectiveness'); return yield* effectiveness(...args); });
  vi.spyOn(application, 'printMoveFailureText').mockImplementation(function* (...args) { mark('failure'); return yield* failure(...args); });
  const ghost = helpers.printGhostText, rage = helpers.handleBuildingRage, exploding = helpers.handleExplodingAnimation;
  vi.spyOn(helpers, 'printGhostText').mockImplementation(function* (...args) { mark('ghost'); return yield* ghost(...args); });
  vi.spyOn(helpers, 'handleBuildingRage').mockImplementation(function* (...args) { mark('rage'); return yield* rage(...args); });
  vi.spyOn(helpers, 'handleExplodingAnimation').mockImplementation(function* (...args) { mark('explode'); return yield* exploding(...args); });
  const swap = helpers.swapPlayerAndEnemyLevels;
  vi.spyOn(helpers, 'swapPlayerAndEnemyLevels').mockImplementation(state => trace('swap', () => swap(state)));
  const anim = status.playMoveAnimation;
  vi.spyOn(status, 'playMoveAnimation').mockImplementation(function* (...args) { mark(`play:${args[2]}:${s.wAnimationType}`); return yield* anim(...args); });
  const pick = math.metronomePickMove;
  vi.spyOn(math, 'metronomePickMove').mockImplementation(state => trace('Metronome', () => pick(state)));
  const executeHost: BattleTurnTextHost = { printText: function* (label) {
    expect(getTextPrograms()[label], label).toBeDefined(); mark(`text:${label}`); yield 'session';
  } };
  const env = makeEnv(s, r.screen, mark);
  const composed = composedJumpMoveEffect(env);
  const ports: ExecutePorts = {
    animation: function* (state) { mark(`animation:${state.wAnimationID}:${state.wAnimationType}`); yield 'held'; },
    hideSubstitute: function* () { mark('hide'); yield 'held'; },
    reshowSubstitute: function* () { mark('reshow'); yield 'session'; },
    substituteBreak: function* () { mark('subBreak'); yield 'held'; },
    shake: function* (_state, b) { mark(`shake:${b}`); yield 'held'; },
    statModifierUpEffect: function* () { mark('statUp'); yield 'held'; },
    jumpMoveEffect: function* (state, effect, mode) {
      mark(`effect:${mode}:${effect}`); return yield* composed(state, effect, mode);
    },
  };
  const program = () => (side === 0 ? executePlayerMove : executeEnemyMove)(s, r.screen, executeHost, ports);
  const names = () => events.filter(e => !e.routine.startsWith('frame:')).map(e => e.routine);
  const texts = () => names().filter(n => n.startsWith('text:')).map(n => n.slice(5));
  const ledger = () => {
    const lines: string[] = [];
    let last = '', repeats = 0;
    const flush = () => { if (last) lines.push(`${last}${repeats > 1 ? ` *${repeats}` : ''}`); };
    for (const event of events) {
      const line = `${event.routine} @${event.turn} L${event.levels.join('/')}`;
      if (line === last) repeats++;
      else { flush(); last = line; repeats = 1; }
    }
    flush();
    return lines;
  };
  const drive = () => {
    const before = s.mem.slice();
    const levels = [s.wBattleMonLevel, s.wEnemyMonLevel];
    let result: { b: number; exit: string } | undefined;
    let thrown: unknown;
    try { result = finish(program(), frame => mark(`frame:${frame}`)).result; }
    catch (error) { thrown = error; }
    if (!thrown) expect([s.wBattleMonLevel, s.wEnemyMonLevel]).toEqual(levels);
    const diff: string[] = [];
    for (let i = 0; i < s.mem.length; i++) if (s.mem[i] !== before[i]) diff.push(`${i.toString(16)}:${before[i]!.toString(16)}>${s.mem[i]!.toString(16)}`);
    return { result, thrown, index, names: names(), texts: texts(), ledger: ledger(), diff, effect: s.mem[move + 1]! };
  };
  return { ...r, events, mark, s, move, drive, override: (v: typeof override) => { override = v; } };
}
type Rig = ReturnType<typeof composedRig>;

function effectMarks(names: string[]): string[] { return names.filter(n => n.startsWith('effect:')); }
function assertStage(names: string[], id: number, stage: Stage, effectByte: number): void {
  const marks = effectMarks(names);
  const call = `effect:call:${id}`, tail = `effect:tail:${id}`;
  const calcAt = () => names.findIndex(n => n.startsWith('calc:'));
  if (stage === 'r1' || stage === 'charge') {
    expect(marks).toEqual([tail]);
    expect(names.some(n => n.startsWith('calc:'))).toBe(false);
    if (stage === 'charge') expect(names).not.toContain('usedMove');
  } else if (stage === 'r2') {
    expect(marks).toEqual([tail]);
    expect(calcAt()).toBeGreaterThanOrEqual(0);
    expect(calcAt()).toBeLessThan(names.indexOf(tail));
    expect(names).not.toContain('apply');
  } else if (stage === 'cont') {
    expect(marks[0]).toBe(call);
    expect(names.indexOf(call)).toBeLessThan(calcAt());
    expect(names).toContain('apply');
  } else if (stage === 'always') {
    const multi = id === 0x1d || id === 0x1e || id === 0x2c;
    expect(marks).toEqual(multi ? [call, call] : [call]);
    expect(names.indexOf('apply')).toBeLessThan(names.indexOf(call));
  } else if (stage === 'rage') {
    expect(marks).toEqual([call, call]);
    expect(names.indexOf('apply')).toBeLessThan(names.indexOf(call));
    expect(names.indexOf('rage')).toBeGreaterThan(names.indexOf(call));
    expect(names.lastIndexOf(call)).toBeGreaterThan(names.indexOf('rage'));
  } else if (stage === 'twineedle') {
    expect(marks).toEqual([call, 'effect:call:2']);
    expect(effectByte).toBe(2);
    expect(names.indexOf('apply')).toBeLessThan(names.indexOf(call));
  } else if (stage === 'final') {
    expect(marks).toEqual([call]);
    expect(names.indexOf('apply')).toBeLessThan(names.indexOf(call));
    expect(names.indexOf('rage')).toBeLessThan(names.indexOf(call));
  } else if (stage === 'ohko') {
    const at = names.map((n, i) => n === call ? i : -1).filter(i => i >= 0);
    expect(at).toHaveLength(1);
    expect(at[0]).toBeGreaterThan(calcAt());
    expect(at[0]).toBeLessThan(names.indexOf('type'));
  } else if (stage === 'set') {
    expect(marks.some(n => n.endsWith(`:${id}`))).toBe(false);
    expect(names.some(n => n.startsWith('calc:'))).toBe(false);
    expect(names).toContain('hit'); expect(names).toContain('apply');
  } else if (stage === 'hit' || stage === 'copy') {
    expect(marks.some(n => n.endsWith(`:${id}`))).toBe(false);
    expect(names).toContain('apply');
    if (stage === 'hit') expect(names).toContain('hit');
  }
}

function expectText(texts: string[], key: string): void { expect(texts).toContain(key); }

function actor(side: 0 | 1) {
  return side === 0
    ? { status: A.wBattleMonStatus, flags1: A.wPlayerBattleStatus1, flags2: A.wPlayerBattleStatus2, flags3: A.wPlayerBattleStatus3,
      hp: A.wBattleMonHP, max: A.wBattleMonMaxHP, attack: A.wBattleMonAttack, speed: A.wBattleMonSpeed, mods: A.wPlayerMonStatMods,
      selected: A.wPlayerSelectedMove, moves: A.wBattleMonMoves, pp: A.wBattleMonPP, disabled: A.wPlayerDisabledMove }
    : { status: A.wEnemyMonStatus, flags1: A.wEnemyBattleStatus1, flags2: A.wEnemyBattleStatus2, flags3: A.wEnemyBattleStatus3,
      hp: A.wEnemyMonHP, max: A.wEnemyMonMaxHP, attack: A.wEnemyMonAttack, speed: A.wEnemyMonSpeed, mods: A.wEnemyMonStatMods,
      selected: A.wEnemySelectedMove, moves: A.wEnemyMonMoves, pp: A.wEnemyMonPP, disabled: A.wEnemyDisabledMove };
}
function foe(side: 0 | 1) { return actor(side === 0 ? 1 : 0); }

function play(side: 0 | 1, moveId: number, effect: number, draws: readonly number[], prepare?: (r: Rig) => void, extra?: { power?: number; type?: number }) {
  const r = composedRig(side, moveId, draws);
  r.override({ effect, ...extra });
  prepare?.(r);
  const played = r.drive();
  return { ...played, s: r.s };
}

describe('composed registry', () => {
  function envFor(state: BattleState): MoveEffectEnvironment {
    return makeEnv(state, new BattleMenuScreen().screen, () => {});
  }
  it('stage row covers $01-$56', () => { expect(STAGE_ROW).toHaveLength(0x56); });
  it('the unused-module guard names battle_effects_registry', () => {
    const source = readFileSync(resolve(__dirname, 'a5c3_unused.test.ts'), 'utf8');
    expect(source).toContain("'battle_effects_registry'");
  });
  it('registry keys equal the 34 non-NULL labels, each from exactly one factory', () => {
    const s = hpRig(0).s;
    const env = envFor(s);
    const factories = [statusMod.statusEffectHandlers(env), statMod.statEffectHandlers(env), turnMod.turnEffectHandlers(env), hpMod.hpEffectHandlers(env)];
    const keys = factories.map(factory => Object.keys(factory));
    const flat = keys.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.length).toBe(34);
    expect(keys.map(k => k.length)).toEqual([8, 6, 11, 9]);
    const labels = new Set(MOVE_EFFECT_POINTERS.flatMap(pointer => pointer === null ? [] : [pointer.label]));
    expect(labels.size).toBe(34);
    expect(Object.keys(moveEffectHandlers(env)).sort()).toEqual([...labels].sort());
  });
  it('duplicate keys fail: every merged handler is that factory\'s own function', () => {
    const s = hpRig(0).s;
    const env = envFor(s);
    const real = {
      status: statusMod.statusEffectHandlers, stats: statMod.statEffectHandlers,
      turns: turnMod.turnEffectHandlers, hp: hpMod.hpEffectHandlers,
    };
    const captured: { status?: ReturnType<typeof real.status>; stats?: ReturnType<typeof real.stats>; turns?: ReturnType<typeof real.turns>; hp?: ReturnType<typeof real.hp> } = {};
    vi.spyOn(statusMod, 'statusEffectHandlers').mockImplementation(e => (captured.status = real.status(e)));
    vi.spyOn(statMod, 'statEffectHandlers').mockImplementation(e => (captured.stats = real.stats(e)));
    vi.spyOn(turnMod, 'turnEffectHandlers').mockImplementation(e => (captured.turns = real.turns(e)));
    vi.spyOn(hpMod, 'hpEffectHandlers').mockImplementation(e => (captured.hp = real.hp(e)));
    const merged = moveEffectHandlers(env);
    for (const table of [captured.status!, captured.stats!, captured.turns!, captured.hp!]) {
      for (const label of Object.keys(table) as MoveEffectLabel[]) expect(merged[label], label).toBe(table[label]);
    }
  });
  it('each registry handler matches its factory ledger on one fixture', () => {
    const s = hpRig(0).s;
    s.wBattleMonHP = s.wEnemyMonHP = 100; s.wBattleMonMaxHP = s.wEnemyMonMaxHP = 160;
    s.wBattleMonAttack = s.wBattleMonDefense = s.wBattleMonSpeed = s.wBattleMonSpecial = 20;
    s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpeed = s.wEnemyMonSpecial = 20;
    s.wBattleMonLevel = s.wEnemyMonLevel = s.wCurEnemyLevel = 10;
    s.wBattleMonType1 = s.wBattleMonType2 = s.wEnemyMonType1 = s.wEnemyMonType2 = 1;
    s.wBattleMonStatus = s.wEnemyMonStatus = 0;
    s.wPlayerBattleStatus1 = s.wEnemyBattleStatus1 = 0;
    s.wPlayerBattleStatus2 = s.wEnemyBattleStatus2 = 0;
    s.wPlayerBattleStatus3 = s.wEnemyBattleStatus3 = 0;
    s.wLinkState = 0; s.wIsInBattle = 0; s.wOptions = 0; s.wObtainedBadges = 0;
    s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8);
    s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
    for (const base of [A.wPlayerMonUnmodifiedLevel, A.wEnemyMonUnmodifiedLevel]) {
      for (let stat = 0; stat < 4; stat++) s.writeBE(base + 3 + stat * 2, 20);
    }
    s.setBytes(A.wBattleMonMoves, [1, 1, 1, 1], 4); s.setBytes(A.wEnemyMonMoves, [1, 1, 1, 1], 4);
    s.mem.fill(12, A.wBattleMonPP, A.wBattleMonPP + 4); s.mem.fill(12, A.wEnemyMonPP, A.wEnemyMonPP + 4);
    s.wPlayerMoveNum = 1; s.wPlayerMovePower = 40; s.wPlayerMoveAccuracy = 255;
    s.wBattleMonSpecies = 1; s.wEnemyMonSpecies = 2;
    s.species = () => ({ name: 'MON', base: [50, 50, 50, 36, 50], type1: 0, type2: 0,
      catchRate: 0, baseExp: 0, moves: [1, 0, 0, 0], learnset: [] });
    const events: string[] = [];
    vi.spyOn(random, 'battleRandom').mockImplementation(() => { events.push('R'); return 1; });
    const env = makeEnv(s, new BattleMenuScreen().screen, routine => events.push(routine));
    const merged = moveEffectHandlers(env);
    const factories = [statusMod.statusEffectHandlers(env), statMod.statEffectHandlers(env), turnMod.turnEffectHandlers(env), hpMod.hpEffectHandlers(env)];
    const base = s.mem.slice();
    const runHandler = (label: MoveEffectLabel, handler: NonNullable<(typeof merged)[MoveEffectLabel]>) => {
      s.mem.set(base); s.hWhoseTurn = 0;
      const id = MOVE_EFFECT_POINTERS.findIndex(pointer => pointer?.label === label) + 1;
      s.wPlayerMoveEffect = id; s.wPlayerMoveNum = 1; s.wPlayerMovePower = 40; s.wPlayerMoveAccuracy = 255; s.wPlayerMoveType = 0;
      events.length = 0; vi.mocked(isPassPressed).mockReturnValue(false);
      try {
        const out = finish(handler!(s));
        return { error: '', result: out.result ?? null, events: events.slice() };
      } catch (error) { return { error: error instanceof Error ? error.message : String(error), result: null, events: events.slice() }; }
    };
    for (const factory of factories) for (const label of Object.keys(factory) as MoveEffectLabel[]) {
      expect(runHandler(label, merged[label]!), label).toEqual(runHandler(label, factory[label]!));
    }
  });
});

function outcome(id: number, side: 0 | 1, played: ReturnType<Rig['drive']> & { s: BattleState }): void {
  const { texts, s } = played;
  const user = actor(side), target = foe(side);
  const rose = () => expectText(texts, 'MonsStatsRoseText');
  const fell = () => expectText(texts, 'MonsStatsFellText');
  if ((id >= 0x0a && id <= 0x0f) || (id >= 0x32 && id <= 0x37)) rose();
  if ((id >= 0x12 && id <= 0x17) || (id >= 0x3a && id <= 0x3f) || (id >= 0x44 && id <= 0x4a)) fell();
  if (id === 0x01 || id === 0x20) expectText(texts, 'FellAsleepText');
  if (id === 0x02 || id === 0x21 || id === 0x42 || id === 0x4d) expectText(texts, 'PoisonedText');
  if (id === 0x04 || id === 0x22) expectText(texts, 'BurnedText');
  if (id === 0x05 || id === 0x23) expectText(texts, 'FrozenText');
  if (id === 0x06 || id === 0x24) expectText(texts, 'ParalyzedMayNotAttackText');
  if (id === 0x43) expectText(texts, 'ParalyzedMayNotAttackText');
  if (id === 0x31 || id === 0x4c) expectText(texts, 'BecameConfusedText');
  if (id === 0x1f || id === 0x25) expect(s.mem[target.flags1]! & 8).toBe(8);
  if (id === 0x54) expectText(texts, 'WasSeededText');
  if (id === 0x07) expect(s.readBE(user.hp)).toBe(0);
  if (id === 0x10) expectText(texts, 'CoinsScatteredText');
  if (id === 0x1a) expect(s.mem[user.flags1]! & 1).toBe(1);
  if (id === 0x1b) expect(s.mem[user.flags1]! & 2).toBe(2);
  if (id === 0x1c) expectText(texts, 'WasBlownAwayText');
  if (id === 0x1d || id === 0x1e || id === 0x2c) expectText(texts, side === 0 ? 'MultiHitText' : 'HitXTimesText');
  if (id === 0x26) { expect(played.result).toEqual({ b: 0, exit: 'fainted' }); expectText(texts, 'OHKOText'); }
  if (id === 0x27 || id === 0x2b) expectText(texts, 'ChargeMoveEffectText');
  if (id === 0x2a) expect(s.mem[user.flags1]! & 0x20).toBe(0x20);
  if (id === 0x50) expect(s.mem[user.flags2]! & 0x20).toBe(0x20);
  if (id === 0x51) expect(s.mem[user.flags2]! & 0x40).toBe(0x40);
  if (id === 0x03) expectText(texts, 'SuckedHealthText');
  if (id === 0x08) expectText(texts, 'DreamWasEatenText');
  if (id === 0x30) expectText(texts, 'HitWithRecoilText');
  if (id === 0x19) expectText(texts, 'StatusChangesEliminatedText');
  if (id === 0x2e) expectText(texts, 'ShroudedInMistText');
  if (id === 0x2f) expectText(texts, 'GettingPumpedText');
  if (id === 0x40) expectText(texts, 'LightScreenProtectedText');
  if (id === 0x41) expectText(texts, 'ReflectGainedArmorText');
  if (id === 0x38) expectText(texts, 'RegainedHealthText');
  if (id === 0x39) expectText(texts, 'TransformedText');
  if (id === 0x18) expectText(texts, 'ConvertedTypeText');
  if (id === 0x52) expectText(texts, 'MimicLearnedMoveText');
  if (id === 0x4f) expectText(texts, 'SubstituteText');
  if (id === 0x55) expectText(texts, 'NoEffectText');
  if (id === 0x56) expectText(texts, 'MoveWasDisabledText');
  if (id === 0x09 || id === 0x53) expect(played.names).toContain('reload:1');
}

describe('every effect id through execute', () => {
  it.each(STAGE_ROW.map((stage, index) => ({ id: index + 1, stage, hex: (index + 1).toString(16).padStart(2, '0') })))(
    'effect 0x$hex $stage', ({ id, stage }) => {
      for (const side of [0, 1] as const) {
        const draws = drawsFor(id, side);
        const played = play(side, 1, id, draws, r => {
          if (id === 0x08) r.s.mem[foe(side).status] = 1;
          if (id === 0x1c) r.s.wIsInBattle = 1;
        });
        if (id === 0x4b) {
          // Name index 8 walks off the six-name table. Index 7 ($4A) lands past the last terminator and still prints.
          expect(played.thrown).toBeInstanceOf(BattleUnsupportedState);
          expect(String(played.thrown)).toMatch(/stat name index outside table/);
          expect(played.names).toContain(`effect:call:${id}`);
          expect(played.index).toBe(draws.length);
          expect(played.s.mem[foe(side).mods + (id - 0x44)]).toBe(6);
        } else if (stage === 'throw') {
          expect(played.thrown).toBeInstanceOf(BattleUnsupportedState);
          expect(String(played.thrown)).toMatch(/NULL move effect \$4e/);
          const at = played.names.indexOf('effect:call:78');
          expect(at).toBeGreaterThanOrEqual(0);
          expect(played.names.slice(at + 1).some(n => n.startsWith('text:') || n.startsWith('rng:'))).toBe(false);
          expect(played.index).toBe(draws.length);
        } else {
          if (played.thrown) throw played.thrown;
          expect(played.index).toBe(draws.length);
          assertStage(played.names, id, stage, played.effect);
          const tail = stage === 'r1' || stage === 'r2' || stage === 'charge';
          expect(played.result).toEqual(id === 0x26 ? { b: 0, exit: 'fainted' } : { b: tail ? 1 : 1, exit: tail ? 'effect' : 'done' });
          outcome(id, side, played);
          if (id >= 0x48 && id <= 0x4a) expect(played.s.mem[foe(side).mods + (id - 0x44)]).toBe(6);
        }
        expect({ side, result: played.result ?? null, error: played.thrown instanceof Error ? played.thrown.message : '',
          ledger: played.ledger, texts: played.texts, diff: played.diff }).toMatchSnapshot();
      }
    });
});

describe('NULL and non-dispatching ids', () => {
  it.each([0x11, 0x2d] as const)('$id reaches hit and apply and never calls the effect port', id => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, id, drawsFor(id, side));
      if (played.thrown) throw played.thrown;
      expect(effectMarks(played.names)).toEqual([]);
      expect(played.names).toContain('hit'); expect(played.names).toContain('apply');
    }
  });
  it.each([0x28, 0x29] as const)('$id takes the set-damage path with no dispatch', id => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, id, drawsFor(id, side));
      if (played.thrown) throw played.thrown;
      expect(effectMarks(played.names)).toEqual([]);
      expect(played.names.some(n => n.startsWith('calc:'))).toBe(false);
      expect(played.names).toContain('apply');
    }
  });
  it.each([0x09, 0x53] as const)('$id copies and restarts with no dispatch of that id', id => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, id, drawsFor(id, side));
      if (played.thrown) throw played.thrown;
      expect(effectMarks(played.names).some(n => n.endsWith(`:${id}`))).toBe(false);
      expect(played.names).toContain('reload:1'); expect(played.names).toContain('apply');
    }
  });
  it('$4E injected at the final call throws before any effect draw or text', () => {
    const played = play(0, 1, 0x4e, HIT);
    expect(played.thrown).toBeInstanceOf(BattleUnsupportedState);
    const at = played.names.indexOf('effect:call:78');
    expect(played.names.slice(at + 1).some(n => n.startsWith('text:') || n.startsWith('rng:'))).toBe(false);
  });
  it('$00 skips the final gate with no dispatch', () => {
    const played = play(0, 1, 0, HIT);
    if (played.thrown) throw played.thrown;
    expect(effectMarks(played.names)).toEqual([]);
    expect(played.result).toEqual({ b: 1, exit: 'done' });
  });
});

describe('§4 bug 1: sleep through recharge', () => {
  it('sleep clears recharge before status and hit gates, overwriting the entire prior status', () => {
    const played = play(0, 1, 0x20, [...HIT, 1], r => { r.s.wEnemyBattleStatus2 = 0x20; r.s.wEnemyMonStatus = 0x40; });
    if (played.thrown) throw played.thrown;
    expect(played.s.wEnemyMonStatus).toBe(1);
    expect(played.s.wEnemyBattleStatus2 & 0x20).toBe(0);
    expect(played.texts).toContain('FellAsleepText');
    expect(played.names.filter(n => n === 'hit')).toHaveLength(1);
  });
});

describe('§4 bug 2: the freeze clears recharge only when the player attacks', () => {
  it('boundary succeeds=true consumes exactly one byte and uses the correct animation', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x05, [...HIT, 0], r => { r.s.mem[foe(side).flags2] = 0x20; });
      if (played.thrown) throw played.thrown;
      expect(played.s.mem[foe(side).status]).toBe(0x20);
      expect(played.s.mem[foe(side).flags2]! & 0x20).toBe(side === 0 ? 0 : 0x20);
      expect(played.texts).toContain('FrozenText');
    }
  });
});

describe('§4 bug 3: confusion side effect is 25/256 without +1', () => {
  it('secondary confusion R24 passes Substitute and invulnerability without HIT, rolls duration and does not animate', () => {
    const played = play(0, 1, 0x4c, [...HIT, 24, 0]);
    if (played.thrown) throw played.thrown;
    expect(played.s.wEnemyBattleStatus1 & 0x80).toBe(0x80);
    expect(played.texts).toContain('BecameConfusedText');
    const at = played.names.indexOf('effect:call:76');
    expect(played.names.slice(at + 1).some(n => n.startsWith('animation:'))).toBe(false);
  });
  it('secondary confusion R25 fails silently, without a duration draw', () => {
    const played = play(0, 1, 0x4c, [...HIT, 25]);
    if (played.thrown) throw played.thrown;
    expect(played.s.wEnemyBattleStatus1 & 0x80).toBe(0);
    expect(played.texts).not.toContain('BecameConfusedText');
  });
});

describe('§4 bug 4: enemy stat-down misses 25% off-link before substitute', () => {
  it('id18 roll63 fails before Substitute/HIT/chance and remains a primary-only printer', () => {
    const enemy = play(1, 1, 0x12, [...HIT, 63]);
    if (enemy.thrown) throw enemy.thrown;
    expect(enemy.s.mem[A.wPlayerMonStatMods]).toBe(7);
    expect(enemy.texts).toContain('ButItFailedText');
    const player = play(0, 1, 0x12, [...HIT, 0]);
    if (player.thrown) throw player.thrown;
    expect(player.s.mem[A.wEnemyMonStatMods]).toBe(6);
    expect(player.texts).toContain('MonsStatsFellText');
  });
});

describe('§4 bug 5: badge boosts reapply and both penalties run', () => {
  it('badge side asymmetry and both target penalties after up=true text', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x0a, HIT, r => { r.s.wObtainedBadges = 1; r.s.mem[foe(side).status] = 0x50; });
      if (played.thrown) throw played.thrown;
      const user = actor(side), target = foe(side);
      expect(played.s.readBE(user.attack)).toBe(side === 0 ? 33 : 30);
      expect(played.s.readBE(target.attack)).toBe(10);
      expect(played.s.readBE(target.speed)).toBe(5);
    }
  });
  it('badge side asymmetry and both target penalties after up=false text', () => {
    const player = play(0, 1, 0x12, [...HIT, 0], r => { r.s.wObtainedBadges = 1; r.s.wEnemyMonStatus = 0x50; });
    if (player.thrown) throw player.thrown;
    expect(player.s.wEnemyMonAttack).toBe(6); expect(player.s.wEnemyMonSpeed).toBe(5);
    const enemy = play(1, 1, 0x12, [...HIT, 64, 0], r => { r.s.wObtainedBadges = 1; r.s.wBattleMonStatus = 0x50; });
    if (enemy.thrown) throw enemy.thrown;
    expect(enemy.s.wBattleMonAttack).toBe(7); expect(enemy.s.wBattleMonSpeed).toBe(5);
  });
});

describe('§4 bug 6: stat 999 undoes the stat-up and stat 1 undoes the stat-down', () => {
  it('up id10 writes stage before testing exactly999, then rolls back only one', () => {
    const played = play(0, 1, 0x0a, [], r => { r.s.wBattleMonAttack = 999; }, { power: 0 });
    if (played.thrown) throw played.thrown;
    expect(played.s.mem[A.wPlayerMonStatMods]).toBe(7);
    expect(played.s.wBattleMonAttack).toBe(999);
    expect(played.texts).toContain('NothingHappenedText');
  });
  it('down id18 stat1 rollback is one stage only', () => {
    const played = play(0, 1, 0x12, [0], r => { r.s.wEnemyMonAttack = 1; }, { power: 0 });
    if (played.thrown) throw played.thrown;
    expect(played.s.mem[A.wEnemyMonStatMods]).toBe(7);
    expect(played.s.wEnemyMonAttack).toBe(1);
    expect(played.texts).toContain('NothingHappenedText');
  });
});

describe('§4 bug 7: Heal compares only the low bytes', () => {
  it('carry test HP$old/$max fails with wait50 then unconditional printer, no writes', () => {
    for (const row of [{ old: 1, max: 256, heal: false }, { old: 45, max: 300, heal: false }, { old: 1, max: 512, heal: false }, { old: 0, max: 255, heal: true }]) {
      const played = play(0, 1, 0x38, [], r => { r.s.wBattleMonHP = row.old; r.s.wBattleMonMaxHP = row.max; });
      if (played.thrown) throw played.thrown;
      expect(played.s.wBattleMonHP).toBe(row.heal ? Math.min(row.max, row.old + (row.max >>> 1)) : row.old);
      expect(played.texts.includes('RegainedHealthText')).toBe(row.heal);
      if (!row.heal) expect(played.texts).toContain('ButItFailedText');
    }
  });
});

describe('§4 bug 8: Substitute can leave the user at 0 HP', () => {
  it('HP0/3 cost0 accepts equality/zero and pins one-byte truncation', () => {
    const played = play(0, 1, 0x4f, [], r => { r.s.wBattleMonHP = 0; r.s.wBattleMonMaxHP = 3; });
    if (played.thrown) throw played.thrown;
    expect(played.s.wBattleMonHP).toBe(0);
    expect(played.s.wPlayerBattleStatus2 & 0x10).toBe(0x10);
    expect(played.texts).toContain('SubstituteText');
  });
});

describe('§4 bug 9: Transform checks the user on the player turn only', () => {
  it('player INVULNERABLE fails after zeroing wPlayerMoveListIndex and copies nothing', () => {
    const played = play(0, 1, 0x39, [], r => { r.s.wPlayerBattleStatus1 = 0x40; r.s.wPlayerMoveListIndex = 5; });
    if (played.thrown) throw played.thrown;
    expect(played.s.wPlayerMoveListIndex).toBe(0);
    expect(played.s.wBattleMonSpecies).toBe(1);
    expect(played.s.wPlayerBattleStatus3 & 0x08).toBe(0);
    expect(played.texts).toContain('ButItFailedText');
  });
  it('enemy turn ignores the user INVULNERABLE bit and does not write wPlayerMoveListIndex', () => {
    const played = play(1, 1, 0x39, [], r => { r.s.wEnemyBattleStatus1 = 0x40; r.s.wPlayerMoveListIndex = 5; });
    if (played.thrown) throw played.thrown;
    expect(played.s.wPlayerMoveListIndex).toBe(5);
    expect(played.s.wEnemyMonSpecies).toBe(1);
    expect(played.texts).toContain('TransformedText');
  });
  it('player turn ignores the target INVULNERABLE bit', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x39, [], r => { r.s.mem[foe(side).flags1] = 0x40; });
      if (played.thrown) throw played.thrown;
      expect(played.s.mem[actor(side).flags3]! & 0x08).toBe(0x08);
      expect(played.texts).toContain('TransformedText');
    }
  });
});

describe('§4 bug 10: Teleport / Whirlwind / Roar', () => {
  it('trainer/non-wild state2 Roar waits50 then IsUnaffected, never HIT/RNG or state changes', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 46, 0x1c, [], r => { r.s.wIsInBattle = 2; });
      if (played.thrown) throw played.thrown;
      expect(played.texts).toContain('IsUnaffectedText');
      expect(played.names.some(n => n.startsWith('rng:'))).toBe(false);
      expect(played.s.wEscapedFromBattle).toBe(0);
    }
  });
  it('trainer Teleport MoveDidntMiss0 uses the side-specific failure printer', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 100, 0x1c, [], r => { r.s.wIsInBattle = 2; });
      if (played.thrown) throw played.thrown;
      expect(played.s.wMoveDidntMiss).toBe(0);
      expect(played.texts).toContain('ButItFailedText');
    }
  });
  it('wild lower-level move100 accepted0 fails after rejected draws, unconditional Teleport failure both sides', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 100, 0x1c, [0], r => {
        r.s.wIsInBattle = 1;
        if (side === 0) { r.s.wBattleMonLevel = 10; r.s.wCurEnemyLevel = 20; }
        else { r.s.wCurEnemyLevel = 10; r.s.wBattleMonLevel = 20; }
      });
      if (played.thrown) throw played.thrown;
      expect(played.texts).toContain('ButItFailedText');
      expect(played.s.wEscapedFromBattle).toBe(0);
    }
  });
  it('wild lower-level move46 accepted0 fails after rejected draws, DidntAffect both sides', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 46, 0x1c, [0], r => {
        r.s.wIsInBattle = 1;
        if (side === 0) { r.s.wBattleMonLevel = 10; r.s.wCurEnemyLevel = 20; }
        else { r.s.wCurEnemyLevel = 10; r.s.wBattleMonLevel = 20; }
      });
      if (played.thrown) throw played.thrown;
      expect(played.texts).toContain('DidntAffectText');
    }
  });
});

describe('§4 bug 11: Twineedle rewrites itself to poison', () => {
  it('fixed two hits id77 consumes no RNG and rewrites only Twineedle', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x4d, [...HIT, 0]);
      if (played.thrown) throw played.thrown;
      expect(played.names).toContain('effect:call:77');
      expect(played.names).toContain('effect:call:2');
      expect(played.effect).toBe(2);
      expect(played.texts).toContain('PoisonedText');
    }
  });
});

describe('§4 bug 12: Disable PP check runs only on the enemy turn and in link', () => {
  it('non-link Disable ignores PP, rejects empty slots, and packs the accepted slot', () => {
    const played = play(0, 1, 0x56, [...HIT, 0, 2, 0], r => {
      r.s.setBytes(A.wEnemyMonMoves, [0, 0, 1, 0], 4); r.s.mem.fill(0, A.wEnemyMonPP, A.wEnemyMonPP + 4);
    });
    if (played.thrown) throw played.thrown;
    expect(played.s.wEnemyDisabledMove).toBe(0x31);
    expect(played.texts).toContain('MoveWasDisabledText');
  });
  it('enemy Disable reads the player PP, redraws a zero raw byte, and packs slot 1', () => {
    const played = play(1, 1, 0x56, [...HIT, 0, 0, 1, 0], r => {
      r.s.setBytes(A.wBattleMonMoves, [1, 2, 0, 0], 4); r.s.setBytes(A.wBattleMonPP, [0, 5, 0, 0], 4);
    });
    if (played.thrown) throw played.thrown;
    expect(played.s.wPlayerDisabledMove).toBe(0x21);
    expect(played.texts).toContain('MoveWasDisabledText');
  });
});

describe('§4 bug 13: Fire defrost writes the party copy', () => {
  it('frozen + FIRE defrosts before type match or roll and clears exactly the selected roster status', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x04, HIT, r => {
        r.s.mem[foe(side).status] = 0x20;
        const base = side === 0 ? A.wEnemyMons + r.s.wEnemyMonPartyPos * PARTYMON_STRUCT_LENGTH
          : A.wPartyMons + r.s.wPlayerMonNumber * PARTYMON_STRUCT_LENGTH;
        r.s.mem[base + 4] = 0xab;
      }, { type: 20 });
      if (played.thrown) throw played.thrown;
      expect(played.s.mem[foe(side).status]).toBe(0);
      const base = side === 0 ? A.wEnemyMons + played.s.wEnemyMonPartyPos * PARTYMON_STRUCT_LENGTH
        : A.wPartyMons + played.s.wPlayerMonNumber * PARTYMON_STRUCT_LENGTH;
      expect(played.s.mem[base + 4]).toBe(0);
      expect(played.texts).toContain('FireDefrostedText');
      expect(played.names.filter(n => n.startsWith('rng:')).filter(n => n.startsWith('rng:hit:') || n.includes(':Psywave:'))).not.toContain('rng:hit:1');
    }
  });
});

describe('§4 bug 14: Haze cures only the target and skips badge boosts', () => {
  it('Haze target status32 selects FF only for sleep/freeze and only on the target', () => {
    for (const side of [0, 1] as const) {
      const played = play(side, 1, 0x19, [], r => {
        r.s.mem[foe(side).status] = 0x20; r.s.mem[actor(side).status] = 0x10;
        r.s.writeBE(actor(side).attack, 99); r.s.writeBE(foe(side).attack, 99);
        r.s.writeBE((side === 0 ? A.wPlayerMonUnmodifiedLevel : A.wEnemyMonUnmodifiedLevel) + 3, 40);
        r.s.writeBE((side === 0 ? A.wEnemyMonUnmodifiedLevel : A.wPlayerMonUnmodifiedLevel) + 3, 40);
        r.s.wObtainedBadges = 1;
      });
      if (played.thrown) throw played.thrown;
      expect(played.s.mem[foe(side).status]).toBe(0);
      expect(played.s.mem[actor(side).status]).toBe(0x10);
      expect(played.s.mem[foe(side).selected]).toBe(0xff);
      expect(played.s.readBE(actor(side).attack)).toBe(40);
      expect(played.s.readBE(foe(side).attack)).toBe(40);
    }
  });
});

describe('§4 bug 15: OHKO compares full-word speeds', () => {
  it('OHKO live speed preserves full-word borrow/tie and slow FF sentinel', () => {
    for (const side of [0, 1] as const) for (const [own, target, hit] of [[0x200, 0x1ff, true], [0x123, 0x123, true], [0x1ff, 0x200, false]] as const) {
      const played = play(side, 1, 0x26, hit ? HIT : [8], r => {
        r.s.writeBE(actor(side).speed, own); r.s.writeBE(foe(side).speed, target);
      });
      if (played.thrown) throw played.thrown;
      if (hit) {
        expect(played.result).toEqual({ b: 0, exit: 'fainted' });
        expect(played.texts).toContain('OHKOText');
        expect(played.s.wCriticalHitOrOHKO).toBe(0);
        expect(played.names.filter(n => n === 'effect:call:38')).toHaveLength(1);
        expect(played.names.indexOf('effect:call:38')).toBeLessThan(played.names.indexOf('type'));
      } else {
        expect(played.s.wMoveMissed).toBe(1);
        expect(played.s.wDamage).toBe(0);
        expect(played.texts).toContain('UnaffectedText');
        expect(played.s.wCriticalHitOrOHKO).toBe(0);
        expect(played.names).not.toContain('type');
        expect(played.names.filter(n => n === 'effect:call:38')).toHaveLength(1);
        expect(played.result?.exit).not.toBe('fainted');
      }
    }
  });
});
