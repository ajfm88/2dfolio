import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), drawFadeOverlay: vi.fn(), drawSprite: vi.fn(),
  getScale: () => 1, getCtx: () => ({ drawImage() {}, save() {}, translate() {}, scale() {}, restore() {} }),
  loadSprite: async () => ({ width: 128 }), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { isHeld, isPassPressed } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms, getTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { BattleState, encodeText } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { useItem, type BattleItemHost } from './battle_items';
import { BALL, itemUseBall, calculateBallAnimation, registerBallBattleItemBody, type BallItemEnvironment } from './battle_item_ball';
import * as rng from './battle_random';
import * as loaders from './battle_loaders';
import * as items from './battle_items';
import type { Frame, Program } from './battle_menu_context';

const disposers: (() => void)[] = [];
beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });
interface Config { item?: number; max?: number; hp?: number; rate?: number; status?: number; draws?: number[];
  type?: number; map?: number; scope?: boolean; count?: number; box?: number; trainer?: boolean;
  initial?: boolean; bill?: boolean; owned?: boolean; transformed?: boolean; species?: number; clobber?: boolean }

function setup(c: Config = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video, screen = video.screen;
  s.species = id => ({ name: id === BALL.DITTO ? 'DITTO' : 'RATTATA', base: id === BALL.DITTO
    ? [48, 48, 48, 48, 48] : [30, 56, 35, 72, 25], type1: 0, type2: 0,
    catchRate: 200, baseExp: 57, moves: [1, 0, 0, 0], learnset: [], growthRate: 0 });
  s.movePP = () => 35;
  s.wIsInBattle = c.trainer ? 2 : 1; s.wBattleType = c.type ?? 0;
  s.wCurMap = c.map ?? 0; s.wEnemyMonSpecies2 = s.wEnemyMonSpecies = c.species ?? 0xa5;
  s.wBattleMonSpecies = 0x54; s.wEnemyMonLevel = 20;
  s.mem[I.wPartyMons] = 0x54;
  s.wEnemyMonMaxHP = c.max ?? 100; s.wEnemyMonHP = c.hp ?? 100;
  s.wEnemyMonActualCatchRate = c.rate ?? 3; s.wEnemyMonStatus = c.status ?? 0;
  s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpeed = s.wEnemyMonSpecial = 999;
  s.mem.set([0x98, 0x76], I.wEnemyMonDVs); s.mem.set([0x12, 0x34], I.wTransformedEnemyMonOriginalDVs);
  s.wEnemyBattleStatus3 = c.transformed ? 8 : 0;
  s.mem[I.wPartyCount] = c.count ?? 1; s.mem[I.wBoxCount] = c.box ?? 0;
  s.mem[I.wPikachuHappiness] = 99; s.mem[I.wPikachuMood] = 0x80;
  s.wNumSafariBalls = 5; s.hWhoseTurn = 1; s.wAnimationType = 0xa5; s.wDamageMultipliers = 0xb6;
  s.mem.set(encodeText('ASH@1234567'), I.wPlayerName);
  s.mem.set(encodeText('BALL@'), I.wStringBuffer);
  s.mem.set(encodeText('BOXMON@'), I.wBoxMonNicks);
  const id = c.item ?? 4;
  const stacks = [{ id: 0x14, quantity: 3 }, { id: 0x14, quantity: 4 }, { id, quantity: 2 }];
  if (c.scope) stacks.push({ id: 0x48, quantity: 1 });
  s.setBag(stacks); s.wWhichPokemon = 2; s.mem[I.wCurItem] = id;
  const bag = stacks.map(stack => ({ id: String(stack.id), count: stack.quantity }));
  const bagBefore = s.mem.slice(I.wNumBagItems, I.wNumBagItems + 10);
  for (const bit of [c.initial ? BALL.initialCatchTraining : -1, c.bill ? BALL.metBill : -1]) {
    if (bit >= 0) s.mem[BALL.eventFlags + (bit >>> 3)] |= 1 << (bit & 7);
  }
  // Rattata is dex19. Ditto's owned bit is left clear unless this is an ordinary owned fixture.
  if (c.owned) s.mem[I.wPokedexOwned + 2] |= 4;
  let at = 0, phase = 'cpu', used = 0, second = false;
  const draws = c.draws ?? [200];
  const events: { at: number; event: string; data?: unknown }[] = [];
  const frames: { at: number; phase: string; kind: Frame }[] = [];
  const mark = (event: string, data?: unknown) => events.push({ at, event, data });
  s.readDIV = () => {
    if (!second) { expect(used).toBeLessThan(draws.length); second = true; return (draws[used] - s.hRandomAdd) & 255; }
    second = false; expect(s.hRandomAdd).toBe(draws[used]); mark('Random', draws[used++]); return 0;
  };
  vi.spyOn(rng, 'battleRandom').mockImplementation(() => { throw new Error('unexpected BattleRandom'); });
  const random = rng.random;
  vi.spyOn(rng, 'random').mockImplementation((state, carry) => { expect(carry).toBe(0); return random(state, carry); });
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', sound.id); return play(sound); });
  vi.mocked(playSFX).mockImplementation(name => {
    const id = name === 'caught_mon' ? 0x9a : name === 'dex_page_added' ? 0x98 : name === 'press_ab' ? 0x90 : -1;
    if (id < 0) throw new Error(`unexpected sound ${name}`);
    bridge.play({ id, data: sfxData(name) });
    return Promise.resolve();
  });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, sounds: new Map(), bag,
    printText: function* (label, bindings, options) {
      const previous = phase; phase = label; mark(`print:${label}`);
      yield* driver.printText(label, bindings, options);
      mark(`end:${label}`); phase = previous;
    },
    waitForSound: function* () { throw new Error('no explicit ball sound wait'); },
    readScrollJoypad() { throw new Error('no ball scroll waiter'); },
  };
  const env: BallItemEnvironment = {
    video,
    animation: function* () {
      mark('MoveAnimation', { id: s.wAnimationID, turn: s.hWhoseTurn, type: s.wAnimationType,
        multipliers: s.wDamageMultipliers, anim: s.mem[I.wPokeBallAnimData], which: s.wWhichPokemon,
        item: s.mem[I.wCurItem], math: [...s.mem.slice(I.hProduct, I.hProduct + 10)] });
      if (c.clobber) { s.wWhichPokemon = 5; s.mem[I.wCurItem] = 0xff; }
    },
    addPartyMon: function* () { mark('AddPartyMon', [s.wWhichPokemon, s.wMonDataLocation]); },
    sendNewMonToBox: function* () { mark('SendNewMonToBox', s.wWhichPokemon); },
    showPokedexData: function* () { mark('ShowPokedexData', s.wPokedexNum); },
  };
  video.screen.put(0, 0, 'Q'); video.saveScreenTilesToBuffer1(); video.screen.put(0, 0, 'Z');
  const restore = video.loadScreenTilesFromBuffer1.bind(video);
  vi.spyOn(video, 'loadScreenTilesFromBuffer1').mockImplementation(() => {
    mark('load1'); restore(); expect(screen.at(0, 0)).toBe('Q');
  });
  const pal = screen.setPalBattle.bind(screen);
  vi.spyOn(screen, 'setPalBattle').mockImplementation(function* (input) {
    const previous = phase; phase = 'palette'; mark('palette', input); yield* pal(input); mark('palette:end'); phase = previous;
  });
  const clear = screen.setOam.bind(screen);
  vi.spyOn(screen, 'setOam').mockImplementation((i, value) => { if (!i) mark('ClearSprites'); clear(i, value); });
  const load = loaders.loadEnemyMonData;
  vi.spyOn(loaders, 'loadEnemyMonData').mockImplementation(state => {
    mark('LoadEnemyMonData', [state.wCurPartySpecies, state.wCurEnemyLevel]); load(state);
  });
  const remove = items.removeUsedItem;
  vi.spyOn(items, 'removeUsedItem').mockImplementation((state, owner) => {
    mark('remove', [state.wWhichPokemon, state.mem[I.wCurItem]]); remove(state, owner);
  });
  disposers.push(registerBallBattleItemBody(env));
  function start(program: Program = useItem(s, host)) { driver.start(program); }
  function finish() {
    for (let i = 0; !driver.done && i < 4000; i++) {
      const pressed = at % 2 === 0;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      vi.mocked(isPassPressed).mockImplementation(key => pressed && key === 'b');
      at++; const before = phase, kind = driver.step(); if (kind) frames.push({ at, phase: before, kind });
    }
    expect(driver.done).toBe(true); expect(used).toBe(draws.length);
  }
  function ledger() {
    const ranges: { phase: string; kind: Frame; from: number; to: number }[] = [];
    for (const frame of frames) {
      const last = ranges[ranges.length - 1];
      if (last?.phase === frame.phase && last.kind === frame.kind) last.to = frame.at;
      else ranges.push({ phase: frame.phase, kind: frame.kind, from: frame.at, to: frame.at });
    }
    return { events, ranges, total: at, final: {
      which: s.wWhichPokemon, item: s.mem[I.wCurItem], captured: s.wCapturedMonSpecies,
      hp: s.wEnemyMonHP, status: s.wEnemyMonStatus, species: s.wEnemyMonSpecies,
      stats: [s.wEnemyMonMaxHP, s.wEnemyMonAttack, s.wEnemyMonDefense, s.wEnemyMonSpeed, s.wEnemyMonSpecial],
      dvs: [...s.mem.slice(I.wEnemyMonDVs, I.wEnemyMonDVs + 2)],
      mood: [s.mem[I.wPikachuEmotionModifier], s.mem[I.wPikachuMood]],
      bag: bag.map(stack => stack.count), safari: s.wNumSafariBalls, result: s.wActionResultOrTookBattleTurn,
    } };
  }
  return { s, driver, video, env, host, events, frames, bag, bagBefore, start, finish, ledger, time: () => at,
    labels: () => events.filter(e => e.event.startsWith('print:')).map(e => e.event.slice(6)) };
}

