import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { createPokemon, loadBattleData } from './data';
import { A, BattleState, encodeText, LINK_STATE_BATTLING, NAME_LENGTH, type BattleState as State } from './battle_state';
import { D } from './battle_end_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { PartyMenu } from '../menus/party_menu';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { loadStatEffectData } from './battle_effects_stats';
import { BattleUnsupportedState } from './battle_move_data';
import { ENEMY_SEND_CELLS } from './battle_enemy_send_out';
import * as rng from './battle_random';
import * as hp from './battle_hp';
import type { GameButton } from '../core';
import type { Program } from './battle_menu_context';
import {
  AI_ROLL, TRAINER_AI_POINTERS, aiCheckIfHPBelowFraction, aiCureStatus, aiSwitchIfEnoughMons,
  aiUseDireHit, aiUseFullHeal, aiUseFullRestore, aiUseGuardSpec, aiUseHyperPotion, aiUsePotion,
  aiUseSuperPotion, aiUseXAccuracy, loadTrainerAIItemNames, switchEnemyMon, trainerAI, trainerAIBuilder,
  type TrainerAIEnvironment,
} from './battle_trainer_ai';

const realRandom = rng.random;
const realBar = hp.updateHPBar2;
const holder: { mark?: (event: string, data?: unknown) => void } = {};

beforeAll(async () => {
  await loadBattleData(); await loadTextPrograms(); await loadStatEffectData();
  await loadTrainerAIItemNames(); await initTextSystem();
});
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isPassPressed).mockReturnValue(false);
  holder.mark = undefined;
  vi.spyOn(rng, 'random').mockImplementation((state, carry) => {
    const value = realRandom(state, carry);
    holder.mark?.('Random', value); return value;
  });
  vi.spyOn(hp, 'updateHPBar2').mockImplementation(function* (state, screen, x, y, type, oldHp, newHp, maxHp) {
    holder.mark?.('hpbar', [x, y, type, oldHp, newHp, maxHp]);
    yield* realBar(state, screen, x, y, type, oldHp, newHp, maxHp);
  });
});
afterEach(() => vi.restoreAllMocks());

interface Mark { at: number; event: string; data?: unknown }
function rig() {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost<{ carry: boolean }>(s, undefined, audio.update);
  const screen = driver.video.screen;
  let time = 0;
  const events: Mark[] = [];
  const mark = (event: string, data?: unknown) => events.push({ at: time, event, data });
  holder.mark = mark;
  s.hWhoseTurn = 1; s.wIsInBattle = 2; s.wPlayerMonNumber = 0;
  s.mem[D.wPartyCount] = 3; s.mem[D.wOptions] = 0; s.wFirstMonsNotOutYet = 0;
  s.setBytes(D.wTrainerName, encodeText('BROCK@'), NAME_LENGTH);
  s.setBytes(A.wEnemyMonNick, encodeText('ONIX@'), NAME_LENGTH);
  s.wEnemyMoveNum = 0x21; s.wEnemyMoveEffect = 0x01;
  s.mem.fill(7, A.wEnemyMonStatMods, A.wEnemyMonStatMods + 8);
  for (let i = 0; i < 4; i++) {
    s.writeBE(A.wEnemyMonUnmodifiedLevel + 3 + i * 2, 100);
    s.writeBE(A.wEnemyMonAttack + i * 2, 100);
  }
  s.species = () => ({ name: 'PIDGEY', base: [40, 45, 40, 56, 35], type1: 0, type2: 2,
    catchRate: 255, baseExp: 55, moves: [33, 0, 0, 0], learnset: [] });
  s.movePP = () => 35;
  s.random = () => { throw new Error('unexpected BattleRandom'); };
  const balls = PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx/battle/balls.png')));
  const atlas = { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(123) };
  const printText = function* (label: string, bindings?: Record<string, unknown>, options?: object): Program {
    const snap = bindings ? {
      trainerName: bindings.trainerName, nameBuffer: bindings.nameBuffer,
      enemyMonNick: bindings.enemyMonNick, stringBuffer: bindings.stringBuffer,
    } : null;
    mark('text', { label, bindings: snap });
    yield* driver.printText(label, bindings, options);
    const rows = [14, 16].map(y => Array.from({ length: 18 }, (_, x) => String(screen.at(x + 1, y) ?? ' ')).join('').trimEnd());
    mark('textEnd', { label, rows });
  };
  const host = {
    screen, tiles: driver.video.tiles, audio: bridge, partyView: new PartyMenu(),
    printText, saveScreenTilesToBuffer1() { mark('save1'); driver.video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { mark('load1'); driver.video.loadScreenTilesFromBuffer1(); },
    readJoypad() { mark('read'); }, pressSound() { mark('press'); }, updateSprites() { mark('sprites'); },
    readScrollJoypad() { return 1; },
    waitForSound: function* () {
      mark('wait'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced' as const; mark('waitEnd');
    },
    playSound(name: string) { mark('playSound', name); },
    runOdds() { return false; },
    backPicture() { return 'back'; },
    animation: function* (state: State) {
      mark('anim', [state.wAnimationID, state.wEnemyMoveNum, state.wEnemyMoveEffect, state.hWhoseTurn]);
    },
    hideSubstitute: function* () { mark('hide'); },
    reshowSubstitute: function* () { mark('show'); },
    sendingOutMon(state: State, x: number, y: number) { mark('sendCue', [state.hWhoseTurn, x, y]); },
    pikachuEntrance() { mark('pika'); }, slidePlayerOff() { mark('slidePlayer'); },
    frontPicture(state: State) { mark('front', state.wEnemyMonSpecies2); return `front-${state.wEnemyMonSpecies2}`; },
    renderTiles: { sprites: atlas }, pokeballTiles: balls,
    sounds: new Map([[0x8e, { id: 0x8e, data: sfxData('heal_ailment') }]]),
    voice: { getAlarm: () => 0, setAlarm(value: number) { mark('alarm', value); }, cry(id: number) { mark('cry', id); }, clip() {} },
  };
  const env: TrainerAIEnvironment = {
    screen, items: host, text: host, sendOut: host,
    animation: host.animation, hideSubstitute: host.hideSubstitute, reshowSubstitute: host.reshowSubstitute,
  };
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(data => {
    mark('sound', { id: data.id, status: s.wEnemyMonStatus }); return play(data);
  });
  function arm(rolls: number[]) {
    let previous = 0;
    s.hRandomAdd = 0;
    const divs = rolls.map(roll => { const div = (roll - previous) & 255; previous = roll; return div; });
    let n = 0;
    s.readDIV = () => divs[n++] ?? 0;
  }
  function step(keys: GameButton[] = []) {
    vi.mocked(isPassPressed).mockImplementation(key => keys.includes(key));
    vi.mocked(isHeld).mockImplementation(key => keys.includes(key));
    time++;
    const kind = driver.step();
    return kind;
  }
  function finish() {
    for (let i = 0; !driver.done && i < 8000; i++) {
      const waiting = driver.video.textBox.isWaitingForInput;
      step(waiting && time % 2 === 0 ? ['b'] : []);
    }
    expect(driver.done).toBe(true);
    return driver.result;
  }
  function start(program: Program<{ carry: boolean }>) { driver.start(program); }
  return { s, env, events, driver, screen, arm, start, finish, time: () => time, mark };
}

function setHp(s: State, hp: number, max: number) { s.wEnemyMonHP = hp; s.wEnemyMonMaxHP = max; }
function cls(s: State, id: number, count: number) { s.mem[D.wTrainerClass] = id; s.mem[D.wAICount] = count; }
function draws(events: Mark[]) { return events.filter(e => e.event === 'Random').map(e => e.data); }
function texts(events: Mark[]) { return events.filter(e => e.event === 'text').map(e => (e.data as { label: string }).label); }
function sounds(events: Mark[]) {
  return events.filter(e => e.event === 'sound').map(e => (e.data as { id: number }).id);
}
function statusAtSound(events: Mark[]) {
  return (events.find(e => e.event === 'sound')?.data as { status: number } | undefined)?.status;
}
function hpbar(events: Mark[]) { return events.find(e => e.event === 'hpbar')?.data; }
function barFrames(events: Mark[], time: number) {
  const bar = events.find(e => e.event === 'hpbar');
  return bar ? time - bar.at : 0;
}

function enemy(s: State, slot: number, hp: number, status = 0, boxLevel = 7) {
  const packed = partySlotFromPokemon(createPokemon('PIDGEY', 20, 'PIDGEY')!);
  packed.hp = hp; packed.maxHp = 100; packed.status = status; packed.boxLevel = boxLevel;
  writePartySlot(s, 'enemy', slot, packed);
  s.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies + slot] = slot === 0 ? 0x24 : 0x54;
  s.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies + slot + 1] = 0xff;
}

