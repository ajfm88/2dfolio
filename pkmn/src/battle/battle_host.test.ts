import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }),
  loadTileset: async () => ({ width: 128 }) }));
import { BattleHost } from './battle_host';
import { BattleMenuScreen } from './battle_menu_screen';
import { A, BattleState, battleContext, decodeNick, encodeText, type SpeciesHeader } from './battle_state';
import { createPokemon, loadBattleData } from './data';
import { initWildBattle, loadBattleMonFromParty, partySlotFromPokemon, writePartySlot } from './battle_loaders';
import { drawHudsAndHpBars } from './battle_menu';
import type { BattleActionContext, BattleActionHost, Frame, Program } from './battle_menu_context';
import { initTextSystem, setTextSpeed, TextBox } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { monsStatsRoseText, type TextBindings } from '../text/text_runner';
import { textBgTransfer } from '../text/bg_transfer';
import { uiTiles } from '../renderer/ui_tiles';
import { isHeld } from '../input';
import { playSFX, isSoundFinished } from '../audio';
import { rig as audioRig, sfxData } from '../test/audio_rig';
import { soundFinished } from '../audio/sound_wait';
import { setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';

beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); await initTextSystem(); });
beforeEach(() => {
  vi.clearAllMocks(); setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  uiTiles.clear(); setLowHealthAlarm(0); setLowHealthAlarmDisabled(false);
  vi.mocked(isHeld).mockReturnValue(false); vi.mocked(isSoundFinished).mockReturnValue(true); vi.mocked(playSFX).mockReset();
});
afterEach(() => vi.restoreAllMocks());

const bindings: TextBindings = { stringBuffer: 'ATTACK', nameBuffer: 'ITEM' };
const actors = { whoseTurn: 0, battleMonNick: 'PIKA', enemyMonNick: 'RHYDON' };
function row(video: BattleMenuScreen, y: number): string {
  return Array.from({ length: 20 }, (_, x) => String(video.screen.at(x, y) ?? ' ')).join('');
}
function down(value: boolean): void { vi.mocked(isHeld).mockImplementation(key => value && key === 'b'); }
function drive<T>(host: BattleHost<T>): Frame[] {
  const frames: Frame[] = []; let pressed = false;
  for (let count = 0; !host.done && count < 1500; count++) {
    pressed = host.video.textBox.isWaitingForInput ? !pressed : false;
    down(pressed); frames.push(host.step()!);
  }
  expect(host.done).toBe(true);
  return frames;
}
function actionHost(video: BattleMenuScreen): BattleActionHost {
  return {
    screen: video.screen, tiles: video.tiles, readJoypad() {}, pressSound() {}, printText: video.printText.bind(video),
    loadScreenTilesFromBuffer1: video.loadScreenTilesFromBuffer1.bind(video),
    saveScreenTilesToBuffer1: video.saveScreenTilesToBuffer1.bind(video),
    loadScreenTilesFromBuffer2: video.loadScreenTilesFromBuffer2.bind(video),
    saveScreenTilesToBuffer2: video.saveScreenTilesToBuffer2.bind(video),
    useItem: function* () {}, partyMenu: function* () { return null; }, playSound() {},
    waitForSound: function* () {}, runOdds: () => false,
  };
}

describe('BattleHost one-frame protocol', () => {
  it('primes once, orders vblank/audio/resume, returns a value and stays idle afterwards', () => {
    const events: string[] = []; const video = new BattleMenuScreen();
    vi.spyOn(video, 'vblank').mockImplementation(() => { events.push('vblank'); });
    const host = new BattleHost<number>(new BattleState(), video, () => events.push('audio'));
    expect([host.done, host.result, host.step()]).toEqual([true, undefined, null]);
    host.start((function* (): Program<number> {
      events.push('prime'); yield 'serviced'; events.push('resume'); return 42;
    })());
    expect(events).toEqual(['prime']); expect(host.done).toBe(false); expect(host.result).toBeUndefined();
    expect(host.step()).toBe('serviced');
    expect(events).toEqual(['prime', 'vblank', 'audio', 'resume']);
    expect([host.done, host.result, host.step(), host.step()]).toEqual([true, 42, null, null]);
    expect(events).toHaveLength(4);
  });
  it.each(['held', 'session'] as const)('%s runs neither vblank nor audio but resumes CPU work', frame => {
    const video = new BattleMenuScreen(); const audio = vi.fn(); const blank = vi.spyOn(video, 'vblank');
    const host = new BattleHost<number>(new BattleState(), video, audio);
    host.start((function* (): Program<number> { yield frame; return 7; })());
    expect(host.step()).toBe(frame); expect(host.result).toBe(7);
    expect(blank).not.toHaveBeenCalled(); expect(audio).not.toHaveBeenCalled();
  });
  it('the session owner already ticks its frame, with no second host tick', () => {
    const video = new BattleMenuScreen(), ownTick = vi.spyOn(video, 'vblank'), audio = vi.fn();
    const host = new BattleHost(new BattleState(), video, audio);
    host.start((function* (): Program { video.vblank(); yield 'session'; })());
    expect(ownTick).toHaveBeenCalledTimes(1); host.step();
    expect(ownTick).toHaveBeenCalledTimes(1); expect(audio).not.toHaveBeenCalled();
  });
  it('refuses replacement while active, then permits a fresh program after completion', () => {
    const host = new BattleHost<number>(new BattleState());
    host.start((function* (): Program<number> { yield 'held'; return 1; })());
    expect(() => host.start((function* (): Program<number> { return 99; })())).toThrow('battle program already running');
    host.step(); expect(host.result).toBe(1);
    host.start((function* (): Program<number> { return 2; })());
    expect([host.done, host.result, host.step()]).toEqual([true, 2, null]);
  });
  it('defaults to a no-op audio port and advances text exactly once per serviced frame', () => {
    const host = new BattleHost(new BattleState()); const update = vi.spyOn(host.video.textBox, 'update');
    host.start(host.printText('PrintEmptyString.emptyString'));
    expect(drive(host)).toEqual(['serviced', 'serviced', 'serviced']);
    expect(update).toHaveBeenCalledTimes(3); expect(host.video.textBox.active).toBe(false);
  });
});

