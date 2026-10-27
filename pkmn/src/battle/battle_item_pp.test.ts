import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), drawFadeOverlay: vi.fn(), drawSprite: vi.fn(),
  getScale: () => 1, getCtx: () => ({ drawImage() {}, save() {}, translate() {}, scale() {}, restore() {} }),
  loadSprite: async () => ({ width: 128 }), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isHeld, isPassPressed } from '../input';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { getTextPrograms, loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { PartyMenu } from '../menus/party_menu';
import { loadPartyTiles } from '../menus/party_tiles';
import { loadPartyIcons } from '../menus/party_icons';
import { enablePikachuFollowing } from '../pikachu/pikachu_following';
import { setPartyAndBillsSavedMenuItem } from '../list_state';
import { createPokemon } from './data';
import { A, BattleState, encodeText } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { useItem, type BattleItemHost } from './battle_items';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { loadBattleMoveData, moveNameBinding, getMoveRecord } from './battle_move_data';
import { getPartyMoveMaxPP, registerPPBattleItemBody, type PPItemEnvironment } from './battle_item_pp';
import * as sessions from './battle_item_medicine_env';
import * as menus from './move_selection_menu';
import * as items from './battle_items';
import * as happiness from './battle_pikachu';
import * as monData from './battle_experience';
import type { Frame, MenuMove } from './battle_menu_context';

const data = JSON.parse(readFileSync(resolve(__dirname, '../../data/moves.json'), 'utf8')) as Record<string, Omit<MenuMove, 'name'>>;
const names = JSON.parse(readFileSync(resolve(__dirname, '../../data/move_names.json'), 'utf8')) as Record<string, string>;
const moves = new Map(Object.entries(data).map(([key, move]) => [move.id, { key, ...move, name: names[key] }]));
const disposers: (() => void)[] = [];
beforeAll(async () => { await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); await loadPartyTiles(); await loadPartyIcons(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
  enablePikachuFollowing(); setPartyAndBillsSavedMenuItem(0);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

interface Config { id?: number; slot?: number; list?: number[]; pp?: number[]; transformed?: boolean;
  partyCancel?: boolean; moveCancelFirst?: boolean; moveIndex?: number; stack?: number; count?: number; starterFirst?: boolean }
function setup({ id = 0x50, slot = 0, list = [1, 45, 84, 93], pp = [0, 40, 30, 25],
  transformed = false, partyCancel = false, moveCancelFirst = false, moveIndex = 0, stack = 2, count = 2, starterFirst = false }: Config = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  s.species = id => ({ name: id === 0x54 ? 'PIKACHU' : 'RATTATA',
    base: id === 0x54 ? [35, 55, 30, 90, 50] : [30, 56, 35, 72, 25],
    type1: id === 0x54 ? 23 : 0, type2: id === 0x54 ? 23 : 0,
    catchRate: 190, baseExp: 82, moves: [84, 45, 0, 0], learnset: [], growthRate: 0 });
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video, screen = video.screen, party = new PartyMenu();
  for (let index = 0; index < 2; index++) {
    const pika = starterFirst ? index === 0 : index === 1;
    const mon = createPokemon(pika ? 25 : 19, 5, pika ? 'PIKA' : 'RAT', { atk: 8, def: 8, spd: 8, spc: 8 })!;
    Object.assign(mon, { currentHp: 50, maxHp: 100, otId: 0x1234, otName: 'ASHXY' });
    mon.moves = list.filter(Boolean).map((move, i) => ({ id: moves.get(move)!.key, pp: pp[i] & 63, maxPp: moves.get(move)!.pp }));
    s.partyMons[index] = mon; writePartySlot(s, 'player', index, partySlotFromPokemon(mon));
    s.mem.set(list, I.wPartyMons + index * 44 + 8); s.mem.set(pp, I.wPartyMons + index * 44 + 29);
    s.mem[I.wPartySpecies + index] = s.mem[I.wPartyMons + index * 44];
  }
  s.mem[I.wPartyCount] = count; s.mem[I.wPartySpecies + count] = 255;
  s.wIsInBattle = 1; s.wPlayerMonNumber = 0; s.wBattleMonSpecies = 0xa5; s.wEnemyMonSpecies2 = 0x54;
  s.wPlayerHPBarColor = 0; s.wEnemyHPBarColor = 1; s.wPlayerBattleStatus3 = transformed ? 8 : 0;
  s.mem.set([126, 45, 84, 93], I.wBattleMonMoves); s.mem.set([7, 8, 9, 10], I.wBattleMonPP);
  s.mem[I.wPikachuHappiness] = 99; s.mem[I.wPikachuMood] = 0x80;
  s.writeBE(I.wPlayerID, 0x1234); s.mem.set(encodeText('ASHXY@'), I.wPlayerName);
  s.mem[I.wCurItem] = id; s.wWhichPokemon = 2;
  s.setBag([{ id: 0x14, quantity: 3 }, { id: 0x14, quantity: 4 }, { id, quantity: stack }]);
  const bag = [{ id: 'POTION', count: 3 }, { id: 'POTION', count: 4 }, { id: 'PP_ITEM', count: stack }];
  const bagBefore = s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8);
  const base = I.wPartyMons + slot * 44;
  // Mirror setters assert each selected move's raw PP write has already happened.
  s.partyMons[slot]!.moves.forEach((move, index) => {
    let value = move.pp;
    Object.defineProperty(move, 'pp', { configurable: true, get: () => value, set(next: number) {
      expect(s.mem[base + 29 + index] & 63).toBe(next); value = next;
    } });
  });
  setPartyAndBillsSavedMenuItem(slot);
  let at = 0, phase = 'cpu', keys: string[] = [], partyCalls = 0, moveCalls = 0;
  const hex = (address: number, length: number) => [...s.mem.slice(address, address + length)].map(n => n.toString(16).padStart(2, '0')).join(' ');
  function state() { return { which: s.wWhichPokemon, item: s.mem[I.wCurItem], restoreItem: s.mem[I.wPPRestoreItem],
    menu: s.wCurrentMenuItem, counter: s.mem[I.wTileBehindCursor], result: s.wActionResultOrTookBattleTurn,
    max: s.wMaxPP, record: hex(I.wMoveData, 6), party: hex(base + 29, 4), battle: hex(I.wBattleMonPP, 4),
    bag: bag.map(stack => stack.count), sprites: s.mem[I.wUpdateSpritesEnabled] }; }
  const events: { at: number; event: string; data?: unknown; state: ReturnType<typeof state> }[] = [];
  const frames: { at: number; phase: string; kind: Frame }[] = [];
  const mark = (event: string, extra?: unknown) => events.push({ at, event, data: extra, state: state() });
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, bag, sounds: new Map([[0x8e, { id: 0x8e, data: sfxData('heal_ailment') }]]),
    printText: function* (label, bindings, options) {
      const previous = phase; phase = `text:${label}`; mark(phase); yield* driver.printText(label, bindings, options);
      mark(`end:${label}`); phase = previous;
    },
    waitForSound: function* () { throw new Error('PP items must not wait for sound'); }, readScrollJoypad: () => { throw new Error('PP items have no scroll waiter'); },
  };
  const press = () => { mark('press'); bridge.play({ id: 0x90, data: sfxData('press_ab') }); };
  const env: PPItemEnvironment = {
    screen, video, partyView: party,
    readJoypad() { mark('party:read'); keys = [partyCancel ? 'b' : 'a']; }, pressSound: press,
    moveMenu: { tiles: video.tiles, getMove: move => moves.get(move)!,
      readJoypad() { mark('move:read'); keys = [moveCancelFirst && moveCalls === 1 ? 'b' :
        s.wCurrentMenuItem < moveIndex + 1 ? 'down' : 'a']; },
      pressSound: press, printText: host.printText,
      loadScreenTilesFromBuffer1() { throw new Error('type2 must not use the regular move-menu refusal'); },
    },
  };
  const session = sessions.displayUseItemPartyMenu;
  const partyMenu = vi.spyOn(sessions, 'displayUseItemPartyMenu').mockImplementation(function* (...args) {
    const previous = phase; phase = 'party'; partyCalls++; mark('party:start');
    expect(s.mem[I.wUpdateSpritesEnabled]).toBe(0); expect(s.mem[I.wPartyMenuTypeOrMessageID]).toBe(1);
    const result = yield* session(...args); mark('party:end', result); phase = previous; return result;
  });
  const chooser = menus.moveSelectionMenu;
  const moveMenu = vi.spyOn(menus, 'moveSelectionMenu').mockImplementation(function* (...args) {
    const previous = phase; phase = 'move'; moveCalls++; mark('move:start');
    expect(s.wMoveMenuType).toBe(2); expect(s.wPlayerMoveListIndex).toBe(0);
    const flags = yield* chooser(...args); mark('move:end', flags); phase = previous; return flags;
  });
  const palette = screen.setPalBattle.bind(screen);
  vi.spyOn(screen, 'setPalBattle').mockImplementation(function* (input) {
    const previous = phase; phase = 'palette'; mark('palette:start', input); yield* palette(input); mark('palette:end'); phase = previous;
  });
  const remove = items.removeUsedItem;
  const removed = vi.spyOn(items, 'removeUsedItem').mockImplementation((state, owner) => {
    mark('remove'); remove(state, owner); mark('removed');
  });
  const play = bridge.play.bind(bridge);
  const sound = vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', sound.id); return play(sound); });
  const happy = vi.spyOn(happiness, 'modifyPikachuHappiness');
  disposers.push(registerPPBattleItemBody(env));
  vi.mocked(isHeld).mockImplementation(key => keys.includes(key)); vi.mocked(isPassPressed).mockImplementation(key => keys.includes(key));
  function start() { driver.start(useItem(s, host)); }
  function step() {
    at++; keys = phase.startsWith('text:') && at % 2 === 0 ? ['b'] : [];
    const before = phase, kind = driver.step(); if (kind) frames.push({ at, phase: before, kind });
  }
  function finish() {
    for (let i = 0; !driver.done && i < 4000; i++) step(); expect(driver.done).toBe(true);
    expect(happy).not.toHaveBeenCalled(); expect([s.mem[I.wPikachuHappiness], s.mem[I.wPikachuMood]]).toEqual([99, 0x80]);
  }
  function ledger() {
    const ranges: { phase: string; kind: Frame; start: number; end: number }[] = [];
    for (const frame of frames) {
      const last = ranges[ranges.length - 1];
      if (last?.phase === frame.phase && last.kind === frame.kind) last.end = frame.at;
      else ranges.push({ phase: frame.phase, kind: frame.kind, start: frame.at, end: frame.at });
    }
    return { events: events.map(event => `${event.at} ${event.event} ${JSON.stringify(event.data)} ${JSON.stringify(event.state)}`),
      ranges, total: at, final: state() };
  }
  return { s, base, audio, bridge, driver, env, host, bag, bagBefore, events, frames, sound, removed, partyMenu, moveMenu,
    start, step, finish, ledger, state, time: () => at, partyCalls: () => partyCalls };
}

it('all PP texts already exist as committed programs', () => {
  const programs = getTextPrograms();
  for (const root of ['RestorePPWhichTechniqueText', 'PPRestoredText', 'ItemUseNoEffectText', 'ItemUseNotTimeText']) {
    expect(programs[root]).toBeDefined();
  }
});

describe('GetMaxPP party source and raw aliases', () => {
  it.each([0, 1, 2, 3].flatMap(ups => [{ move: 126, base: 5, bonus: 1 }, { move: 45, base: 40, bonus: 7 }]
    .map(spec => ({ ups, ...spec }))))('move$move base$base ups$ups has the capped bonus and six-byte record', ({ move, base, bonus, ups }) => {
    const s = new BattleState(); s.wWhichPokemon = 1; s.wCurrentMenuItem = 2; s.wMonDataLocation = 0;
    const at = I.wPartyMons + 44 + 8 + 2; s.mem[at] = move; s.mem[at + 21] = ups * 64;
    s.mem[I.wBattleMonMoves + 2] = 1; s.mem[I.wBattleMonPP + 2] = 0;
    const writes: [string, number][] = [];
    for (const key of ['wUsingPPUp', 'wMaxPP'] as const) {
      const setter = Object.getOwnPropertyDescriptor(s, key)!.set!;
      vi.spyOn(s, key, 'set').mockImplementation(value => { writes.push([key, value]); setter.call(s, value); });
    }
    expect(getPartyMoveMaxPP(s)).toBe(base + ups * bonus);
    expect(writes).toEqual([['wUsingPPUp', 0], ['wMaxPP', base + ups * bonus]]);
    expect(I.wUsingPPUp).toBe(I.wMaxPP); expect(s.mem[0xd11d]).toBe(base + ups * bonus);
    expect([...s.mem.slice(I.wMoveData, I.wMoveData + 6)]).toEqual([...getMoveRecord(move)]);
    expect(s.mem[I.wMoveData + 5]).toBe(base); expect(s.wPPUpCountAndMaxPP).toBe(ups * 64 + base + ups * bonus);
  });
});

describe('Ether and Max Ether byte effects', () => {
  it.each([0, 3].flatMap(ups => [0, 1, 15].map(missing => ({ ups, missing }))))
  ('Ether with$ups PP Ups and$missing missing PP', ({ ups, missing }) => {
    const max = 35 + ups * 7, packed = ups * 64 + max - missing;
    const r = setup({ pp: [packed, 40, 30, 25] }); r.start(); r.finish();
    expect(r.s.mem[r.base + 29]).toBe(ups * 64 + Math.min(max, max - missing + 10));
    expect(r.s.wActionResultOrTookBattleTurn).toBe(missing ? 1 : 0);
    expect(r.s.wWhichPokemon).toBe(missing ? 2 : 0); expect(r.bag[2].count).toBe(missing ? 1 : 2);
    expect(r.s.wPlayerMoveListIndex).toBe(0);
    if (missing) expect([...r.s.mem.slice(I.wBattleMonPP, I.wBattleMonPP + 4)])
      .toEqual([...r.s.mem.slice(r.base + 29, r.base + 33)]);
    else expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
    expect(moveNameBinding(r.s)).toBe('POUND');
  });
  it.each([1, 2, 3])('Max Ether spends at already-full PP with%s PP Ups: the cartridge bug', ups => {
    const packed = ups * 64 + 35 + ups * 7;
    const r = setup({ id: 0x51, pp: [packed, 40, 30, 25] }); r.start(); r.finish();
    expect(r.s.mem[r.base + 29]).toBe(packed); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
    expect(r.bag[2].count).toBe(1); expect(r.sound.mock.calls.some(([sound]) => sound.id === 0x8e)).toBe(true);
  });
  it('a zero-PP-Up Max Ether at full PP refuses and leaves the party slot', () => {
    const r = setup({ id: 0x51, slot: 1, pp: [35, 40, 30, 25] }); r.start(); r.finish();
    expect(r.s.wWhichPokemon).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
  });
  it('type2 selects the third party move, restores only that PP and copies its name', () => {
    const r = setup({ slot: 1, moveIndex: 2, pp: [35, 40, 1, 25] }); r.start(); r.finish();
    expect([...r.s.mem.slice(r.base + 29, r.base + 33)]).toEqual([35, 40, 11, 25]);
    expect(r.s.wCurrentMenuItem).toBe(2); expect(r.s.wPlayerMoveListIndex).toBe(0);
    expect(moveNameBinding(r.s)).toBe('THUNDERSHOCK');
  });
});

describe('Elixir iteration and target gates', () => {
  it('Elixir skips an empty slot, restores exactly two and ends on menu4/counter2', () => {
    const r = setup({ id: 0x52, list: [1, 45, 84, 0], pp: [0, 40, 5, 0xab] }); r.start(); r.finish();
    expect([...r.s.mem.slice(r.base + 29, r.base + 33)]).toEqual([10, 40, 15, 0xab]);
    expect([r.s.wCurrentMenuItem, r.s.mem[I.wTileBehindCursor]]).toEqual([4, 2]);
    expect(I.wTileBehindCursor).toBe(I.wCurrentMenuItem + 1);
    expect(r.s.mem[I.wPPRestoreItem]).toBe(0x50); expect(r.s.mem[I.wCurItem]).toBe(0xa5);
    expect(r.moveMenu).not.toHaveBeenCalled(); expect(r.s.partyMons[0]!.moves.map(move => move.pp)).toEqual([10, 40, 15]);
  });
  it('an Elixir with nothing to restore skips empty PP garbage and does not count it', () => {
    const r = setup({ id: 0x52, list: [1, 0, 0, 0], pp: [35, 0xff, 0x9a, 0x81] }); r.start(); r.finish();
    expect([r.s.wCurrentMenuItem, r.s.mem[I.wTileBehindCursor]]).toEqual([4, 0]);
    expect(r.s.wWhichPokemon).toBe(0); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
  });
  it('Max Elixir retains the full-PP-plus-PP-Ups bug through its MAX_ETHER conversion', () => {
    const r = setup({ id: 0x53, list: [1, 0, 0, 0], pp: [106, 0, 0, 0] }); r.start(); r.finish();
    expect(r.s.mem[r.base + 29]).toBe(106); expect(r.s.mem[I.wTileBehindCursor]).toBe(1);
    expect(r.s.mem[I.wPPRestoreItem]).toBe(0x51); expect(r.s.mem[I.wCurItem]).toBe(0xa5);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(1); expect(r.bag[2].count).toBe(1);
  });
  it('a transformed active mon refuses before the move menu, but a reserve remains eligible', () => {
    const r = setup({ transformed: true }); r.start(); r.finish();
    expect(r.moveMenu).not.toHaveBeenCalled(); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.events.some(e => e.event === 'text:ItemUseNotTimeText')).toBe(true); expect(r.bag[2].count).toBe(2);
  });
  it('a transformed active mon does not block a reserve or copy the reserve PP to battle', () => {
    const r = setup({ transformed: true, slot: 1 }); r.start(); r.finish();
    expect(r.s.mem[r.base + 29]).toBe(10); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
    expect([...r.s.mem.slice(I.wBattleMonPP, I.wBattleMonPP + 4)]).toEqual([7, 8, 9, 10]);
  });
  it('B in the move menu repeats the full party opening before a second successful choice', () => {
    const r = setup({ moveCancelFirst: true }); r.start(); r.finish();
    expect(r.partyMenu).toHaveBeenCalledTimes(2); expect(r.moveMenu).toHaveBeenCalledTimes(2);
    const openings = r.events.filter(e => e.event === 'party:start'), ends = r.events.filter(e => e.event === 'party:end');
    expect(ends.map((end, i) => end.at - openings[i].at)).toEqual([24, 24]);
    expect(r.s.wActionResultOrTookBattleTurn).toBe(1); expect(r.s.wWhichPokemon).toBe(2);
  });
  it('party cancel leaves the party row and an untouched bag', () => {
    const r = setup({ slot: 1, partyCancel: true }); r.start(); r.finish();
    expect(r.s.wWhichPokemon).toBe(1); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 8)).toEqual(r.bagBefore);
  });
  it('palette tail completes before last-stack removal, without a sound or scroll wait', () => {
    const r = setup({ stack: 1 }); r.start(); r.finish();
    const end = r.events.findIndex(e => e.event === 'palette:end'), remove = r.events.findIndex(e => e.event === 'remove');
    expect(end).toBeLessThan(remove); expect(r.events[end].state.bag).toEqual([3, 4, 1]);
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4]); expect(r.s.mem[I.wBagItems + 4]).toBe(255);
  });
});

