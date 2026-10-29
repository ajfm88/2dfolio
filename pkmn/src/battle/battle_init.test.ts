// A5c3f checkpoint-04: an independent harness over the real state, host, printer and Audio2 engines.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }),
  loadTileset: async () => ({ width: 128 }) }));
import { isHeld } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { setPlayerName } from '../core/player_state';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { uiTiles } from '../renderer/ui_tiles';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { A, BattleState, decodeNick, encodeText, POKEDEX_ORDER } from './battle_state';
import { D } from './battle_end_state';
import { BattleHost } from './battle_host';
import { BattleAudio } from './battle_audio';
import { BattleRandomState } from './battle_random_state';
import { battleRandom } from './battle_random';
import { createPokemon, loadBattleData } from './data';
import { partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { installTrainerSpecies, W_RIVAL_NAME, W_TRAINER_NO } from './battle_trainer_party';
import { loadBattleMoveData, getMoveRecord } from './battle_move_data';
import { INIT, initBattleVariables, setupBattleBeforeTransition, initBattleAfterTransition, type BattleInitHost } from './battle_init';
import type { Frame } from './battle_menu_context';
import type { BattleCell, BattleOam } from './battle_screen';
import type { RawImage } from './battle_screen_render';

beforeAll(async () => { await loadBattleData(); await loadBattleMoveData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); setTextSpeed('fast'); setPlayerName('ASH');
  textBgTransfer.enabled = true; textBgTransfer.resetPortion(); uiTiles.clear();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false);
});
afterEach(() => vi.restoreAllMocks());

function image(path: string): RawImage {
  return PNG.sync.read(readFileSync(resolve(__dirname, '../../static', path)));
}
function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16); }
function nonzero(bytes: Uint8Array): Record<string, number> {
  return Object.fromEntries([...bytes].flatMap((value, at) => value ? [[at.toString(16).padStart(4, '0'), value]] : []));
}
interface Options { trainer?: number; map?: number; type?: number; hooked?: boolean; scope?: boolean; marowak?: boolean;
  asleep?: boolean; gym?: number; daycare?: number; staleTrainerClass?: number; flipped?: boolean }

