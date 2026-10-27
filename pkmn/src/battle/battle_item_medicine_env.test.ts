import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), drawFadeOverlay: vi.fn(), drawSprite: vi.fn(),
  getScale: () => 1, getCtx: () => ({ drawImage() {}, save() {}, translate() {}, scale() {}, restore() {} }),
  loadSprite: async () => ({ width: 128 }), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { PartyMenu } from '../menus/party_menu';
import { loadPartyTiles } from '../menus/party_tiles';
import { loadPartyIcons } from '../menus/party_icons';
import { enablePikachuFollowing, disablePikachuFollowing } from '../pikachu/pikachu_following';
import { setPartyAndBillsSavedMenuItem, getPartyAndBillsSavedMenuItem } from '../list_state';
import { createPokemon, loadBattleData } from './data';
import { A, BattleState, encodeText } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { useItem, type BattleItemHost } from './battle_items';
import { registerMedicineBattleItemBody } from './battle_item_medicine';
import { createMedicineItemEnvironment } from './battle_item_medicine_env';
import * as monData from './battle_experience';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { readHpBarWord, writeHpBarWord } from './battle_hp';
import type { Frame, Program } from './battle_menu_context';
import type { StatusCondition } from './types';
import { getMonsterPalette } from '../renderer/palettes';