describe('thresholds and the pointer table', () => {
  it('evaluates percent the way rgbds does', () => {
    expect(AI_ROLL).toEqual({ percent25Plus1: 64, percent13Minus1: 32, percent50Plus1: 128, percent8: 20 });
    expect(TRAINER_AI_POINTERS).toHaveLength(47);
    expect(TRAINER_AI_POINTERS[12]).toMatchObject({ className: 'UNUSED_JUGGLER', routine: 'JugglerAI' });
    expect(TRAINER_AI_POINTERS[20]).toMatchObject({ className: 'JUGGLER', routine: 'JugglerAI' });
    expect(TRAINER_AI_POINTERS[39].routine).toBe('SabrinaAI');
  });
});

describe('AICheckIfHPBelowFraction', () => {
  it('uses the real HRAM floor and rejects equality', () => {
    const r = rig();
    r.s.mem.fill(0, A.hProduct, A.hProduct + 10);
    setHp(r.s, 19, 101);
    expect(aiCheckIfHPBelowFraction(r.s, 5)).toBe(true);
    const below = [...r.s.mem.subarray(A.hProduct, A.hProduct + 10)];
    setHp(r.s, 20, 101);
    expect(aiCheckIfHPBelowFraction(r.s, 5)).toBe(false);
    setHp(r.s, 74, 300);
    expect(aiCheckIfHPBelowFraction(r.s, 4)).toBe(true);
    setHp(r.s, 75, 300);
    expect(aiCheckIfHPBelowFraction(r.s, 4)).toBe(false);
    setHp(r.s, 300, 300);
    expect(aiCheckIfHPBelowFraction(r.s, 4)).toBe(false);
    expect(below[2]).toBe(0); expect(below[3]).toBe(20);
    // hQuotient is h[0..3], remainder left in hDivisor (h[4]). 101 / 5 = 20 remainder 1.
    expect(below).toEqual([0, 0, 0, 20, 1, 5, 0, 0, 0, 20]);
  });
});

describe('AIRecoverHP', () => {
  it('carries the low byte, clamps only on a borrow, and does not touch the roster or play a sound', () => {
    const cases = [
      [250, 260, 20, 'potion', 260],
      [240, 260, 20, 'potion', 260],
      [100, 300, 50, 'super', 150],
      [300, 400, 200, 'hyper', 400],
    ] as const;
    for (const [hp, max, , kind, next] of cases) {
      const r = rig();
      setHp(r.s, hp, max);
      r.s.mem[D.wEnemyPartyCount] = 1;
      r.s.writeBE(D.wEnemyMon1HP, 1);
      const run = kind === 'potion' ? aiUsePotion(r.s, r.env) : kind === 'super' ? aiUseSuperPotion(r.s, r.env) : aiUseHyperPotion(r.s, r.env);
      r.start(run); r.finish();
      expect(r.s.wEnemyMonHP).toBe(next);
      expect(r.s.readBE(D.wEnemyMon1HP)).toBe(1);
      expect(sounds(r.events)).toEqual([]);
      expect(hpbar(r.events)).toEqual([2, 2, 0, hp, next, max]);
    }
  });
});