const LEDGERS = [
  { name: 'Ether active', config: {} },
  { name: 'Max Elixir reserve', config: { id: 0x53, slot: 1, pp: [0, 4, 0, 5] } },
  { name: 'move B then success', config: { moveCancelFirst: true } },
  { name: 'transformed refusal', config: { transformed: true } },
  { name: 'no effect', config: { pp: [35, 40, 30, 25] } },
];
it.each(LEDGERS)('$name real party/menu/printer/audio/palette ledger and total', ({ name, config }) => {
  const r = setup(config); r.start(); r.finish();
  expect(r.events.filter(e => e.event === 'palette:start')).toHaveLength(1);
  if (r.s.wActionResultOrTookBattleTurn) {
    expect(r.events.findIndex(e => e.event === 'palette:end')).toBeLessThan(r.events.findIndex(e => e.event === 'remove'));
    expect(r.s.wWhichPokemon).toBe(2);
  } else expect(r.removed).not.toHaveBeenCalled();
  const totals: Record<string, number> = { 'Ether active': 133, 'Max Elixir reserve': 69,
    'move B then success': 221, 'transformed refusal': 137, 'no effect': 147 };
  expect(r.time()).toBe(totals[name]);
  const openings = r.events.filter(e => e.event === 'party:start'), ends = r.events.filter(e => e.event === 'party:end');
  expect(ends.map((end, i) => end.at - openings[i].at)).toEqual(openings.map(() => 24));
  expect(r.frames.slice(-5).map(frame => frame.kind)).toEqual(['held', 'held', 'serviced', 'serviced', 'serviced']);
  expect(r.ledger()).toMatchSnapshot();
});


