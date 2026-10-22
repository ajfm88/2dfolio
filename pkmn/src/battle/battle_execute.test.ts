import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A, LINK_STATE_BATTLING, PARTYMON_STRUCT_LENGTH, POKEMON_TOWER_1F, POKEMON_TOWER_7F, SILPH_SCOPE } from './battle_state';
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
import { executePlayerMove, executeEnemyMove, type ExecutePorts } from './battle_execute';
import { finish, hpRig } from '../test/battle_hp_rig';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import type { BattleTurnTextHost } from './battle_turn_text';

beforeAll(async () => { await moves.loadBattleMoveData(); await loadTextPrograms(); });
afterEach(() => vi.restoreAllMocks());

interface Event { routine: string; turn: number; levels: number[] }
function rig(side: 0 | 1, id = 1, draws: readonly number[] = [8, 179, 0]) {
  const r = hpRig(side), s = r.s, events: Event[] = [];
  s.wBattleMonLevel = 10; s.wEnemyMonLevel = 20;
  s.wBattleMonAttack = 20; s.wBattleMonDefense = 20; s.wBattleMonSpecial = 20;
  s.wEnemyMonAttack = 20; s.wEnemyMonDefense = 20; s.wEnemyMonSpecial = 20;
  s.wBattleMonSpecies = 1; s.wEnemyMonSpecies = 2;
  s.wBattleMonType1 = 3; s.wBattleMonType2 = 3; s.wEnemyMonType1 = 3; s.wEnemyMonType2 = 3;
  s.species = () => ({ name: 'MON', base: [50, 50, 50, 36, 50], type1: 0, type2: 0,
    catchRate: 0, baseExp: 0, moves: [1, 0, 0, 0], learnset: [] });
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8);
  s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  s.wPlayerSelectedMove = id; s.wEnemySelectedMove = id;
  s.wPlayerMoveListIndex = 2; s.wEnemyMoveListIndex = 1;
  s.wPlayerMonNumber = 1; s.wEnemyMonPartyPos = 2;
  s.mem.fill(12, A.wBattleMonPP, A.wBattleMonPP + 4); s.mem.fill(12, A.wEnemyMonPP, A.wEnemyMonPP + 4);
  s.mem.fill(12, A.wPartyMons + PARTYMON_STRUCT_LENGTH + 29, A.wPartyMons + PARTYMON_STRUCT_LENGTH + 33);
  s.mem.fill(12, A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 29, A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH + 33);
  // Preload cached data/name without invoking the execution call log.
  moves.getCurrentMove(s);
  const move = side === 0 ? A.wPlayerMoveNum : A.wEnemyMoveNum;
  const flags1 = side === 0 ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1;
  const flags2 = side === 0 ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2;
  const count = side === 0 ? A.wPlayerNumAttacksLeft : A.wEnemyNumAttacksLeft;
  const hits = side === 0 ? A.wPlayerNumHits : A.wEnemyNumHits;
  const selected = side === 0 ? A.wPlayerSelectedMove : A.wEnemySelectedMove;
  const battlePP = (side === 0 ? A.wBattleMonPP : A.wEnemyMonPP) + (side === 0 ? 2 : 1);
  const partyPP = (side === 0 ? A.wPartyMons + PARTYMON_STRUCT_LENGTH : A.wEnemyMons + 2 * PARTYMON_STRUCT_LENGTH) + 29 + (side === 0 ? 2 : 1);
  const mark = (routine: string) => events.push({ routine, turn: s.hWhoseTurn, levels: [s.wBattleMonLevel, s.wEnemyMonLevel] });
  let phase = '', index = 0, second = false;
  s.readDIV = () => {
    expect(index, `unexpected ${phase} draw`).toBeLessThan(draws.length);
    if (!second) { second = true; return (draws[index] - s.hRandomAdd - 1) & 255; }
    second = false; expect(s.hRandomAdd).toBe(draws[index++]); return 0;
  };
  s.random = () => random.battleRandom(s);
  const rng = random.battleRandom;
  vi.spyOn(random, 'battleRandom').mockImplementation(state => { const n = rng(state); mark(`rng:${phase}:${n}`); return n; });
  const trace = <T>(name: string, fn: () => T): T => { phase = name; mark(name); return fn(); };
  const get = moves.getCurrentMove;
  let override: { effect?: number; power?: number; accuracy?: number } = {};
  vi.spyOn(moves, 'getCurrentMove').mockImplementation(state => trace('getMove', () => {
    get(state);
    if (override.effect !== undefined) state.mem[move + 1] = override.effect;
    if (override.power !== undefined) state.mem[move + 2] = override.power;
    if (override.accuracy !== undefined) state.mem[move + 4] = override.accuracy;
  }));
  const reload = moves.reloadMoveData;
  vi.spyOn(moves, 'reloadMoveData').mockImplementation((state, n) => trace(`reload:${n}`, () => reload(state, n)));
  const name = moves.getName;
  vi.spyOn(moves, 'getName').mockImplementation(state => trace('moveName', () => name(state)));
  const moveName = moves.getMoveName;
  vi.spyOn(moves, 'getMoveName').mockImplementation(state => trace('moveName', () => moveName(state)));
  const pstatus = status.checkPlayerStatusConditions, estatus = status.checkEnemyStatusConditions;
  vi.spyOn(status, 'checkPlayerStatusConditions').mockImplementation(function* (...args) { mark('status'); phase = 'status'; return yield* pstatus(...args); });
  vi.spyOn(status, 'checkEnemyStatusConditions').mockImplementation(function* (...args) { mark('status'); phase = 'status'; return yield* estatus(...args); });
  const obey = obedience.checkForDisobedience;
  vi.spyOn(obedience, 'checkForDisobedience').mockImplementation(function* (...args) { mark('obedience'); phase = 'obedience'; return yield* obey(...args); });
  const used = text.displayUsedMoveText;
  vi.spyOn(text, 'displayUsedMoveText').mockImplementation(function* (...args) { mark('usedMove'); return yield* used(...args); });
  const crit = numbers.criticalHitTest, type = numbers.adjustDamageForMoveType, range = numbers.randomizeDamage;
  vi.spyOn(numbers, 'criticalHitTest').mockImplementation(state => trace('crit', () => crit(state)));
  vi.spyOn(numbers, 'adjustDamageForMoveType').mockImplementation(state => trace('type', () => type(state)));
  vi.spyOn(numbers, 'randomizeDamage').mockImplementation(state => trace('range', () => range(state)));
  const pvars = numbers.getDamageVarsForPlayerAttack, evars = numbers.getDamageVarsForEnemyAttack;
  vi.spyOn(numbers, 'getDamageVarsForPlayerAttack').mockImplementation(state => trace('vars', () => pvars(state)));
  vi.spyOn(numbers, 'getDamageVarsForEnemyAttack').mockImplementation(state => trace('vars', () => evars(state)));
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
  const host: BattleTurnTextHost = { printText: function* (label) {
    expect(getTextPrograms()[label]).toBeDefined(); mark(`text:${label}`); yield 'session';
  } };
  const ports: ExecutePorts = {
    animation: function* () { mark(`animation:${s.wAnimationID}:${s.wAnimationType}`); yield 'held'; },
    hideSubstitute: function* () { mark('hide'); yield 'held'; },
    reshowSubstitute: function* () { mark('reshow'); yield 'session'; },
    substituteBreak: function* () { mark('subBreak'); yield 'held'; },
    shake: function* (_state, b) { mark(`shake:${b}`); yield 'held'; },
    statModifierUpEffect: function* () { mark('statUp'); yield 'held'; },
    jumpMoveEffect: function* (_state, effect, mode) { mark(`effect:${mode}:${effect}`); yield 'held'; return 7; },
  };
  const program = () => (side === 0 ? executePlayerMove : executeEnemyMove)(s, r.screen, host, ports);
  const run = () => {
    const levels = [s.wBattleMonLevel, s.wEnemyMonLevel];
    const out = finish(program(), frame => mark(`frame:${frame}`));
    expect([s.wBattleMonLevel, s.wEnemyMonLevel]).toEqual(levels);
    if (s.wLinkState !== LINK_STATE_BATTLING) expect(index).toBe(draws.length);
    // Lossless run-length encoding keeps every routine, actor, level and owned frame reviewable.
    const ledger: string[] = [];
    let last = '', repeats = 0;
    const flush = () => { if (last) ledger.push(`${last}${repeats > 1 ? ` *${repeats}` : ''}`); };
    for (const event of events) {
      const line = `${event.routine} @${event.turn} L${event.levels.join('/')}`;
      if (line === last) repeats++;
      else { flush(); last = line; repeats = 1; }
    }
    flush();
    expect({ result: out.result, ledger }).toMatchSnapshot();
    return out;
  };
  const names = () => events.filter(e => !e.routine.startsWith('frame:')).map(e => e.routine);
  return { ...r, events, mark, ports, host, move, flags1, flags2, count, hits, selected, battlePP, partyPP,
    run, program, names, override: (v: typeof override) => { override = v; } };
}