const WORKED: { name: string; config: Config; anim: number; captured: number }[] = [
  { name: 'Poke miss0', config: {}, anim: 0x20, captured: 0 },
  { name: 'Great shake1', config: { item: 3, rate: 45, draws: [255, 100] }, anim: 0x61, captured: 0 },
  { name: 'Ultra shake2', config: { item: 2, rate: 150, draws: [151, 100, 255] }, anim: 0x62, captured: 0 },
  { name: 'Safari shake3', config: { item: 8, type: 2, hp: 20, rate: 120, draws: [200, 130] }, anim: 0x63, captured: 0 },
  { name: 'ordinary equality success', config: { rate: 100, draws: [40, 85] }, anim: 0x43, captured: 0xa5 },
  { name: 'W-high success', config: { item: 2, hp: 1, rate: 45, draws: [40] }, anim: 0x43, captured: 0xa5 },
  { name: 'sleep borrow', config: { item: 3, status: 3, draws: [24] }, anim: 0x43, captured: 0xa5 },
  { name: 'status shake bonus', config: { rate: 45, status: 3, draws: [70, 255] }, anim: 0x61, captured: 0 },
  { name: 'Master consumes draw', config: { item: 1, draws: [255] }, anim: 0x43, captured: 0xa5 },
  { name: 'unidentified ghost', config: { item: 1, map: 0x8e, draws: [] }, anim: 0x10, captured: 0 },
  { name: 'restless Marowak', config: { item: 1, map: 0x93, species: 0x91, scope: true, draws: [] }, anim: 0x10, captured: 0 },
  { name: 'old man clear', config: { type: 1, draws: [] }, anim: 0x43, captured: 0xa5 },
  { name: 'old man set', config: { type: 1, initial: true, draws: [] }, anim: 0x63, captured: 1 },
  { name: 'Pikachu demo', config: { type: 4, draws: [] }, anim: 0x43, captured: 0xa5 },
];