describe('06b party draw and selection cells', () => {
  it.each([
    { name: 'success', config: {}, which: 2, item: 0xa5 },
    { name: 'no effect', config: { pp: [35, 40, 30, 25] }, which: 0, item: 0xa5 },
    { name: 'transformed', config: { transformed: true }, which: 0, item: 0xa5 },
    { name: 'cancel at first cursor', config: { partyCancel: true }, which: 1, item: 0x54 },
    { name: 'one-mon cancel', config: { partyCancel: true, count: 1 }, which: 0, item: 0xa5 },
    { name: 'reserve success', config: { slot: 1 }, which: 2, item: 0x54 },
    { name: 'following starter before last row', config: { starterFirst: true, partyCancel: true }, which: 1, item: 0xa5 },
  ])('$name retains cartridge aliases and row order', ({ config, which, item }) => {
    const r = setup(config), s = r.s, count = s.mem[I.wPartyCount];
    const expected = s.mem.slice(I.wPartyMons + 44 * (count - 1), I.wPartyMons + 44 * count);
    const rows: number[] = [], load = monData.loadExperienceMonData;
    vi.spyOn(monData, 'loadExperienceMonData').mockImplementation(state => {
      rows.push(state.wWhichPokemon); load(state);
      const row = state.wWhichPokemon, species = state.mem[I.wPartySpecies + row];
      expect([state.wCurPartySpecies, state.wCurSpecies]).toEqual([species, species]);
      expect(state.mem.slice(A.wLoadedMon, A.wLoadedMon + 44))
        .toEqual(state.mem.slice(I.wPartyMons + 44 * row, I.wPartyMons + 44 * (row + 1)));
      expect([...state.mem.slice(A.wMonHBaseStats, A.wMonHBaseStats + 5)]).toEqual(state.species(species).base);
      expect(state.mem[A.wMonHIndex]).toBe(species);
    });
    r.start(); r.finish();
    expect(rows).toEqual(Array.from({ length: count }, (_, i) => i));
    expect(s.wWhichPokemon).toBe(which); expect(s.mem[I.wCurItem]).toBe(item);
    expect(s.wCurPartySpecies).toBe(item);
    expect(s.mem.slice(A.wLoadedMon, A.wLoadedMon + 44)).toEqual(expected);
    if (!('partyCancel' in config && config.partyCancel)) expect(s.wBattleMonSpecies2).toBe(item);
    else expect(s.wBattleMonSpecies2).toBe(0);
    if (s.wActionResultOrTookBattleTurn) {
      expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]);
      expect(r.events.find(e => e.event === 'remove')!.state.which).toBe(2);
    } else expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 2]);
  });

  it('LoadMonData reads the species list and copies exactly 44 bytes', () => {
    const r = setup(), s = r.s;
    s.wWhichPokemon = 0; s.wMonDataLocation = 0;
    s.mem[I.wPartySpecies] = 0x54; // Deliberately differs from the slot struct.
    const bytes = Uint8Array.from({ length: 44 }, (_, i) => i + 100);
    s.mem.set(bytes, I.wPartyMons);
    s.mem[A.wLoadedMon - 1] = 0x66; s.mem[A.wLoadedMon + 44] = 0x77;
    monData.loadExperienceMonData(s);
    expect([s.wCurPartySpecies, s.wCurSpecies, s.mem[A.wMonHIndex]]).toEqual([0x54, 0x54, 0x54]);
    expect([...s.mem.slice(A.wMonHBaseStats, A.wMonHBaseStats + 5)]).toEqual([35, 55, 30, 90, 50]);
    expect(s.mem.slice(A.wLoadedMon, A.wLoadedMon + 44)).toEqual(bytes);
    expect([s.mem[A.wLoadedMon - 1], s.mem[A.wLoadedMon + 44]]).toEqual([0x66, 0x77]);
    s.wMonDataLocation = 1; expect(() => monData.loadExperienceMonData(s)).toThrow();
  });

  it('selection reads the species list rather than the slot struct', () => {
    const r = setup({ transformed: true });
    r.s.mem[I.wPartySpecies] = 0x54;
    r.start(); r.finish();
    expect([r.s.wWhichPokemon, r.s.wCurPartySpecies, r.s.wBattleMonSpecies2]).toEqual([0, 0x54, 0x54]);
  });
});
