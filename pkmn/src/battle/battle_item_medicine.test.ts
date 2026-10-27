import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(),
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import * as alarm from '../audio/low_health_alarm';
import { soundFinished } from '../audio/sound_wait';
import { getPikachuSpawnState, setPikachuSpawnState } from '../pikachu/pikachu_spawn';
import { applyFieldMedicine } from '../menus/field_medicine';
import { restorePikachuHappiness, getPikachuHappiness } from '../pikachu/pikachu_happiness';
import { createPokemon, loadBattleData } from './data';
import { BattleState, encodeText } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { BATTLE_ITEM_POINTERS, useItem, type BattleItemHost } from './battle_items';
import { registerMedicineBattleItemBody, type MedicineItemEnvironment } from './battle_item_medicine';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { readHpBarWord } from './battle_hp';
import * as happiness from './battle_pikachu';
import * as math from './battle_math';
import * as items from './battle_items';
import type { StatusCondition } from './types';
import { delayFrames } from './battle_menu_context';

const disposers: (() => void)[] = [];
beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  alarm.setLowHealthAlarm(0); alarm.setLowHealthChannel5(0); alarm.setLowHealthAlarmDisabled(false); setPikachuSpawnState(0);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

const MEDICINES = [
  [0x0b, 'ANTIDOTE'], [0x0c, 'BURN_HEAL'], [0x0d, 'ICE_HEAL'], [0x0e, 'AWAKENING'], [0x0f, 'PARALYZE_HEAL'],
  [0x10, 'FULL_RESTORE'], [0x11, 'MAX_POTION'], [0x12, 'HYPER_POTION'], [0x13, 'SUPER_POTION'], [0x14, 'POTION'],
  [0x34, 'FULL_HEAL'], [0x35, 'REVIVE'], [0x36, 'MAX_REVIVE'],
  [0x3c, 'FRESH_WATER'], [0x3d, 'SODA_POP'], [0x3e, 'LEMONADE'],
] as const;
// Independent constants/menu_constants.asm and party_menu.asm message table.
const MESSAGES: Record<number, string> = { 0xf0: 'AntidoteText', 0xf1: 'BurnHealText', 0xf2: 'IceHealText',
  0xf3: 'AwakeningText', 0xf4: 'ParlyzHealText', 0xf5: 'PotionText', 0xf6: 'FullHealText', 0xf7: 'ReviveText' };
const RAW: Record<NonNullable<StatusCondition>, number> = { PSN: 8, BRN: 16, FRZ: 32, PAR: 64, SLP: 3 };
const STATUSES: StatusCondition[] = [null, 'PSN', 'BRN', 'FRZ', 'PAR', 'SLP'];

function pokemon(hp: number, maxHp: number, status: StatusCondition = null, starter = false) {
  const mon = createPokemon(starter ? 25 : 19, 5, 'TARGET', { atk: 8, def: 8, spd: 8, spc: 8 })!;
  Object.assign(mon, { currentHp: hp, maxHp, status, sleepTurns: status === 'SLP' ? 3 : 0,
    attack: 100, defense: 120, speed: 140, special: 160, otId: 0x1234, otName: 'ASHXY' });
  return mon;
}

interface Options { id?: number; slot?: number; hp?: number; maxHp?: number; status?: StatusCondition;
  starter?: boolean; cancel?: boolean; empty?: boolean; stack?: number }