it('all ball text programs already exist', () => {
  const programs = getTextPrograms();
  for (const label of ['ItemUseText00', 'ItemUseBall.emptyString', 'ThrowBallAtTrainerMonText1',
    'ThrowBallAtTrainerMonText2', 'BoxFullCannotThrowBallText', ...Array.from({ length: 9 }, (_, i) => `ItemUseBallText0${i}`)]) {
    expect(programs[label]).toBeDefined();
  }
});

it.each(WORKED)('$name: exact worked-table draws and animation', ({ config, anim, captured }) => {
  const r = setup(config); r.start(); r.finish();
  expect(r.events.find(e => e.event === 'MoveAnimation')!.data).toMatchObject({ id: 0xc1, anim, turn: 0, type: 0, multipliers: 0 });
  expect(r.events.filter(e => e.event === 'Random').map(e => e.data)).toEqual(config.draws ?? [200]);
  expect(r.s.wCapturedMonSpecies).toBe(captured); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
  expect(r.s.wWhichPokemon).toBe(2);
  expect(r.bag[2].count).toBe(config.type ? 2 : 1);
  const math = (r.events.find(e => e.event === 'MoveAnimation')!.data as { math: number[] }).math;
  const heads: Record<string, number[]> = {
    'Poke miss0': [0, 0, 0, 0], 'Great shake1': [0, 0, 0, 10], 'Ultra shake2': [0, 0, 0, 33],
    'Safari shake3': [0, 0, 0, 80], 'ordinary equality success': [0, 0, 0, 85],
    'W-high success': [0, 0, 8, 255], 'status shake bonus': [0, 0, 0, 15],
  };
  const name = WORKED.find(row => row.config === config)!.name;
  expect(math.slice(0, 4)).toEqual(heads[name] ?? [0, 0, 0, 0]);
  if (config.type === 1 || config.type === 4) {
    expect(r.s.mem.slice(I.wGrassRate, I.wGrassRate + 11)).toEqual(r.s.mem.slice(I.wPlayerName, I.wPlayerName + 11));
    expect(r.events.some(e => ['AddPartyMon', 'SendNewMonToBox', 'ShowPokedexData'].includes(e.event))).toBe(false);
    expect(r.s.mem[I.wPikachuMood]).toBe(0x80);
  }
});

