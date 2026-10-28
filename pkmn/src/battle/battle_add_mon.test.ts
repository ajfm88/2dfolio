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
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthChannel5, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { A, BattleState, encodeText, NAME_LENGTH, PARTYMON_STRUCT_LENGTH, POKEDEX_ORDER } from './battle_state';
import { I } from './battle_item_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { BALL, itemUseBall, type BallItemEnvironment } from './battle_item_ball';
import type { BattleItemHost } from './battle_items';
import { calcStats } from './battle_calc_stats';
import { calcExperience } from './battle_calc_experience';
import { partySlotFromPokemon } from './battle_loaders';
import { getMoveRecord, BattleUnsupportedState, loadBattleMoveData } from './battle_move_data';
import { getSpeciesById, loadBattleData } from './data';
import { pokemonToBoxed } from '../pokemon_storage';
import { flagAction } from './battle_end_helpers';
import {
  addPartyMon, askName, ballHomes, battlePokemonFromPartyBytes, readBoxSlot, sendNewMonToBox,
  type CaughtMonEnvironment,
} from './battle_add_mon';
import * as rng from './battle_random';
import { battleGlyphTile } from './battle_screen';
import type { Frame, Program } from './battle_menu_context';

const realRandom = rng.random;
const PAR = 0x40;
const KADABRA = 0x26;
const MOVES: [number, number, number, number] = [1, 2, 3, 4];
beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); await loadBattleData(); await loadBattleMoveData(); });
beforeEach(() => {
  vi.restoreAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setLowHealthAlarm(0); setLowHealthChannel5(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => { vi.restoreAllMocks(); });

interface Opt {
  species?: number; level?: number; hp?: number; status?: number; count?: number; box?: number;
  choice?: 'a' | 'b'; name?: number[] | null; frames?: number; clobber?: number[] | null;
  menuId?: number; moves?: [number, number, number, number] | null; catch?: number; enemyCatch?: number;
  enemyPP?: number[]; battle?: number; location?: number; owned?: boolean; transformed?: boolean; bill?: boolean;
  item?: number; draws?: number[] | null; fake?: boolean; stats?: number | null; speed?: number | null;
  keys?: ('a' | 'b' | 'down')[];
  types?: [number, number]; learn?: { level: number; move: number }[];
}

function bytes(text: string): number[] {
  const out = encodeText(text);
  while (out.length < 11) out.push(0);
  return out.slice(0, 11);
}

function rig(o: Opt = {}) {
  const s = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(s, undefined, audio.update), video = driver.video, screen = video.screen;
  const species = o.species ?? 1, level = o.level ?? 20, moves = o.moves === undefined ? MOVES : o.moves;
  s.species = id => ({
    name: id === BALL.DITTO ? 'DITTO' : id === KADABRA ? 'KADABRA' : 'RATTATA',
    base: id === BALL.DITTO ? [48, 48, 48, 48, 48] : [30, 56, 35, 72, 25],
    type1: o.types?.[0] ?? 0, type2: o.types?.[1] ?? 0, catchRate: o.catch ?? 0x99, baseExp: 57,
    moves: moves ?? [0, 0, 0, 0], learnset: o.learn ?? [], growthRate: 0,
  });
  s.movePP = id => getMoveRecord(id)[5];
  s.wIsInBattle = o.battle ?? 1; s.wMonDataLocation = o.location ?? 0; s.wBattleType = 0;
  s.wCurPartySpecies = species; s.wCurEnemyLevel = level; s.wEnemyMonLevel = level;
  s.wEnemyMonSpecies = s.wEnemyMonSpecies2 = species;
  s.wEnemyMonHP = o.hp ?? 13; s.wEnemyMonStatus = o.status ?? PAR;
  s.mem.set([0x98, 0x76], I.wEnemyMonDVs); s.mem.set([0x12, 0x34], A.wPlayerID);
  s.mem.set(bytes('ASH@1234567'), A.wPlayerName);
  s.wEnemyMonCatchRate = o.enemyCatch ?? 0x11;
  s.mem.set(o.enemyPP ?? [9, 8, 7, 6], A.wEnemyMonPP);
  if (o.stats != null) {
    s.wEnemyMonMaxHP = s.wEnemyMonAttack = s.wEnemyMonDefense = s.wEnemyMonSpeed = s.wEnemyMonSpecial = o.stats;
  } else {
    s.wEnemyMonMaxHP = 46; s.wEnemyMonAttack = 31; s.wEnemyMonDefense = 22;
    s.wEnemyMonSpeed = o.speed ?? 36; s.wEnemyMonSpecial = 17;
  }
  const count = o.count ?? 1, box = o.box ?? 0;
  s.mem[I.wPartyCount] = count;
  for (let i = 0; i < count; i++) s.mem[I.wPartySpecies + i] = 0x54;
  s.mem[I.wPartySpecies + count] = 0xff;
  s.mem[I.wBoxCount] = box; s.mem[I.wBoxSpecies] = 0xff;
  s.mem[I.wTwoOptionMenuID] = o.menuId ?? 0; s.mem[I.wUpdateSpritesEnabled] = 0xab;
  if (o.item) { s.mem[I.wCurItem] = o.item; s.wWhichPokemon = 0; s.setBag([{ id: o.item, quantity: 2 }]); }
  if (o.bill) s.mem[BALL.eventFlags + (BALL.metBill >>> 3)] |= 1 << (BALL.metBill & 7);
  screen.put(0, 0, 'Q'); screen.put(14, 7, 'Z');
  for (let i = 0; i < count && count < 6; i++) {
    s.mem.fill(0x11, A.wPartyMons + i * PARTYMON_STRUCT_LENGTH, A.wPartyMons + (i + 1) * PARTYMON_STRUCT_LENGTH);
  }
  if (count < 6) s.mem.fill(0x5a, A.wPartyMons + count * PARTYMON_STRUCT_LENGTH, A.wPartyMons + (count + 1) * PARTYMON_STRUCT_LENGTH);
  for (let i = 0; i < box; i++) {
    s.mem[I.wBoxSpecies + i] = 0x11; s.mem.fill(0x30 + i, I.wBoxMonOT + i * 11, I.wBoxMonOT + (i + 1) * 11);
    s.mem.fill(0x40 + i, I.wBoxMonNicks + i * 11, I.wBoxMonNicks + (i + 1) * 11);
    s.mem.fill(0x50 + (i & 15), I.wBoxMons + i * 0x21, I.wBoxMons + (i + 1) * 0x21);
  }
  if (box > 0) s.mem[I.wBoxSpecies + box] = 0xff;
  if (box < 20) s.mem.fill(0xee, I.wBoxMons + box * 0x21, I.wBoxMons + (box + 1) * 0x21);
  const national = POKEDEX_ORDER[species - 1] ?? 0;
  if (o.owned && national) flagAction(s, I.wPokedexOwned, 1, national - 1);
  if (o.transformed) s.wEnemyBattleStatus3 = 8;
  let at = 0, phase = 'cpu', used = 0, second = false, during = -1, sprites = -1;
  const draws = o.draws === undefined ? [200] : o.draws, keys = o.keys ?? [o.choice ?? 'b'];
  let keyAt = 0;
  const events: { at: number; event: string; data?: unknown }[] = [];
  const frames: { at: number; phase: string; kind: Frame }[] = [];
  const mark = (event: string, data?: unknown) => events.push({ at, event, data });
  const naming = o.name ?? bytes('PIKACHU@ABC');
  s.readDIV = () => {
    if (!second) { second = true; return ((draws?.[used] ?? 0) - s.hRandomAdd) & 255; }
    second = false; mark('Random', draws?.[used]); used++; return 0;
  };
  vi.spyOn(rng, 'battleRandom').mockImplementation(() => { throw new Error('unexpected BattleRandom'); });
  vi.spyOn(rng, 'random').mockImplementation((state, carry) => { expect(carry).toBe(0); return realRandom(state, carry); });
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', sound.id); return play(sound); });
  vi.mocked(playSFX).mockImplementation(name => {
    const id = name === 'caught_mon' ? 0x9a : name === 'dex_page_added' ? 0x98 : name === 'press_ab' ? 0x90 : -1;
    if (id < 0) throw new Error(`unexpected sound ${name}`);
    bridge.play({ id, data: sfxData(name) }); return Promise.resolve();
  });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const host: BattleItemHost = {
    tiles: video.tiles, audio: bridge, sounds: new Map(),
    printText: function* (label, bindings, options) {
      if (label === 'DoYouWantToNicknameText') {
        during = s.mem[A.wPartyMons + count * PARTYMON_STRUCT_LENGTH];
        mark('during-box', readBoxSlot(s, Math.min(box, 19)).bytes[0]);
      }
      const previous = phase; phase = label; mark(`print:${label}`, bindings); yield* driver.printText(label, bindings, options);
      mark(`end:${label}`); phase = previous;
    },
    waitForSound: function* () { throw new Error('no explicit sound wait'); },
    readScrollJoypad() { throw new Error('no scroll waiter'); },
  };
  const menu = {
    tiles: video.tiles, updateSprites() {},
    pressSound() { bridge.play({ id: 0x90, data: sfxData('press_ab') }); },
    readJoypad() {
      const key = keys[Math.min(keyAt, keys.length - 1)]; keyAt++;
      mark('menu', String(screen.at(16, 8)));
      vi.mocked(isHeld).mockImplementation(pressed => pressed === key);
      vi.mocked(isPassPressed).mockImplementation(pressed => pressed === key);
    },
  };
  const env: CaughtMonEnvironment = {
    state: s, host, menu, video,
    displayNamingScreen: function* (who, type, destination) {
      mark('naming', { who, type, destination, sprites: s.mem[I.wUpdateSpritesEnabled] });
      sprites = s.mem[I.wUpdateSpritesEnabled];
      for (let i = 0; i < (o.frames ?? 0); i++) yield 'serviced';
      s.setBytes(A.wStringBuffer, naming, 11); s.setBytes(destination, naming, 11);
      if (o.clobber) s.setBytes(A.wNameBuffer, o.clobber, 11);
    },
  };
  const homes = o.fake ? {
    addPartyMon: function* () { mark('AddPartyMon'); },
    sendNewMonToBox: function* () { mark('SendNewMonToBox'); },
  } : ballHomes(env);
  const ball: BallItemEnvironment = {
    video, ...homes,
    animation: function* () { mark('MoveAnimation'); },
    showPokedexData: function* () { mark('ShowPokedexData', s.wPokedexNum); },
  };
  const save = video.saveScreenTilesToBuffer1.bind(video);
  const load = video.loadScreenTilesFromBuffer1.bind(video);
  vi.spyOn(video, 'saveScreenTilesToBuffer1').mockImplementation(() => { mark('save1'); save(); });
  vi.spyOn(video, 'loadScreenTilesFromBuffer1').mockImplementation(() => { mark('load1'); load(); });
  function finish(program: Program<unknown> = itemUseBall(s, host, ball)) {
    driver.start(program as Program);
    for (let i = 0; !driver.done && i < 8000; i++) {
      const pressed = at % 2 === 0;
      vi.mocked(isHeld).mockImplementation(key => pressed && key === 'b');
      vi.mocked(isPassPressed).mockImplementation(key => pressed && key === 'b');
      at++; const before = phase, kind = driver.step(); if (kind) frames.push({ at, phase: before, kind });
    }
    expect(driver.done).toBe(true);
    if (draws) expect(used).toBe(draws.length);
  }
  function ledger() {
    const ranges: { phase: string; kind: Frame; from: number; to: number }[] = [];
    for (const frame of frames) {
      const last = ranges[ranges.length - 1];
      if (last?.phase === frame.phase && last.kind === frame.kind) last.to = frame.at;
      else ranges.push({ phase: frame.phase, kind: frame.kind, from: frame.at, to: frame.at });
    }
    return { events, ranges, total: at, final: s.mem.slice(0) };
  }
  const party = (index = count < 6 ? count : 0) => [...s.mem.subarray(A.wPartyMons + index * PARTYMON_STRUCT_LENGTH,
    A.wPartyMons + (index + 1) * PARTYMON_STRUCT_LENGTH)];
  return { s, screen, env, finish, ledger, party, events, driver, during: () => during, sprites: () => sprites,
    loads: () => events.filter(e => e.event === 'load1').length, time: () => at,
    result: () => driver.result };
}

function freshSpeed(): number {
  return Math.floor(((72 + 7) * 2 * 20) / 100) + 5;
}

describe('item 0, the reload write-back', () => {
  it('keeps partial HP and paralysis, with the speed penalty gone', () => {
    const r = rig({ fake: true, item: 1, owned: true, status: PAR, hp: 13, speed: 9, draws: [200] });
    r.s.mem[I.wCurItem] = 1; r.s.wWhichPokemon = 0; r.s.setBag([{ id: 1, quantity: 1 }]);
    r.finish();
    expect(r.s.wEnemyMonHP).toBe(13); expect(r.s.wEnemyMonStatus).toBe(PAR);
    expect(r.s.wEnemyMonSpeed).toBe(freshSpeed()); expect(r.s.wEnemyMonSpeed).not.toBe(9);
    expect([r.s.wEnemyMonMaxHP, r.s.wEnemyMonAttack, r.s.wEnemyMonDefense, r.s.wEnemyMonSpecial])
      .toEqual([46, 31, 22, 17]);
  });

  it('keeps a sleep counter of 3 across the reload', () => {
    const r = rig({ fake: true, item: 1, owned: true, status: 3, hp: 13, speed: 9, draws: [200] });
    r.s.mem[I.wCurItem] = 1; r.s.wWhichPokemon = 0; r.s.setBag([{ id: 1, quantity: 1 }]);
    r.finish();
    expect(r.s.wEnemyMonHP).toBe(13); expect(r.s.wEnemyMonStatus).toBe(3);
    expect(r.s.wEnemyMonSpeed).toBe(freshSpeed());
  });
});

const home = { draws: null as null, item: undefined };

function runHome(o: Opt, program: (r: ReturnType<typeof rig>) => Program<unknown>) {
  const r = rig({ ...home, ...o });
  r.finish(program(r));
  return r;
}

describe('unsupported branches', () => {
  it.each([
    ['enemy party', { location: 1 }],
    ['not in battle', { battle: 0 }],
    ['trainer battle', { battle: 2 }],
  ] as const)('throws for the %s branch', (_name, opt) => {
    const r = rig({ ...home, ...opt });
    expect(() => addPartyMon(r.s, r.env).next()).toThrow(BattleUnsupportedState);
  });

  it('a full party returns carry clear and writes nothing', () => {
    const r = rig({ ...home, count: 6 });
    const before = r.s.mem.slice(I.wPartyCount, A.wPartyMonNicks + 6 * NAME_LENGTH);
    const step = addPartyMon(r.s, r.env).next();
    expect(step.done).toBe(true); expect(step.value).toEqual({ carry: false });
    expect([...r.s.mem.slice(I.wPartyCount, A.wPartyMonNicks + 6 * NAME_LENGTH)]).toEqual([...before]);
  });
});

function ppOf(moves: readonly number[]): number[] {
  return moves.map(id => id === 0 ? 0 : getMoveRecord(id)[5]);
}

function expectPartyBytes(raw: number[], species: number, level: number, hp: number, status: number,
  moves: readonly number[], catchRate: number, stats: number[]): void {
  expect(raw[0]).toBe(species);
  expect((raw[1] << 8) | raw[2]).toBe(hp);
  expect(raw[3]).toBe(0); expect(raw[4]).toBe(status);
  expect(raw[7]).toBe(catchRate);
  expect(raw.slice(8, 12)).toEqual([...moves]);
  expect(raw.slice(12, 14)).toEqual([0x12, 0x34]);
  expect(raw.slice(17, 27)).toEqual(Array(10).fill(0));
  expect(raw.slice(27, 29)).toEqual([0x98, 0x76]);
  expect(raw.slice(29, 33)).toEqual(ppOf(moves));
  expect(raw[33]).toBe(level);
  for (let i = 0; i < 5; i++) expect((raw[34 + i * 2] << 8) | raw[35 + i * 2]).toBe(stats[i]);
}

describe('party home', () => {
  it('grows 1 to 2 on NO, leaving the old slot and filling after the prompt', () => {
    const r = runHome({ count: 1, status: PAR, hp: 13, stats: null }, x => addPartyMon(x.s, x.env));
    expect(r.result()).toEqual({ carry: true });
    expect(r.during()).toBe(0x5a);
    expect(r.s.mem[I.wPartyCount]).toBe(2); expect(r.s.mem[I.hNewPartyLength]).toBe(2);
    expect([...r.s.mem.subarray(I.wPartySpecies, I.wPartySpecies + 3)]).toEqual([0x54, 1, 0xff]);
    expect(r.party(0)[0]).toBe(0x11);
    expectPartyBytes(r.party(1), 1, 20, 13, PAR, MOVES, 0x99, [46, 31, 22, 36, 17]);
    expect([...r.s.mem.subarray(A.wPartyMonOT + 11, A.wPartyMonOT + 22)]).toEqual(bytes('ASH@1234567'));
    expect([...r.s.mem.subarray(A.wPartyMonNicks + 11, A.wPartyMonNicks + 22)]).toEqual(bytes('RATTATA@'));
    expect(r.loads()).toBe(0); expect(r.screen.at(0, 0)).toBe(' ');
    expect(r.screen.at(14, 7)).toBe(battleGlyphTile('Z'));
    expect(r.events.filter(e => e.event === 'naming')).toEqual([]);
    expect(r.events.find(e => e.event === 'menu')!.data).toBe('Y');
    expect(r.s.mem[I.wLearningMovesFromDayCare]).toBe(0);
    expect([...r.s.mem.subarray(A.wNameBuffer, A.wNameBuffer + 6)]).toEqual([...getMoveRecord(4)]);
    const mon = r.s.partyMons[1]!;
    const slot = partySlotFromPokemon(mon);
    expect(battlePokemonFromPartyBytes(r.s, 1).nickname).toBe(mon.nickname);
    expect(slot.species).toBe(1); expect(slot.boxLevel).toBe(20); expect(slot.level).toBe(20);
    expect(slot.hp).toBe(13); expect(slot.status).toBe(PAR); expect(slot.moves).toEqual([...MOVES]);
    expect(slot.pp).toEqual(ppOf(MOVES)); expect(slot.dvs).toEqual([0x98, 0x76]);
    expect(slot.catchRate).toBe(mon.species.catchRate); expect(slot.nickname).toBe('RATTATA'); expect(slot.otName).toBe('ASH');
    const exp = calcExperience(r.s, 20);
    expect(slot.exp).toBe(exp);
    expect(r.party(1)[14]).toBe((exp >>> 16) & 255);
    expect(slot.otId).toBe(0x1234); expect(slot.statExp).toEqual([0, 0, 0, 0, 0]);
    expect(mon.statStages).toEqual({ attack: 0, defense: 0, speed: 0, special: 0, accuracy: 0, evasion: 0 });
    expect(mon.originalStats).toEqual({ attack: 31, defense: 22, speed: 36, special: 17 });
  });

  it('grows 5 to 6 and keeps every earlier slot', () => {
    const r = runHome({ count: 5 }, x => addPartyMon(x.s, x.env));
    expect(r.s.mem[I.wPartyCount]).toBe(6);
    expect([...r.s.mem.subarray(I.wPartySpecies, I.wPartySpecies + 7)]).toEqual([0x54, 0x54, 0x54, 0x54, 0x54, 1, 0xff]);
    for (let i = 0; i < 5; i++) expect(r.party(i)[0]).toBe(0x11);
    expect(r.party(5)[0]).toBe(1); expect(r.party(5)[3]).toBe(0); expect(r.party(5)[33]).toBe(20);
  });

  it('copies the enemy stats instead of CalcStats, and keeps box level 0', () => {
    const r = runHome({ stats: 7 }, x => addPartyMon(x.s, x.env));
    expectPartyBytes(r.party(1), 1, 20, 13, PAR, MOVES, 0x99, [7, 7, 7, 7, 7]);
    const scratch = 0xe000;
    calcStats(r.s, 0, A.wPartyMons + PARTYMON_STRUCT_LENGTH + 16, scratch);
    expect([...r.s.mem.subarray(scratch, scratch + 10)]).not.toEqual(r.party(1).slice(34, 44));
  });

  it('YES writes the given name and restores the screen and the sprite flag', () => {
    const r = runHome({ choice: 'a' }, x => addPartyMon(x.s, x.env));
    expect(r.events.find(e => e.event === 'naming')!.data).toMatchObject({ who: 1, type: 2, sprites: 0,
      destination: A.wPartyMonNicks + NAME_LENGTH });
    expect(r.sprites()).toBe(0); expect(r.s.mem[I.wUpdateSpritesEnabled]).toBe(0xab);
    expect([...r.s.mem.subarray(A.wPartyMonNicks + 11, A.wPartyMonNicks + 22)]).toEqual(bytes('PIKACHU@ABC'));
    expect(r.loads()).toBe(1); expect(r.screen.at(0, 0)).toBe('Q');
    const mirror = r.s.partyMons[1]!;
    const live = getSpeciesById(POKEDEX_ORDER[0]);
    expect(live).not.toBeNull();
    expect(mirror.species).toBe(live);
    expect(mirror.species.name).toBe(live!.name);
    expect(mirror.nickname).toBe('PIKACHU');
    expect(mirror.species.name).not.toBe(mirror.nickname);
    expect(pokemonToBoxed(mirror).speciesName).toBe(live!.name);
  });

  it('YES with an empty name copies the clobbered name buffer', () => {
    const clobber = bytes('ZAPDOS@XXXX');
    const r = runHome({ choice: 'a', name: bytes('@'), clobber }, x => addPartyMon(x.s, x.env));
    expect([...r.s.mem.subarray(A.wPartyMonNicks + 11, A.wPartyMonNicks + 22)]).toEqual(clobber);
  });

  it('NO and B both copy the species name', () => {
    const declined = runHome({ keys: ['down', 'a'] }, x => addPartyMon(x.s, x.env));
    const pressed = runHome({ keys: ['b'] }, x => addPartyMon(x.s, x.env));
    expect([...declined.s.mem.subarray(A.wPartyMonNicks + 11, A.wPartyMonNicks + 22)]).toEqual(bytes('RATTATA@'));
    expect([...pressed.s.mem.subarray(A.wPartyMonNicks + 11, A.wPartyMonNicks + 22)]).toEqual(bytes('RATTATA@'));
    expect(declined.events.filter(e => e.event === 'naming')).toEqual([]);
    expect(pressed.events.filter(e => e.event === 'naming')).toEqual([]);
  });

  it('shows whichever two-option menu is already selected', () => {
    const yes = runHome({ menuId: 0 }, x => askName(x.s, x.env, A.wPartyMonNicks));
    const no = runHome({ menuId: 7 }, x => askName(x.s, x.env, A.wPartyMonNicks));
    expect(yes.events.find(e => e.event === 'menu')!.data).toBe('Y');
    expect(no.events.find(e => e.event === 'menu')!.data).toBe('N');
  });

  it('does not clear the HUD in a trainer battle', () => {
    const r = runHome({ battle: 2 }, x => askName(x.s, x.env, A.wPartyMonNicks));
    expect(r.screen.at(0, 0)).toBe('Q');
  });

  it('clears an 11 by 4 area and leaves the tiles outside it', () => {
    const r = rig({ ...home });
    r.screen.put(10, 0, 'A'); r.screen.put(0, 3, 'B'); r.screen.put(10, 3, 'C');
    r.screen.put(11, 0, 'D'); r.screen.put(0, 4, 'E');
    r.finish(askName(r.s, r.env, A.wPartyMonNicks));
    for (const [x, y] of [[0, 0], [10, 0], [0, 3], [10, 3]]) expect(r.screen.at(x, y)).toBe(' ');
    expect(r.screen.at(11, 0)).toBe('D'); expect(r.screen.at(0, 4)).toBe('E');
  });

  it('stores Kadabra with the twisted spoon and a moveless species with zero PP', () => {
    const kadabra = runHome({ species: KADABRA, catch: 0x99, choice: 'a' }, x => addPartyMon(x.s, x.env));
    expect(kadabra.party(1)[7]).toBe(0x60); expect(kadabra.party(1)[0]).toBe(KADABRA);
    const live = getSpeciesById(POKEDEX_ORDER[KADABRA - 1]);
    const mirror = kadabra.s.partyMons[1]!;
    expect(mirror.species).toBe(live);
    expect(mirror.species.type1).toBe('PSYCHIC');
    expect(mirror.species.name).toBe('Kadabra');
    expect(mirror.nickname).toBe('PIKACHU');
    expect(pokemonToBoxed(mirror).speciesName).toBe('Kadabra');
    const empty = runHome({ moves: [0, 0, 0, 0] }, x => addPartyMon(x.s, x.env));
    expect(empty.party(1).slice(8, 12)).toEqual([0, 0, 0, 0]);
    expect(empty.party(1).slice(29, 33)).toEqual([0, 0, 0, 0]);
  });

  it('reads the owned flag the ball already set, then sets seen', () => {
    const r = runHome({ owned: true }, x => addPartyMon(x.s, x.env));
    const bit = (POKEDEX_ORDER[0] - 1) & 255;
    expect(r.s.mem[I.wUnusedAlreadyOwnedFlag]).toBe(1 << (bit & 7));
    expect(flagAction(r.s, I.wPokedexOwned, 2, bit)).not.toBe(0);
    expect(flagAction(r.s, A.wPokedexSeen, 2, bit)).not.toBe(0);
  });
});

describe('box home', () => {
  it('inserts into an empty box without shifting', () => {
    const r = runHome({ box: 0 }, x => sendNewMonToBox(x.s, x.env));
    expect(r.s.mem[I.wBoxCount]).toBe(1);
    expect([...r.s.mem.subarray(I.wBoxSpecies, I.wBoxSpecies + 2)]).toEqual([1, 0xff]);
    expect(readBoxSlot(r.s, 0).ot).toEqual(bytes('ASH@1234567'));
    expect(readBoxSlot(r.s, 0).nick).toEqual(bytes('RATTATA@'));
    expect(r.events.find(e => e.event === 'during-box')!.data).toBe(0xee);
    const box = readBoxSlot(r.s, 0).bytes;
    expect(box[0]).toBe(1); expect(box[3]).toBe(20); expect(box.slice(29, 33)).toEqual([9, 8, 7, 6]);
    const boxExp = calcExperience(r.s, 20);
    expect(box[14]).toBe((boxExp >>> 16) & 255);
    expect((box[15] << 8) | box[16]).toBe(boxExp & 0xffff);
    expect(box[7]).toBe(0x11); expect(r.s.mem[I.wEnemyMonBoxLevel]).toBe(20);
    expect(box.slice(27, 29)).toEqual([0x98, 0x76]);
  });

  it('shifts a box of 1 after the nickname, keeping the old entry behind the new one', () => {
    const r = runHome({ box: 1 }, x => sendNewMonToBox(x.s, x.env));
    expect(r.events.find(e => e.event === 'during-box')!.data).toBe(0xee);
    expect([...r.s.mem.subarray(I.wBoxSpecies, I.wBoxSpecies + 3)]).toEqual([1, 0x11, 0xff]);
    expect(readBoxSlot(r.s, 1).bytes[0]).toBe(0x50);
    expect(readBoxSlot(r.s, 1).ot[0]).toBe(0x30);
    expect(readBoxSlot(r.s, 1).nick[0]).toBe(0x40);
    expect(readBoxSlot(r.s, 0).ot).toEqual(bytes('ASH@1234567'));
    expect(readBoxSlot(r.s, 0).nick).toEqual(bytes('RATTATA@'));
  });

  it('shifts a box of 19 to 20 and keeps the old order', () => {
    const r = runHome({ box: 19, choice: 'a' }, x => sendNewMonToBox(x.s, x.env));
    expect(r.s.mem[I.wBoxCount]).toBe(20);
    expect(r.events.find(e => e.event === 'during-box')!.data).toBe(0xee);
    const species = [...r.s.mem.subarray(I.wBoxSpecies, I.wBoxSpecies + 21)];
    expect(species[0]).toBe(1); expect(species.slice(1, 20)).toEqual(Array(19).fill(0x11)); expect(species[20]).toBe(0xff);
    for (let i = 0; i < 19; i++) {
      expect(readBoxSlot(r.s, i + 1).ot[0]).toBe(0x30 + i);
      expect(readBoxSlot(r.s, i + 1).nick[0]).toBe(0x40 + i);
      expect(readBoxSlot(r.s, i + 1).bytes[0]).toBe(0x50 + (i & 15));
    }
    expect(readBoxSlot(r.s, 0).nick).toEqual(bytes('PIKACHU@ABC'));
  });

  it('takes the enemy PP, overrides Kadabra, and writes the enemy box level', () => {
    const plain = runHome({ box: 0, enemyPP: [1, 2, 3, 4], enemyCatch: 0x22 }, x => sendNewMonToBox(x.s, x.env));
    expect(readBoxSlot(plain.s, 0).bytes.slice(29, 33)).toEqual([1, 2, 3, 4]);
    expect(readBoxSlot(plain.s, 0).bytes[7]).toBe(0x22);
    const kadabra = runHome({ box: 0, species: KADABRA, enemyCatch: 0x22 }, x => sendNewMonToBox(x.s, x.env));
    expect(readBoxSlot(kadabra.s, 0).bytes[7]).toBe(0x60);
    expect(kadabra.s.mem[I.wEnemyMonBoxLevel]).toBe(20);
    expect(readBoxSlot(kadabra.s, 0).bytes[3]).toBe(20);
  });

  it('answers YES, NO and B into nickname 0', () => {
    const yes = runHome({ box: 0, choice: 'a' }, x => sendNewMonToBox(x.s, x.env));
    const empty = runHome({ box: 0, choice: 'a', name: bytes('@'), clobber: bytes('ZAPDOS@XXXX') }, x => sendNewMonToBox(x.s, x.env));
    const no = runHome({ box: 0, keys: ['down', 'a'] }, x => sendNewMonToBox(x.s, x.env));
    const pressed = runHome({ box: 0, keys: ['b'] }, x => sendNewMonToBox(x.s, x.env));
    expect(readBoxSlot(yes.s, 0).nick).toEqual(bytes('PIKACHU@ABC'));
    expect(readBoxSlot(empty.s, 0).nick).toEqual(bytes('ZAPDOS@XXXX'));
    expect(readBoxSlot(no.s, 0).nick).toEqual(bytes('RATTATA@'));
    expect(readBoxSlot(pressed.s, 0).nick).toEqual(bytes('RATTATA@'));
  });
});

describe('a transformed capture lands as a Ditto', () => {
  it('in the party and in the box', () => {
    const party = rig({ item: 1, species: 0xa5, transformed: true, choice: 'b', draws: [200] });
    flagAction(party.s, I.wPokedexOwned, 1, 131);
    party.finish();
    expect(party.party(1)[0]).toBe(BALL.DITTO);
    const box = rig({ item: 1, species: 0xa5, transformed: true, count: 6, box: 0, choice: 'b', draws: [200] });
    flagAction(box.s, I.wPokedexOwned, 1, 131);
    box.finish();
    expect(readBoxSlot(box.s, 0).species).toBe(BALL.DITTO);
    expect(readBoxSlot(box.s, 0).bytes[0]).toBe(BALL.DITTO);
  });
});

describe('ledgers', () => {
  function capture(o: Opt) {
    const r = rig({ item: 1, draws: [200], hp: 13, status: PAR, ...o });
    r.finish();
    return r.ledger();
  }
  it('new species into the party, NO', () => {
    const book = capture({ choice: 'b' });
    expect(book.total).toBe(522);
    expect(book.events.some(e => e.event === 'print:DoYouWantToNicknameText')).toBe(true);
    expect(book.events.some(e => e.event === 'end:DoYouWantToNicknameText')).toBe(true);
    expect(book.events.some(e => e.event === 'print:ItemUseBallText05')).toBe(true);
    expect(book.events.filter(e => e.event === 'naming')).toEqual([]);
    expect(book.events.filter(e => e.event === 'save1')).toHaveLength(1);
    expect(book.events.filter(e => e.event === 'load1')).toHaveLength(1);
    expect(book.ranges.some(range => range.phase === 'cpu' && range.kind === 'serviced' && range.to - range.from + 1 >= 15)).toBe(true);
  });
  it('YES with a name adds exactly the naming frames', () => {
    const named = capture({ choice: 'a', frames: 0 });
    const slow = capture({ choice: 'a', frames: 60 });
    expect(named.total).toBe(522); expect(slow.total).toBe(582);
    expect(slow.total - named.total).toBe(60);
    expect(named.events.some(e => e.event === 'naming')).toBe(true);
    expect(named.events.filter(e => e.event === 'load1')).toHaveLength(2);
  });
  it('an owned species, YES with an empty name', () => {
    const book = capture({ owned: true, choice: 'a', name: bytes('@'), clobber: bytes('ZAPDOS@XXXX') });
    expect(book.events.some(e => e.event === 'print:ItemUseBallText06')).toBe(false);
    expect(book.total).toBe(388);
  });
  it('an empty box with Bill met, NO, and a full box without Bill, YES', () => {
    const bill = capture({ count: 6, box: 0, bill: true, choice: 'b' });
    const full = capture({ count: 6, box: 19, bill: false, choice: 'a' });
    const text = bill.events.find(e => e.event === 'print:ItemUseBallText07');
    expect(text?.data).toMatchObject({ caughtMonNick: 'RATTATA' });
    expect(full.events.find(e => e.event === 'print:ItemUseBallText08')?.data).toMatchObject({ caughtMonNick: 'PIKACHU' });
    expect(bill.total).toBe(609); expect(full.total).toBe(615);
  });
});