function setup({ id = 0x14, slot = 0, hp = 10, maxHp = 300, status = null,
  starter = false, cancel = false, empty = false, stack = 2 }: Options = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video;
  const mon = pokemon(hp, maxHp, status, starter), base = I.wPartyMons + slot * 44;
  s.partyMons[slot] = mon; writePartySlot(s, 'player', slot, partySlotFromPokemon(mon));
  const partyBefore = s.mem.slice(base, base + 44);
  s.mem[I.wPartyCount] = empty ? 0 : 6;
  s.mem[I.wPartySpecies + slot] = s.mem[base]; s.mem[I.wPartySpecies + 6] = 255;
  s.writeBE(I.wPlayerID, 0x1234); s.mem.set(encodeText('ASHXY@'), I.wPlayerName);
  s.mem[I.wPikachuHappiness] = 99; s.mem[I.wPikachuMood] = 0x80;
  s.wIsInBattle = 1; s.wPlayerMonNumber = 0; s.wWhichPokemon = 2;
  s.mem[I.wCurItem] = id; s.setBag([{ id: 0x14, quantity: 3 }, { id: 0x14, quantity: 4 }, { id, quantity: stack }]);
  const bag = [{ id: 'POTION', count: 3 }, { id: 'POTION', count: 4 }, { id: MEDICINES.find(row => row[0] === id)![1], count: stack }];
  const bagBefore = s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8);
  s.mem[I.hAutoBGTransferEnabled] = 1; s.mem[I.hUILayoutFlags] = 0xa0;
  s.mem[I.hDownArrowBlinkCount1] = 17; s.mem[I.hDownArrowBlinkCount2] = 29;
  let time = 0, scrollReads = 0;
  function state() { return { which: s.wWhichPokemon, item: s.mem[I.wCurItem], used: s.mem[I.wUsedItemOnWhichPokemon],
    curSpecies: s.wCurSpecies, party: [s.readBE(base + 1), s.mem[base + 4]], mirror: [mon.currentHp, mon.status],
    battle: [s.wBattleMonHP, s.wBattleMonStatus, s.wPlayerBattleStatus3], result: s.wActionResultOrTookBattleTurn,
    bag: [...s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)], bagMirror: bag.map(stack => stack.count),
    happiness: s.mem[I.wPikachuHappiness], alarm: alarm.lowHealthAlarm(), chan5: bridge.channelId(5),
    transfer: [s.mem[I.hAutoBGTransferEnabled], textBgTransfer.enabled], layout: s.mem[I.hUILayoutFlags],
    message: s.mem[I.wPartyMenuTypeOrMessageID], spawn: getPikachuSpawnState() }; }
  const events: { at: number; event: string; data?: unknown; state: ReturnType<typeof state> }[] = [];
  const mark = (event: string, data?: unknown) => events.push({ at: time, event, data, state: state() });
  // Assert byte-before-mirror order at each actual object write.
  let mirrorHp = mon.currentHp, mirrorStatus = mon.status;
  Object.defineProperty(mon, 'currentHp', { configurable: true, get: () => mirrorHp, set(value: number) {
    expect(s.readBE(base + 1)).toBe(value); mirrorHp = value; mark('mirror:hp', value);
  } });
  Object.defineProperty(mon, 'status', { configurable: true, get: () => mirrorStatus, set(value: StatusCondition) {
    expect(s.mem[base + 4]).toBe(0); mirrorStatus = value; mark('mirror:status', value);
  } });
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, bag,
    sounds: new Map([[0x8d, { id: 0x8d, data: sfxData('heal_hp') }], [0x8e, { id: 0x8e, data: sfxData('heal_ailment') }]]),
    printText: function* (label, bindings, options) {
      mark(`print:${label}`); yield* driver.printText(label, bindings, options); mark(`end:${label}`);
    },
    readScrollJoypad() { mark('scroll'); return scrollReads++ < 2 ? 0 : 1; },
    waitForSound: function* () {
      mark('wait'); while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced'; mark('wait:end');
    },
  };
  const env: MedicineItemEnvironment = {
    displayPartyMenu: function* () {
      mark('menu'); expect(s.mem[I.wPartyMenuTypeOrMessageID]).toBe(1); expect(s.mem[I.wUpdateSpritesEnabled]).toBe(255);
      s.wWhichPokemon = slot;
      if (cancel) { s.mem[I.wCurItem] = 0xed; mark('cancel'); return null; }
      s.wCurPartySpecies = s.wBattleMonSpecies2 = s.mem[base]; mark('selected'); return slot;
    },
    animateHpBar: function* (x, y) {
      mark('hpbar', [x, y, readHpBarWord(s, I.wHPBarOldHP), readHpBarWord(s, I.wHPBarNewHP), readHpBarWord(s, I.wHPBarMaxHP)]);
      expect(s.wHPBarType).toBe(2); expect(s.mem[I.hUILayoutFlags]).toBe(0xa1);
    },
    clearScreen: function* () { mark('clear'); yield* delayFrames(3); mark('clear:end'); },
    redrawPartyMenu: function* (message) {
      mark('redraw', message); expect(s.mem[I.wUpdateSpritesEnabled]).toBe(255);
      // Fake redraw's text is still the real printer. Layout/palette timing waits for05b.
      s.mem[I.hAutoBGTransferEnabled] = 1; textBgTransfer.enabled = true;
      // The fake supplies a valid number for both raw wrap and over-max fixtures;
      // the actual HP-number/HP-bar presentation is checkpoint-05b's port.
      const difference = Math.abs((mon.currentHp - hp) << 16 >> 16);
      yield* host.printText(MESSAGES[message], { nameBuffer: 'TARGET', hpDifference: difference });
      mark('redraw:end');
    },
    gbPalWhiteOut() { mark('white'); },
    runDefaultPaletteCommand: function* () { mark('default'); },
  };
  const modify = happiness.modifyPikachuHappiness;
  const happy = vi.spyOn(happiness, 'modifyPikachuHappiness').mockImplementation((state, event) => {
    mark('happiness', [event, state.wWhichPokemon]); modify(state, event);
  });
  const double = math.doubleOrHalveSelectedStats;
  const stats = vi.spyOn(math, 'doubleOrHalveSelectedStats').mockImplementation(state => { mark('stats'); double(state); });
  const remove = items.removeUsedItem;
  vi.spyOn(items, 'removeUsedItem').mockImplementation((state, host) => { mark('remove'); remove(state, host); mark('removed'); });
  const play = bridge.play.bind(bridge);
  const sound = vi.spyOn(bridge, 'play').mockImplementation(data => { mark('sound', data.id); return play(data); });
  disposers.push(registerMedicineBattleItemBody(env));
  function start() { driver.start(useItem(s, host)); }
  function step() {
    const pressed = time % 2 === 0;
    vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
    vi.mocked(isPassPressed).mockImplementation(key => pressed && key === 'b');
    time++; driver.step();
  }
  function finish() { for (let i = 0; !driver.done && i < 2000; i++) step(); expect(driver.done).toBe(true); }
  function result() {
    const message = events.find(e => e.event === 'redraw')?.data as number | undefined;
    return { effect: events.some(e => e.event === 'hpbar') ? 'hp' : message ? 'status' : 'none',
      program: message ? MESSAGES[message] : 'ItemUseNoEffectText' };
  }
  return { s, audio, bridge, driver, host, env, mon, base, bag, bagBefore, partyBefore, events, happy, stats, sound,
    start, step, finish, result, state, time: () => time };
}