describe('per-print runner options', () => {
  it('retains the literal standalone print path and noDelay default behavior', () => {
    const box = new TextBox(); box.printStandalone({ text: 'OK' }, { noDelay: true });
    for (let i = 0; i < 3; i++) box.update();
    expect(box.isComplete).toBe(true); expect(box.textReturn).toBe('returned');
    expect(box.saveScreen().buffer.slice(41, 43)).toEqual(['O', 'K']);
  });
  it.each([0, 1])('TextBox forwards actors and asm on turn %i without another PrintText opening', turn => {
    const box = new TextBox(), handler = vi.fn(monsStatsRoseText(0x0a));
    box.printStandalone({ program: 'MonsStatsRoseText' }, { bindings, actors: { ...actors, whoseTurn: turn },
      asm: { MonsStatsRoseText: handler }, noDelay: true });
    let pressed = false, frames = 0;
    for (; !box.isComplete && frames < 300; frames++) { pressed = box.isWaitingForInput ? !pressed : false; down(pressed); box.update(); }
    expect(box.isComplete).toBe(true); expect(box.textReturn).toBe('returned');
    expect(frames).toBe(6); // Delay3 + ManualTextScroll's ProtectedDelay3; no letter delays.
    expect(handler).toHaveBeenCalledExactlyOnceWith({ label: 'MonsStatsRoseText', column: 7, row: 16 });
    const buffer = box.saveScreen().buffer;
    expect(buffer.slice(41, 59).join('').trimEnd()).toBe(turn === 0 ? "PIKA's" : "Enemy RHYDON's");
    expect(buffer.slice(81, 99).join('').trimEnd()).toBe('ATTACK rose!');
  });
  it('applies BattleMenuScreen runner options on each print, without leaking handlers', () => {
    const video = new BattleMenuScreen(), host = new BattleHost(new BattleState(), video);
    const handler = vi.fn(() => {});
    host.start(video.printText('MonsStatsRoseText', bindings, { actors, asm: { MonsStatsRoseText: handler } }));
    drive(host); expect(handler).toHaveBeenCalledTimes(1); expect(video.textBox.textReturn).toBe('returned');
    host.start(video.printText('MonsStatsRoseText', bindings)); drive(host);
    expect(handler).toHaveBeenCalledTimes(1); expect(video.textBox.textReturn).toBe('asm');
    expect(row(video, 14)).toContain("<USER>'s");
  });
  it.each(['FoundHiddenItemText', 'PalletTownOakText.HeyWaitDontGoOutText',
    'PewterNidoranHouseNidoranText', 'TownMapText'])('default overworld root %s still returns asm', program => {
    const host = new BattleHost(new BattleState());
    host.start(host.video.printText(program, bindings)); drive(host);
    expect(host.video.textBox.textReturn).toBe('asm');
  });
  it('host actors read the current turn and decoded state nicks when placed, including a second print', () => {
    const state = new BattleState(), host = new BattleHost(state);
    state.setBytes(A.wBattleMonNick, encodeText('PIKA@'), 11);
    state.setBytes(A.wEnemyMonNick, encodeText('RHYDON@'), 11);
    const options = { asm: { MonsStatsRoseText: monsStatsRoseText(0x0a) } };
    host.start(host.printText('MonsStatsRoseText', bindings, options));
    // Changed after priming, before Delay3 reaches PlaceString.
    state.hWhoseTurn = 1; state.setBytes(A.wEnemyMonNick, encodeText('FOE@'), 11);
    drive(host); expect(row(host.video, 14)).toContain("Enemy FOE's");
    state.hWhoseTurn = 0; state.setBytes(A.wBattleMonNick, encodeText('NEW@'), 11);
    host.start(host.printText('MonsStatsRoseText', bindings, options)); drive(host);
    expect(row(host.video, 14)).toContain("NEW's");
  });
  it('host accepts explicit runner actors and handler options', () => {
    const host = new BattleHost(new BattleState());
    const handler = vi.fn(() => {});
    host.start(host.printText('MonsStatsRoseText', bindings, { actors, asm: { MonsStatsRoseText: handler } }));
    drive(host); expect(row(host.video, 14)).toContain("PIKA's"); expect(handler).toHaveBeenCalledTimes(1);
  });
  it('sound waits advance the real audio engines through the serviced audio port', () => {
    const audio = audioRig(), host = new BattleHost(new BattleState(), new BattleMenuScreen(), audio.update);
    vi.mocked(playSFX).mockImplementation(async name => { audio.sfx.play(sfxData(name)); });
    vi.mocked(isSoundFinished).mockImplementation(() => soundFinished(audio.sfx, audio.music, 0));
    host.start(host.printText('FoundItemText', { stringBuffer: 'ITEM' }));
    const frames = drive(host);
    expect(playSFX).toHaveBeenCalledWith('get_item1');
    expect(audio.synth.update).toBe(frames.length);
    expect(audio.sfx.isChannelActive(0)).toBe(false); expect(host.video.textBox.textReturn).toBe('returned');
  });
});