function harness(options: Options = {}) {
  const state = new BattleState(), audio = audioRig(), bridge = new BattleAudio(audio.sfx, audio.music);
  const driver = new BattleHost(state, undefined, audio.update), screen = driver.video.screen;
  installTrainerSpecies(state); state.movePP = id => getMoveRecord(id)[5];
  const mon = createPokemon('PIKACHU', 5, 'PIKACHU', { atk: 9, def: 8, spd: 8, spc: 8 })!;
  mon.otName = 'ASH'; mon.otId = 0x1234; mon.sleepTurns = options.asleep ? 2 : 0;
  mon.status = options.asleep ? 'SLP' : null;
  state.setBytes(A.wPlayerName, encodeText('ASH@'), 11); state.writeBE(A.wPlayerID, 0x1234);
  state.mem[D.wPartyCount] = 1; state.setBytes(D.wPartySpecies, [0x54, 255], 2);
  writePartySlot(state, 'player', 0, partySlotFromPokemon(mon));
  state.setBytes(W_RIVAL_NAME, encodeText('GARY@'), 11);
  state.wCurMap = options.map ?? 0x0c; // ROUTE_1
  state.wBattleType = options.type ?? 0;
  state.wCurOpponent = options.trainer ? 200 + options.trainer : options.marowak ? 0x91 : 0xa5;
  state.wCurEnemyLevel = 3; state.mem[W_TRAINER_NO] = 1;
  state.mem[D.wLoneAttackNo] = options.gym ?? 0;
  state.wMoveMissed = options.hooked ? 1 : 0;
  state.mem[INIT.wMapPalOffset] = 7; state.mem[INIT.wLetterPrintingDelayFlags] = 0xa7;
  state.mem[INIT.hTileAnimations] = 1;
  state.mem[D.wPikachuHappiness] = 90; state.mem[D.wPikachuMood] = 128;
  state.mem.fill(0xa5, D.wMiscBattleData, D.wMiscBattleDataEnd);
  state.mem.fill(0xa5, D.wPartyAndBillsPCSavedMenuItem, D.wPartyAndBillsPCSavedMenuItem + 4);
  state.wPlayerHPBarColor = state.wEnemyHPBarColor = 2;
  state.mem.fill(0xa5, D.wPlayerStatsToDouble, D.wPlayerStatsToDouble + 5);
  state.wPlayerDisabledMove = 0xa5;
  state.mem[D.wTrainerClass] = options.staleTrainerClass ?? 0;
  state.mem[INIT.wSpriteFlipped] = options.flipped ? 1 : 0;
  state.mem[D.wLearningMovesFromDayCare] = options.daycare ?? 0;
  state.setBag(options.scope ? [{ id: 0x48, quantity: 1 }] : []);
  const random = new BattleRandomState(() => ((++divReads * 0x10) & 255));
  random.hRandomAdd = 5; random.hRandomSub = 0xf0;
  let divReads = 0, time = 0, phase = 'setup';
  const draws: { phase: string; at: number; value: number; add: number; sub: number }[] = [];
  state.random = () => {
    const value = battleRandom(state);
    draws.push({ phase, at: time, value, add: state.hRandomAdd, sub: state.hRandomSub });
    return value;
  };
  const events: { at: number; name: string; data: unknown }[] = [];
  const mark = (name: string, data: unknown = null) => events.push({ at: time, name, data });
  const frameRecords: string[] = [], kinds: Frame[] = [];
  const printRecords: { at: number; program: string; end: number; rows: string[]; oam: BattleOam[]; cells: readonly BattleCell[] }[] = [];
  const headFrames: BattleOam[][] = [], holes: { x: number; y: number; at: number }[] = [];
  let bodyPlaced = false, openingPrinted = false;
  const originalPut = screen.put.bind(screen);
  vi.spyOn(screen, 'put').mockImplementation((x, y, cell) => {
    if (x === 1 && y === 5 && cell === 0x31) bodyPlaced = true;
    if (bodyPlaced && !openingPrinted && cell === ' ' && x >= 1 && x <= 7 && y >= 5 && y <= 7) holes.push({ x, y, at: time });
    originalPut(x, y, cell);
  });
  const originalBlack = screen.setPalBattleBlack.bind(screen);
  vi.spyOn(screen, 'setPalBattleBlack').mockImplementation(function* () {
    mark('palette', 'black'); yield* originalBlack();
  });
  const originalPal = screen.setPalBattle.bind(screen);
  vi.spyOn(screen, 'setPalBattle').mockImplementation(function* (input) { mark('palette', input); yield* originalPal(input); });
  const host: BattleInitHost = {
    screen, audio: bridge, trainerAppeared: { id: 0xe9, data: sfxData('trainer_appeared') },
    renderTiles: { sprites: { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4) } },
    pokeballTiles: image('gfx/battle/balls.png'),
    frontPicture: s => `front/${POKEDEX_ORDER[s.wCurPartySpecies - 1]}`,
    saveScreenTilesToBuffer1() { mark('buffer1.save'); driver.video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { mark('buffer1.load'); driver.video.loadScreenTilesFromBuffer1(); },
    printText: function* (program, bindings) {
      const record = { at: time, program, end: -1, rows: [] as string[],
        oam: Array.from({ length: 40 }, (_, i) => screen.shadowOam(i)), cells: screen.cells };
      printRecords.push(record); mark('text.start', { program, bindings });
      if (program !== '_InitBattleCommon.emptyString') openingPrinted = true;
      yield* driver.printText(program, bindings);
      record.end = time;
      record.rows = Array.from({ length: 4 }, (_, row) => Array.from({ length: 18 }, (_, col) => screen.at(col + 1, row + 13)).join(''));
      mark('text.end', { program, rows: record.rows });
    },
    voice: { getAlarm: lowHealthAlarm, setAlarm: setLowHealthAlarm,
      cry: species => mark('cry', species), clip: id => mark('clip', id), clearSfxIds: () => bridge.clearClipIds() },
    marowakAnimation: function* () { mark('MarowakAnim.cue'); },
    waitForSound: function* () {
      mark('sound.wait');
      while (!soundFinished(audio.sfx, audio.music, 0)) yield 'serviced';
      mark('sound.finished');
    },
  };
  const play = bridge.play.bind(bridge);
  vi.spyOn(bridge, 'play').mockImplementation(sound => { mark('sound', { id: sound.id, frequency: bridge.frequencyModifier, tempo: bridge.tempoModifier }); return play(sound); });
  vi.mocked(playSFX).mockImplementation(async name => { mark('text.sound', name); audio.sfx.play(sfxData(name)); });
  vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
  const beforeSetup = state.mem.slice();
  const saved = setupBattleBeforeTransition(state, random);
  const setup = { saved, writes: Object.fromEntries([...state.mem].flatMap((value, at) => value !== beforeSetup[at] ? [[at.toString(16), value]] : [])),
    ram: nonzero(state.mem), draws: [...draws] };
  const ramAfterSetup = state.mem.slice();
  const drive = () => {
    phase = 'after-transition'; driver.start(initBattleAfterTransition(state, host));
    let down = false, previous = state.mem.slice();
    for (; !driver.done && time < 4000;) {
      down = driver.video.textBox.isWaitingForInput ? !down : false;
      vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
      const head = Array.from({ length: 21 }, (_, i) => screen.shadowOam(i));
      if (head[0].y === 0x38) headFrames.push(head);
      time++;
      const kind = driver.step()!; kinds.push(kind);
      const changes = [...state.mem].flatMap((value, at) => value !== previous[at] ? [`${at.toString(16)}=${value.toString(16)}`] : []);
      frameRecords.push(`${time}:${kind} bg${textBgTransfer.nextPortion}/${Number(textBgTransfer.enabled)}/${screen.transferDestination.toString(16)} ` +
        `tiles=${digest(screen.cells)}/${digest(screen.visibleCells)} oam=${digest(Array.from({ length: 40 }, (_, i) => screen.oam(i)))} ram=${changes.join(',')}`);
      previous = state.mem.slice();
    }
    expect(driver.done).toBe(true);
    return { setup, frames: frameRecords, events, draws, audio: audio.synth.log,
      final: { ram: nonzero(state.mem), cells: screen.cells, oam: Array.from({ length: 40 }, (_, i) => screen.shadowOam(i)),
        front: Array.from({ length: 49 }, (_, i) => screen.frontSlot(i)), back: Array.from({ length: 49 }, (_, i) => screen.backSlot(i + 0x31)) } };
  };
  return { state, screen, host, driver, random, draws, events, printRecords, holes, headFrames,
    setup, ramAfterSetup, drive, frameRecords, kinds, audio, get divReads() { return divReads; } };
}