describe('cure, Full Restore and the unreferenced items', () => {
  it('AICureStatus clears both status bytes and BADLY_POISONED and leaves speed and the toxic counter', () => {
    const r = rig();
    r.s.wEnemyMonPartyPos = 0; r.s.wEnemyMonStatus = 0x40; r.s.mem[D.wEnemyMon1Status] = 0x40;
    r.s.wEnemyBattleStatus3 = 0x0f; r.s.wEnemyToxicCounter = 5;
    r.s.wEnemyMonSpeed = 10; r.s.writeBE(A.wEnemyMonUnmodifiedLevel + 7, 40);
    aiCureStatus(r.s);
    expect([r.s.wEnemyMonStatus, r.s.mem[D.wEnemyMon1Status], r.s.wEnemyBattleStatus3, r.s.wEnemyToxicCounter, r.s.wEnemyMonSpeed]).toEqual([0, 0, 0x0e, 5, 10]);
  });

  it('Full Restore cures without a sound, then fills HP and prints from the real cells', () => {
    const r = rig();
    setHp(r.s, 10, 80); r.s.wEnemyMonStatus = 0x08; r.s.mem[D.wEnemyMon1Status] = 0x08;
    r.s.wEnemyBattleStatus3 = 1; r.s.wEnemyToxicCounter = 9; r.s.wEnemyMonSpeed = 10;
    r.s.mem[D.wAICount] = 1;
    r.start(aiUseFullRestore(r.s, r.env)); const result = r.finish();
    expect(result).toEqual({ carry: true });
    expect(r.s.wEnemyMonHP).toBe(80); expect(r.s.wEnemyMonStatus).toBe(0); expect(r.s.wEnemyMonSpeed).toBe(10);
    expect(r.s.wEnemyToxicCounter).toBe(9); expect(sounds(r.events)).toEqual([]);
    expect(r.s.mem[D.wAICount]).toBe(0);
    expect(hpbar(r.events)).toEqual([2, 2, 0, 10, 80, 80]);
    const printed = r.events.find(e => e.event === 'text')!.data as { bindings: { trainerName: string; nameBuffer: string; enemyMonNick: string } };
    expect(printed.bindings).toEqual({ trainerName: 'BROCK', nameBuffer: 'FULL RESTORE', enemyMonNick: 'ONIX', stringBuffer: undefined });
    expect(A.wNamedObjectIndex).toBe(0xd11d); expect(A.wPokedexNum).toBe(0xd11d);
    expect([r.s.wNamedObjectIndex, r.s.wNameListIndex, r.s.wNameListType, r.s.wPredefBank]).toEqual([0x10, 0x10, 4, 1]);
    const rows = (r.events.find(e => e.event === 'textEnd')!.data as { rows: string[] }).rows;
    expect(rows.join('|')).toContain('FULL RESTORE');
  });

  it('Full Heal plays heal_ailment before the cure, with no second wait', () => {
    const r = rig();
    r.s.wEnemyMonStatus = 0x08; r.s.mem[D.wEnemyMon1Status] = 0x08; r.s.mem[D.wAICount] = 4;
    r.start(aiUseFullHeal(r.s, r.env)); r.finish();
    const soundAt = r.events.findIndex(e => e.event === 'sound');
    const textAt = r.events.findIndex(e => e.event === 'text');
    expect(sounds(r.events)).toEqual([0x8e]);
    expect(statusAtSound(r.events)).toBe(0x08);
    expect(r.events.filter(e => e.event === 'wait')).toHaveLength(1);
    expect(r.events.filter(e => e.event === 'waitEnd').length).toBe(1);
    expect(soundAt).toBeLessThan(textAt);
    expect(r.s.wEnemyMonStatus).toBe(0); expect(r.s.mem[D.wAICount]).toBe(3);
  });

  it('Guard Spec, X Accuracy and Dire Hit set their status2 bits after the pre-wait', () => {
    const runs = [
      [aiUseGuardSpec, 1 << 1, 0x37],
      [aiUseXAccuracy, 1 << 0, 0x2e],
      [aiUseDireHit, 1 << 2, 0x3a],
    ] as const;
    for (const [fn, bit, item] of runs) {
      const r = rig(); r.s.mem[D.wAICount] = 2; r.s.wEnemyBattleStatus2 = 0;
      r.start(fn(r.s, r.env)); r.finish();
      expect(r.s.wEnemyBattleStatus2 & bit).toBe(bit);
      expect(r.s.mem[I.wAIItem]).toBe(item);
      expect(sounds(r.events)).toEqual([0x8e]);
      expect(r.events.filter(e => e.event === 'wait')).toHaveLength(1);
      expect(r.s.mem[D.wAICount]).toBe(1);
    }
  });
});

describe('TrainerAI gates', () => {
  it.each([
    ['wild', (s: State) => { s.wIsInBattle = 1; }],
    ['link', (s: State) => { s.wLinkState = LINK_STATE_BATTLING; }],
    ['storing', (s: State) => { s.wEnemyBattleStatus1 = 1 << 0; }],
    ['thrashing', (s: State) => { s.wEnemyBattleStatus1 = 1 << 1; }],
    ['charging', (s: State) => { s.wEnemyBattleStatus1 = 1 << 4; }],
    ['rage', (s: State) => { s.wEnemyBattleStatus2 = 1 << 6; }],
    ['count 0', (s: State) => { s.mem[D.wAICount] = 0; }],
  ])('%s returns carry clear with no draw', (_name, armGate) => {
    const r = rig(); cls(r.s, 42, 1); setHp(r.s, 1, 100); armGate(r.s);
    r.start(trainerAI(r.s, r.env));
    expect(r.finish()).toEqual({ carry: false });
    expect(draws(r.events)).toEqual([]);
    expect(texts(r.events)).toEqual([]);
  });

  it('a recharging enemy still acts, and GenericAI still draws once', () => {
    const recharge = rig(); cls(recharge.s, 42, 1); setHp(recharge.s, 1, 100);
    recharge.s.wEnemyBattleStatus2 = 1 << 5; recharge.arm([31]);
    recharge.start(trainerAI(recharge.s, recharge.env));
    expect(recharge.finish()).toEqual({ carry: true });
    expect(draws(recharge.events)).toEqual([31]);
    expect(recharge.s.wEnemyMonHP).toBe(21); expect(recharge.s.wEnemyBattleStatus2).toBe(1 << 5);

    const generic = rig(); cls(generic.s, 1, 3); generic.arm([200]);
    generic.start(trainerAIBuilder(generic.env)(generic.s));
    expect(generic.finish()).toEqual({ carry: false });
    expect(draws(generic.events)).toEqual([200]); expect(texts(generic.events)).toEqual([]);
    expect(generic.s.mem[D.wAICount]).toBe(3);
  });

  it('count $FF loads the row before the draw', () => {
    const r = rig(); cls(r.s, 34, 0xff); r.s.wEnemyMonStatus = 0; r.arm([9]);
    let countAtDraw = -1;
    vi.mocked(rng.random).mockImplementation((state, carry) => {
      countAtDraw = state.mem[D.wAICount];
      const value = realRandom(state, carry); r.mark('Random', value); return value;
    });
    r.start(trainerAI(r.s, r.env));
    expect(r.finish()).toEqual({ carry: false });
    expect(countAtDraw).toBe(5); expect(r.s.mem[D.wAICount]).toBe(5); expect(draws(r.events)).toEqual([9]);
  });
});