// Symbol addresses read from pret's pinned pokeyellow.sym, not inferred from a struct.
const PLAYER_BAR = 0xcf1c, ENEMY_BAR = 0xcf1d;
function fillHuds(state: BattleState): BattleActionContext {
  const ctx = battleContext(state);
  ctx.playerHud = {
    nickname: decodeNick(state.mem, A.wBattleMonNick), level: state.wBattleMonLevel, status: state.wBattleMonStatus,
    hp: state.wBattleMonHP, maxHp: state.wBattleMonMaxHP, alarm: state.wLowHealthAlarm, alarmDisabled: false,
    get barColor() { return state.mem[PLAYER_BAR]; }, set barColor(value: number) { state.mem[PLAYER_BAR] = value; },
  };
  ctx.enemyHud = {
    nickname: decodeNick(state.mem, A.wEnemyMonNick), level: state.wEnemyMonLevel, status: state.wEnemyMonStatus,
    hp: state.wEnemyMonHP, maxHp: state.wEnemyMonMaxHP,
    get barColor() { return state.mem[ENEMY_BAR]; }, set barColor(value: number) { state.mem[ENEMY_BAR] = value; },
  };
  return ctx;
}

describe('palette CPU write and composed battle program', () => {
  it.each([[84, 1, 112], [153, 0xa5, 19], [0, 1, 112], [84, 0, 0], [0, 0, 0]])
  ('player internal %i, enemy %i leaves dex %i before the first yield', (player, enemy, dex) => {
    const state = new BattleState(), video = new BattleMenuScreen();
    state.mem[A.wPartyMons] = player; state.wBattleMonSpecies = player; state.wEnemyMonSpecies2 = enemy;
    state.wBattleMonHP = state.wBattleMonMaxHP = state.wEnemyMonHP = state.wEnemyMonMaxHP = 30;
    state.mem[PLAYER_BAR] = 2; state.wMaxPP = 0x77;
    const ctx = fillHuds(state), host = new BattleHost(state, video);
    host.start(drawHudsAndHpBars(ctx, actionHost(video)));
    expect([ctx.pokedexNum, state.wPokedexNum, state.wMaxPP]).toEqual([dex, dex, dex]);
    expect(host.step()).toBe('held'); expect(state.wCalculateWhoseStats).toBe(dex);
    expect(drive(host)).toEqual(['held', 'serviced', 'serviced', 'serviced']);
  });
  it('both directions of the pokedexNum binding alias the other D11D views', () => {
    const state = new BattleState(), view = battleContext(state);
    view.pokedexNum = 112; expect(state.wMaxPP).toBe(112);
    state.wCalculateWhoseStats = 19; expect(view.pokedexNum).toBe(19);
  });
  it('also writes the optional field on a plain context which initially lacks it', () => {
    const state = new BattleState(), host = new BattleHost(state);
    state.wBattleMonHP = state.wBattleMonMaxHP = state.wEnemyMonHP = state.wEnemyMonMaxHP = 30;
    state.wEnemyMonSpecies2 = 1; state.mem[PLAYER_BAR] = 2;
    state.mem[A.wBattleMonNick] = 0x50;
    state.mem[A.wEnemyMonNick] = 0x50;
    const ctx = { ...fillHuds(state) }; delete ctx.pokedexNum;
    host.start(drawHudsAndHpBars(ctx, actionHost(host.video)));
    expect(ctx.pokedexNum).toBe(112); drive(host);
  });
  it('does not clobber D11D when neither HUD requests a palette', () => {
    const state = new BattleState(), host = new BattleHost(state);
    state.wBattleMonHP = state.wBattleMonMaxHP = state.wEnemyMonHP = state.wEnemyMonMaxHP = 30;
    state.wMaxPP = 0x77;
    host.start(drawHudsAndHpBars(fillHuds(state), actionHost(host.video)));
    expect(host.done).toBe(true); expect(state.wMaxPP).toBe(0x77);
  });
  it('loads both copies, draws one palette hold, then prints USER through MonsStatsRoseText', () => {
    const state = new BattleState(), video = new BattleMenuScreen(), audio = audioRig();
    state.species = (id: number): SpeciesHeader => id === 1
      ? { name: 'RHYDON', base: [105, 130, 120, 40, 45], type1: 4, type2: 5, catchRate: 60, baseExp: 204,
        moves: [33, 0, 0, 0], learnset: [] }
      : { name: 'PIKACHU', base: [35, 55, 30, 90, 50], type1: 23, type2: 23, catchRate: 190, baseExp: 112,
        moves: [84, 0, 0, 0], learnset: [] };
    state.movePP = () => 35; state.readDIV = () => 2;
    const mon = createPokemon('Pikachu', 50, 'PIKA', { atk: 9, def: 8, spd: 8, spc: 8 })!;
    writePartySlot(state, 'player', 0, partySlotFromPokemon(mon)); state.wBattleMonSpecies2 = 84;
    loadBattleMonFromParty(state);
    state.wEnemyMonSpecies2 = state.wCurPartySpecies = 1; state.wCurEnemyLevel = 50; initWildBattle(state);
    expect(state.bytes(A.wEnemyMonDVs, 2).slice()).toEqual([6, 3]);
    expect([state.wBattleMonHP, state.wEnemyMonHP]).toEqual([103, 166]);
    state.hWhoseTurn = 0; state.mem[PLAYER_BAR] = 2; state.wMaxPP = 0x77;
    const ctx = fillHuds(state), handler = vi.fn(monsStatsRoseText(0x0a));
    const host = new BattleHost<number>(state, video, audio.update);
    const blank = vi.spyOn(video, 'vblank'), text = vi.spyOn(video.textBox, 'update');
    host.start((function* (): Program<number> {
      yield* drawHudsAndHpBars(ctx, actionHost(video));
      expect(state.wPokedexNum).toBe(112);
      yield* host.printText('MonsStatsRoseText', bindings, { asm: { MonsStatsRoseText: handler } });
      return state.wPokedexNum;
    })());
    expect(state.wMaxPP).toBe(112); expect(audio.synth.update).toBe(0);
    const frames = drive(host);
    expect(frames).toEqual(['held', 'held', ...Array<Frame>(26).fill('serviced')]);
    expect(blank).toHaveBeenCalledTimes(26); expect(audio.synth.update).toBe(26); expect(text).toHaveBeenCalledTimes(23);
    expect(handler).toHaveBeenCalledTimes(1); expect(host.result).toBe(112);
    expect(Array.from({ length: 6 }, (_, x) => video.screen.at(x + 1, 0))).toEqual(encodeText('RHYDON'));
    expect(Array.from({ length: 4 }, (_, x) => video.screen.at(x + 11, 7))).toEqual(encodeText('PIKA'));
    expect(Array.from({ length: 7 }, (_, x) => video.screen.at(x + 11, 10))).toEqual(encodeText('103/103'));
    expect(row(video, 14)).toContain("PIKA's");
    expect(row(video, 16)).toContain('ATTACK rose!');
    expect([state.mem[PLAYER_BAR], state.mem[ENEMY_BAR]]).toEqual([0, 0]);
  });
});

it('keeps the host outside the production module graph', () => {
  const seen = new Set<string>();
  function visit(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const base = resolve(dirname(file), match[1]);
      const target = [base + '.ts', resolve(base, 'index.ts')].find(existsSync);
      if (target) visit(target);
    }
  }
  visit(resolve(__dirname, '../main.ts'));
  expect(seen.has(resolve(__dirname, 'battle_host.ts'))).toBe(false);
  expect(seen.has(resolve(__dirname, 'battle_menu_screen.ts'))).toBe(false);
});