describe('all source medicine rows and field parity', () => {
  it('covers exactly the sixteen reachable non-vitamin ItemUseMedicine entries', () => {
    // The brief says17, but its listed categories and the actual dispatcher total16.
    expect(BATTLE_ITEM_POINTERS.filter(row => row.label === 'ItemUseMedicine').map(row => row.id))
      .toEqual(MEDICINES.map(([id]) => id));
  });
  const cases = MEDICINES.filter(([id]) => id < 0x3c).flatMap(([id, name]) =>
    [0, 10, 299, 300].flatMap(hp => STATUSES.map(status => ({ id, name, hp, status }))));
  it.each(cases)('$name HP$hp status$status matches applyFieldMedicine party outcome, kind and message', ({ id, name, hp, status }) => {
    restorePikachuHappiness(99, 0x80);
    const field = pokemon(hp, 300, status, true), expected = applyFieldMedicine(name, field);
    const fieldHappiness = getPikachuHappiness();
    const r = setup({ id, hp, status, starter: true }); r.start(); r.finish();
    expect([r.s.readBE(r.base + 1), r.s.mem[r.base + 4]]).toEqual([field.currentHp, field.status ? RAW[field.status] : 0]);
    expect([r.mon.currentHp, r.mon.status]).toEqual([field.currentHp, field.status]);
    const expectedBytes = r.partyBefore.slice();
    expectedBytes[1] = field.currentHp >> 8; expectedBytes[2] = field.currentHp;
    expectedBytes[4] = field.status ? RAW[field.status] : 0;
    expect(r.s.mem.slice(r.base, r.base + 44)).toEqual(expectedBytes);
    expect(r.result()).toEqual({ effect: expected.effect, program: expected.program });
    expect(r.sound.mock.calls.map(([sound]) => sound.id)).toEqual(expected.sound ? [expected.sound === 'heal_hp' ? 0x8d : 0x8e] : []);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(expected.effect === 'none' ? 0 : 1);
    if (expected.effect === 'none') {
      expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
      expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 2]);
      expect(r.events.some(e => ['redraw', 'remove', 'hpbar', 'scroll'].includes(e.event))).toBe(false);
    } else expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]);
    expect(r.events.slice(-2).map(e => e.event)).toEqual(['white', 'default']);
    expect(r.s.mem[I.wPikachuHappiness]).toBe(fieldHappiness);
    // The live mood drift is deferred to J2; battle mood has independent ASM pins below (§11.15).
  });
});

