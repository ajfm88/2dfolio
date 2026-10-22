import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn(), loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }) }));
import { A } from './battle_state';
import { battleGlyphTile } from './battle_screen';
import { drawHuds, drawEnemyHud, drawPlayerHud } from './battle_hud_state';
import { BattleHost } from './battle_host';
import { BattleMenuScreen } from './battle_menu_screen';
import { checkPlayerStatusConditions } from './battle_turn_status';
import { handlePoisonBurnLeechSeed, type ResidualFlags } from './battle_residual';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { isHeld } from '../input';
import { doLowHealthAlarm, lowHealthAlarm, lowHealthChannel5, setLowHealthAlarm,
  setLowHealthAlarmDisabled, setLowHealthChannel5 } from '../audio/low_health_alarm';
import { loadBattleMoveData } from './battle_move_data';
import { getMonsterPalette } from '../renderer/palettes';
import { finish, hpRig } from '../test/battle_hp_rig';
import type { Frame } from './battle_menu_context';

beforeAll(async () => { await loadTextPrograms(); await initTextSystem(); await loadBattleMoveData(); });
beforeEach(() => {
  vi.clearAllMocks(); textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast');
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setLowHealthChannel5(0);
});
afterEach(() => vi.restoreAllMocks());
const hold: Frame[] = ['held', 'held', 'serviced', 'serviced', 'serviced'];

it.each([[0, 0, 0], [2, 0, 1], [0, 2, 1], [2, 2, 2]])(
  'stored colours player%i enemy%i request exactly%i palettes, no unconditional hold', (p, e, requests) => {
    const r = hpRig(); r.s.wPlayerHPBarColor = p; r.s.wEnemyHPBarColor = e;
    const pal = vi.spyOn(r.screen, 'setPalBattle');
    expect(finish(drawHuds(r.s, r.screen)).frames).toEqual(Array.from({ length: requests }, () => hold).flat());
    expect(pal).toHaveBeenCalledTimes(requests);
    expect([r.s.wPlayerHPBarColor, r.s.wEnemyHPBarColor]).toEqual([0, 0]);
    expect(r.screen.at(11, 7)).toBe(battleGlyphTile('P')); // short-name centering
    expect(r.screen.at(2, 0)).toBe(battleGlyphTile('F'));
    expect(r.screen.at(10, 9)).toBe(0x71); expect(r.screen.at(2, 2)).toBe(0x71);
    expect([r.screen.at(15, 8), r.screen.at(16, 8), r.screen.at(5, 1), r.screen.at(6, 1)])
      .toEqual(['2', '5', '3', '0'].map(battleGlyphTile));
  });