const disposers: (() => void)[] = [];
beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); await initTextSystem(); await loadPartyTiles(); await loadPartyIcons(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
  enablePikachuFollowing(); setPartyAndBillsSavedMenuItem(0);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

interface Scenario { name: string; id: number; slot: number; hp: number; max?: number; status?: StatusCondition; cancel?: boolean; count?: number }
function setup(c: Scenario) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  s.species = id => ({ name: id === 0x54 ? 'PIKACHU' : 'RATTATA',
    base: id === 0x54 ? [35, 55, 30, 90, 50] : [30, 56, 35, 72, 25],
    type1: id === 0x54 ? 23 : 0, type2: id === 0x54 ? 23 : 0,
    catchRate: 190, baseExp: 82, moves: [84, 45, 0, 0], learnset: [], growthRate: 0 });
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video, screen = video.screen, party = new PartyMenu();
  for (let slot = 0; slot < 2; slot++) {
    const mon = createPokemon(slot ? 25 : 19, 5, slot ? 'PIKA' : 'RAT', { atk: 8, def: 8, spd: 8, spc: 8 })!;
    Object.assign(mon, { currentHp: slot === c.slot ? c.hp : 50, maxHp: c.max ?? 100,
      status: slot === c.slot ? c.status ?? null : null, sleepTurns: 3, otId: 0x1234, otName: 'ASHXY' });
    s.partyMons[slot] = mon; writePartySlot(s, 'player', slot, partySlotFromPokemon(mon));
    s.mem[I.wPartySpecies + slot] = s.mem[I.wPartyMons + slot * 44];
  }
  s.mem[I.wPartyCount] = c.count ?? 2; s.mem[I.wPartySpecies + (c.count ?? 2)] = 255;
  s.wIsInBattle = 1; s.wPlayerMonNumber = 0; s.wBattleMonSpecies = 0xa5; s.wEnemyMonSpecies2 = 0x54;
  s.wBattleMonHP = c.slot === 0 ? c.hp : 50; s.wBattleMonStatus = c.slot === 0 && c.status === 'PSN' ? 8 : 0;
  s.wPlayerHPBarColor = 2; s.wEnemyHPBarColor = 1;
  s.mem[I.wPikachuHappiness] = 99; s.mem[I.wPikachuMood] = 0x80;
  s.writeBE(I.wPlayerID, 0x1234); s.mem.set(encodeText('ASHXY@'), I.wPlayerName);
  s.mem[I.wCurItem] = c.id; s.wWhichPokemon = 1;
  s.setBag([{ id: 0x14, quantity: 3 }, { id: c.id, quantity: 2 }]);
  const bag = [{ id: 'POTION', count: 3 }, { id: 'MEDICINE', count: 2 }];
  setPartyAndBillsSavedMenuItem(c.slot);
  let time = 0, phase = 'cpu', scrollReads = 0;
  const events: { at: number; event: string; data?: unknown }[] = [];
  const frames: { at: number; phase: string; kind: Frame; ticks: number; vblanks: number }[] = [];
  const mark = (event: string, data?: unknown) => events.push({ at: time, event, data });
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, bag,
    sounds: new Map([[0x8d, { id: 0x8d, data: sfxData('heal_hp') }], [0x8e, { id: 0x8e, data: sfxData('heal_ailment') }]]),
    printText: function* (label, bindings, options) {
      const previous = phase; phase = `text:${label}`; mark(phase); yield* driver.printText(label, bindings, options);
      mark(`end:${label}`); phase = previous;
    },
    readScrollJoypad() { mark('scroll'); return scrollReads++ < 2 ? 0 : 1; },
    waitForSound: function* () {
      const previous = phase; phase = 'sound-wait'; mark('wait');
      while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced';
      mark('wait:end'); phase = previous;
    },
  };
  const env = createMedicineItemEnvironment(s, { screen, video, partyView: party,
    readJoypad() { mark('read', s.wCurrentMenuItem); },
    pressSound() { mark('press'); bridge.play({ id: 0x90, data: sfxData('press_ab') }); },
  });
  for (const key of ['displayPartyMenu', 'animateHpBar', 'clearScreen', 'redrawPartyMenu', 'runDefaultPaletteCommand'] as const) {
    const original = env[key].bind(env) as (...args: unknown[]) => Program<unknown>;
    (env as unknown as Record<string, unknown>)[key] = function* (...args: unknown[]) {
      const previous = phase; phase = key;
      mark(key, key === 'animateHpBar' ? [...args, readHpBarWord(s, I.wHPBarOldHP),
        readHpBarWord(s, I.wHPBarNewHP), readHpBarWord(s, I.wHPBarMaxHP)] : args);
      const result = yield* original(...args);
      mark(`${key}:end`, key === 'animateHpBar' ? {
        bar: [12, 13, 14, 15].map(x => screen.at(x, (args[1] as number))),
        scratch: [readHpBarWord(s, I.wHPBarOldHP), readHpBarWord(s, I.wHPBarNewHP)],
      } : result);
      phase = previous; return result;
    };
  }
  const white = env.gbPalWhiteOut;
  env.gbPalWhiteOut = () => { white(); mark('white', [screen.bgp, screen.obp0, screen.obp1]); };
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', [sound.id, bag.map(stack => stack.count)]); return play(sound); });
  const pal = screen.setPalBattle.bind(screen);
  const battlePalette = vi.spyOn(screen, 'setPalBattle').mockImplementation(function* (input) {
    mark('battle-palette', input); yield* pal(input);
  });
  const bgTicks = vi.spyOn(textBgTransfer, 'tick'), vblank = vi.spyOn(video, 'vblank');
  const renders = vi.spyOn(party, 'render');
  disposers.push(registerMedicineBattleItemBody(env));
  let inputPlan: ((frame: number, phase: string) => string[]) | undefined;
  function start(program: Program = useItem(s, host)) { driver.start(program); }
  function step() {
    time++;
    const keys = inputPlan?.(time, phase) ?? (phase === 'displayPartyMenu'
      ? time === 24 ? [c.cancel ? 'b' : 'a'] : party.ownsInput && time % 2 === 0 ? ['b'] : []
      : time % 2 === 0 ? ['b'] : []);
    vi.mocked(isHeld).mockImplementation(key => keys.includes(key));
    vi.mocked(isPassPressed).mockImplementation(key => keys.includes(key));
    const ticks = bgTicks.mock.calls.length, blanks = vblank.mock.calls.length, previous = phase;
    const kind = driver.step();
    if (kind) frames.push({ at: time, phase: previous, kind,
      ticks: bgTicks.mock.calls.length - ticks, vblanks: vblank.mock.calls.length - blanks });
  }
  function finish() { for (let i = 0; !driver.done && i < 4000; i++) step(); expect(driver.done).toBe(true); }
  function summary() {
    const groups: { phase: string; kind: Frame; from: number; to: number; ticks: number; vblanks: number }[] = [];
    for (const frame of frames) {
      const last = groups[groups.length - 1];
      if (last?.phase === frame.phase && last.kind === frame.kind) {
        last.to = frame.at; last.ticks += frame.ticks; last.vblanks += frame.vblanks;
      } else groups.push({ phase: frame.phase, kind: frame.kind, from: frame.at, to: frame.at,
        ticks: frame.ticks, vblanks: frame.vblanks });
    }
    return { events, groups, total: time,
      final: { result: s.wActionResultOrTookBattleTurn, hp: s.partyMons.map(mon => mon?.currentHp),
        status: s.partyMons.map(mon => mon?.status), bag: bag.map(stack => stack.count),
        palettes: [0, 1, 2, 3].map(i => screen.paletteName(i)), registers: [screen.bgp, screen.obp0, screen.obp1],
        saved: getPartyAndBillsSavedMenuItem(), renders: renders.mock.calls.length } };
  }
  return { s, audio, bridge, driver, video, screen, party, host, env, bag, events, frames, battlePalette, renders,
    start, step, finish, summary, time: () => time, plan: (plan: typeof inputPlan) => { inputPlan = plan; } };
}