for (const side of [0, 1] as const) describe(`Execute actor ${side}`, () => {
  it('plain hit has the complete routine / level / RNG / frame ledger', () => {
    const r = rig(side); const out = r.run();
    expect(out.result).toEqual({ b: 1, exit: 'done' });
    expect(r.names()).toEqual([
      'ghost', 'status', 'getMove', ...(side === 0 ? ['obedience'] : []), 'usedMove', 'text:UsedMoveText',
      ...(side ? ['swap'] : []), 'crit', 'rng:crit:8', 'Counter', ...(side ? ['swap'] : []), 'vars',
      ...(side ? ['swap'] : []), `calc:${side ? 20 : 10}`, 'type', 'range', 'rng:range:179', 'hit', 'rng:hit:0',
      ...(side ? ['swap'] : []), `play:1:${side ? 1 : 4}`, `animation:1:${side ? 1 : 4}`, 'explode', side ? 'enemyHud' : 'playerHud',
      'apply', `bar:${side ? 1 : 0}:100:${side ? 92 : 95}`, 'huds', 'criticalText', 'effectiveness', 'rage',
    ]);
    for (const e of r.events) {
      expect(e.turn).toBe(side);
      const swapped = side === 1 && (['crit', 'rng:crit:8', 'Counter', 'calc:20', 'type', 'range', 'rng:range:179', 'hit', 'rng:hit:0'].includes(e.routine));
      if (e.routine !== 'swap') expect(e.levels).toEqual(swapped ? [20, 10] : [10, 20]);
    }
    expect(out.frames).toEqual(['session', ...Array(3).fill('serviced'), 'held', ...Array((side ? 20 : 9) + 20).fill('serviced')]);
    expect(r.s.readBE(r.c.opposite)).toBe(side ? 92 : 95); expect(r.s.wMoveDidntMiss).toBe(1);
    expect(r.s.mem[r.battlePP]).toBe(side ? 12 : 11); expect(r.s.mem[r.partyPP]).toBe(side ? 12 : 11);
  });
  it('ordinary accuracy miss spends crit/range/hit then waits30 before failure', () => {
    const r = rig(side, 1, [8, 179, 255]); const out = r.run();
    expect(out.result).toEqual({ b: 1, exit: 'done' });
    expect(r.names()).toContain('text:AttackMissedText'); expect(r.names()).not.toContain('apply');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:crit:8', 'rng:range:179', 'rng:hit:255']);
    expect(out.frames).toEqual(['session', ...Array(30).fill('serviced'), 'session']);
    expect(r.s.wDamage).toBe(0); expect(r.s.wMoveDidntMiss).toBe(0);
  });
  it.each(['immunity', 'Dream Eater', 'invulnerability', 'Swift', 'X Accuracy'])('conditional hit stream: %s', gate => {
    const id = gate === 'Dream Eater' ? 138 : gate === 'Swift' ? 129 : 1;
    const r = rig(side, id, gate === 'immunity' ? [8, 0] : [8, 179]);
    if (gate === 'immunity') r.s.mem[side ? A.wBattleMonType1 : A.wEnemyMonType1] = 8;
    if (gate === 'invulnerability') r.s.mem[side ? A.wPlayerBattleStatus1 : A.wEnemyBattleStatus1] = 0x40;
    if (gate === 'X Accuracy') r.s.mem[r.flags2] = 1;
    expect(r.run().result.exit).toBe('done');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(gate === 'immunity'
      ? ['rng:crit:8', 'rng:hit:0'] : ['rng:crit:8', 'rng:range:179']);
    const missed = gate !== 'Swift' && gate !== 'X Accuracy';
    expect(r.s.wMoveMissed !== 0).toBe(missed); expect(r.names().includes('apply')).toBe(!missed);
    if (gate === 'immunity') expect(r.names()).toContain('text:DoesntAffectMonText');
  });
  it('range rejection consumes its draw before the single hit draw', () => {
    const r = rig(side, 1, [8, 0, 179, 0]); expect(r.run().result.exit).toBe('done');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:crit:8', 'rng:range:0', 'rng:range:179', 'rng:hit:0']);
  });
  it.each([false, true])('OHKO calculation calls its effect port, missed%s controls Z and subsequent stages', missed => {
    const r = rig(side, 12, missed ? [8] : [8, 179, 0]);
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); expect([effect, mode]).toEqual([0x26, 'call']);
      r.s.wMoveMissed = missed ? 1 : 0; r.s.wCriticalHitOrOHKO = missed ? 255 : 2; r.s.wDamage = missed ? 0 : 500;
      yield 'held'; return 0;
    };
    expect(r.run().result).toEqual({ b: missed ? 1 : 0, exit: missed ? 'done' : 'fainted' });
    expect(r.names().includes('hit')).toBe(!missed);
    expect(r.names()).toContain(missed ? 'text:UnaffectedText' : 'text:OHKOText');
  });
  it('zero-power calc Z skips type/range/hit, but still applies and waits20 after the30 path', () => {
    const r = rig(side, 1, []); r.override({ power: 0 }); const out = r.run();
    expect(out.result.exit).toBe('done');
    expect(r.names()).not.toContain('hit'); expect(r.names()).not.toContain('type'); expect(r.names()).not.toContain('range');
    expect(r.names()).toContain('apply'); expect(out.frames).toEqual(['session', ...Array(50).fill('serviced')]);
  });
  it.each([0x27, 0x2b])('charge/Fly effect %i tails before used text and PP, preserving b/action', effect => {
    const r = rig(side, 1, []); r.override({ effect }); r.s.wActionResultOrTookBattleTurn = side ? 9 : 0;
    expect(r.run().result).toEqual({ b: 7, exit: 'effect' });
    expect(r.s.wActionResultOrTookBattleTurn).toBe(side ? 9 : 0);
    expect(r.names()).not.toContain('usedMove'); expect(r.s.mem[r.battlePP]).toBe(12);
    expect(r.names()[r.names().length - 1]).toBe(`effect:tail:${effect}`);
  });
  it('charge release reloads only the player, clears both bits, and bypasses obedience', () => {
    const r = rig(side, 1); r.s.mem[r.flags1] = 0x50; r.s.mem[A.wStringBuffer] = 0;
    // A stale cached move distinguishes a reload from merely calling the spy.
    if (side === 0) { r.s.mem[r.move] = 2; r.s.mem[r.move + 2] = 1; r.s.mem[r.move + 4] = 0; }
    r.s.wNameListIndex = 0xee; r.s.wNameListType = 0xed; r.s.wPredefBank = 0xec; r.s.wNamedObjectIndex = 0xeb;
    if (side === 1) {
      const name = vi.mocked(moves.getName).getMockImplementation()!;
      vi.mocked(moves.getName).mockImplementation(state => {
        // Inspect GetName's inputs before its writes can hide a missing caller assignment.
        expect([state.wNameListIndex, state.wNameListType, state.wPredefBank, state.wNamedObjectIndex])
          .toEqual([1, 2, 0x2f, 0xeb]);
        name(state);
        expect([state.wNameListIndex, state.wNameListType, state.wPredefBank, state.wNamedObjectIndex])
          .toEqual([1, 2, 0x2f, 1]);
      });
    }
    const out = r.run(); expect(out.result.exit).toBe('done'); expect(r.s.mem[r.flags1] & 0x50).toBe(0);
    expect(r.names()).not.toContain('obedience'); expect(r.names().includes('getMove')).toBe(side === 0);
    expect(r.names().includes('moveName')).toBe(side === 1);
    expect(r.s.mem[r.move]).toBe(1); expect(r.s.mem[r.move + 2]).toBe(40); expect(r.s.mem[r.move + 4]).toBe(255);
    expect(moves.moveNameBinding(r.s)).toBe('POUND');
    expect(r.names().slice(0, 4)).toEqual(['ghost', 'status', side === 0 ? 'getMove' : 'moveName', 'usedMove']);
    expect(r.s.mem[r.battlePP]).toBe(side ? 12 : 11);
  });
  it('CANNOT_MOVE exits before flags reset, text, RNG or encouragement; only player clears action', () => {
    const r = rig(side, 1, []); r.s.mem[r.selected] = 255; r.s.wActionResultOrTookBattleTurn = 9;
    r.s.wMoveMissed = 5; r.s.wMonIsDisobedient = 6; r.s.wMoveDidntMiss = 7; r.s.wDamageMultipliers = 8;
    r.s.wAILayer2Encouragement = 255;
    expect(r.run()).toEqual({ result: { b: 1, exit: 'done' }, frames: [] }); expect(r.names()).toEqual([]);
    expect([r.s.wMoveMissed, r.s.wMonIsDisobedient, r.s.wMoveDidntMiss, r.s.wDamageMultipliers]).toEqual([5, 6, 7, 8]);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(side ? 9 : 0); expect(r.s.wAILayer2Encouragement).toBe(255);
  });
  it.each([1, 0x20, 0x08, 0x40])('status early Done for status/flags %i', value => {
    const r = rig(side, 1, []);
    if (value === 8) r.s.mem[r.flags1] = 8;
    else if (value === 0x40) r.s.mem[r.flags2] = 0x20;
    else r.s.mem[side ? A.wEnemyMonStatus : A.wBattleMonStatus] = value;
    expect(r.run().result).toEqual({ b: 1, exit: 'done' });
    expect(r.names()).not.toContain('getMove'); expect(r.names()).not.toContain('crit');
  });
  it('SetDamage skips crit/Counter/vars/range, with hit called at the enemy swapped levels', () => {
    const r = rig(side, 69, [0]); const out = r.run();
    expect(out.result.exit).toBe('done'); expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:hit:0']);
    for (const name of ['crit', 'Counter', 'vars', 'type', 'range']) expect(r.names()).not.toContain(name);
    expect(r.events.find(e => e.routine === 'hit')!.levels).toEqual(side ? [20, 10] : [10, 20]);
    expect(r.s.wDamage).toBe(side ? 20 : 10);
  });
  it.each([false, true])('Counter %s restores levels after its one hit draw, no range/vars', missed => {
    const r = rig(side, 68, [8, missed ? 255 : 0]); r.s.wDamage = 10;
    r.s.mem[side ? A.wPlayerSelectedMove : A.wEnemySelectedMove] = 1;
    r.s.mem[side ? A.wPlayerMovePower : A.wEnemyMovePower] = 40;
    expect(r.run().result.exit).toBe('done');
    expect(r.names()).not.toContain('vars'); expect(r.names()).not.toContain('range');
    expect(r.s.wDamage).toBe(missed ? 0 : 20);
    expect(r.events.find(e => e.routine === 'Counter')!.levels).toEqual(side ? [20, 10] : [10, 20]);
  });
  it.each([false, true])('Explosion missed%s plays type0 on miss and always-effect precedes faint exit', missed => {
    const r = rig(side, 153, [8, 179, missed ? 255 : 0]);
    const out = r.run(); expect(out.result.exit).toBe('done');
    expect(r.names()).toContain(`animation:153:${missed ? 0 : side ? 2 : 5}`);
    expect(r.names().includes('animation:5:5')).toBe(!missed);
    expect(r.names()).toContain('effect:call:7');
    expect(r.events.filter(e => e.routine.startsWith('animation:')).every(e => e.levels.join() === '10,20')).toBe(true);
    if (missed) expect(r.names()).toContain('failure');
  });
  it.each([false, true])('multi-hit KO%s repeats animation/application only and keeps shared damage', ko => {
    const r = rig(side, 24); if (ko) r.s.writeBE(r.c.opposite, 1);
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`);
      if ((r.s.mem[r.flags1] & 4) === 0) {
        r.s.mem[r.flags1] |= 4; r.s.mem[r.count] = 3; r.s.mem[r.hits] = 3;
      }
      yield 'held'; return 0;
    };
    const out = r.run(); expect(out.result).toEqual({ b: ko ? 0 : 1, exit: ko ? 'fainted' : 'done' });
    expect(r.names().filter(n => n === 'crit')).toHaveLength(1); expect(r.names().filter(n => n === 'hit')).toHaveLength(1);
    expect(r.names().filter(n => n === 'apply')).toHaveLength(ko ? 1 : 3);
    expect(r.names().filter(n => n.startsWith('rng:'))).toHaveLength(3);
    expect(r.names().filter(n => n === 'usedMove')).toHaveLength(1);
    expect(r.s.mem[r.flags1] & 4).toBe(ko ? 4 : 0); expect(r.s.mem[r.hits]).toBe(ko ? 3 : 0);
    expect(r.names().includes(`text:${side ? 'HitXTimesText' : 'MultiHitText'}`)).toBe(!ko);
    if (ko) expect(r.names()).not.toContain('rage');
  });
  it('multi-hit KO on the second hit stops mid-loop with remaining count and shared overkill damage', () => {
    const r = rig(side, 24); r.s.writeBE(r.c.opposite, side ? 4 : 2);
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); r.s.wActionResultOrTookBattleTurn = 97;
      if ((r.s.mem[r.flags1] & 4) === 0) { r.s.mem[r.flags1] |= 4; r.s.mem[r.count] = 3; r.s.mem[r.hits] = 3; }
      return 1;
    };
    expect(r.run().result).toEqual({ b: 0, exit: 'fainted' });
    expect(r.names().filter(n => n === 'apply')).toHaveLength(2); expect(r.names().filter(n => n === 'rage')).toHaveLength(1);
    expect(r.names().filter(n => n.startsWith('rng:'))).toHaveLength(3);
    expect([r.s.mem[r.count], r.s.mem[r.hits], r.s.wDamage, r.s.wActionResultOrTookBattleTurn]).toEqual([2, 3, 1, 97]);
    expect(r.names()).not.toContain(`text:${side ? 'HitXTimesText' : 'MultiHitText'}`);
  });
  it.each([0, 119])('Mirror Move failure writes opposing UsedMove%i into selected and exits Done', used => {
    const r = rig(side, 119, []); r.s.mem[side ? A.wPlayerUsedMove : A.wEnemyUsedMove] = used;
    expect(r.run().result).toEqual({ b: 1, exit: 'done' });
    expect(r.s.mem[r.selected]).toBe(used); expect(r.names()).toContain('text:MirrorMoveFailedText');
    expect(r.names()).not.toContain('apply'); expect(r.s.mem[r.battlePP]).toBe(side ? 12 : 11);
  });
  it('Mirror success re-enters charge check, repeats text, and compensates original-slot PP', () => {
    const r = rig(side, 119); r.s.mem[side ? A.wPlayerUsedMove : A.wEnemyUsedMove] = 1;
    expect(r.run().result.exit).toBe('done'); expect(r.names().filter(n => n === 'status')).toHaveLength(1);
    expect(r.names().filter(n => n === 'usedMove')).toHaveLength(2); expect(r.names()).toContain('reload:1');
    expect(r.s.mem[r.battlePP]).toBe(side ? 13 : 11); expect(r.s.mem[r.partyPP]).toBe(side ? 13 : 11);
    expect(r.s.mem[r.selected]).toBe(1); expect(r.s.mem[r.move]).toBe(1);
  });
  it('Metronome animates before rejected draws then reloads; called move starts at charge check', () => {
    const r = rig(side, 118, [0, 165, 118, 1, 8, 179, 0]);
    expect(r.run().result.exit).toBe('done');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:Metronome:0', 'rng:Metronome:165',
      'rng:Metronome:118', 'rng:Metronome:1', 'rng:crit:8', 'rng:range:179', 'rng:hit:0']);
    expect(r.names().indexOf('animation:118:0')).toBeLessThan(r.names().indexOf('rng:Metronome:0'));
    expect(r.names().filter(n => n === 'usedMove')).toHaveLength(2);
    expect(r.s.mem[r.battlePP]).toBe(side ? 13 : 11); expect(r.s.mem[r.partyPP]).toBe(side ? 13 : 11);
  });
  it('Metronome accepts $A4, the final legal ID, then tails its Substitute effect', () => {
    const r = rig(side, 118, [164]); expect(r.run().result).toEqual({ b: 7, exit: 'effect' });
    expect(r.s.mem[r.selected]).toBe(164); expect(r.names()).toContain('effect:tail:79');
  });
  it('called moves can nest Mirror -> Metronome -> Charge without another status/obedience pass', () => {
    const r = rig(side, 119, [76]); r.s.mem[side ? A.wPlayerUsedMove : A.wEnemyUsedMove] = 118;
    expect(r.run().result).toEqual({ b: 7, exit: 'effect' });
    expect(r.names().filter(n => n === 'usedMove')).toHaveLength(2);
    expect(r.names().filter(n => n === 'status')).toHaveLength(1);
    expect(r.names().filter(n => n === 'obedience')).toHaveLength(side ? 0 : 1);
    expect(r.names()).toContain('reload:118'); expect(r.names()).toContain('reload:76');
    expect(r.s.mem[r.battlePP]).toBe(side ? 14 : 12); expect(r.s.mem[r.partyPP]).toBe(side ? 14 : 12);
    expect(r.s.mem[r.selected]).toBe(76);
  });
  it('Mirror clears player disobedience before copied Charge tails; enemy preserves it until announce', () => {
    const r = rig(side, 119, []); r.s.mem[side ? A.wPlayerUsedMove : A.wEnemyUsedMove] = 76;
    const print = r.host.printText;
    r.host.printText = function* (...args) { yield* print(...args); r.s.wMonIsDisobedient = 1; };
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); expect(r.s.wMonIsDisobedient).toBe(side ? 1 : 0); return 3;
    };
    expect(r.run().result).toEqual({ b: 3, exit: 'effect' }); expect(r.s.mem[r.move]).toBe(76);
  });
  it('Metronome preserves disobedience on re-entry to the copied charge check', () => {
    const r = rig(side, 118, [76]);
    const print = r.host.printText;
    r.host.printText = function* (...args) { yield* print(...args); r.s.wMonIsDisobedient = 1; };
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); expect(r.s.wMonIsDisobedient).toBe(1); return 4;
    };
    expect(r.run().result).toEqual({ b: 4, exit: 'effect' });
  });
  it('PP compensation stays on the original slot, including transformed raw party increment', () => {
    const r = rig(side, 119); r.s.mem[side ? A.wPlayerUsedMove : A.wEnemyUsedMove] = 1;
    r.s.wPlayerBattleStatus3 = 8;
    expect(r.run().result.exit).toBe('done');
    expect(r.s.mem[r.battlePP]).toBe(side ? 13 : 11); expect(r.s.mem[r.partyPP]).toBe(13);
    const base = side ? A.wEnemyMonPP : A.wBattleMonPP;
    for (let slot = 0; slot < 4; slot++) if (base + slot !== r.battlePP) expect(r.s.mem[base + slot]).toBe(12);
  });
  it.each([true, false])('Bide release nonzero%s enters miss label, with its own level swap already performed', nonzero => {
    const r = rig(side, 117, []); r.s.mem[r.flags1] = 1; r.s.mem[r.count] = 1;
    r.s.mem[r.move + 1] = 0; r.s.wDamage = nonzero ? 5 : 0; r.s.writeBE(r.hits, 0);
    expect(r.run().result.exit).toBe('done');
    for (const name of ['crit', 'Counter', 'vars', 'range', 'hit', 'getMove', 'usedMove']) expect(r.names()).not.toContain(name);
    expect(r.names()).toContain('text:UnleashedEnergyText');
    if (nonzero) { expect(r.s.wDamage).toBe(10); expect(r.names()).toContain('apply'); }
    else expect(r.names()).toContain('failure');
    expect(r.events.filter(e => e.routine.startsWith('animation:')).every(e => e.levels.join() === '10,20')).toBe(true);
  });
  it('Thrash continuation starts at calc, including final confusion draw before crit/range/hit', () => {
    const r = rig(side, 37, [3, 8, 179, 0]); r.s.mem[r.flags1] = 2; r.s.mem[r.count] = 1;
    expect(r.run().result.exit).toBe('done');
    expect(r.names()).not.toContain('getMove'); expect(r.names()).not.toContain('usedMove');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:status:3', 'rng:crit:8', 'rng:range:179', 'rng:hit:0']);
    expect(r.s.mem[side ? A.wEnemyConfusedCounter : A.wPlayerConfusedCounter]).toBe(5);
    expect(r.s.mem[r.battlePP]).toBe(12);
  });
  it('trapping continuation enters animation with cached damage and no level swap or RNG', () => {
    const r = rig(side, 35, []); r.s.mem[r.flags1] = 0x20; r.s.mem[r.count] = 2; r.s.wDamage = 5;
    expect(r.run().result.exit).toBe('done');
    for (const name of ['crit', 'vars', 'hit', 'getMove', 'usedMove', 'swap']) expect(r.names()).not.toContain(name);
    expect(r.s.readBE(r.c.opposite)).toBe(95); expect(r.s.mem[r.count]).toBe(1); expect(r.s.mem[r.battlePP]).toBe(12);
  });
  it('Rage continuation enters announce and skips PP through existing Rage guard', () => {
    const r = rig(side, 99); r.s.mem[r.flags2] = 0x40;
    expect(r.run().result.exit).toBe('done');
    expect(r.names()).not.toContain('getMove'); expect(r.names()).not.toContain('obedience');
    expect(r.names()).toContain('usedMove'); expect(r.s.mem[r.battlePP]).toBe(12);
  });
  it('self-confusion uses the checked status/self-hit seam and reaches Done without move RNG', () => {
    const r = rig(side, 1, [128]); r.s.mem[r.flags1] = 0x80;
    r.s.mem[side ? A.wEnemyConfusedCounter : A.wPlayerConfusedCounter] = 2;
    expect(r.run().result).toEqual({ b: 1, exit: 'done' });
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:status:128']);
    for (const name of ['crit', 'range', 'hit', 'getMove', 'usedMove']) expect(r.names()).not.toContain(name);
    expect(r.s.readBE(r.c.hp)).toBe(side ? 90 : 94); expect(r.s.readBE(r.c.opposite)).toBe(100);
  });
  it('disabled selected move exits Done without loading, announcing or spending PP', () => {
    const r = rig(side, 1, []); r.s.mem[side ? A.wEnemyDisabledMoveNumber : A.wPlayerDisabledMoveNumber] = 1;
    expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('text:MoveIsDisabledText');
    expect(r.names()).not.toContain('getMove'); expect(r.s.mem[r.battlePP]).toBe(12);
  });
  it('full paralysis consumes only its status draw and returns Done', () => {
    const r = rig(side, 1, [62]); r.s.mem[side ? A.wEnemyMonStatus : A.wBattleMonStatus] = 0x40;
    expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('text:FullyParalyzedText');
    expect(r.names().filter(n => n.startsWith('rng:'))).toEqual(['rng:status:62']);
  });
  it('always-effect runs before KO test, and the faint exit preserves action/counts and returns B=0', () => {
    const r = rig(side, 153); r.s.writeBE(r.c.opposite, 1);
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); r.s.wActionResultOrTookBattleTurn = 91; return 12;
    };
    expect(r.run().result).toEqual({ b: 0, exit: 'fainted' });
    expect(r.names()).toContain('effect:call:7'); expect(r.names()).not.toContain('rage');
    expect(r.s.wActionResultOrTookBattleTurn).toBe(91);
  });
  it('Twineedle changes effect before next hit, then final poison dispatch follows count text', () => {
    const r = rig(side, 41);
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`);
      if (effect === 0x4d) { r.s.mem[r.flags1] |= 4; r.s.mem[r.count] = 2; r.s.mem[r.hits] = 2; r.s.mem[r.move + 1] = 2; }
      yield 'held'; return 0;
    };
    expect(r.run().result.exit).toBe('done'); expect(r.names().filter(n => n === 'apply')).toHaveLength(2);
    const countText = `text:${side ? 'HitXTimesText' : 'MultiHitText'}`;
    expect(r.names().indexOf(countText)).toBeLessThan(r.names().indexOf('effect:call:2'));
    expect(r.names().filter(n => n.startsWith('effect:'))).toEqual(['effect:call:77', 'effect:call:2']);
    expect(r.s.mem[r.hits]).toBe(0);
  });
  it('Rage is called in both always and final effect stages', () => {
    const r = rig(side, 99); expect(r.run().result.exit).toBe('done');
    expect(r.names().filter(n => n.startsWith('effect:'))).toEqual(['effect:call:81', 'effect:call:81']);
  });
  it('successful hit composes Building Rage under the target actor before any multi-hit bookkeeping', () => {
    const r = rig(side); r.s.mem[side ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2] = 0x40;
    const targetMove = side ? A.wPlayerMoveNum : A.wEnemyMoveNum;
    expect(r.run().result.exit).toBe('done'); expect(r.s.mem[targetMove]).toBe(99); expect(r.s.mem[targetMove + 1]).toBe(0);
    expect(r.events.find(e => e.routine === 'statUp')!.turn).toBe(side ^ 1);
  });
  for (const [table, mode] of [['residual1', 'tail'], ['residual2', 'tail'], ['cont', 'call']] as const) {
    it.each(helpers.EXECUTE_EFFECTS[table].filter(n => n !== 255))(`${table} effect %i dispatches at its exact stage`, effect => {
      const r = rig(side, 1, []); r.override({ effect, power: 0 });
      const out = r.run(); expect(out.result).toEqual({ b: mode === 'tail' ? 7 : 1, exit: mode === 'tail' ? 'effect' : 'done' });
      expect(r.names().filter(n => n.startsWith('effect:'))).toEqual([`effect:${mode}:${effect}`]);
      if (table === 'residual1') {
        expect(r.names()).not.toContain('crit'); expect(out.frames).toEqual(['session', 'held']);
      } else if (table === 'residual2') {
        expect(r.names()).toContain('crit'); expect(r.names()).not.toContain('apply');
        expect(out.frames).toEqual(['session', ...Array(30).fill('serviced'), 'held']);
      } else {
        expect(r.names().indexOf(`effect:call:${effect}`)).toBeLessThan(r.names().indexOf('crit'));
      }
    });
  }
  it('tail effect B=0 is preserved and bypasses Done/action clear; called B=0 does not exit', () => {
    const r = rig(side, 1, []); r.override({ effect: 0x2f, power: 0 });
    r.ports.jumpMoveEffect = function* (_s, effect, mode) {
      r.mark(`effect:${mode}:${effect}`); r.s.wActionResultOrTookBattleTurn = 71; return 0;
    };
    expect(r.run().result).toEqual({ b: 0, exit: 'effect' }); expect(r.s.wActionResultOrTookBattleTurn).toBe(71);
  });
  it('final non-Special effect is called only after apply/critical/effectiveness/Rage', () => {
    const r = rig(side); r.override({ effect: 4 }); expect(r.run().result.exit).toBe('done');
    expect(r.names().filter(n => n.startsWith('effect:'))).toEqual(['effect:call:4']);
    expect(r.names().indexOf('rage')).toBeLessThan(r.names().indexOf('effect:call:4'));
  });
  it('ordinary KO skips Done, Rage and any final side effect, preserving action byte', () => {
    const r = rig(side); r.override({ effect: 4 }); r.s.writeBE(r.c.opposite, 1);
    r.ports.animation = function* () { r.mark('animation'); r.s.wActionResultOrTookBattleTurn = 93; };
    expect(r.run().result).toEqual({ b: 0, exit: 'fainted' }); expect(r.s.wActionResultOrTookBattleTurn).toBe(93);
    expect(r.names()).not.toContain('rage'); expect(r.names().filter(n => n.startsWith('effect:'))).toEqual([]);
  });
  it('own Substitute hides and reshows around move/exploding animation and actor HUD', () => {
    const r = rig(side, 1); r.s.mem[r.flags2] = 0x10;
    expect(r.run().result.exit).toBe('done');
    const names = r.names(); expect(names.indexOf('hide')).toBeLessThan(names.findIndex(n => n.startsWith('play:')));
    expect(names.indexOf('explode')).toBeLessThan(names.indexOf(side ? 'enemyHud' : 'playerHud'));
    expect(names.indexOf(side ? 'enemyHud' : 'playerHud')).toBeLessThan(names.indexOf('reshow')); expect(names.indexOf('reshow')).toBeLessThan(names.indexOf('apply'));
  });
  it.each([0, 1])('stale effect at zero-power calc becomes Fly/Charge %i at its 30-frame continuation', fly => {
    const r = rig(side, 1, []); r.override({ power: 0 });
    const calc = vi.mocked(numbers.calculateDamage).getMockImplementation()!;
    vi.spyOn(numbers, 'calculateDamage').mockImplementation(function* (...args) {
      const result = yield* calc(...args); r.s.mem[r.move + 1] = fly ? 0x2b : 0x27; return result;
    });
    expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('animation:167:0');
    expect(r.names()).not.toContain('hit');
  });
});

