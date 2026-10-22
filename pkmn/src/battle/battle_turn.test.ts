import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { resetListStateForEmptySlot, setBattleAndStartSavedMenuItem } from '../list_state';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { createPokemon, getAllLoadedMoveIds, getMove } from './data';
import { A, BattleState, battleContext, LINK_STATE_BATTLING } from './battle_state';
import { loadBattleMoveData } from './battle_move_data';
import * as loaders from './battle_loaders';
import * as menus from './battle_menu';
import * as chooser from './move_selection_menu';
import * as math from './battle_math';
import * as execute from './battle_execute';
import * as residual from './battle_residual';
import * as hud from './battle_hud_state';
import * as random from './battle_random';
import * as damage from './battle_damage_asm';
import * as hit from './battle_hit';
import { BattleHost } from './battle_host';
import { mainInBattleLoop, type TurnExit, type TurnHost, type TurnPorts } from './battle_turn';
import type { Frame, Program } from './battle_menu_context';

beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); resetListStateForEmptySlot(); setBattleAndStartSavedMenuItem(0);
  setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => vi.restoreAllMocks());

interface Options {
  player?: number; enemy?: number; first?: 0 | 1; tie?: number; clock?: number;
  cancel?: boolean; ai?: boolean; aiTurn?: 0 | 1; effect?: (s: BattleState) => number;
  trainer?: math.TrainerMoveSelection;
}
function rig(o: Options = {}) {
  const s = new BattleState(), audio = audioRig(), events: string[] = [], frames: Frame[] = [];
  let phase = 'loader', frame = 0, divSecond = false, draw = 0, loaderDraw = 0, cancelled = false, menusSeen = 0;
  const mark = (name: string) => events.push(`${name} @${s.hWhoseTurn} L${s.wBattleMonLevel}/${s.wEnemyMonLevel}`);
  s.readDIV = () => {
    if (!divSecond) {
      draw = phase === 'loader' ? [3, 6][loaderDraw++] : phase === 'tie' ? (o.tie ?? 127)
        : phase === 'range' ? 179 : phase === 'crit' ? 8 : 0;
      expect(draw, `unexpected ${phase} draw`).toBeDefined();
      divSecond = true; return (draw - s.hRandomAdd - 1) & 255;
    }
    divSecond = false; return 0;
  };
  const rng = random.battleRandom;
  vi.spyOn(random, 'battleRandom').mockImplementation(state => {
    const value = rng(state); mark(`rng:${phase}:${value}`); return value;
  });
  s.species = id => id === 1
    ? { name: 'RHYDON', base: [105, 130, 120, 40, 45], type1: 4, type2: 5, catchRate: 60, baseExp: 204, moves: [33, 0, 0, 0], learnset: [] }
    : { name: 'PIKACHU', base: [35, 55, 30, 90, 50], type1: 23, type2: 23, catchRate: 190, baseExp: 112, moves: [84, 0, 0, 0], learnset: [] };
  s.movePP = () => 35;
  const mon = createPokemon('Pikachu', 50, 'PIKA', { atk: 9, def: 8, spd: 8, spc: 8 })!;
  s.partyMons[0] = mon;
  loaders.writePartySlot(s, 'player', 0, loaders.partySlotFromPokemon(mon)); s.wBattleMonSpecies2 = 84;
  loaders.loadBattleMonFromParty(s);
  s.wEnemyMonSpecies2 = s.wCurPartySpecies = 1; s.wCurEnemyLevel = 50; loaders.initWildBattle(s);
  expect(s.bytes(A.wEnemyMonDVs, 2).slice()).toEqual([6, 3]);
  s.wBattleMonHP = s.wEnemyMonHP = 100; s.wBattleMonMaxHP = s.wEnemyMonMaxHP = 160;
  s.wBattleMonLevel = 10; s.wEnemyMonLevel = 20;
  s.wBattleMonAttack = s.wBattleMonDefense = s.wBattleMonSpecial = 20;
  s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpecial = 20;
  s.wBattleMonType1 = s.wBattleMonType2 = s.wEnemyMonType1 = s.wEnemyMonType2 = 3;
  s.wBattleMonSpeed = o.first === 1 ? 99 : 101; s.wEnemyMonSpeed = 100;
  if (o.tie !== undefined) s.wBattleMonSpeed = 100;
  s.hSerialConnectionStatus = o.clock ?? 0;
  s.wPlayerSelectedMove = o.player ?? 100; s.wEnemySelectedMove = o.enemy ?? 100;
  s.mem[A.wBattleMonMoves] = s.wPlayerSelectedMove; s.mem.fill(0, A.wBattleMonMoves + 1, A.wBattleMonMoves + 4);
  s.mem[A.wEnemyMonMoves] = s.wEnemySelectedMove; s.mem.fill(0, A.wEnemyMonMoves + 1, A.wEnemyMonMoves + 4);
  s.mem.fill(12, A.wBattleMonPP, A.wBattleMonPP + 4); s.mem[A.wPartyMons + 29] = 12;
  s.mem.fill(7, A.wPlayerMonStatMods, A.wPlayerMonStatMods + 8); s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  const ctx = battleContext(s);
  const host = new BattleHost<TurnExit>(s, undefined, () => audio.update());
  vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  let choosing = false;
  const originalMenu = menus.displayBattleMenu;
  vi.spyOn(menus, 'displayBattleMenu').mockImplementation(function* (...args) {
    mark('menu'); menusSeen++; phase = 'menu'; return yield* originalMenu(...args);
  });
  const originalChooser = chooser.moveSelectionMenu;
  vi.spyOn(chooser, 'moveSelectionMenu').mockImplementation(function* (...args) {
    mark(`choose:${s.wMoveMenuType}/${s.wAnimationID}/${s.wMenuItemToSwap}`); choosing = true;
    const result = yield* originalChooser(...args); choosing = false; mark(`picked:${result.zero}`); return result;
  });
  const read = loaders.readPlayerMonCurHPAndStatus;
  vi.spyOn(loaders, 'readPlayerMonCurHPAndStatus').mockImplementation(state => { mark('readHP'); read(state); });
  const select = math.selectEnemyMove;
  vi.spyOn(math, 'selectEnemyMove').mockImplementation((state, trainer) => {
    mark('selectEnemy'); phase = 'selectEnemy'; select(state, trainer); phase = 'tie';
  });
  const clean = residual.checkNumAttacksLeft;
  vi.spyOn(residual, 'checkNumAttacksLeft').mockImplementation(state => {
    mark('cleanup'); clean(state); setBattleAndStartSavedMenuItem(3);
  });
  const p = execute.executePlayerMove, e = execute.executeEnemyMove;
  vi.spyOn(execute, 'executePlayerMove').mockImplementation(function* (...args) { mark('executeP'); const result = yield* p(...args); mark(`returnP:${result.b}/${result.exit}`); return result; });
  vi.spyOn(execute, 'executeEnemyMove').mockImplementation(function* (...args) { mark('executeE'); const result = yield* e(...args); mark(`returnE:${result.b}/${result.exit}`); return result; });
  const poison = residual.handlePoisonBurnLeechSeed;
  vi.spyOn(residual, 'handlePoisonBurnLeechSeed').mockImplementation(function* (...args) { mark('residual'); const result = yield* poison(...args); mark(`residualZ:${result.zero}`); return result; });
  const huds = hud.drawHuds;
  vi.spyOn(hud, 'drawHuds').mockImplementation(function* (...args) { mark('huds'); yield* huds(...args); });
  const crit = damage.criticalHitTest, range = damage.randomizeDamage, accuracy = hit.moveHitTest;
  vi.spyOn(damage, 'criticalHitTest').mockImplementation(state => { phase = 'crit'; mark('crit'); crit(state); });
  vi.spyOn(damage, 'randomizeDamage').mockImplementation(state => { phase = 'range'; mark('range'); range(state); });
  vi.spyOn(hit, 'moveHitTest').mockImplementation(state => { phase = 'hit'; mark('hit'); return accuracy(state); });
  const ports: TurnPorts = {
    animation: function* () { mark(`animation:${s.wAnimationID}`); yield 'held'; },
    hideSubstitute: function* () { mark('hide'); yield 'held'; }, reshowSubstitute: function* () { mark('reshow'); yield 'held'; },
    substituteBreak: function* () { mark('break'); }, shake: function* () { mark('shake'); }, statModifierUpEffect: function* () { mark('statUp'); },
    jumpMoveEffect: function* (_state, effect, mode) { mark(`effect:${mode}:${effect}`); yield 'held'; return o.effect?.(s) ?? 1; },
    trainerAI: function* () { mark('AI'); yield 'held'; if (o.aiTurn !== undefined) s.hWhoseTurn = o.aiTurn; return { carry: o.ai ?? false }; },
    switchEnemyMon: function* () { mark('switch'); yield 'held'; },
  };
  const action: TurnHost = {
    screen: host.video.screen, tiles: host.video.tiles,
    getMove(id) { const key = getAllLoadedMoveIds().find(key => getMove(key)!.id === id)!; return { ...getMove(key)!, name: key }; },
    readJoypad() {
      const key = choosing && o.cancel && !cancelled ? 'b' : 'a';
      if (key === 'b') cancelled = true;
      mark(`input:${key}`); vi.mocked(isPassPressed).mockImplementation(k => k === key);
      vi.mocked(isHeld).mockImplementation(k => k === key);
    },
    pressSound() { mark('press'); audio.sfx.play(sfxData('press_ab')); },
    printText: function* (...args) { mark(`text:${args[0]}`); yield* host.printText(...args); expect(host.video.textBox.textReturn).toBe('returned'); },
    saveScreenTilesToBuffer1() { mark('save1'); host.video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { mark('load1'); host.video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer2() { mark('save2'); host.video.saveScreenTilesToBuffer2(); },
    loadScreenTilesFromBuffer2() { mark('load2'); host.video.loadScreenTilesFromBuffer2(); },
    useItem: function* (context) { mark(`item:${context.curItem}`); s.wActionResultOrTookBattleTurn = 1; s.wEscapedFromBattle = 1; yield* host.printText('GotAwayText'); },
    partyMenu: function* () { mark('party'); return null; },
    playSound(name) { mark(`sound:${name}`); audio.sfx.play(sfxData(name)); },
    waitForSound: function* () { mark('waitSound'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; },
    runOdds: () => true,
  };
  const run = () => {
    let down = false;
    host.start((function* (): Program<TurnExit> {
      const program = mainInBattleLoop(s, ctx, action, ports, o.trainer);
      for (;;) { const next = program.next(); if (next.done) return next.value; mark(`frame:${next.value}`); yield next.value; }
    })());
    while (!host.done && frame++ < 6000) {
      down = host.video.textBox.isWaitingForInput ? !down : false;
      vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
      const step = host.step(); frames.push(step!);
    }
    expect(host.done, events.slice(-20).join('\n')).toBe(true);
    expect(audio.synth.update).toBe(frames.filter(f => f === 'serviced').length);
    expect(s.readBE(A.wPartyMons + 1)).toBe(s.partyMons[0]!.currentHp);
    const ledger: string[] = [];
    for (const event of events) {
      const last = ledger[ledger.length - 1];
      if (last && last.replace(/ \*\d+$/, '') === event) {
        const count = Number(last.match(/ \*(\d+)$/)?.[1] ?? 1); ledger[ledger.length - 1] = `${event} *${count + 1}`;
      } else ledger.push(event);
    }
    expect({ exit: host.result, ledger, audioUpdates: audio.synth.update, audio: audio.synth.log.map(({ u, m, a }) => `${u}:${m}(${a.join(',')})`) }).toMatchSnapshot();
    return host.result;
  };
  const names = () => events.filter(e => !e.startsWith('frame:'));
  return { s, ctx, host, action, ports, events, frames, audio, run, names, get menusSeen() { return menusSeen; } };
}

describe('MainInBattleLoop entry and selection', () => {
  it.each([0, 1] as const)('entry faint actor %i runs readback first and saves no screen', side => {
    const r = rig(); r.s.wFirstMonsNotOutYet = 9; r.s.wBattleMonHP = side === 0 ? 0 : 100; r.s.wEnemyMonHP = 0;
    expect(r.run()).toBe(side === 0 ? 'playerFainted' : 'enemyFainted');
    expect(r.names().slice(2)).toEqual(['readHP @1 L10/20']); expect(r.s.wFirstMonsNotOutYet).toBe(9);
    expect(r.s.readBE(A.wPartyMons + 1)).toBe(side === 0 ? 0 : 100);
  });
  const gates = [
    ['Rage', A.wPlayerBattleStatus2, 0x40, false], ['recharge', A.wPlayerBattleStatus2, 0x20, false],
    ['thrash', A.wPlayerBattleStatus1, 2, false], ['charge', A.wPlayerBattleStatus1, 0x10, false],
    ['freeze', A.wBattleMonStatus, 0x20, true], ['sleep1', A.wBattleMonStatus, 1, true], ['sleep2', A.wBattleMonStatus, 2, true],
    ['sleep4', A.wBattleMonStatus, 4, true], ['sleep7', A.wBattleMonStatus, 7, true],
    ['Bide', A.wPlayerBattleStatus1, 1, true], ['trapping', A.wPlayerBattleStatus1, 0x20, true],
    ['enemy trapping', A.wEnemyBattleStatus1, 0x20, true], ['used turn', A.wActionResultOrTookBattleTurn, 1, true],
    ['used turn2', A.wActionResultOrTookBattleTurn, 2, true], ['used turn128', A.wActionResultOrTookBattleTurn, 128, true],
  ] as const;
  it.each(gates)('%s skips the chooser at its exact gate', (_name, address, value, menu) => {
    const r = rig(); r.s.wFirstMonsNotOutYet = 9; r.s.wPlayerBattleStatus1 = r.s.wEnemyBattleStatus1 = 8;
    r.s.mem[address] |= value; r.s.wLinkState = LINK_STATE_BATTLING; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.menusSeen).toBe(menu ? 1 : 0);
    expect(r.s.wPlayerBattleStatus1 & 8).toBe(address === A.wPlayerBattleStatus2 ? 8 : 0);
    expect(r.s.wEnemyBattleStatus1 & 8).toBe(address === A.wPlayerBattleStatus2 ? 8 : 0);
    expect(r.s.wPlayerSelectedMove).toBe(_name === 'enemy trapping' ? 255 : 100);
    expect(r.names().some(n => n.startsWith('choose:'))).toBe(false); expect(r.s.wFirstMonsNotOutYet).toBe(0);
  });
  it('Rage beats flinch clearing, charging, menu and enemy trapping', () => {
    const r = rig(); r.s.wPlayerBattleStatus2 = 0x60; r.s.wPlayerBattleStatus1 = 0x1a; r.s.wEnemyBattleStatus1 = 0x28;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.s.wPlayerSelectedMove).toBe(100);
    expect(r.s.wPlayerBattleStatus1).toBe(0x1a); expect(r.s.wEnemyBattleStatus1).toBe(0x28);
  });
  it('freeze takes priority over enemy trapping, then trapping over used turn', () => {
    const r = rig(); r.s.wBattleMonStatus = 0x20; r.s.wEnemyBattleStatus1 = 0x20; r.s.wActionResultOrTookBattleTurn = 9;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.s.wPlayerSelectedMove).toBe(100);
  });
  it('enemy trapping writes CANNOT_MOVE even when an item used the turn', () => {
    const r = rig(); r.s.wEnemyBattleStatus1 = 0x20; r.s.wActionResultOrTookBattleTurn = 9;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.s.wPlayerSelectedMove).toBe(255);
  });
  it('flinch clears preserve every unrelated flag on both sides', () => {
    const r = rig(); r.s.wPlayerBattleStatus1 = 0x8c; r.s.wEnemyBattleStatus1 = 0xcc;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.s.wPlayerBattleStatus1).toBe(0x84); expect(r.s.wEnemyBattleStatus1).toBe(0xc4);
  });
  it('cancel restores Buffer1, draws HUDs and repeats readback before choosing again', () => {
    const r = rig({ cancel: true }); r.s.wMoveMenuType = 2; r.s.wAnimationID = 99; r.s.wMenuItemToSwap = 3;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('enemyRan'); expect(r.menusSeen).toBe(2);
    const names = r.names().map(e => e.split(' @')[0]);
    const i = names.indexOf('picked:false'); expect(names.slice(i, i + 6)).toEqual(['picked:false', 'load1', 'huds', 'readHP', 'save1', 'menu']);
    expect(names.filter(n => n.startsWith('choose:'))).toEqual(['choose:0/1/0', 'choose:0/1/0']);
  });
  it('RUN carry wins over escaped and returns before enemy selection', () => {
    const r = rig(); setBattleAndStartSavedMenuItem(3); r.s.wEscapedFromBattle = 1;
    expect(r.run()).toBe('ran'); expect(r.names().some(n => n.startsWith('selectEnemy'))).toBe(false);
    expect(r.names().some(n => n.startsWith('sound:run'))).toBe(true);
  });
  it('Poke Doll exits escaped after the real bag/item/text/HUD path', () => {
    const r = rig(); setBattleAndStartSavedMenuItem(1); r.ctx.bag = [{ id: 'POKE_DOLL', count: 1 }];
    expect(r.run()).toBe('escaped'); expect(r.ctx.curItem).toBe('POKE_DOLL');
    expect(r.names().some(n => n.startsWith('selectEnemy'))).toBe(false);
  });
});