it('first hold sees D11D and only player colour updated; second sees both colours', () => {
  const r = hpRig(); r.s.wPlayerHPBarColor = 2; r.s.wEnemyHPBarColor = 2; r.s.wNamedObjectIndex = 77;
  const p = drawHuds(r.s, r.screen);
  expect(p.next()).toEqual({ value: 'held', done: false });
  expect([r.s.wNamedObjectIndex, r.s.wPlayerHPBarColor, r.s.wEnemyHPBarColor]).toEqual([112, 0, 2]);
  expect([r.screen.paletteName(2), r.screen.paletteName(3)]).toEqual([getMonsterPalette(25), getMonsterPalette(112)]);
  expect(r.screen.at(2, 2)).toBe(' '); // enemy draw occurs only after player hold/alarm.
  for (let i = 0; i < 4; i++) p.next();
  expect(p.next()).toEqual({ value: 'held', done: false });
  expect([r.s.wNamedObjectIndex, r.s.wEnemyHPBarColor]).toEqual([112, 0]);
  expect(finish(p).frames).toEqual(hold.slice(1));
});
it('no palette means D11D untouched, and a zero enemy writes0 before any yield', () => {
  const r = hpRig(); r.s.wNamedObjectIndex = 77; finish(drawHuds(r.s, r.screen));
  expect(r.s.wNamedObjectIndex).toBe(77);
  r.s.wEnemyMonSpecies2 = 0; r.s.wEnemyHPBarColor = 2;
  const p = drawEnemyHud(r.s, r.screen); expect(p.next().value).toBe('held'); expect(r.s.wNamedObjectIndex).toBe(0);
  finish(p);
});
it.each(['player', 'enemy'] as const)('standalone%s reads live mon bytes and writes only its HUD and colour', which => {
  const r = hpRig(); r.s.wBattleMonHP = 1; r.s.wEnemyMonHP = 1;
  r.s.wBattleMonStatus = 8; r.s.wEnemyMonStatus = 16;
  const player = which === 'player';
  expect(finish(player ? drawPlayerHud(r.s, r.screen) : drawEnemyHud(r.s, r.screen)).frames).toEqual(hold);
  expect([r.s.wPlayerHPBarColor, r.s.wEnemyHPBarColor]).toEqual(player ? [2, 0] : [0, 2]);
  expect(r.screen.at(player ? 10 : 2, player ? 9 : 2)).toBe(0x71);
  expect(r.screen.at(player ? 2 : 10, player ? 2 : 9)).toBe(' ');
  expect(r.screen.at(player ? 15 : 5, player ? 8 : 1)).toBe(battleGlyphTile(player ? 'P' : 'B'));
});
it('LCD-off palette requests write D11D but yield nothing, including both changes', () => {
  const r = hpRig(); r.screen.lcdOn = false; r.s.wPlayerHPBarColor = 2; r.s.wEnemyHPBarColor = 2;
  const pal = vi.spyOn(r.screen, 'setPalBattle');
  expect(finish(drawHuds(r.s, r.screen)).frames).toEqual([]); expect(pal).toHaveBeenCalledTimes(2);
  expect(r.s.wPokedexNum).toBe(112);
});
it.each([[1, 0, 0x15, 0x95, 5], [0, 0, 0x95, 0, 0], [100, 0, 0x95, 0, 0],
  [100, 0, 0x15, 0, 5], [1, 1, 0x95, 0x95, 5], [0, 1, 0x95, 0, 0],
  [1, 1, 0x15, 0x15, 5], [100, 1, 0x95, 0x95, 5]])(
  'alarm HP%i disabled%i old%i ->%i, CHAN5%i', (hp, disabled, old, alarm, channel) => {
    const r = hpRig(); r.s.wBattleMonHP = hp;
    setLowHealthAlarm(old); setLowHealthAlarmDisabled(disabled !== 0); setLowHealthChannel5(5);
    finish(drawPlayerHud(r.s, r.screen));
    expect(lowHealthAlarm()).toBe(alarm);
    expect(lowHealthChannel5()).toBe(channel);
  });
it('alarm writes after player palette, before enemy palette; a suspended audio tick stays', () => {
  const r = hpRig(); r.s.wBattleMonHP = 1; r.s.wEnemyHPBarColor = 2;
  const p = drawHuds(r.s, r.screen);
  expect(p.next().value).toBe('held'); expect(lowHealthAlarm()).toBe(0);
  for (let i = 0; i < 4; i++) p.next();
  expect(p.next().value).toBe('held'); expect(lowHealthAlarm()).toBe(128);
  doLowHealthAlarm(); // audio owns this tick while the HUD is suspended.
  expect(p.next().value).toBe('held'); expect(lowHealthAlarm()).toBe(158);
  finish(p); expect(lowHealthAlarm()).toBe(158);
});
it('enemy-only HUD never resets or ticks the audio alarm', () => {
  const r = hpRig(); setLowHealthAlarm(151);
  finish(drawEnemyHud(r.s, r.screen));
  expect(lowHealthAlarm()).toBe(151);
});
it('drawPlayerHud and drawHuds leave BattleState $D082 untouched', () => {
  const r = hpRig(); r.s.wBattleMonHP = 1; r.s.wLowHealthAlarm = 0x12; r.s.wLowHealthAlarmDisabled = 1;
  setLowHealthAlarm(0x15); setLowHealthAlarmDisabled(false);
  finish(drawPlayerHud(r.s, r.screen));
  finish(drawHuds(r.s, r.screen));
  expect(A.wLowHealthAlarm).toBe(0xd082);
  expect(r.s.mem[A.wLowHealthAlarm]).toBe(0x12);
  expect(r.s.wLowHealthAlarmDisabled).toBe(1);
  expect(lowHealthAlarm()).toBe(0x95);
});
it('real HUD supplies checkpoint-03 self-hit drawPlayerHud port with turn still flipped', () => {
  const r = hpRig(); r.s.wPlayerBattleStatus1 = 128; r.s.wPlayerConfusedCounter = 2; r.s.random = () => 128;
  r.s.wPlayerHPBarColor = 2;
  const turns: number[] = [];
  const host = { printText: function* () {} };
  const out = finish(checkPlayerStatusConditions(r.s, host, {
    animation: function* () {}, calculateSelfHit: function* () {}, applySelfHit: function* () {},
    drawPlayerHud: function* (s) { turns.push(s.hWhoseTurn); yield* drawPlayerHud(s, r.screen); },
  }));
  expect(out.result).toBe('ExecutePlayerMoveDone'); expect(turns).toEqual([1]);
  expect(out.frames).toEqual([...Array(6).fill('serviced'), ...hold]); expect(r.s.hWhoseTurn).toBe(0);
});