it('used player turn clears action after resetting four flag bytes, before ghost/status', () => {
  const r = rig(0, 1, []); r.s.wActionResultOrTookBattleTurn = 6; r.s.wMoveMissed = 9; r.s.wMonIsDisobedient = 9;
  expect(r.run()).toEqual({ result: { b: 1, exit: 'done' }, frames: [] }); expect(r.names()).toEqual([]);
  expect([r.s.wMoveMissed, r.s.wMonIsDisobedient, r.s.wMoveDidntMiss, r.s.wDamageMultipliers]).toEqual([0, 0, 0, 10]);
});
it('EnemyCanExecuteMove clears stale disobedience immediately before the used-move text', () => {
  const r = rig(1); r.s.wMonIsDisobedient = 9;
  const print = r.host.printText;
  r.host.printText = function* (...args) {
    if (args[0] === 'UsedMoveText') expect(r.s.wMonIsDisobedient).toBe(0);
    yield* print(...args);
  };
  expect(finish(r.program()).result).toEqual({ b: 1, exit: 'done' });
  expect(r.s.wMonIsDisobedient).toBe(0);
});
it('disobedience cannot-use result goes directly to Done, with no announcement or PP spend', () => {
  const r = rig(0, 1, [0xa0, 20, 0, 0x10]); r.s.wBattleMonLevel = 11;
  r.s.writeBE(A.wPartyMon1OTID + PARTYMON_STRUCT_LENGTH, 0xffff);
  expect(r.run().result).toEqual({ b: 1, exit: 'done' }); expect(r.names()).toContain('text:BeganToNapText');
  expect(r.names()).not.toContain('usedMove'); expect(r.s.mem[r.battlePP]).toBe(12);
});
it.each([0, 1, 254, 255])('enemy encouragement %i increments before status, byte-wrapped, even on early sleep exit', initial => {
  const r = rig(1, 1, []); r.s.wAILayer2Encouragement = initial; r.s.wEnemyMonStatus = 1;
  const check = vi.mocked(status.checkEnemyStatusConditions).getMockImplementation()!;
  vi.spyOn(status, 'checkEnemyStatusConditions').mockImplementation(function* (...args) {
    expect(r.s.wAILayer2Encouragement).toBe((initial + 1) & 255); return yield* check(...args);
  });
  expect(r.run().result.exit).toBe('done'); expect(r.s.wAILayer2Encouragement).toBe((initial + 1) & 255);
});
it.each([4, 5, 13, 15, 255])('enemy link data %i exits before encouragement/flag reset, retaining action/disobedience', received => {
  const r = rig(1, 1, []); r.s.wLinkState = LINK_STATE_BATTLING; r.s.wSerialExchangeNybbleReceiveData = received;
  r.s.wAILayer2Encouragement = 255; r.s.wMoveMissed = 9; r.s.wMonIsDisobedient = 9; r.s.wMoveDidntMiss = 9;
  r.s.wActionResultOrTookBattleTurn = 6;
  expect(r.run()).toEqual({ result: { b: 1, exit: 'link' }, frames: [] }); expect(r.names()).toEqual(['ghost']);
  expect([r.s.wAILayer2Encouragement, r.s.wMoveMissed, r.s.wMonIsDisobedient, r.s.wMoveDidntMiss]).toEqual([255, 9, 9, 9]);
  expect(r.s.wActionResultOrTookBattleTurn).toBe(6);
});
it.each([0, 3, 14])('enemy link move/Struggle data %i executes; no used-action gate', received => {
  const r = rig(1); r.s.wLinkState = LINK_STATE_BATTLING; r.s.wSerialExchangeNybbleReceiveData = received;
  r.s.mem.set([8, 179, 0], A.wLinkBattleRandomNumberList); r.s.wActionResultOrTookBattleTurn = 6;
  expect(r.run().result.exit).toBe('done'); expect(r.s.wAILayer2Encouragement).toBe(1);
  expect(r.s.wActionResultOrTookBattleTurn).toBe(6); expect(r.s.wLinkBattleRandomNumberListIndex).toBe(3);
});