describe('independent byte expectations', () => {
  it.each([{ id: 0x3c, amount: 50 }, { id: 0x3d, amount: 60 }, { id: 0x3e, amount: 80 }])
  ('drink$id heals$amount with carry and clamp, without happiness or curing', ({ id, amount }) => {
    const r = setup({ id, hp: 250, maxHp: 500, status: 'PAR' }); r.start(); r.finish();
    expect(r.s.readBE(r.base + 1)).toBe(250 + amount); expect(r.mon.currentHp).toBe(250 + amount);
    expect(r.s.mem[r.base + 4]).toBe(64); expect(r.happy).not.toHaveBeenCalled();
    expect(r.result()).toEqual({ effect: 'hp', program: 'PotionText' });
    expect([readHpBarWord(r.s, I.wHPBarOldHP), readHpBarWord(r.s, I.wHPBarNewHP), readHpBarWord(r.s, I.wHPBarMaxHP)])
      .toEqual([250, 250 + amount, 500]);
  });
  it.each([0x3c, 0x3d, 0x3e])('drink%s clamps below max', id => {
    const r = setup({ id, hp: 499, maxHp: 500 }); r.start(); r.finish(); expect(r.mon.currentHp).toBe(500);
  });
  it.each([0x3c, 0x3d, 0x3e].flatMap(id => [0, 300].map(hp => ({ id, hp }))))
  ('drink$id refuses HP$hp without spending, sound or happiness', ({ id, hp }) => {
    const r = setup({ id, hp }); r.start(); r.finish();
    expect(r.s.wActionResultOrTookBattleTurn).toBe(0); expect(r.mon.currentHp).toBe(hp);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
    expect(r.sound).not.toHaveBeenCalled(); expect(r.happy).not.toHaveBeenCalled();
  });
  it.each([0x08, 0x80, 0x81, 0x7f, 0xff])('Full Heal clears the entire raw status%s', raw => {
    const r = setup({ id: 0x34 }); r.s.mem[r.base + 4] = raw; r.start(); r.finish();
    expect(r.s.mem[r.base + 4]).toBe(0); expect(r.mon.status).toBeNull(); expect(r.mon.sleepTurns).toBe(0);
    expect(r.result()).toEqual({ effect: 'status', program: 'FullHealText' });
  });
  it.each([1, 2, 3, 4, 5, 6, 7])('Awakening matches raw sleep count%s and removes the whole combined byte', sleep => {
    const r = setup({ id: 0x0e }); r.s.mem[r.base + 4] = 0x80 | sleep; r.start(); r.finish();
    expect(r.s.mem[r.base + 4]).toBe(0); expect(r.mon.sleepTurns).toBe(0);
  });
  it('Antidote removes a combined status byte rather than only PSN', () => {
    const r = setup({ id: 0x0b }); r.s.mem[r.base + 4] = 0x59; r.start(); r.finish();
    expect(r.s.mem[r.base + 4]).toBe(0); expect(r.s.wBattleMonStatus).toBe(0);
  });
  it('old-HP scratch is little-endian even on refusal', () => {
    const r = setup({ id: 0x35, hp: 0x123, maxHp: 0x200 }); r.start(); r.finish();
    expect([...r.s.mem.slice(I.wHPBarOldHP, I.wHPBarOldHP + 2)]).toEqual([0x23, 1]);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
  });
  it('16-bit heal addition wraps before comparing with max HP, matching the raw byte instructions', () => {
    const r = setup({ hp: 65530, maxHp: 65535 }); r.start(); r.finish();
    expect(r.mon.currentHp).toBe(14); expect(r.s.readBE(r.base + 1)).toBe(14);
    expect(readHpBarWord(r.s, I.wHPBarNewHP)).toBe(14);
  });
  it('a raw over-max HP value is unequal to max, so Potion clamps it and counts as a use', () => {
    const r = setup({ hp: 400, maxHp: 300 }); r.start(); r.finish();
    expect(r.mon.currentHp).toBe(300); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
    expect(r.bag[2].count).toBe(1);
  });
  it('Full Restore at full HP treats a pure garbage status bit as a Full Heal cure', () => {
    const r = setup({ id: 0x10, hp: 300 }); r.s.mem[r.base + 4] = 0x80; r.start(); r.finish();
    expect(r.s.mem[r.base + 4]).toBe(0); expect(r.s.mem[I.wCurItem]).toBe(0x34);
    expect(r.result()).toEqual({ effect: 'status', program: 'FullHealText' });
  });
});