it.each([0, 1] as const)('BattleHost residual side%i runs committed text, HP bars, HUD, and serviced-only audio/video', side => {
  const r = hpRig(side); r.s.mem[r.c.status] = 24; r.s.mem[r.c.flags2] = 128; r.s.writeBE(r.c.hp, 1);
  r.s.wPlayerHPBarColor = 1; r.s.wEnemyHPBarColor = 1;
  const video = new BattleMenuScreen(r.screen), audio = vi.fn(), blank = vi.spyOn(video, 'vblank');
  const screenBlank = vi.spyOn(r.screen, 'vblank');
  const host = new BattleHost<ResidualFlags>(r.s, video, audio), snapshots: string[] = [];
  const printText = host.printText.bind(host);
  host.printText = function* (...args) {
    yield* printText(...args); snapshots.push(r.screen.cells.map(String).join(''));
  };
  host.start(handlePoisonBurnLeechSeed(r.s, r.screen, host, {
    animation: function* () { yield 'held'; yield 'session'; },
    drawHuds: s => drawHuds(s, r.screen),
  }));
  const frames: Frame[] = []; let down = false;
  for (let i = 0; !host.done && i < 3000; i++) {
    down = video.textBox.isWaitingForInput ? !down : false;
    vi.mocked(isHeld).mockImplementation(key => down && key === 'b');
    frames.push(host.step()!);
  }
  expect(host.done).toBe(true); expect(host.result).toEqual({ zero: true });
  expect(snapshots).toHaveLength(2);
  expect(snapshots[0]).toContain(side ? 'Enemy FOE' : 'PIKA'); expect(snapshots[0]).toContain('burn!');
  expect(snapshots[1]).toContain('LEECH SEED');
  expect([r.s.readBE(r.c.hp), r.s.readBE(r.c.opposite), r.s.hWhoseTurn]).toEqual([0, 110, side]);
  expect(r.s.wPokedexNum).toBe(112);
  expect(frames.slice(-20)).toEqual(Array(20).fill('serviced'));
  expect(frames.filter(f => f === 'session')).toHaveLength(2);
  expect(frames.filter(f => f === 'held')).toHaveLength(6); // two fake frames + two palette holds
  expect(audio).toHaveBeenCalledTimes(frames.filter(f => f === 'serviced').length);
  expect(blank).toHaveBeenCalledTimes(audio.mock.calls.length);
  expect(screenBlank).toHaveBeenCalledTimes(audio.mock.calls.length);
});

it('new scratch/status cells have their cartridge addresses and shared buffer alias', () => {
  expect([A.wHPBarMaxHP, A.wHPBarOldHP, A.wHPBarNewHP, A.wHPBarDelta, A.wHPBarTempHP,
    A.wHPBarHPDifference, A.wHPBarType]).toEqual([0xcee9, 0xceeb, 0xceed, 0xceef, 0xcef0, 0xcefd, 0xcf93]);
  expect([A.wPlayerHPBarColor, A.wEnemyHPBarColor, A.wPlayerToxicCounter, A.wEnemyToxicCounter,
    A.wLowHealthAlarmDisabled]).toEqual([0xcf1c, 0xcf1d, 0xd06b, 0xd070, 0xccf6]);
  const r = hpRig(); r.s.mem[A.wHPBarMaxHP] = 22; expect(r.s.wBuffer).toBe(22);
});