describe('turn ordering and link switch', () => {
  const priorities = [
    [98, 100, 1, 0], [100, 98, 0, 1], [98, 68, 1, 0], [68, 98, 0, 1],
    [68, 100, 0, 1], [100, 68, 1, 0], [98, 98, 0, 0], [98, 98, 1, 1],
    [68, 68, 0, 0], [68, 68, 1, 1], [100, 100, 0, 0], [100, 100, 1, 1],
  ] as const;
  it.each(priorities)('moves %i/%i speed winner %i -> actor %i', (player, enemy, first, expected) => {
    const r = rig({ player, enemy, first }); expect(r.run()).toBe('ran');
    expect(r.names().find(n => /^execute[PE] /.test(n))!.startsWith(expected === 0 ? 'executeP' : 'executeE')).toBe(true);
    expect(r.events.filter(n => n.startsWith('rng:tie'))).toEqual([]);
    expect(r.names().filter(n => n.startsWith('cleanup'))).toHaveLength(1);
  });
  it.each([0, 1, 2, 255])('speed tie clock %i obeys the exact internal-clock comparison', clock => {
    const r = rig({ tie: 127, clock }); expect(A.hSerialConnectionStatus).toBe(0xffaa); expect(r.s.mem[0xffaa]).toBe(clock);
    expect(r.run()).toBe('ran');
    expect(r.names().find(n => /^execute[PE] /.test(n))!.startsWith(clock === 2 ? 'executeE' : 'executeP')).toBe(true);
    expect(r.events.filter(n => n.startsWith('rng:tie:127'))).toHaveLength(1);
  });
  it.each([0, 2])('tie boundary 128, clock %i', clock => {
    const r = rig({ tie: 128, clock }); expect(r.run()).toBe('ran');
    expect(r.names().find(n => /^execute[PE] /.test(n))!.startsWith(clock === 2 ? 'executeP' : 'executeE')).toBe(true);
  });
  it.each([[98, 0], [98, 2], [68, 0], [68, 2]] as const)('both move %i use the same tie draw, clock %i', (move, clock) => {
    const r = rig({ player: move, enemy: move, tie: 128, clock }); expect(r.run()).toBe('ran');
    expect(r.names().find(n => /^execute[PE] /.test(n))!.startsWith(clock === 2 ? 'executeP' : 'executeE')).toBe(true);
    expect(r.events.filter(n => n.startsWith('rng:tie:128'))).toHaveLength(1);
  });
  it.each([[0x100, 0xff, 0], [0xff, 0x100, 1], [0x101, 0x100, 0]] as const)('BE speed %i/%i -> actor %i', (p, e, expected) => {
    const r = rig(); r.s.wBattleMonSpeed = p; r.s.wEnemyMonSpeed = e; expect(r.run()).toBe('ran');
    expect(r.names().find(n => /^execute[PE] /.test(n))!.startsWith(expected === 0 ? 'executeP' : 'executeE')).toBe(true);
  });
  it.each([0, 3, 4, 12, 13, 14, 15])('link receive %i handles action/switch/Struggle/no-action/RUN', received => {
    const r = rig({ effect: s => { s.wEscapedFromBattle = 1; return 1; } });
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = received; r.s.mem[A.wEnemyMonMoves + 3] = 100;
    // Player first, so even link Struggle/no-action need not execute before this exit.
    expect(r.run()).toBe(received === 15 ? 'enemyRan' : 'escaped');
    expect(r.events.some(n => n.startsWith('switch '))).toBe(received >= 4 && received <= 12);
    expect(r.s.wEnemySelectedMove).toBe(received === 14 ? 165 : received === 13 ? 255 : 100);
  });
  it.each([118, 119, 1])('link trapping slot %i rewrites Metronome only (missing Mirror comparison kept)', move => {
    const r = rig(); r.s.wPlayerBattleStatus1 = 0x20; r.s.wPlayerMoveListIndex = 2; r.s.mem[A.wBattleMonMoves + 2] = move;
    r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 4;
    // Stop at the later-slice boundary after observing all preceding writes.
    r.ports.switchEnemyMon = function* () { r.events.push(`switchSelected:${r.s.wPlayerSelectedMove}`); r.s.wEnemyMonHP = 0; };
    // The first actor's real tail port returns B=0, selecting the target-faint exit.
    r.ports.jumpMoveEffect = function* () { return 0; };
    expect(r.run()).toBe('enemyFainted');
    expect(r.events).toContain(`switchSelected:${move === 118 ? 118 : 100}`);
  });
  it('non-link receive RUN is ignored and the real trainer selector receives its model', () => {
    const player = createPokemon('Pikachu', 10)!, enemy = createPokemon('Rhydon', 20)!;
    enemy.moves = [{ id: 'TELEPORT', pp: 12, maxPp: 20 }];
    const trainer = { player, enemy, aiModifiers: [] };
    const r = rig({ trainer, effect: s => { s.wEscapedFromBattle = 1; return 1; } });
    r.s.wIsInBattle = 2; r.s.wSerialExchangeNybbleReceiveData = 15;
    expect(r.run()).toBe('escaped'); expect(math.selectEnemyMove).toHaveBeenCalledWith(r.s, trainer);
    expect(r.names().some(n => n.startsWith('switch '))).toBe(false);
  });
  it('link switch leaves a nontrapping Metronome slot alone', () => {
    const r = rig(); r.s.wActionResultOrTookBattleTurn = 1; r.s.wPlayerMoveListIndex = 2;
    r.s.mem[A.wBattleMonMoves + 2] = 118; r.s.wLinkState = 4; r.s.wSerialExchangeNybbleReceiveData = 4;
    r.ports.switchEnemyMon = function* () { r.events.push(`switchSelected:${r.s.wPlayerSelectedMove}`); r.s.wEnemyMonHP = 0; };
    expect(r.run()).toBe('enemyFainted'); expect(r.events).toContain('switchSelected:100');
  });
});