describe('throw gates, reload and raw byte pins', () => {
  // item_effects.asm:147–149,2634–2638; text_9.asm:248–251: text_ram preserves the ItemNames é byte.
  it('keeps the POKe BALL accented glyph in the real item-name binding', () => {
    const r = setup(); r.s.setBytes(I.wStringBuffer, encodeText('POKé BALL@'), 11);
    const print = r.host.printText;
    r.host.printText = function* (label, bindings, options) {
      if (label === 'ItemUseText00') expect(bindings?.stringBuffer).toBe('POKé BALL');
      yield* print(label, bindings, options);
    };
    r.start(); r.finish();
  });
  it('new ownership is tested before setting, and the page sees the owned bit and internal species', () => {
    const r = setup({ item: 1, draws: [255] });
    expect(r.s.mem[I.wPokedexOwned + 2] & 4).toBe(0);
    const page = r.env.showPokedexData;
    r.env.showPokedexData = function* () {
      expect(r.s.mem[I.wPokedexOwned + 2] & 4).toBe(4);
      expect(r.s.wPokedexNum).toBe(0xa5);
      expect(r.s.mem[I.wPikachuMood]).toBe(0x80);
      yield* page();
    };
    r.start(); r.finish();
    expect(r.labels()).toContain('ItemUseBallText06');
    expect(r.events.filter(e => e.event === 'ShowPokedexData')).toHaveLength(1);
    expect(r.ledger().final.mood).toEqual([1, 0x85]);
    expect(r.events.find(e => e.event === 'AddPartyMon')!.data).toEqual([2, 0]);
    expect(r.events.find(e => e.event === 'remove')!.data).toEqual([2, 0xa5]);
    expect(r.events.filter(e => e.event === 'sound').map(e => e.data)).toContain(0x9a);
    expect(r.events.filter(e => e.event === 'sound').map(e => e.data)).toContain(0x98);
  });
  it('Safari decrement precedes even the prologue palette and ghost test', () => {
    const r = setup({ type: 2, map: 0x8e, item: 8, draws: [] }); r.start();
    expect(r.s.wNumSafariBalls).toBe(4); r.finish();
  });
  it('TOSS_ANIM is $C1 (move_constants.asm:207); $C7 is SHAKE_SCREEN_ANIM', () => {
  expect(BALL.TOSS_ANIM).toBe(0xc1);
  const r = setup();
  r.start(); r.finish();
  expect(r.s.wAnimationID).toBe(0xc1);
  expect((r.events.find(e => e.event === 'MoveAnimation')!.data as { id: number }).id).toBe(0xc1);
});
it('event checks use Yellow WRAM and the full Bill event index', () => {
    expect(BALL.eventFlags).toBe(0xd746);
    expect(BALL.initialCatchTraining).toBe(0x2f); expect(BALL.metBill).toBe(0x550);
  });
  it.each([1, 4])('demo%s bypasses full capacity but does not add, own, or set mood', type => {
    const r = setup({ type, count: 6, box: 20, draws: [] }); r.start(); r.finish();
    expect(r.s.wCapturedMonSpecies).toBe(0xa5); expect(r.labels()).not.toContain('BoxFullCannotThrowBallText');
    expect(r.s.mem.slice(I.wPokedexOwned, I.wPokedexOwned + 19)).toEqual(new Uint8Array(19));
    expect(r.ledger().final.mood).toEqual([0, 0x80]); expect(r.bag[2].count).toBe(2);
  });
  it.each([0x20, 1, 0x10, 0x40, 8])('status byte%s has its exact borrow threshold', status => {
    const bonus = status & 0x27 ? 25 : 12;
    const r = setup({ status, draws: [bonus - 1] });
    expect(calculateBallAnimation(r.s)).toBe(0x43);
    expect([...r.s.mem.slice(I.hProduct, I.hProduct + 10)]).toEqual(Array(10).fill(0));
  });
  it.each([{ item: 3, first: 200 }, { item: 2, first: 150 }, { item: 8, first: 150 }])
  ('ball$item accepts its exact Rand1 boundary', ({ item, first }) => {
    const r = setup({ item, draws: [first] });
    expect(calculateBallAnimation(r.s)).toBe(0x20);
    expect(r.events.filter(e => e.event === 'Random').map(e => e.data)).toEqual([first]);
  });
  it('trainer throw spends the turn and bag slot, with Delay3 and no wild zeroing', () => {
    const r = setup({ trainer: true, draws: [] }); r.start(); r.finish();
    const anim = r.events.find(e => e.event === 'MoveAnimation')!;
    expect(anim.at).toBe(8); expect(anim.data).toMatchObject({ id: 0xc1, turn: 1, type: 0xa5, multipliers: 0xb6 });
    expect(r.labels()).toEqual(['ThrowBallAtTrainerMonText1', 'ThrowBallAtTrainerMonText2']);
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]); expect(r.s.wActionResultOrTookBattleTurn).toBe(1);
  });
  it('out of battle directly enters NotTime', () => {
    const r = setup({ draws: [] }); r.s.wIsInBattle = 0;
    r.start(itemUseBall(r.s, r.host, r.env)); r.finish();
    expect(r.labels()).toEqual(['ItemUseNotTimeText']); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.bag[2].count).toBe(2);
  });
  it('party6 and box20 refuse before palette, animation, draws or Safari decrement', () => {
    const r = setup({ count: 6, box: 20, draws: [], type: 2 }); r.start(); r.finish();
    expect(r.labels()).toEqual(['BoxFullCannotThrowBallText']); expect(r.s.wActionResultOrTookBattleTurn).toBe(0);
    expect(r.s.wNumSafariBalls).toBe(5); expect(r.bag[2].count).toBe(2);
    expect(r.events.some(e => ['palette', 'MoveAnimation'].includes(e.event))).toBe(false);
  });
  it('Safari ghost loses its ball before the ghost check and never removes a bag item', () => {
    const r = setup({ type: 2, map: 0x8e, item: 8, draws: [] }); r.start(); r.finish();
    expect(r.s.wNumSafariBalls).toBe(4); expect(r.s.mem.slice(I.wNumBagItems, I.wNumBagItems + 10)).toEqual(r.bagBefore);
    expect(r.events.some(e => e.event === 'remove')).toBe(false);
  });
  it('a transformed non-Ditto is caught as Ditto using saved DVs', () => {
    const r = setup({ item: 1, transformed: true, draws: [255] }); r.start(); r.finish();
    expect([r.s.wCapturedMonSpecies, r.s.wEnemyMonSpecies2, r.s.wEnemyMonSpecies]).toEqual([0x4c, 0x4c, 0x4c]);
    expect([...r.s.mem.slice(I.wEnemyMonDVs, I.wEnemyMonDVs + 2)]).toEqual([0x12, 0x34]);
  });
  it.each([0x10, 0x40])('status%x survives reload while all stats are freshly calculated', status => {
    const r = setup({ item: 1, status, hp: 7, draws: [255] }); r.start(); r.finish();
    expect([r.s.wEnemyMonHP, r.s.wEnemyMonStatus]).toEqual([7, status]);
    expect(r.ledger().final.stats).toEqual([46, 31, 22, 36, 17]);
    expect([...r.s.mem.slice(I.wEnemyMonDVs, I.wEnemyMonDVs + 2)]).toEqual([0x98, 0x76]);
    expect([...r.s.mem.slice(I.wEnemyMonStatMods, I.wEnemyMonStatMods + 8)]).toEqual(Array(8).fill(7));
    expect(r.s.wEnemyMonActualCatchRate).toBe(200);
  });
  it('owned catch skips dex text/page but still sets mood and reaches party home', () => {
    const r = setup({ item: 1, owned: true, draws: [255] }); r.start(); r.finish();
    expect(r.labels()).not.toContain('ItemUseBallText06'); expect(r.events.some(e => e.event === 'ShowPokedexData')).toBe(false);
    expect(r.ledger().final.mood).toEqual([1, 0x85]); expect(r.events.some(e => e.event === 'AddPartyMon')).toBe(true);
    expect(r.s.mem[I.wPikachuHappiness]).toBe(99);
  });
  it.each([false, true])('party6/box19 capture uses box home and correct Bill text (%s)', bill => {
    const r = setup({ item: 1, owned: true, count: 6, box: 19, bill, draws: [255] }); r.start(); r.finish();
    expect(r.events.find(e => e.event === 'SendNewMonToBox')!.data).toBe(2);
    expect(r.labels()).toContain(bill ? 'ItemUseBallText07' : 'ItemUseBallText08');
    expect(r.s.wWhichPokemon).toBe(2); expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]);
  });
  it('wild toss preserves bag slot and item across a clobbering presentation port', () => {
    const r = setup({ clobber: true }); r.start(); r.finish();
    expect(r.events.find(e => e.event === 'remove')!.data).toEqual([2, 4]);
    expect(r.bag.map(stack => stack.count)).toEqual([3, 4, 1]);
  });
  it('HP/4 truncates to a byte before zero becomes one', () => {
    const r = setup({ hp: 1024, rate: 100, draws: [40] });
    expect(calculateBallAnimation(r.s)).toBe(0x43);
    expect([...r.s.mem.slice(I.hProduct, I.hProduct + 4)]).toEqual([0, 0, 8, 255]);
  });
  it('HP/4 greater than255 uses its low byte even when nonzero', () => {
    const r = setup({ hp: 1200, rate: 100, draws: [40, 0] });
    expect(calculateBallAnimation(r.s)).toBe(0x43);
    expect([...r.s.mem.slice(I.hProduct, I.hProduct + 4)]).toEqual([0, 0, 0, 48]);
  });
});