function assertCommon(h: ReturnType<typeof harness>): void {
  expect(h.setup.saved).toEqual({ mapPalOffset: 7, letterPrintingDelayFlags: 0xa7 });
  expect(h.ramAfterSetup[INIT.wLetterPrintingDelayFlags]).toBe(0xa5);
  expect(h.ramAfterSetup[INIT.wSavedTileAnimations]).toBe(1);
  expect(h.ramAfterSetup.slice(D.wPartyAndBillsPCSavedMenuItem, D.wPartyAndBillsPCSavedMenuItem + 4)).toEqual(new Uint8Array(4));
  expect(h.ramAfterSetup.slice(D.wCanEvolveFlags, D.wMiscBattleDataEnd)).toEqual(new Uint8Array(60).map((_, i) => i === 6 ? 1 : 0));
  // 6 HUD + ClearScreen3 + front7 + palette5 + LoadPlayerBackPic14 + tail3 + palette5.
  expect(h.events.find(e => e.name === 'palette')?.at).toBe(16);
  expect(h.events.filter(e => e.name === 'palette').slice(0, 2).map(e => e.at)).toEqual([16, 38]);
  expect(h.kinds.slice(0, 6)).toEqual(Array(6).fill('serviced'));
  expect(h.headFrames.length).toBe(22); // 14 copy + 3 tail + 5 palette frames.
  expect(h.headFrames[0]).toEqual(Array.from({ length: 21 }, (_, i) => ({
    y: 0x38 + (i % 3) * 8, x: 0xa0 + Math.floor(i / 3) * 8, tile: Math.floor(i / 3) * 7 + i % 3, attributes: 2,
  })));
  expect(h.holes).toEqual([]);
  const empty = h.printRecords.filter(e => e.program === '_InitBattleCommon.emptyString');
  expect(empty).toHaveLength(1); expect(empty[0].end - empty[0].at).toBe(3);
  expect(h.events.find(e => e.name === 'buffer1.save')?.at).toBe(empty[0].end);
  expect(h.events.find(e => e.name === 'buffer1.load')!.at - empty[0].end).toBe(6);
  expect(h.state.mem[INIT.wUpdateSpritesEnabled]).toBe(0xff);
  expect(h.state.mem[INIT.hTileAnimations]).toBe(0);
  expect(h.state.mem.slice(D.wPlayerStatsToDouble, D.wPlayerStatsToDouble + 5)).toEqual(new Uint8Array(5));
  expect(h.state.wPlayerDisabledMove).toBe(0);
  expect(h.screen.transferDestination).toBe(0x9c); expect(h.screen.wy).toBe(0);
  expect([h.screen.scx, h.screen.scy, h.screen.scxSplit]).toEqual([0, 0, null]);
  expect(textBgTransfer.enabled).toBe(true);
  const flipped = h.state.mem[INIT.wSpriteFlipped] !== 0;
  for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++) {
    expect(h.screen.at(12 + (flipped ? 6 - col : col), row), 'enemy pic cell at (12,0)').toBe(col * 7 + row);
    expect(h.screen.at(1 + (flipped ? 6 - col : col), 5 + row), 'player pic cell at (1,5)').toBe(0x31 + col * 7 + row);
  }
  for (let y = 7; y < 12; y++) for (let x = 9; x < 19; x++) expect(h.screen.at(x, y)).toBe(' ');
  expect(Array.from({ length: 40 }, (_, i) => h.screen.shadowOam(i))).toEqual(Array.from({ length: 40 }, () => ({ y: 0, x: 0, tile: 0, attributes: 0 })));
}