describe('class actions', () => {
  it('pins both sides of every threshold', () => {
    const no = (id: number, roll: number, count: number) => {
      const r = rig(); cls(r.s, id, count); setHp(r.s, 1, 100); r.arm([roll]);
      r.start(trainerAI(r.s, r.env));
      expect(r.finish()).toEqual({ carry: false });
      expect(texts(r.events)).toEqual([]); expect(r.s.mem[D.wAICount]).toBe(count);
    };
    no(29, 64, 1); no(42, 32, 1); no(37, 128, 1); no(46, 128, 2);
    const yes = rig(); cls(yes.s, 24, 2); yes.arm([31]);
    yes.start(trainerAI(yes.s, yes.env));
    expect(yes.finish()!.carry).toBe(true);
    expect(yes.s.mem[I.wAIItem]).toBe(0x41); expect(yes.s.wEnemyMonAttack).toBe(150);
    expect(yes.s.wEnemyMoveNum).toBe(0x21); expect(yes.s.wEnemyMoveEffect).toBe(0x01);
  });

  it('Cooltrainer F ignores the compare, including a roll of 255', () => {
    const hyper = rig(); cls(hyper.s, 32, 1); setHp(hyper.s, 9, 100); hyper.arm([255]);
    hyper.start(trainerAI(hyper.s, hyper.env));
    expect(hyper.finish()!.carry).toBe(true);
    expect(hyper.s.wEnemyMonHP).toBe(100); expect(hyper.s.mem[I.wAIItem]).toBe(0x12);

    const swapped = rig(); cls(swapped.s, 32, 1); setHp(swapped.s, 15, 100);
    enemy(swapped.s, 0, 15); enemy(swapped.s, 1, 40);
    swapped.s.mem[D.wEnemyPartyCount] = 2; swapped.s.wEnemyMonPartyPos = 0; swapped.arm([255]);
    swapped.start(trainerAI(swapped.s, swapped.env));
    expect(swapped.finish()!.carry).toBe(true);
    expect(texts(swapped.events)).toContain('AIBattleWithdrawText');
    expect(swapped.s.wFirstMonsNotOutYet).toBe(0);
    expect(swapped.events.some(e => e.event === 'text' && (e.data as { label: string }).label === 'TrainerAboutToUseText')).toBe(false);
  });

  it('Agatha does not heal after a failed switch, and 20..127 can', () => {
    const failed = rig(); cls(failed.s, 46, 2); setHp(failed.s, 10, 100);
    failed.s.mem[D.wEnemyPartyCount] = 1; enemy(failed.s, 0, 0); failed.s.wEnemyMonHP = 10; failed.arm([19]);
    failed.start(trainerAI(failed.s, failed.env));
    expect(failed.finish()).toEqual({ carry: false });
    expect(failed.s.wEnemyMonHP).toBe(10); expect(texts(failed.events)).toEqual([]);
    expect(failed.s.mem[D.wAICount]).toBe(2);

    const heal = rig(); cls(heal.s, 46, 2); setHp(heal.s, 10, 100); heal.arm([20]);
    heal.start(trainerAI(heal.s, heal.env));
    expect(heal.finish()!.carry).toBe(true);
    expect(heal.s.wEnemyMonHP).toBe(60); expect(heal.s.mem[I.wAIItem]).toBe(0x13);
  });

  it('Brock heals any roll when there is a status, and does nothing without one', () => {
    const healthy = rig(); cls(healthy.s, 34, 5); healthy.s.wEnemyMonStatus = 0; healthy.arm([0]);
    healthy.start(trainerAI(healthy.s, healthy.env));
    expect(healthy.finish()).toEqual({ carry: false }); expect(draws(healthy.events)).toEqual([0]);

    const sick = rig(); cls(sick.s, 34, 5); sick.s.wEnemyMonStatus = 0x10; sick.s.mem[D.wEnemyMon1Status] = 0x10; sick.arm([255]);
    sick.start(trainerAI(sick.s, sick.env));
    expect(sick.finish()!.carry).toBe(true);
    expect(sick.s.wEnemyMonStatus).toBe(0); expect(sick.s.mem[I.wAIItem]).toBe(0x34); expect(sounds(sick.events)).toEqual([0x8e]);
  });

  it('Sabrina uses X Defend', () => {
    const r = rig(); cls(r.s, 40, 1); r.arm([63]);
    r.start(trainerAI(r.s, r.env)); r.finish();
    expect(r.s.mem[I.wAIItem]).toBe(0x42); expect(r.s.wEnemyMonDefense).toBe(150);
    expect(texts(r.events)[0]).toBe('AIBattleUseItemText');
  });

  it('unused class 13 switches on the same roll as Juggler', () => {
    const r = rig(); cls(r.s, 13, 3); setHp(r.s, 30, 100);
    enemy(r.s, 0, 30, 0, 0x5a); enemy(r.s, 1, 40);
    r.s.mem[D.wEnemyPartyCount] = 2; r.s.wEnemyMonPartyPos = 0; r.s.wEnemyMonStatus = 0x40; r.arm([63]);
    r.start(trainerAI(r.s, r.env));
    expect(r.finish()!.carry).toBe(true);
    expect(r.s.mem[D.wEnemyMons + 3]).toBe(0); // party position landed in the box-level byte
    expect(r.s.mem[D.wEnemyMons + 4]).toBe(0x40);
    expect(r.s.wFirstMonsNotOutYet).toBe(0);
  });
});