const LEDGERS: { name: string; config: Config }[] = [
  ...WORKED.slice(0, 4).map(row => ({ name: row.name, config: row.config })),
  { name: 'new party capture', config: { item: 1, draws: [255] } },
  { name: 'owned box Bill', config: { item: 1, draws: [255], owned: true, count: 6, box: 19, bill: true } },
  { name: 'owned box someone', config: { item: 1, draws: [255], owned: true, count: 6, box: 19 } },
  { name: 'trainer throw', config: { trainer: true, draws: [] } },
  { name: 'ghost', config: { item: 1, map: 0x8e, draws: [] } },
  { name: 'old man event set', config: { type: 1, initial: true, draws: [] } },
];
it.each(LEDGERS)('$name real-owner ledger', ({ name, config }) => {
  const r = setup(config); r.start(); r.finish();
  const totals: Record<string, number> = { 'Poke miss0': 111, 'Great shake1': 123, 'Ultra shake2': 127,
    'Safari shake3': 119, 'new party capture': 416, 'owned box Bill': 367, 'owned box someone': 373,
    'trainer throw': 111, ghost: 195, 'old man event set': 119 };
  expect(r.time()).toBe(totals[name]);
  expect(r.frames.filter(frame => frame.kind === 'held').map(frame => frame.at)).toEqual([1, 2]);
  const animation = r.events.find(e => e.event === 'MoveAnimation')!;
  if (!config.trainer) expect(animation.at - r.events.find(e => e.event === 'end:ItemUseText00')!.at).toBe(20);
  expect(r.ledger()).toMatchSnapshot();
});