describe('ghost inventory gate', () => {
  for (const side of [0, 1] as const) {
    it('ghost text returns Done before loading/status/encouragement, preserving UsedMove', () => {
      const r = rig(side, 1, []); r.s.wIsInBattle = 1; r.s.wCurMap = POKEMON_TOWER_1F; r.s.setBag([]);
      r.s.wPlayerUsedMove = 17; r.s.wEnemyUsedMove = 18;
      expect(r.run().result.exit).toBe('done');
      expect(r.names()).toEqual(['ghost', `text:${side ? 'GetOutText' : 'ScaredText'}`]);
      expect([r.s.wPlayerUsedMove, r.s.wEnemyUsedMove]).toEqual([17, 18]); expect(r.s.wAILayer2Encouragement).toBe(0);
    });
    it.each([POKEMON_TOWER_1F - 1, POKEMON_TOWER_7F + 1])('outside Tower map %i continues through ordinary hit', map => {
      const r = rig(side); r.s.wIsInBattle = 1; r.s.wCurMap = map;
      expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('hit');
    });
    it.each([0, 2])('battle kind %i is not a ghost battle', battle => {
      const r = rig(side); r.s.wIsInBattle = battle; r.s.wCurMap = POKEMON_TOWER_1F;
      expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('hit');
    });
    it('Silph Scope lookup uses the existing packed inventory', () => {
      const r = rig(side); r.s.wIsInBattle = 1; r.s.wCurMap = POKEMON_TOWER_7F;
      r.s.setBag([{ id: SILPH_SCOPE, quantity: 1 }]); const quantity = vi.spyOn(r.s, 'quantityInBag');
      expect(r.run().result.exit).toBe('done'); expect(quantity).toHaveBeenCalledWith(SILPH_SCOPE); expect(r.names()).toContain('hit');
    });
  }
  it.each([1, 0x20])('player ghost with sleep/freeze %i reaches status instead of ScaredText', value => {
    const r = rig(0, 1, []); r.s.wIsInBattle = 1; r.s.wCurMap = POKEMON_TOWER_1F; r.s.wBattleMonStatus = value;
    expect(r.run().result.exit).toBe('done'); expect(r.names()).toContain('status'); expect(r.names()).not.toContain('text:ScaredText');
  });
});

