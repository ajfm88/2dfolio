import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../input', () => ({ isHeld: () => false, isPassPressed: () => false, syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ drawTile: vi.fn(), fillRect: vi.fn() }));
import { BattleState, battleContext } from './battle_state';
import { BattleScreen, battleScreenFor, bindBattleScreen } from './battle_screen';
import { BattleMenuScreen } from './battle_menu_screen';
import { BattleUnsupportedState } from './battle_move_data';
import { executePlayerMove, executeEnemyMove } from './battle_execute';
import { handlePoisonBurnLeechSeed } from './battle_residual';
import { mainInBattleLoop, type TurnHost, type TurnPorts } from './battle_turn';
import { textBgTransfer } from '../text/bg_transfer';
import { finish } from '../test/battle_hp_rig';

beforeEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });
afterEach(() => { textBgTransfer.enabled = true; textBgTransfer.resetPortion(); });

function rig() {
  const s = new BattleState(), video = new BattleMenuScreen(), screen = video.screen;
  s.wPlayerSelectedMove = s.wEnemySelectedMove = 0xff;
  const host: TurnHost = {
    screen, tiles: video.tiles, printText: function* () {}, getMove: () => { throw new Error('unexpected move lookup'); },
    readJoypad() {}, pressSound() {}, saveScreenTilesToBuffer1() { video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer1() { video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer2() { video.saveScreenTilesToBuffer2(); },
    loadScreenTilesFromBuffer2() { video.loadScreenTilesFromBuffer2(); },
    useItem: function* () {}, partyMenu: function* () { return null; }, playSound() {}, waitForSound: function* () {},
    runOdds: () => false,
  };
  const ports: TurnPorts = {
    animation: function* () {}, statModifierUpEffect: function* () {}, hideSubstitute: function* () {},
    reshowSubstitute: function* () {}, substituteBreak: function* () {}, shake: function* () {},
    jumpMoveEffect: function* () { return 1; }, trainerAI: function* () { return { carry: false }; }, switchEnemyMon: function* () {},
  };
  return { s, screen, host, ports };
}

describe.each(['player', 'enemy', 'residual', 'turn'] as const)('entry screen binding: %s', entry => {
  function run(r: ReturnType<typeof rig>) {
    if (entry === 'player') return finish(executePlayerMove(r.s, r.screen, r.host, r.ports));
    if (entry === 'enemy') return finish(executeEnemyMove(r.s, r.screen, r.host, r.ports));
    if (entry === 'residual') return finish(handlePoisonBurnLeechSeed(r.s, r.screen, r.host,
      { animation: r.ports.animation, drawHuds: function* () {} }));
    return finish(mainInBattleLoop(r.s, battleContext(r.s), r.host, r.ports));
  }
  it('binds a passed screen with no host and accepts the same screen on reentry', () => {
    const r = rig(); run(r); expect(battleScreenFor(r.s)).toBe(r.screen);
    run(r); expect(battleScreenFor(r.s)).toBe(r.screen);
  });
  it('rejects a different already-bound screen before CPU writes or frames', () => {
    const r = rig(), bound = new BattleScreen(); bindBattleScreen(r.s, bound);
    const before = r.s.mem.slice();
    expect(() => run(r)).toThrow(BattleUnsupportedState); expect(r.s.mem).toEqual(before);
    expect(battleScreenFor(r.s)).toBe(bound);
  });
  it('rejects a previously created lazy screen instead of silently refreshing it', () => {
    const r = rig(); const lazy = battleScreenFor(r.s);
    expect(lazy).not.toBe(r.screen); expect(() => run(r)).toThrow('different battle screen already bound');
  });
});

it('executePlayerMove without a host refreshes the passed screen BG0 on refresh frames 7-9', () => {
  const r = rig(), screen = r.screen;
  r.s.wPlayerSelectedMove = 1; r.s.wBattleMonStatus = 2;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) { screen.put(x, y, 'A'); screen.putBg(x, y, 'Z'); }
  for (let i = 0; i < 3; i++) screen.vblank();
  const shown = screen.visibleCells, stages: number[][] = [];
  const out = finish(executePlayerMove(r.s, screen, r.host, r.ports), () => {
    screen.vblank(); stages.push([screen.transferDestination, textBgTransfer.enabled ? 1 : 0]);
    expect(screen.visibleCells).toEqual(shown);
    const elapsed = stages.length;
    expect(screen.bgAt(0, 0)).toBe(elapsed < 10 ? 'Z' : ' ');
    expect(screen.bgAt(0, 6)).toBe(elapsed < 11 ? 'Z' : ' ');
    expect(screen.bgAt(0, 12)).toBe(elapsed < 12 ? 'Z' : ' ');
  });
  expect(out.result).toEqual({ b: 1, exit: 'done' }); expect(out.frames).toHaveLength(15);
  expect(stages.slice(9, 12)).toEqual(Array(3).fill([0x98, 1]));
  expect(battleScreenFor(r.s)).toBe(screen); expect(screen.transferDestination).toBe(0x9c);
});