const CASES: Scenario[] = [
  { name: 'Potion active', id: 0x14, slot: 0, hp: 10 },
  { name: 'Antidote reserve', id: 0x0b, slot: 1, hp: 10, status: 'PSN' },
  { name: 'Revive fainted reserve', id: 0x35, slot: 1, hp: 0, max: 101 },
  { name: 'Full Restore full HP status', id: 0x10, slot: 0, hp: 100, status: 'PSN' },
  { name: 'no effect', id: 0x14, slot: 0, hp: 100 },
  { name: 'cancel', id: 0x14, slot: 1, hp: 10, cancel: true },
];
describe('real medicine presentation ledgers', () => {
  it.each(CASES)('$name opening, bar, redraw, button wait and battle-palette tail', c => {
    const r = setup(c); r.start(); r.finish();
    const firstRead = r.events.find(e => e.event === 'read')!;
    expect(firstRead.at).toBe(24);
    expect(r.frames.slice(0, 24).filter(f => f.kind === 'held').map(f => f.at)).toEqual([11, 12]);
    const clear = r.events.find(e => e.event === 'clearScreen'), redraw = r.events.find(e => e.event === 'redrawPartyMenu:end');
    if (clear && redraw) {
      expect(redraw.at - clear.at).toBe(14);
      expect(r.events.find(e => e.event === 'scroll')!.at - redraw.at).toBe(50);
      expect(r.events.filter(e => e.event === 'scroll').map(e => e.at - redraw.at)).toEqual([50, 51, 52]);
    }
    expect(r.battlePalette).toHaveBeenCalledExactlyOnceWith({ partySpecies: 19, enemySpecies2: 25, playerBar: 2, enemyBar: 1 });
    expect([0, 1, 2, 3].map(i => r.screen.paletteName(i))).toEqual(['REDBAR', 'YELLOWBAR', getMonsterPalette(19), getMonsterPalette(25)]);
    expect(r.events.find(e => e.event === 'white')!.data).toEqual([0, 0, 0]);
    expect(r.frames.slice(-5).map(f => f.kind)).toEqual(['held', 'held', 'serviced', 'serviced', 'serviced']);
    for (const frame of r.frames) {
      expect(frame.ticks).toBe(frame.kind === 'held' ? 0 : 1);
      expect(frame.vblanks).toBe(frame.kind === 'held' ? 0 : 1);
    }
    expect(r.s.wActionResultOrTookBattleTurn).toBe(c.cancel || c.name === 'no effect' ? 0 : 1);
    expect(r.bag[1].count).toBe(c.cancel || c.name === 'no effect' ? 2 : 1);
    // Independent sums: opening24 + optional press-AB17/bar46 or100 + redraw14
    // + hold50 + two unaccepted scroll reads + final battle palette5.
    const totals: Record<string, number> = { 'Potion active': 141, 'Antidote reserve': 112,
      'Revive fainted reserve': 195, 'Full Restore full HP status': 112, 'no effect': 83, cancel: 29 };
    expect(r.time()).toBe(totals[c.name]);
    expect(r.renders).toHaveBeenCalledTimes(c.cancel || c.name === 'no effect' ? 1 : 2);
    const bar = r.events.find(e => e.event === 'animateHpBar'), barEnd = r.events.find(e => e.event === 'animateHpBar:end');
    if (bar && barEnd) expect(barEnd.at - bar.at).toBe(c.id === 0x35 ? 100 : 46);
    else expect(bar).toBeUndefined();
    expect(r.summary()).toMatchSnapshot();
  });
});