describe('Rage and exploding presentation helpers', () => {
  for (const side of [0, 1] as const) {
    it.each([false, true])('Building Rage attack mod maxed%s flips actor around text/port, restores 0/RAGE', maxed => {
      const r = rig(side, 1, []); const targetMove = side ? A.wPlayerMoveNum : A.wEnemyMoveNum;
      r.s.mem[side ? A.wPlayerBattleStatus2 : A.wEnemyBattleStatus2] = 0x40;
      r.s.mem[side ? A.wPlayerMonStatMods : A.wEnemyMonStatMods] = maxed ? 13 : 12;
      r.ports.statModifierUpEffect = function* (s) {
        r.mark('statUp'); expect(s.mem[targetMove]).toBe(0); expect(s.mem[targetMove + 1]).toBe(10);
        expect(s.hWhoseTurn).toBe(side ^ 1); yield 'held';
      };
      finish(helpers.handleBuildingRage(r.s, r.host, r.ports));
      expect(r.s.hWhoseTurn).toBe(side);
      if (maxed) expect(r.names()).toEqual(['rage']);
      else {
        expect(r.names()).toEqual(['rage', 'text:BuildingRageText', 'statUp']);
        expect(r.s.mem[targetMove]).toBe(99); expect(r.s.mem[targetMove + 1]).toBe(0);
        expect(r.events.filter(e => ['statUp', 'text:BuildingRageText'].includes(e.routine)).map(e => e.turn)).toEqual([side ^ 1, side ^ 1]);
      }
    });
    it.each([1, 120, 153])('exploding move %i triggers only the two exploding IDs', id => {
      const r = rig(side, id, []); const out = finish(helpers.handleExplodingAnimation(r.s, r.ports));
      expect(r.names().includes('animation:5:5')).toBe(id !== 1);
      expect(out.frames).toEqual(id === 1 ? [] : ['serviced', 'serviced', 'serviced', 'held']);
    });
    it.each(['enemy-invulnerable', 'ghost1', 'ghost2', 'miss'])('exploding skip condition %s', gate => {
      const r = rig(side, 153, []);
      if (gate === 'enemy-invulnerable') r.s.wEnemyBattleStatus1 = 0x40;
      if (gate === 'ghost1') r.s.mem[side ? A.wBattleMonType1 : A.wEnemyMonType1] = 8;
      if (gate === 'ghost2') r.s.mem[side ? A.wBattleMonType2 : A.wEnemyMonType2] = 8;
      if (gate === 'miss') r.s.wMoveMissed = 1;
      expect(finish(helpers.handleExplodingAnimation(r.s, r.ports)).frames).toEqual([]);
      expect(r.names()).toEqual(['explode']);
    });
  }
  it('enemy exploding-animation bug ignores player invulnerability but tests its own', () => {
    const r = rig(1, 153, []); r.s.wPlayerBattleStatus1 = 0x40;
    expect(finish(helpers.handleExplodingAnimation(r.s, r.ports)).frames).toHaveLength(4);
    r.s.wEnemyBattleStatus1 = 0x40; expect(finish(helpers.handleExplodingAnimation(r.s, r.ports)).frames).toEqual([]);
  });
});

describe('FF-terminated effect arrays from pret data/battle', () => {
  const expected = {
    residual1: [24, 25, 28, 46, 47, 49, 56, 57, 64, 65, 66, 67, 79, 82, 84, 85],
    residual2: [1, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 26, 32, 50, 51, 52, 53, 54, 55, 58, 59, 60, 61, 62, 63],
    setDamage: [40, 41], always: [3, 7, 8, 16, 29, 30, 44, 48, 77, 81],
    special: [3, 7, 8, 16, 17, 29, 30, 39, 40, 41, 43, 44, 45, 48, 27, 42], cont: [27, 42],
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    it(`pins all 256 memberships and the sole terminator of ${key}`, () => {
      const table = helpers.EXECUTE_EFFECTS[key]; expect([...table]).toEqual([...expected[key], 255]);
      for (let effect = 0; effect < 256; effect++) expect(helpers.isInEffectArray(effect, table)).toBe(expected[key].includes(effect));
    });
  }
  it('IsInArray stops before the terminator, even if matching bytes follow it', () => {
    expect(helpers.isInEffectArray(255, [255])).toBe(false);
    expect(helpers.isInEffectArray(7, [255, 7])).toBe(false); expect(helpers.isInEffectArray(7, [])).toBe(false);
  });
});