describe('battle-only copies, Toxic and inherited stat selectors', () => {
  it.each([0x0b, 0x34])('cure%s copies exactly ten bytes, dropping stage/badge stat effects while preserving their cells and Toxic counter', id => {
    const r = setup({ id, status: 'PSN' });
    const words = [0x123, 0x234, 0x345, 0x456, 0x567];
    words.forEach((word, i) => r.s.writeBE(r.base + 34 + 2 * i, word));
    [999, 600, 700, 200, 900].forEach((word, i) => r.s.writeBE(I.wBattleMonMaxHP + 2 * i, word));
    r.s.wBattleMonStatus = 8; r.s.wPlayerBattleStatus3 = 0xa9; r.s.wPlayerToxicCounter = 11;
    r.s.mem[I.wObtainedBadges] = 0xff;
    r.s.mem.set([13, 2, 9, 5, 6, 8, 7, 7], I.wPlayerMonStatMods);
    const stages = r.s.mem.slice(I.wPlayerMonStatMods, I.wPlayerMonStatMods + 8);
    r.s.mem[I.wBattleMonMaxHP - 1] = 0x91; r.s.mem[I.wBattleMonMaxHP + 10] = 0x92;
    r.start(); r.finish();
    expect([...r.s.mem.slice(I.wBattleMonMaxHP, I.wBattleMonMaxHP + 10)])
      .toEqual([...r.s.mem.slice(r.base + 34, r.base + 44)]);
    expect([r.s.mem[I.wBattleMonMaxHP - 1], r.s.mem[I.wBattleMonMaxHP + 10]]).toEqual([0x91, 0x92]);
    expect([r.s.wBattleMonStatus, r.s.wPlayerBattleStatus3, r.s.wPlayerToxicCounter]).toEqual([0, 0xa8, 11]);
    expect(r.s.mem.slice(I.wPlayerMonStatMods, I.wPlayerMonStatMods + 8)).toEqual(stages);
    expect(r.s.mem[I.wObtainedBadges]).toBe(255); expect(r.stats).toHaveBeenCalledOnce();
    expect(r.mon.status).toBeNull(); expect(r.mon.attack).toBe(100);
    expect(r.events).toMatchSnapshot();
  });
  it('a reserve cure leaves active status, all stats and BADLY_POISONED untouched', () => {
    const r = setup({ id: 0x0b, slot: 5, status: 'PSN' });
    r.s.wBattleMonStatus = 64; r.s.wPlayerBattleStatus3 = 0xa9;
    r.s.mem.fill(0x7d, I.wBattleMonMaxHP, I.wBattleMonMaxHP + 10);
    r.start(); r.finish();
    expect([...r.s.mem.slice(I.wBattleMonMaxHP, I.wBattleMonMaxHP + 10)]).toEqual(Array(10).fill(0x7d));
    expect([r.s.wBattleMonStatus, r.s.wPlayerBattleStatus3]).toEqual([64, 0xa9]);
    expect(r.stats).not.toHaveBeenCalled(); expect(r.mon.status).toBeNull();
  });
  it.each([0, 1])('stat helper reads inherited turn%s and its matching masks, without forcing a player selector', turn => {
    const r = setup({ id: 0x34, status: 'PSN' });
    r.s.hWhoseTurn = turn; r.s.wCalculateWhoseStats = 1 - turn;
    r.s.wPlayerStatsToDouble = 1; r.s.wPlayerStatsToHalve = 2;
    r.s.wEnemyStatsToDouble = 4; r.s.wEnemyStatsToHalve = 8;
    [200, 220, 240, 260].forEach((word, i) => r.s.writeBE(I.wEnemyMonAttack + i * 2, word));
    r.start(); r.finish();
    expect([0, 2, 4, 6].map(i => r.s.readBE(I.wBattleMonAttack + i))).toEqual(turn ? [100, 120, 140, 160] : [200, 60, 140, 160]);
    expect([0, 2, 4, 6].map(i => r.s.readBE(I.wEnemyMonAttack + i))).toEqual(turn ? [200, 220, 480, 130] : [200, 220, 240, 260]);
    expect(r.s.hWhoseTurn).toBe(turn); expect(r.s.wCalculateWhoseStats).toBe(1 - turn);
  });
  it('Full Restore HP-heal keeps quartered speed, modified stats, BADLY_POISONED and toxic counter', () => {
    const r = setup({ id: 0x10, hp: 1, status: 'PAR' });
    r.s.wBattleMonStatus = 64; r.s.wBattleMonSpeed = 35; r.s.wBattleMonAttack = 600;
    r.s.wPlayerBattleStatus3 = 0xa9; r.s.wPlayerToxicCounter = 11;
    r.start(); r.finish();
    expect([r.s.wBattleMonHP, r.s.wBattleMonStatus, r.s.wBattleMonSpeed, r.s.wBattleMonAttack]).toEqual([300, 0, 35, 600]);
    expect([r.s.wPlayerBattleStatus3, r.s.wPlayerToxicCounter]).toEqual([0xa9, 11]);
    expect(r.stats).not.toHaveBeenCalled(); expect(r.mon.status).toBeNull();
    expect(r.result()).toEqual({ effect: 'hp', program: 'PotionText' }); expect(r.s.mem[I.wCurItem]).toBe(0x10);
    expect(r.events).toMatchSnapshot();
  });
  it('Full Restore at full HP rewrites CurItem to FULL_HEAL, copies stats and spends the Full Restore stack', () => {
    const r = setup({ id: 0x10, hp: 300, status: 'PSN' });
    r.s.wPlayerBattleStatus3 = 1; r.s.wBattleMonStatus = 8; r.s.wBattleMonSpeed = 35;
    r.start(); r.finish();
    expect(r.s.mem[I.wCurItem]).toBe(0x34); expect(r.s.wPlayerBattleStatus3).toBe(0);
    expect(r.s.wBattleMonStatus).toBe(0); expect(r.s.wBattleMonSpeed).toBe(140);
    expect(r.result()).toEqual({ effect: 'status', program: 'FullHealText' });
    expect(r.bag[2]).toEqual({ id: 'FULL_RESTORE', count: 1 }); expect(r.s.mem[I.wBagItems + 4]).toBe(0x10);
    expect(r.stats).toHaveBeenCalledOnce(); expect(r.events.some(e => e.event === 'hpbar')).toBe(false);
    expect(r.events).toMatchSnapshot();
  });
  it('a status cure never writes old-HP scratch or copies party HP into active HP', () => {
    const r = setup({ id: 0x0b, hp: 0, status: 'PSN' });
    r.s.wBattleMonHP = 111; r.s.mem[I.wHPBarOldHP] = 0x45; r.s.mem[I.wHPBarOldHP + 1] = 0x23;
    r.start(); r.finish();
    expect(readHpBarWord(r.s, I.wHPBarOldHP)).toBe(0x2345); expect(r.s.wBattleMonHP).toBe(111);
    expect(r.mon.currentHp).toBe(0); expect(r.mon.status).toBeNull();
  });
});