describe('switching', () => {
  it('counts roster HP, not a stale active copy', () => {
    const r = rig(); setHp(r.s, 50, 100); r.s.wEnemyMonPartyPos = 0;
    enemy(r.s, 0, 0); enemy(r.s, 1, 40); r.s.mem[D.wEnemyPartyCount] = 2; r.s.wEnemyMonHP = 50;
    r.start(aiSwitchIfEnoughMons(r.s, r.env));
    expect(r.finish()).toEqual({ carry: false });
    expect(texts(r.events)).toEqual([]);
    expect(r.s.readBE(D.wEnemyMon1HP)).toBe(0);
  });

  it('a link SwitchEnemyMon cannot reach carry clear while EnemySendOut throws', () => {
    const r = rig(); setHp(r.s, 30, 100); r.s.wEnemyMonPartyPos = 0; r.s.wLinkState = LINK_STATE_BATTLING;
    enemy(r.s, 0, 30); enemy(r.s, 1, 40); r.s.mem[D.wEnemyPartyCount] = 2;
    r.start(switchEnemyMon(r.s, r.env));
    expect(() => r.finish()).toThrow(BattleUnsupportedState);
    expect(r.s.wFirstMonsNotOutYet).toBe(1);
  });
});

describe('ledgers', () => {
  function summary(r: ReturnType<typeof rig>, before: number) {
    return {
      frames: r.time(), draws: draws(r.events), texts: texts(r.events), sounds: sounds(r.events),
      bar: hpbar(r.events), barFrames: barFrames(r.events, r.time()),
      hp: r.s.wEnemyMonHP, count: [before, r.s.mem[D.wAICount]],
      roster: [r.s.readBE(D.wEnemyMon1HP), r.s.mem[D.wEnemyMon1Status]],
      active: [r.s.wEnemyMonStatus, r.s.wEnemyBattleStatus2, r.s.wEnemyBattleStatus3],
    };
  }

  it('Rival2 Potion', () => {
    const r = rig(); cls(r.s, 42, 1); setHp(r.s, 19, 100); r.s.writeBE(D.wEnemyMon1HP, 7);
    r.s.wEnemyBattleStatus2 = 1 << 5; r.arm([31]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(summary(r, 1).hp).toBe(39); expect(summary(r, 1).draws).toEqual([31]);
    expect(summary(r, 1).sounds).toEqual([]); expect(summary(r, 1).count).toEqual([1, 0]);
    expect(r.s.readBE(D.wEnemyMon1HP)).toBe(7); expect(r.s.wEnemyBattleStatus2).toBe(1 << 5);
    expect(summary(r, 1).texts).toEqual(['AIBattleUseItemText']);
    expect(summary(r, 1).bar).toEqual([2, 2, 0, 19, 39, 100]);
    expect(r.time()).toBe(68); expect(summary(r, 1).barFrames).toBe(23);
  });

  it('Rival3 Full Restore on a poisoned mon', () => {
    const r = rig(); cls(r.s, 43, 1); setHp(r.s, 10, 80);
    r.s.wEnemyMonStatus = 0x08; r.s.mem[D.wEnemyMon1Status] = 0x08; r.s.wEnemyMonSpeed = 11; r.arm([31]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.wEnemyMonHP).toBe(80); expect(r.s.wEnemyMonStatus).toBe(0); expect(r.s.mem[D.wEnemyMon1Status]).toBe(0);
    expect(r.s.wEnemyMonSpeed).toBe(11); expect(sounds(r.events)).toEqual([]);
    expect(r.time()).toBe(140); expect(barFrames(r.events, r.time())).toBe(89);
    expect(r.s.mem[D.wAICount]).toBe(0); expect(draws(r.events)).toEqual([31]);
  });

  it('Erika Super Potion clamps', () => {
    const r = rig(); cls(r.s, 37, 1); setHp(r.s, 1, 40); r.arm([127]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.wEnemyMonHP).toBe(40); expect(hpbar(r.events)).toEqual([2, 2, 0, 1, 40, 40]);
    expect(r.time()).toBe(150); expect(barFrames(r.events, r.time())).toBe(99);
    expect(sounds(r.events)).toEqual([]); expect(r.s.mem[D.wAICount]).toBe(0);
  });

  it('Lance Hyper Potion', () => {
    const r = rig(); cls(r.s, 47, 1); setHp(r.s, 50, 300); r.arm([127]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.wEnemyMonHP).toBe(250); expect(sounds(r.events)).toEqual([]);
    expect(r.time()).toBe(120); expect(barFrames(r.events, r.time())).toBe(69);
    expect(hpbar(r.events)).toEqual([2, 2, 0, 50, 250, 300]); expect(r.s.mem[D.wAICount]).toBe(0);
  });

  it('Brock Full Heal', () => {
    const r = rig(); cls(r.s, 34, 5); r.s.wEnemyMonStatus = 0x40; r.s.mem[D.wEnemyMon1Status] = 0x40;
    r.s.wEnemyMonSpeed = 10; r.arm([200]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.wEnemyMonStatus).toBe(0); expect(r.s.wEnemyMonSpeed).toBe(10); expect(sounds(r.events)).toEqual([0x8e]);
    const soundAt = r.events.findIndex(e => e.event === 'sound');
    const textAt = r.events.findIndex(e => e.event === 'text');
    expect(soundAt).toBeLessThan(textAt);
    const printed = r.events.find(e => e.event === 'text')!.data as { bindings: { nameBuffer: string; trainerName: string; enemyMonNick: string } };
    expect(printed.bindings.trainerName).toBe('BROCK');
    expect(printed.bindings.nameBuffer).toBe('FULL HEAL');
    expect(printed.bindings.enemyMonNick).toBe('ONIX');
    const rows = (r.events.find(e => e.event === 'textEnd')!.data as { rows: string[] }).rows;
    expect(rows).toEqual(['used FULL HEAL', 'on ONIX!']);
    expect(r.time()).toBe(47); expect(r.s.mem[D.wAICount]).toBe(4); expect(draws(r.events)).toEqual([200]);
  });

  it('Misty X Defend, normal and at +6', () => {
    const normal = rig(); cls(normal.s, 35, 1); normal.arm([63]);
    normal.start(trainerAI(normal.s, normal.env)); expect(normal.finish()!.carry).toBe(true);
    expect(normal.s.wEnemyMonDefense).toBe(150); expect(normal.s.mem[D.wAICount]).toBe(0);
    expect(normal.s.wEnemyMoveNum).toBe(0x21); expect(normal.s.wEnemyMoveEffect).toBe(0x01);
    expect(texts(normal.events)).toEqual(['AIBattleUseItemText', 'MonsStatsRoseText']);
    const rose = (normal.events.find(e => e.event === 'textEnd' && (e.data as { label: string }).label === 'MonsStatsRoseText')!.data as { rows: string[] }).rows.join('');
    expect(rose).toContain('DEFENSE'); expect(rose).toContain('rose');
    const anim = normal.events.find(e => e.event === 'anim')!.data;
    expect(anim).toEqual([0xaf, 0xaf, 0x0b, 1]);
    expect(texts(normal.events).indexOf('AIBattleUseItemText')).toBeLessThan(texts(normal.events).indexOf('MonsStatsRoseText'));
    expect(normal.time()).toBe(89);

    const capped = rig(); cls(capped.s, 35, 2); capped.s.mem[A.wEnemyMonStatMods + 1] = 13; capped.arm([63]);
    capped.start(trainerAI(capped.s, capped.env)); expect(capped.finish()!.carry).toBe(true);
    expect(capped.s.wEnemyMonDefense).toBe(100); expect(capped.s.mem[A.wEnemyMonStatMods + 1]).toBe(13);
    expect(capped.s.mem[D.wAICount]).toBe(1);
    expect(capped.s.wEnemyMoveNum).toBe(0x21); expect(capped.s.wEnemyMoveEffect).toBe(0x01);
    expect(texts(capped.events)).toEqual(['AIBattleUseItemText', 'NothingHappenedText']);
    expect(capped.events.some(e => e.event === 'anim')).toBe(false);
    expect(capped.time()).toBe(71);
  });

  it('Giovanni Guard Spec', () => {
    const r = rig(); cls(r.s, 29, 1); r.arm([63]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.wEnemyBattleStatus2 & 2).toBe(2); expect(r.s.mem[I.wAIItem]).toBe(0x37);
    expect(sounds(r.events)).toEqual([0x8e]); expect(r.s.mem[D.wAICount]).toBe(0);
    expect(r.time()).toBe(49); expect(draws(r.events)).toEqual([63]); expect(texts(r.events)).toEqual(['AIBattleUseItemText']);
  });

  it('Juggler switches two living mons, then the next call reloads the count', () => {
    const r = rig(); cls(r.s, 21, 0xff); setHp(r.s, 30, 100);
    enemy(r.s, 0, 30, 0, 0x5a); enemy(r.s, 1, 40);
    r.s.mem[D.wEnemyPartyCount] = 2; r.s.wEnemyMonPartyPos = 0; r.s.wEnemyMonStatus = 0x08;
    r.arm([63]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.mem[D.wEnemyMons + 3]).toBe(0); expect(r.s.mem[D.wEnemyMons + 4]).toBe(0x08);
    expect(r.s.wFirstMonsNotOutYet).toBe(0); expect(r.s.mem[D.wAICount]).toBe(0xff);
    expect(r.events.some(e => e.event === 'text' && (e.data as { label: string }).label === 'TrainerAboutToUseText')).toBe(false);
    expect(r.time()).toBe(82); expect(r.s.wEnemyMonPartyPos).toBe(1); expect(draws(r.events)).toEqual([63]);
    expect(texts(r.events)).toEqual(['AIBattleWithdrawText', 'PrintEmptyString.emptyString', 'TrainerSentOutText']);
  });

  it('the call after a switch reloads the row count before it draws', () => {
    const r = rig(); cls(r.s, 21, 0xff);
    enemy(r.s, 0, 30, 0, 0x5a); enemy(r.s, 1, 40);
    r.s.mem[D.wEnemyPartyCount] = 2; r.s.wEnemyMonPartyPos = 0; r.s.wEnemyMonHP = 30; r.s.wEnemyMonStatus = 0x08;
    r.arm([63]);
    r.start(trainerAI(r.s, r.env)); expect(r.finish()!.carry).toBe(true);
    expect(r.s.mem[D.wAICount]).toBe(0xff);
    const next = rig();
    next.s.mem.set(r.s.mem);
    next.s.hWhoseTurn = 1; next.s.species = r.s.species; next.s.movePP = r.s.movePP; next.s.random = r.s.random;
    next.arm([64]);
    next.start(trainerAI(next.s, next.env));
    expect(next.finish()).toEqual({ carry: false });
    expect(draws(next.events)).toEqual([64]); expect(next.s.mem[D.wAICount]).toBe(3);
    expect(texts(next.events)).toEqual([]);
  });

  it('Agatha below 20 with one living mon, a charging gate, and count 0', () => {
    const agatha = rig(); cls(agatha.s, 46, 2); setHp(agatha.s, 10, 100);
    agatha.s.mem[D.wEnemyPartyCount] = 1; enemy(agatha.s, 0, 0); agatha.s.wEnemyMonHP = 10; agatha.arm([19]);
    agatha.start(trainerAI(agatha.s, agatha.env));
    expect(agatha.finish()).toEqual({ carry: false });
    expect(agatha.time()).toBe(0); expect(draws(agatha.events)).toEqual([19]); expect(agatha.s.mem[D.wAICount]).toBe(2);

    const charging = rig(); cls(charging.s, 35, 1); charging.s.wEnemyBattleStatus1 = 1 << 4;
    charging.start(trainerAI(charging.s, charging.env));
    expect(charging.finish()).toEqual({ carry: false });
    expect(charging.time()).toBe(0); expect(draws(charging.events)).toEqual([]); expect(charging.s.mem[D.wAICount]).toBe(1);

    const zero = rig(); cls(zero.s, 35, 0);
    zero.start(trainerAI(zero.s, zero.env));
    expect(zero.finish()).toEqual({ carry: false });
    expect(zero.time()).toBe(0); expect(draws(zero.events)).toEqual([]);

    const loaded = rig(); cls(loaded.s, 1, 0xff); loaded.arm([4]);
    loaded.start(trainerAI(loaded.s, loaded.env));
    expect(loaded.finish()).toEqual({ carry: false });
    expect(loaded.time()).toBe(0); expect(draws(loaded.events)).toEqual([4]); expect(loaded.s.mem[D.wAICount]).toBe(3);
  });
});

const FIRST_CP: Record<string, number | null> = {
  GenericAI: null, BrockAI: null,
  JugglerAI: AI_ROLL.percent25Plus1, GiovanniAI: AI_ROLL.percent25Plus1, CooltrainerMAI: AI_ROLL.percent25Plus1,
  CooltrainerFAI: AI_ROLL.percent25Plus1, MistyAI: AI_ROLL.percent25Plus1, LtSurgeAI: AI_ROLL.percent25Plus1,
  BlaineAI: AI_ROLL.percent25Plus1, SabrinaAI: AI_ROLL.percent25Plus1, BrunoAI: AI_ROLL.percent25Plus1,
  BlackbeltAI: AI_ROLL.percent13Minus1, KogaAI: AI_ROLL.percent13Minus1, Rival2AI: AI_ROLL.percent13Minus1,
  Rival3AI: AI_ROLL.percent13Minus1,
  ErikaAI: AI_ROLL.percent50Plus1, LoreleiAI: AI_ROLL.percent50Plus1, LanceAI: AI_ROLL.percent50Plus1,
  AgathaAI: AI_ROLL.percent8,
};

it.skipIf(!process.env.ROM_PATH)('TrainerAIPointers matches the ROM bytes behind TrainerAI', () => {
  const rom = readFileSync(process.env.ROM_PATH!);
  const pattern = [
    0xfa, 0x56, 0xd0, 0x3d, 0x28, -1,
    0xfa, 0x2a, 0xd1, 0xfe, 0x04, 0x28, -1,
    0xfa, 0x66, 0xd0, 0xe6, 0x13, 0x20, -1,
    0xfa, 0x67, 0xd0, 0xe6, 0x40, 0x20, -1,
    0xfa, 0x30, 0xd0, 0x3d, 0x4f, 0x06, 0x00, 0x21,
  ];
  const hits: number[] = [];
  for (let i = 0; i + pattern.length < rom.length; i++) {
    if (pattern.every((byte, n) => byte === -1 || rom[i + n] === byte)) hits.push(i);
  }
  expect(hits).toHaveLength(1);
  const pointer = rom[hits[0] + pattern.length] | (rom[hits[0] + pattern.length + 1] << 8);
  expect(pointer).toBeGreaterThanOrEqual(0x4000); expect(pointer).toBeLessThan(0x8000);
  const bank = Math.floor((hits[0] + pattern.length - 1) / 0x4000);
  const fileOf = (addr: number) => bank * 0x4000 + (addr - 0x4000);
  const table = fileOf(pointer);
  const seen = new Map<string, number>();
  TRAINER_AI_POINTERS.forEach((row, index) => {
    const at = table + index * 3;
    const count = rom[at];
    const routine = rom[at + 1] | (rom[at + 2] << 8);
    expect(count, row.className).toBe(row.count);
    const previous = seen.get(row.routine);
    if (previous === undefined) seen.set(row.routine, routine);
    else expect(routine, row.routine).toBe(previous);
  });
  expect(new Set(seen.values()).size).toBe(seen.size);
  for (const [name, addr] of seen) {
    const at = fileOf(addr);
    const expected = FIRST_CP[name];
    if (expected === null) expect(rom[at], name).not.toBe(0xfe);
    else {
      expect(rom[at], name).toBe(0xfe);
      expect(rom[at + 1], name).toBe(expected);
    }
  }
  const cool = fileOf(seen.get('CooltrainerFAI')!);
  expect(rom[cool + 2]).toBe(0x3e); expect(rom[cool + 3]).toBe(10); // ld a, 10; ret nc stays commented out
  expect(rom[fileOf(seen.get('BrockAI')!)]).toBe(0xfa);
  expect(rom[fileOf(seen.get('GenericAI')!)]).toBe(0xa7);
});

// §10.1.10, written out here. Not read from AI_ROLL or TRAINER_AI_POINTERS.
// Max HP 200 makes the floors distinct: /4 = 50, /5 = 40, /10 = 20.
const ROUTINE_CASES: readonly {
  routine: string; classId: number; count: number; roll: number; hp: number;
  status: number; party: boolean; outcome: string; item: number;
}[] = [
  { routine: 'Generic', classId: 1, count: 3, roll: 255, hp: 1, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Juggler', classId: 21, count: 3, roll: 63, hp: 80, status: 0, party: true, outcome: 'switch', item: 0 },
  { routine: 'Juggler', classId: 21, count: 3, roll: 64, hp: 80, status: 0, party: true, outcome: 'nothing', item: 0 },
  { routine: 'Blackbelt', classId: 24, count: 2, roll: 31, hp: 80, status: 0, party: false, outcome: 'X ATTACK', item: 0x41 },
  { routine: 'Blackbelt', classId: 24, count: 2, roll: 32, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Giovanni', classId: 29, count: 1, roll: 63, hp: 80, status: 0, party: false, outcome: 'GUARD SPEC.', item: 0x37 },
  { routine: 'Giovanni', classId: 29, count: 1, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'CooltrainerM', classId: 31, count: 2, roll: 63, hp: 80, status: 0, party: false, outcome: 'X ATTACK', item: 0x41 },
  { routine: 'CooltrainerM', classId: 31, count: 2, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'CooltrainerF', classId: 32, count: 1, roll: 255, hp: 19, status: 0, party: false, outcome: 'HYPER POTION', item: 0x12 },
  { routine: 'CooltrainerF', classId: 32, count: 1, roll: 255, hp: 20, status: 0, party: true, outcome: 'switch', item: 0 },
  { routine: 'CooltrainerF', classId: 32, count: 1, roll: 255, hp: 39, status: 0, party: true, outcome: 'switch', item: 0 },
  { routine: 'CooltrainerF', classId: 32, count: 1, roll: 255, hp: 40, status: 0, party: true, outcome: 'nothing', item: 0 },
  { routine: 'Brock', classId: 34, count: 5, roll: 0, hp: 80, status: 0x08, party: false, outcome: 'FULL HEAL', item: 0x34 },
  { routine: 'Brock', classId: 34, count: 5, roll: 255, hp: 80, status: 0x08, party: false, outcome: 'FULL HEAL', item: 0x34 },
  { routine: 'Misty', classId: 35, count: 1, roll: 63, hp: 80, status: 0, party: false, outcome: 'X DEFEND', item: 0x42 },
  { routine: 'Misty', classId: 35, count: 1, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'LtSurge', classId: 36, count: 1, roll: 63, hp: 80, status: 0, party: false, outcome: 'X SPEED', item: 0x43 },
  { routine: 'LtSurge', classId: 36, count: 1, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Erika', classId: 37, count: 1, roll: 127, hp: 19, status: 0, party: false, outcome: 'SUPER POTION', item: 0x13 },
  { routine: 'Erika', classId: 37, count: 1, roll: 128, hp: 19, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Erika', classId: 37, count: 1, roll: 127, hp: 20, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Koga', classId: 38, count: 2, roll: 31, hp: 80, status: 0, party: false, outcome: 'X ATTACK', item: 0x41 },
  { routine: 'Koga', classId: 38, count: 2, roll: 32, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Blaine', classId: 39, count: 2, roll: 63, hp: 19, status: 0, party: false, outcome: 'SUPER POTION', item: 0x13 },
  { routine: 'Blaine', classId: 39, count: 2, roll: 64, hp: 19, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Blaine', classId: 39, count: 2, roll: 63, hp: 20, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Sabrina', classId: 40, count: 1, roll: 63, hp: 80, status: 0, party: false, outcome: 'X DEFEND', item: 0x42 },
  { routine: 'Sabrina', classId: 40, count: 1, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Rival2', classId: 42, count: 1, roll: 31, hp: 39, status: 0, party: false, outcome: 'POTION', item: 0x14 },
  { routine: 'Rival2', classId: 42, count: 1, roll: 32, hp: 39, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Rival2', classId: 42, count: 1, roll: 31, hp: 40, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Rival3', classId: 43, count: 1, roll: 31, hp: 39, status: 0, party: false, outcome: 'FULL RESTORE', item: 0x10 },
  { routine: 'Rival3', classId: 43, count: 1, roll: 32, hp: 39, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Rival3', classId: 43, count: 1, roll: 31, hp: 40, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Lorelei', classId: 44, count: 2, roll: 127, hp: 39, status: 0, party: false, outcome: 'SUPER POTION', item: 0x13 },
  { routine: 'Lorelei', classId: 44, count: 2, roll: 128, hp: 39, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Lorelei', classId: 44, count: 2, roll: 127, hp: 40, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Bruno', classId: 33, count: 2, roll: 63, hp: 80, status: 0, party: false, outcome: 'X DEFEND', item: 0x42 },
  { routine: 'Bruno', classId: 33, count: 2, roll: 64, hp: 80, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Agatha', classId: 46, count: 2, roll: 19, hp: 200, status: 0, party: true, outcome: 'switch', item: 0 },
  { routine: 'Agatha', classId: 46, count: 2, roll: 20, hp: 49, status: 0, party: false, outcome: 'SUPER POTION', item: 0x13 },
  { routine: 'Agatha', classId: 46, count: 2, roll: 20, hp: 50, status: 0, party: true, outcome: 'nothing', item: 0 },
  { routine: 'Agatha', classId: 46, count: 2, roll: 127, hp: 49, status: 0, party: false, outcome: 'SUPER POTION', item: 0x13 },
  { routine: 'Agatha', classId: 46, count: 2, roll: 128, hp: 49, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Lance', classId: 47, count: 1, roll: 127, hp: 39, status: 0, party: false, outcome: 'HYPER POTION', item: 0x12 },
  { routine: 'Lance', classId: 47, count: 1, roll: 128, hp: 39, status: 0, party: false, outcome: 'nothing', item: 0 },
  { routine: 'Lance', classId: 47, count: 1, roll: 127, hp: 40, status: 0, party: false, outcome: 'nothing', item: 0 },
];

describe("every routine's own threshold, fraction and action", () => {
  it.each(ROUTINE_CASES)('$routine roll $roll hp $hp → $outcome', row => {
    const r = rig();
    cls(r.s, row.classId, row.count);
    if (row.party) {
      enemy(r.s, 0, row.hp); enemy(r.s, 1, 40);
      r.s.mem[D.wEnemyPartyCount] = 2; r.s.wEnemyMonPartyPos = 0;
    }
    setHp(r.s, row.hp, 200);
    if (row.status) { r.s.wEnemyMonStatus = row.status; r.s.mem[D.wEnemyMon1Status] = row.status; }
    r.arm([row.roll]);
    r.start(trainerAI(r.s, r.env));
    const result = r.finish();
    expect(draws(r.events)).toEqual([row.roll]);
    if (row.outcome === 'nothing') {
      expect(result).toEqual({ carry: false });
      expect(texts(r.events)).toEqual([]);
      expect(r.s.mem[D.wAICount]).toBe(row.count);
      return;
    }
    expect(result).toEqual({ carry: true });
    if (row.outcome === 'switch') {
      expect(texts(r.events)).toContain('AIBattleWithdrawText');
      expect(texts(r.events)).not.toContain('AIBattleUseItemText');
      expect(r.s.mem[D.wAICount]).toBe(0xff);
      return;
    }
    expect(r.s.mem[I.wAIItem]).toBe(row.item);
    const printed = r.events.find(event => event.event === 'text')!.data as { label: string; bindings: { nameBuffer?: string } };
    expect(printed.label).toBe('AIBattleUseItemText');
    expect(printed.bindings.nameBuffer).toBe(row.outcome);
    expect(r.s.mem[D.wAICount]).toBe(row.count - 1);
  });
});