/** pret draw_hud_pokeball_gfx.asm:19-33,123-168. Pin the HUD and own OAM before the opening text. */
function assertOwnPokeballs(h: ReturnType<typeof harness>): void {
  const opening = h.printRecords[0], at = (x: number, y: number) => opening.cells[y * 20 + x];
  expect(at(18, 10)).toBe(0x73);
  expect(at(18, 11), 'player HUD corner').toBe(0x77);
  for (let x = 10; x <= 17; x++) expect(at(x, 11)).toBe(0x76);
  expect(at(9, 11)).toBe(0x6f);
  expect(opening.oam.slice(0, 6).map(o => o.x), 'own pokeballs advance right by eight').toEqual([0x60, 0x68, 0x70, 0x78, 0x80, 0x88]);
}

describe('checkpoint-04 battle start, through the instruction before StartBattle', () => {
  it('Route 1: setup draws both DVs before any frame and stores second-first; no music restart', () => {
    const h = harness();
    expect(h.divReads).toBe(4);
    expect(h.draws).toEqual([{ phase: 'setup', at: 0, value: 0x16, add: 0x16, sub: 0xd0 },
      { phase: 'setup', at: 0, value: 0x47, add: 0x47, sub: 0x90 }]);
    expect([...h.state.mem.slice(A.wEnemyMonDVs, A.wEnemyMonDVs + 2)]).toEqual([0x47, 0x16]);
    expect(h.state.mem[A.wPokedexSeen + 2] & 4).toBe(4); // Rattata dex19, seen before the transition.
    const trace = h.drive(); assertCommon(h); assertOwnPokeballs(h);
    expect(h.draws).toHaveLength(2);
    expect(h.events.find(e => e.name === 'cry')).toMatchObject({ at: 43, data: 0xa5 });
    const first = h.printRecords[0]; expect(first.at).toBe(44);
    expect(first.program).toBe('WildMonAppearedText');
    expect(first.oam.slice(0, 6).map(o => o.tile)).toEqual([0x31, 0x34, 0x34, 0x34, 0x34, 0x34]);
    expect(first.oam.slice(6).every(o => o.y === 0xa0)).toBe(true);
    expect(h.events.some(e => e.name === 'sound')).toBe(false);
    expect(h.screen.frontSlot(0)?.picture).toBe('front/19'); expect(h.screen.backSlot(0x31)?.picture).toBe('redb');
    expect(trace).toMatchSnapshot();
  });

  it('Forest bug catcher: FF AI count, trainer pic, waited sound, exactly20 frames and both party HUDs', () => {
    const h = harness({ trainer: 2, map: 0x33 });
    expect(h.draws).toEqual([]);
    expect(h.state.mem[D.wEnemyPartyCount]).toBe(2);
    const trace = h.drive(); assertCommon(h); assertOwnPokeballs(h);
    expect(h.state.mem[D.wAICount]).toBe(0xff); expect(h.state.wEnemyMonPartyPos).toBe(0xff);
    expect(h.state.wEnemyMonSpecies2).toBe(0); expect(h.state.wIsInBattle).toBe(2);
    expect(h.screen.frontSlot(0)?.picture).toBe('bugcatcher.png'); expect(h.state.wMonHSpriteDim).toBe(0);
    expect(Array.from({ length: 49 }, (_, i) => h.screen.frontSlot(i))).toEqual(
      Array.from({ length: 49 }, (_, tile) => ({ picture: 'bugcatcher.png', tile })));
    const sound = h.events.find(e => e.name === 'sound')!;
    expect(sound).toEqual({ at: 43, name: 'sound', data: { id: 0xe9, frequency: 0, tempo: 0x80 } });
    const waited = h.events.find(e => e.name === 'sound.finished')!;
    expect(h.events.filter(e => e.name === 'sound.wait')).toHaveLength(1);
    expect(waited.at - sound.at).toBe(18); // Audio2 CHAN5 at frequency0/tempo$80, through sound_ret.
    expect(h.printRecords[0].at - waited.at).toBe(21); // DelayFrames20, one ball-copy wait.
    expect(h.printRecords[0].program).toBe('TrainerWantsToFightText');
    expect(h.printRecords[0].rows.join(' ')).toContain('BUG CATCHER');
    expect(h.printRecords[0].oam.slice(6, 12).map(o => o.tile)).toEqual([0x31, 0x31, 0x34, 0x34, 0x34, 0x34]);
    expect(trace).toMatchSnapshot();
  });

  it('RIVAL1: the actual rival name reaches the committed trainer text', () => {
    const h = harness({ trainer: 25, map: 0x28 }); const trace = h.drive(); assertCommon(h);
    expect(h.printRecords[0].rows.join(' ')).toContain('GARY');
    expect(decodeNick(h.state.mem, D.wTrainerName)).toBe('GARY');
    expect(h.screen.frontSlot(0)?.picture).toBe('rival1.png');
    expect(trace).toMatchSnapshot();
  });

  it.each([false, true])('Pikachu intro: asleep=%s selects clip11/37 and draws no pokeballs', asleep => {
    const h = harness({ type: 4, asleep }); const trace = h.drive(); assertCommon(h);
    expect(h.events.find(e => e.name === 'clip')).toEqual({ at: 46, name: 'clip', data: asleep ? 37 : 11 });
    expect(h.events.some(e => e.name === 'cry')).toBe(false);
    expect(h.printRecords[0].oam.every(o => o.y === 0xa0)).toBe(true);
    expect(h.screen.backSlot(0x31)?.picture).toBe('prof.oakb');
    expect(trace).toMatchSnapshot();
  });

  it('hooked wild mon: uses HookedMonAttackedText, not the ordinary appeared program', () => {
    const h = harness({ hooked: true }); const trace = h.drive(); assertCommon(h);
    expect(h.printRecords.map(e => e.program)).toEqual(['HookedMonAttackedText', '_InitBattleCommon.emptyString']);
    expect(trace).toMatchSnapshot();
  });

  it('Tower ghost without scope: Tower check precedes cry, two programs, no sound or pokeballs', () => {
    const h = harness({ map: 0x90 }); const trace = h.drive(); assertCommon(h);
    expect(h.printRecords.map(e => e.program)).toEqual(['EnemyAppearedText', 'GhostCantBeIDdText', '_InitBattleCommon.emptyString']);
    expect(h.events.some(e => ['cry', 'clip', 'sound'].includes(e.name))).toBe(false);
    expect(h.printRecords[0].oam.every(o => o.y === 0xa0)).toBe(true);
    expect(h.screen.frontSlot(0)?.picture).toBe('ghost');
    expect(h.state.wMonHSpriteDim).toBe(0x66); expect(h.state.frontPicSpecies).toBe(0xb8);
    expect(trace).toMatchSnapshot();
  });

  it('unveiled Marowak: three prints, reload and animation cue, then the fall-through sound with its wait', () => {
    const h = harness({ map: 0x95 - 1, scope: true, marowak: true }); const trace = h.drive(); assertCommon(h);
    expect(h.printRecords.map(e => e.program)).toEqual(['EnemyAppearedText', 'UnveiledGhostText', 'WildMonAppearedText', '_InitBattleCommon.emptyString']);
    const third = h.printRecords[2], sound = h.events.find(e => e.name === 'sound')!;
    expect(sound, 'Marowak falls through into the trainer-appeared sound').toBeDefined();
    expect(sound.at).toBe(third.end); expect(sound.data).toEqual({ id: 0xe9, frequency: 0, tempo: 0x80 });
    expect(h.events.find(e => e.name === 'sound.finished')!.at).toBe(h.printRecords[3].at);
    expect(h.events.some(e => e.name === 'MarowakAnim.cue')).toBe(true);
    expect(h.events.some(e => e.name === 'cry')).toBe(false);
    expect(h.draws.map(d => d.phase)).toEqual(['setup', 'setup', 'after-transition', 'after-transition']);
    expect(h.printRecords.slice(0, 3).every(p => p.oam.every(o => o.y === 0xa0))).toBe(true);
    expect(trace).toMatchSnapshot();
  });

  it('Safari range sets battle type before transition; the nonzero type suppresses balls', () => {
    const h = harness({ map: 0xd9 }); expect(h.state.wBattleType).toBe(2);
    const trace = h.drive(); assertCommon(h);
    expect(h.printRecords[0].oam.every(o => o.y === 0xa0)).toBe(true);
    expect(trace).toMatchSnapshot();
  });

  it.each([0, 1])('gym happiness reads D05B=%i, independent of trainer class', gym => {
    // Bug catcher is not in any gym class list. A nonzero script byte still applies event4.
    const h = harness({ trainer: 2, gym });
    expect(h.state.mem[D.wPikachuHappiness]).toBe(90);
    const trace = h.drive(); assertCommon(h);
    expect(h.state.mem[D.wPikachuHappiness]).toBe(gym ? 93 : 90);
    expect(trace).toMatchSnapshot();
  });

  it('RNG HRAM persists across BattleStates; attach/detach never draws or resets the DIV source', () => {
    let div = 0; const random = new BattleRandomState(() => (++div * 16) & 255);
    random.hRandomAdd = 5; random.hRandomSub = 0xf0;
    const first = new BattleState(), oldDIV = first.readDIV;
    random.attach(first); expect(first.random()).toBe(0x16); expect(first.random()).toBe(0x47);
    random.detach(first); expect(first.readDIV).toBe(oldDIV);
    expect([random.hRandomAdd, random.hRandomSub, div]).toEqual([0x47, 0x90, 4]);
    const second = new BattleState(); random.attach(second);
    expect([second.hRandomAdd, second.hRandomSub]).toEqual([0x47, 0x90]);
    expect(second.random()).toBe(0x98); expect(second.random()).toBe(9);
    random.detach(second); expect([random.hRandomAdd, random.hRandomSub, div]).toEqual([9, 0xaf, 8]);
    expect(() => random.detach(first)).toThrow('different battle random state');
    random.attach(first); expect(() => random.attach(second)).toThrow('already attached'); random.detach(first);
  });

  it('LoadEnemyMonData clears the daycare selector before the wild WriteMonMoves call (core.asm:6282-6284)', () => {
    const h = harness({ daycare: 0xa5 });
    expect(h.state.mem[D.wLearningMovesFromDayCare]).toBe(0);
  });

  it.each([0xd8, 0xd9, 0xdc, 0xdd])('Safari comparison endpoints for map $%s retain other battle types outside the range', map => {
    const s = new BattleState(); s.wCurMap = map; s.wBattleType = 4;
    initBattleVariables(s); expect(s.wBattleType).toBe(map >= 0xd9 && map < 0xdd ? 2 : 4);
  });

  it('old-man type selects its back pic and suppresses party balls', () => {
    const h = harness({ type: 1 }); h.drive(); assertCommon(h);
    expect(h.screen.backSlot(0x31)?.picture).toBe('oldmanb');
    expect(h.printRecords[0].oam.every(o => o.y === 0xa0)).toBe(true);
  });

  it('a scoped ordinary Tower mon reloads data, then follows the ordinary cry and balls branch', () => {
    const h = harness({ map: 0x90, scope: true }); h.drive(); assertCommon(h);
    expect(h.printRecords.map(p => p.program)).toEqual(['WildMonAppearedText', '_InitBattleCommon.emptyString']);
    expect(h.draws).toHaveLength(4);
    expect(h.events.find(e => e.name === 'cry')).toMatchObject({ data: 0xa5 });
    expect(h.screen.frontSlot(0)?.picture).toBe('front/19');
  });

  it('wild setup after a trainer clears the stale nonzero wTrainerClass', () => {
    const h = harness({ staleTrainerClass: 0x22 });
    expect(h.ramAfterSetup[D.wTrainerClass]).toBe(0x22);
    h.drive(); assertCommon(h);
    expect(h.state.mem[D.wTrainerClass], 'wild branch clears the previous trainer class').toBe(0);
  });

  it('wSpriteFlipped mirrors every front and back picture column', () => {
    const h = harness({ flipped: true }); h.drive(); assertCommon(h); assertOwnPokeballs(h);
    expect(h.screen.at(18, 0)).toBe(0);
    expect(h.screen.at(12, 0)).toBe(42);
    expect(h.screen.at(7, 5)).toBe(0x31);
    expect(h.screen.at(1, 5)).toBe(0x31 + 42);
  });
});