describe('revive, happiness, alarm and program order', () => {
  it.each([false, true].flatMap(fought => [false, true].map(starter => ({ fought, starter }))))
  ('Revive: fought=$fought starter=$starter; chosen identity, right-shift, gated EXP bit', ({ fought, starter }) => {
    const r = setup({ id: 0x35, slot: 5, hp: 0, maxHp: 0x301, starter });
    r.s.mem[I.wPartyFoughtCurrentEnemyFlags] = fought ? 0x20 : 0;
    r.s.mem[I.wPartyGainExpFlags] = 0x81; setPikachuSpawnState(5);
    const isStarter = happiness.isThisPartyMonStarterPikachu;
    const slots: number[] = [];
    vi.spyOn(happiness, 'isThisPartyMonStarterPikachu').mockImplementation(state => { slots.push(state.wWhichPokemon); return isStarter(state); });
    r.start(); r.finish();
    expect(slots).toEqual([5]); expect(r.s.wWhichPokemon).toBe(2); expect(r.mon.currentHp).toBe(0x180);
    expect(r.s.mem[I.wPartyGainExpFlags]).toBe(fought ? 0xa1 : 0x81);
    expect(getPikachuSpawnState()).toBe(starter ? 3 : 5); expect(r.happy).not.toHaveBeenCalled();
    expect(r.result()).toEqual({ effect: 'hp', program: 'ReviveText' });
  });
  it('Max Revive uses the full two-byte maximum and preserves the existing status', () => {
    const r = setup({ id: 0x36, hp: 0, maxHp: 0x301, status: 'BRN' }); r.start(); r.finish();
    expect([r.mon.currentHp, r.mon.status, r.s.wBattleMonHP]).toEqual([0x301, 'BRN', 0x301]);
  });
  it('healing a reserve clears alarm and CHAN5 before its sound, preserving the disabled flag and active HP', () => {
    const r = setup({ slot: 5 }); r.s.wBattleMonHP = 90;
    alarm.setLowHealthAlarm(0x9e); alarm.setLowHealthChannel5(0x86); alarm.setLowHealthAlarmDisabled(true);
    r.start(); r.finish();
    const wait = r.events.find(e => e.event === 'wait')!;
    expect([wait.state.alarm, wait.state.chan5]).toEqual([0, 0]);
    expect(alarm.lowHealthAlarm()).toBe(0); expect(alarm.isLowHealthAlarmDisabled()).toBe(true);
    expect(r.s.wBattleMonHP).toBe(90); expect(r.mon.currentHp).toBe(30);
  });
  it('a full-HP starter still gets USEDITEM happiness before refusal, using the chosen slot rather than bag/active', () => {
    const r = setup({ slot: 5, hp: 300, starter: true }); r.start(); r.finish();
    const happy = r.events.find(e => e.event === 'happiness')!;
    expect(happy.data).toEqual([2, 5]); expect(happy.state.party).toEqual([300, 0]);
    expect([happy.state.used, happy.state.curSpecies]).toEqual([5, 0x54]);
    expect(r.s.mem[I.wPikachuHappiness]).toBe(104); expect(r.s.wWhichPokemon).toBe(2);
    expect(r.events.findIndex(e => e.event === 'happiness')).toBeLessThan(r.events.findIndex(e => e.event === 'print:ItemUseNoEffectText'));
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
    expect(r.events).toMatchSnapshot();
  });
  it.each([0x14, 0x10])('starter medicine%s sets USEDITEM mood 0x83 from 0x80 before healing', id => {
    const r = setup({ id, hp: 1, starter: true });
    r.s.mem[I.wPikachuMood] = 0x80; r.s.mem[I.wPikachuEmotionModifier] = 0;
    r.start(); r.finish();
    expect(r.s.mem[I.wPikachuHappiness]).toBe(104);
    expect(r.s.mem[I.wPikachuMood]).toBe(0x83);
    expect(r.happy).toHaveBeenCalledExactlyOnceWith(r.s, 2);
  });
  it.each(MEDICINES.filter(([id]) => id <= 0x27).flatMap(([id]) => [
    { mood: 0x80, modifier: 0, expected: 0x83 }, { mood: 0x83, modifier: 0, expected: 0x83 },
    { mood: 0x90, modifier: 0, expected: 0x90 }, { mood: 0x80, modifier: 1, expected: 0x80 },
  ].map(config => ({ id, ...config }))))
  ('ASM mood: item$id mood$mood modifier$modifier → $expected', ({ id, mood, modifier, expected }) => {
    const r = setup({ id, hp: 1, status: 'PSN', starter: true });
    r.s.mem[I.wPikachuMood] = mood; r.s.mem[I.wPikachuEmotionModifier] = modifier;
    r.start(); r.finish();
    expect(r.s.mem[I.wPikachuHappiness]).toBe(104); expect(r.s.mem[I.wPikachuMood]).toBe(expected);
  });
  it.each([0x34, 0x35, 0x36, 0x3c, 0x3d, 0x3e])('item%s never calls happiness, even on the starter', id => {
    const r = setup({ id, hp: id === 0x35 || id === 0x36 ? 0 : 10, status: 'PSN', starter: true }); r.start(); r.finish();
    expect(r.happy).not.toHaveBeenCalled(); expect(r.s.mem[I.wPikachuHappiness]).toBe(99);
    expect(r.s.mem[I.wPikachuMood]).toBe(0x80);
  });
  it.each([0, 5])('slot%s uses HP bar(4,1+2*slot), restores layout, spends before pre-wait and sound, and delays50 before the real button wait', slot => {
    const r = setup({ slot }); r.start(); r.finish();
    const events = r.events, event = (name: string) => events.find(e => e.event === name)!;
    expect(event('hpbar').data).toEqual([4, 1 + 2 * slot, 10, 30, 300]);
    expect(events.findIndex(e => e.event === 'removed')).toBeLessThan(events.findIndex(e => e.event === 'wait'));
    expect(events.findIndex(e => e.event === 'removed')).toBeLessThan(events.findIndex(e => e.event === 'sound'));
    expect(event('sound').state.bagMirror).toEqual([3, 4, 1]); expect(event('sound').state.bag[6]).toBe(1);
    expect(event('clear').state.transfer).toEqual([0, false]); expect(event('clear').state.layout).toBe(0xa0);
    expect(event('redraw').data).toBe(0xf5);
    expect(event('scroll').at - event('redraw:end').at).toBe(50);
    expect(events.filter(e => e.event === 'scroll').map(e => e.at - event('redraw:end').at)).toEqual([50, 51, 52]);
    expect([r.s.mem[I.hDownArrowBlinkCount1], r.s.mem[I.hDownArrowBlinkCount2]]).toEqual([17, 29]);
    expect(events.slice(-2).map(e => e.event)).toEqual(['white', 'default']);
    expect(r.s.mem[I.hAutoBGTransferEnabled]).toBe(1); expect(textBgTransfer.enabled).toBe(true);
    expect(r.audio.synth.update).toBe(r.time()); expect(r.sound).toHaveBeenCalledOnce();
    if (slot === 0) expect(events).toMatchSnapshot();
  });
  it('the real audio pre-wait finishes an old sound after bag removal, before the ailment sound', () => {
    const r = setup({ id: 0x0b, status: 'PSN' });
    r.bridge.play({ id: 0x8d, data: sfxData('heal_hp') }); r.events.length = 0;
    r.start(); r.finish();
    const wait = r.events.find(e => e.event === 'wait')!, sound = r.events.find(e => e.event === 'sound')!;
    expect(wait.state.bagMirror).toEqual([3, 4, 1]); expect(sound.at - wait.at).toBe(33); expect(sound.data).toBe(0x8e);
    expect(r.audio.synth.at('freq0').length).toBeGreaterThan(1);
    expect(r.events).toMatchSnapshot();
  });
  it('last item removal shifts the raw bag and mirror through the existing owner', () => {
    const r = setup({ stack: 1 }); r.start(); r.finish();
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4]); expect(r.s.mem[I.wNumBagItems]).toBe(2);
    expect(r.s.mem[I.wBagItems + 4]).toBe(255);
    expect(r.events.find(e => e.event === 'sound')!.state.bagMirror).toEqual([3, 4]);
  });
});