for (const first of [0, 1] as const) describe(`action order ${first}`, () => {
  it.each([false, true])('full turn AI carry %s, real residuals and cleanup then menu', ai => {
    const r = rig({ first, ai }); r.s.wBattleMonStatus = 8; r.s.wEnemyMonStatus = 0x10;
    r.s.wPlayerBattleStatus1 = r.s.wEnemyBattleStatus1 = 8;
    expect(r.run()).toBe('ran');
    expect(r.s.wBattleMonHP).toBe(90); expect(r.s.wEnemyMonHP).toBe(90);
    const calls = r.names().map(n => n.split(' @')[0]).filter(n => /^(executeP|executeE|AI|residual|cleanup)$/.test(n));
    expect(calls).toEqual(first === 0 ? ['executeP', 'residual', 'AI', ...(!ai ? ['executeE'] : []), 'residual', 'cleanup']
      : ['AI', ...(!ai ? ['executeE'] : []), 'residual', 'executeP', 'residual', 'cleanup']);
    expect(r.names().filter(n => n.startsWith('residual @')).map(n => Number(n.split('@')[1][0]))).toEqual(first === 0 ? [0, 1] : [1, 0]);
    expect([r.s.wPlayerBattleStatus1 & 8, r.s.wEnemyBattleStatus1 & 8]).toEqual([0, 0]);
  });
  it.each([0, 1] as const)('effect B=0 on actor %i returns the other faint without residual or cleanup', side => {
    const r = rig({ first, effect: s => s.hWhoseTurn === side ? 0 : 1 });
    expect(r.run()).toBe(side === 0 ? 'enemyFainted' : 'playerFainted');
    expect(r.names().some(n => n.startsWith('cleanup'))).toBe(false);
    expect(r.names().filter(n => n.startsWith('residual @'))).toHaveLength(first === side ? 0 : 1);
  });
  it.each([0, 1] as const)('escaped beats B=0 on actor %i', side => {
    const r = rig({ first, effect: s => { if (s.hWhoseTurn === side) { s.wEscapedFromBattle = 9; return 0; } return 1; } });
    expect(r.run()).toBe('escaped'); expect(r.names().some(n => n.startsWith('cleanup'))).toBe(false);
  });
  it.each([0, 1] as const)('residual KO actor %i leaves by that actor faint label', side => {
    const r = rig({ first }); if (side === 0) { r.s.wBattleMonHP = 1; r.s.wBattleMonStatus = 8; }
    else { r.s.wEnemyMonHP = 1; r.s.wEnemyMonStatus = 8; }
    expect(r.run()).toBe(side === 0 ? 'playerFainted' : 'enemyFainted');
    expect(r.names().filter(n => n.startsWith('residual @'))).toHaveLength(first === side ? 1 : 2);
    expect(r.names().some(n => n.startsWith('cleanup'))).toBe(false);
  });
  it('AI carry skips enemy execution and its escape check, then residual follows the AI turn', () => {
    const r = rig({ first, ai: true, aiTurn: 0 }); r.s.wBattleMonStatus = 8;
    expect(r.run()).toBe('ran'); expect(r.s.wBattleMonHP).toBe(80); expect(r.s.wEnemyMonHP).toBe(100);
    expect(r.names().filter(n => n.startsWith('executeE'))).toEqual([]);
    expect(r.names().filter(n => n.startsWith('residual @')).map(n => Number(n.split('@')[1][0]))).toEqual([0, 0]);
  });
  it('AI-used action can faint to its residual before the second actor', () => {
    const r = rig({ first, ai: true }); r.s.wEnemyMonStatus = 8; r.s.wEnemyMonHP = 1;
    expect(r.run()).toBe('enemyFainted'); expect(r.names().some(n => n.startsWith('cleanup'))).toBe(false);
  });
  it('a real damaging KO exits before residual, HUD redraw and the second actor', () => {
    const r = rig({ first, player: 1, enemy: 1 });
    if (first === 0) r.s.wEnemyMonHP = 1; else r.s.wBattleMonHP = 1;
    expect(r.run()).toBe(first === 0 ? 'enemyFainted' : 'playerFainted');
    expect(r.names().filter(n => n.startsWith('residual @'))).toEqual([]);
    expect(r.names().some(n => n.startsWith('cleanup'))).toBe(false);
  });
  it('AI carry skips the enemy escape check even if the port wrote escaped', () => {
    const r = rig({ first, ai: true });
    r.ports.trainerAI = function* () { r.events.push(`AIescape @${r.s.hWhoseTurn}`); r.s.wEscapedFromBattle = 1; return { carry: true }; };
    expect(r.run()).toBe(first === 0 ? 'ran' : 'escaped');
    expect(r.names().some(n => n.startsWith('executeE'))).toBe(false);
    expect(r.names().filter(n => n.startsWith('residual @'))).toHaveLength(first === 0 ? 2 : 1);
  });
});