it('type2 uses the LE words, 46 scheduled frames, the party bracket and number at bar+9', () => {
  const r = setup(CASES[0]); r.start();
  while (!r.events.some(e => e.event === 'animateHpBar:end') && r.time() < 200) r.step();
  const begin = r.events.find(e => e.event === 'animateHpBar')!, end = r.events.find(e => e.event === 'animateHpBar:end')!;
  expect(end.at - begin.at).toBe(46); expect(r.s.wHPBarType).toBe(2);
  expect(end.data).toEqual({ bar: [0x6c, ' ', '3', '0'], scratch: [30, 30] });
  expect(readHpBarWord(r.s, I.wHPBarOldHP)).toBe(30); expect(readHpBarWord(r.s, I.wHPBarNewHP)).toBe(30);
  expect(r.s.readBE(I.wHPBarHPDifference)).toBe(20);
  r.finish();
});

it('type2 reads a two-byte LE scratch value rather than interpreting it as BE', () => {
  const r = setup({ name: 'scratch', id: 0x14, slot: 0, hp: 0x123, max: 500 });
  r.start(); while (!r.events.some(e => e.event === 'animateHpBar:end') && r.time() < 500) r.step();
  const begin = r.events.find(e => e.event === 'animateHpBar')!, end = r.events.find(e => e.event === 'animateHpBar:end')!;
  expect(end.at - begin.at).toBe(30); expect(r.s.readBE(I.wHPBarTempHP)).toBe(0x137);
  expect([...r.s.mem.slice(I.wHPBarOldHP, I.wHPBarOldHP + 2)]).toEqual([0x37, 1]);
  r.finish();
});

it('the menu wraps through PartyMenu and saves a new row without a switch submenu', () => {
  const r = setup(CASES[0]);
  r.plan((at, phase) => phase === 'displayPartyMenu' ? at === 24 ? ['up'] : at === 27 ? ['a'] : [] : at % 2 === 0 ? ['b'] : []);
  r.start(); r.finish();
  expect(r.events.filter(e => e.event === 'read').map(e => e.at).slice(0, 2)).toEqual([24, 27]);
  expect(r.s.mem[I.wUsedItemOnWhichPokemon]).toBe(1); expect(getPartyAndBillsSavedMenuItem()).toBe(1);
  expect(r.party.chosenIndex).toBe(1); expect(r.s.wBattleMonSpecies2).toBe(0x54);
});

it('sleeping starter refusal stays with PartyMenu and its real text, then returns cancel', () => {
  const r = setup({ name: 'sleeping starter', id: 0x14, slot: 1, hp: 10 });
  disablePikachuFollowing(); r.start(); r.finish();
  expect(r.party.chosenIndex).toBe(-1); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
  expect(r.bag[1].count).toBe(2); expect(r.time()).toBeGreaterThan(29);
  expect(r.events.some(e => e.event === 'animateHpBar')).toBe(false);
});

it('the empty HP change returns immediately with the correct difference and no extra frame', () => {
  const r = setup(CASES[0]);
  writeHpBarWord(r.s, I.wHPBarOldHP, 7); writeHpBarWord(r.s, I.wHPBarNewHP, 7); writeHpBarWord(r.s, I.wHPBarMaxHP, 100);
  r.s.wHPBarType = 2;
  r.start(r.env.animateHpBar(4, 1));
  expect(r.driver.done).toBe(true); expect(r.time()).toBe(0); expect(r.s.readBE(I.wHPBarHPDifference)).toBe(0);
});