describe('cancel, empty party and palette tails', () => {
  it('cancel returns0 without restoring the popped item/bag cells, and always runs both palette ports', () => {
    const r = setup({ cancel: true, slot: 4 }); r.start(); r.finish();
    expect([r.s.wActionResultOrTookBattleTurn, r.s.wWhichPokemon, r.s.mem[I.wCurItem]]).toEqual([0, 4, 0xed]);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
    expect(r.happy).not.toHaveBeenCalled(); expect(r.sound).not.toHaveBeenCalled();
    expect(r.events.map(e => e.event)).toEqual(['menu', 'cancel', 'white', 'default']);
    expect(r.events).toMatchSnapshot();
  });
  it('empty party jumps to func_e4bf result2 and real text, before the menu or medicine tail', () => {
    const r = setup({ empty: true }); r.start(); r.finish();
    expect(r.s.wActionResultOrTookBattleTurn).toBe(2);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
    expect(r.events.map(e => e.event)).toEqual(['print:DontHavePokemonText', 'end:DontHavePokemonText']);
    expect(r.happy).not.toHaveBeenCalled(); expect(r.sound).not.toHaveBeenCalled();
    expect(r.events).toMatchSnapshot();
  });
  it('menu scratch can change CurItem, but selection restores the saved medicine before effects', () => {
    const r = setup(); const menu = r.env.displayPartyMenu;
    r.env.displayPartyMenu = function* () { const slot = yield* menu(); r.s.mem[I.wCurItem] = 0xee; return slot; };
    r.start(); r.finish();
    expect(r.mon.currentHp).toBe(30); expect(r.s.mem[I.wCurItem]).toBe(0x14); expect(r.s.wWhichPokemon).toBe(2);
  });
});