it('ordinary damaging moves log exact selection, crit, range and hit draws for both actors', () => {
  const r = rig({ player: 1, enemy: 1 }); expect(r.run()).toBe('ran');
  expect(r.events.filter(n => n.startsWith('rng:')).map(n => n.split(' @')[0])).toEqual([
    'rng:loader:3', 'rng:loader:6', 'rng:selectEnemy:0',
    'rng:crit:8', 'rng:range:179', 'rng:hit:0', 'rng:crit:8', 'rng:range:179', 'rng:hit:0',
  ]);
  expect(r.s.wBattleMonHP).toBeLessThan(100); expect(r.s.wEnemyMonHP).toBeLessThan(100);
});

it.each([[0, 0], [1, 0], [0, 1], [1, 1]] as const)('cleanup trapping counters %i/%i only after both actors', (p, e) => {
  const r = rig(); r.s.wPlayerNumAttacksLeft = p; r.s.wEnemyNumAttacksLeft = e;
  const clean = vi.mocked(residual.checkNumAttacksLeft).getMockImplementation()!;
  vi.mocked(residual.checkNumAttacksLeft).mockImplementation(state => {
    state.wPlayerBattleStatus1 |= 0x20; state.wEnemyBattleStatus1 |= 0x20; clean(state);
    expect(state.wPlayerBattleStatus1 & 0x20).toBe(p ? 0x20 : 0); expect(state.wEnemyBattleStatus1 & 0x20).toBe(e ? 0x20 : 0);
    // Permit the next turn's menu to end this finite harness run.
    state.wPlayerBattleStatus1 &= ~0x20; state.wEnemyBattleStatus1 &= ~0x20;
  });
  expect(r.run()).toBe('ran'); expect(r.names().filter(n => n.startsWith('cleanup'))).toHaveLength(1);
});