it('the party row retains its old status and bar colour until redraw, while HP bytes already hold the heal', () => {
  const r = setup({ name: 'frozen', id: 0x10, slot: 0, hp: 10, status: 'PAR' }); r.start();
  while (!r.events.some(e => e.event === 'animateHpBar') && r.time() < 100) r.step();
  const view = r.party as unknown as { hpOverride: ({ status: StatusCondition; colorPixels: number; shownHp: number } | null)[] };
  expect(r.s.partyMons[0]!.currentHp).toBe(100); expect(r.s.partyMons[0]!.status).toBeNull();
  expect(view.hpOverride[0]).toMatchObject({ status: 'PAR', colorPixels: 4, shownHp: 10 });
  r.finish();
  expect(view.hpOverride[0]).toBeNull(); expect(r.party.cursorVisible).toBe(false); expect(r.party.promptVisible).toBe(false);
});

it('ClearScreen blanks the complete tile map before its three serviced waits, retaining transfer off', () => {
  const r = setup(CASES[0]); r.screen.put(0, 0, 'Q'); r.screen.put(19, 17, 'Z');
  textBgTransfer.enabled = false; r.s.mem[I.hAutoBGTransferEnabled] = 0;
  r.start(r.env.clearScreen()); expect(r.screen.cells.every(cell => cell === ' ')).toBe(true);
  r.finish(); expect(r.time()).toBe(3); expect(textBgTransfer.enabled).toBe(false);
  expect(r.frames.map(frame => frame.kind)).toEqual(['serviced', 'serviced', 'serviced']);
});


describe('06b medicine draw cells', () => {
  it.each([
    { name: 'cancel from first cursor', id: 0x14, slot: 0, hp: 10, cancel: true },
    { name: 'success redraw', id: 0x14, slot: 0, hp: 10 },
    { name: 'no effect without redraw', id: 0x14, slot: 0, hp: 100 },
    { name: 'one-mon cancel', id: 0x14, slot: 0, hp: 10, cancel: true, count: 1 },
    { name: 'one-mon success', id: 0x14, slot: 0, hp: 10, count: 1 },
  ])('$name', c => {
    const r = setup(c), s = r.s, count = s.mem[I.wPartyCount], last = count - 1;
    const rows: number[] = [], load = monData.loadExperienceMonData;
    const copies: Uint8Array[] = [];
    vi.spyOn(monData, 'loadExperienceMonData').mockImplementation(state => {
      rows.push(state.wWhichPokemon); load(state);
      const row = state.wWhichPokemon, species = state.mem[I.wPartySpecies + row];
      expect([state.wCurPartySpecies, state.wCurSpecies]).toEqual([species, species]);
      const expected = state.mem.slice(I.wPartyMons + row * 44, I.wPartyMons + (row + 1) * 44);
      expect(state.mem.slice(A.wLoadedMon, A.wLoadedMon + 44)).toEqual(expected); copies.push(expected);
      expect(state.mem[A.wMonHIndex]).toBe(species);
      expect([...state.mem.slice(A.wMonHBaseStats, A.wMonHBaseStats + 5)]).toEqual(state.species(species).base);
    });
    r.start(); r.finish();
    const success = s.wActionResultOrTookBattleTurn === 1;
    const loop = Array.from({ length: count }, (_, i) => i);
    expect(rows).toEqual(success ? [...loop, ...loop] : loop);
    expect(s.wWhichPokemon).toBe(success || c.cancel ? last : 1);
    expect(s.mem[I.wCurItem]).toBe(success || c.cancel ? s.mem[I.wPartySpecies + last] : c.id);
    expect(r.bag.map(stack => stack.count)).toEqual([3, success ? 1 : 2]);
    expect(s.mem.slice(A.wLoadedMon, A.wLoadedMon + 44)).toEqual(copies[copies.length - 1]);
  });
});
