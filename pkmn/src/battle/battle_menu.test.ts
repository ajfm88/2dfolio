import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPassPressed, isHeld } from '../input';
import type { GameButton } from '../core';
import { BattleMenuScreen } from './battle_menu_screen';
import { bagWasSelected, battleMenuRunWasSelected, cartridgeRunOdds, displayBattleMenu,
  drawBattleMenuTemplate, drawHudsAndHpBars, tryRunningFromBattle, useBagItem } from './battle_menu';
import { delayFrames } from './battle_menu_context';
import type { BattleActionContext, BattleActionHost, BattleMenuFlags, Program } from './battle_menu_context';
import { setBattleAndStartSavedMenuItem, getBattleAndStartSavedMenuItem, setBagSavedMenuItem,
  getBagSavedMenuItem, setListScrollOffset, getListScrollOffset, resetListStateForEmptySlot } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { textBoxBorder } from '../menus/tile_surface';
import { lowHealthAlarm, setLowHealthAlarm, setLowHealthAlarmDisabled } from '../audio/low_health_alarm';
import { getNoTextDelay, setNoTextDelay } from '../text/text_flags';
import { MENU_CURSOR_FRAMES, LIST_FROZEN_FRAMES, LIST_DRAW_FRAMES, LIST_CURSOR_FRAMES } from './catch_demo';
vi.mock('../input', () => ({ isPassPressed: vi.fn(() => false), isHeld: vi.fn(() => false), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../text/program_data', () => ({ getTextPrograms: () => ({
  CP4Text: [{ op: 'text', text: 'HI<DONE>' }],
}) }));

function context(): BattleActionContext {
  return { moveMenuType: 0, battleMoves: [1, 0, 0, 0], battlePP: [5, 0, 0, 0], enemyMoves: [1, 0, 0, 0],
    party: [{ moves: [1, 0, 0, 0], pp: [5, 0, 0, 0] }], playerMonNumber: 0, whichPokemon: 0,
    playerMoveListIndex: 0, menuItemToSwap: 0, currentMenuItem: 0, numMovesMinusOne: 0, movesString: '',
    playerDisabledMove: 0, transformed: false, playerSelectedMove: 0, playerMove: null, moveData: null,
    maxPP: 0, battleMenuCurrentPP: 0, whoseTurn: 0, monDataLocation: 0, usingPPUp: 0, ppUpCountAndMaxPP: 0,
    cursor: { topX: 0, topY: 0, item: 0, lastItem: 0, tileBehind: ' ', location: null },
    battleType: 0, isInBattle: 1, ghostBattle: false, numRunAttempts: 7, actionResultOrTookBattleTurn: 0,
    battleResult: 0, forcePlayerToChooseMon: 0, capturedMonSpecies: 0, escapedFromBattle: 0,
    usingTrappingMove: false, playerNumAttacksLeft: 0, numSafariBalls: 30,
    playerName: [0x80, 0x81, 0x82, 0x50, 1, 2, 3, 4, 5, 6, 7], linkEnemyTrainerName: [],
    playerSpeed: 30, enemySpeed: 20, curItem: '', itemIndex: 0, itemName: '', pseudoItemID: 7,
    menuWatchMovingOutOfBounds: 0, joy7: 0, bag: [{ id: 'POTION', count: 2 }],
    playerHud: { nickname: 'PIKACHU', level: 5, status: 0, hp: 30, maxHp: 30, barColor: 0, alarm: 0, alarmDisabled: false },
    enemyHud: { nickname: 'PIDGEY', level: 3, status: 0, hp: 20, maxHp: 20, barColor: 0 },
    partySpecies: 25, enemySpecies2: 16 };
}
type Routine = (ctx: BattleActionContext, host: BattleActionHost) => Program<BattleMenuFlags | null | void>;
function rig(ctx = context(), routine: Routine = displayBattleMenu, portion = 0,
  item?: (ctx: BattleActionContext) => void) {
  const video = new BattleMenuScreen(), screen = video.screen;
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  for (let i = 0; i < portion; i++) video.vblank();
  let frame = 0, keys: GameButton[] = [];
  const calls: { name: string; at: number; action: number; result: number; item: string }[] = [];
  const reads: number[] = [], sounds: number[] = [], frames: string[] = [];
  const saved2: (readonly import('./battle_screen').BattleCell[])[] = [];
  const busy: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0 };
  const event = (name: string) => calls.push({ name, at: frame, action: ctx.actionResultOrTookBattleTurn, result: ctx.battleResult, item: ctx.curItem });
  const host: BattleActionHost = {
    screen, tiles: video.tiles,
    readJoypad() { reads.push(frame); vi.mocked(isPassPressed).mockImplementation(k => keys.includes(k)); vi.mocked(isHeld).mockImplementation(k => keys.includes(k)); },
    pressSound() { sounds.push(frame); busy[5] = frame + 17; },
    printText: function* (program) {
      event(program);
      if (program === 'PrintEmptyString.emptyString') { textBoxBorder(video.tiles, 0, 12, 4, 18); yield* delayFrames(3); }
      else {
        yield* delayFrames(2);
        if (program === 'GotAwayText') { yield* host.waitForSound(); host.pressSound(); }
      }
    },
    loadScreenTilesFromBuffer1() { event('load1'); video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer1() { event('save1'); video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer2() { event('load2'); video.loadScreenTilesFromBuffer2(); },
    saveScreenTilesToBuffer2() { event('save2'); saved2.push(screen.cells); video.saveScreenTilesToBuffer2(); },
    useItem: function* () { event('use'); if (item) item(ctx); else ctx.actionResultOrTookBattleTurn = 1; },
    partyMenu: function* () { event('party'); return { carry: false }; },
    playSound(name) { event(name); if (name === 'run') busy[8] = frame + 40; },
    waitForSound: function* () { event('wait'); while (!(lowHealthAlarm() & 0x80) && [5, 6, 8].some(ch => busy[ch] > frame)) yield 'serviced'; },
    runOdds: vi.fn(cartridgeRunOdds),
  };
  let program: ReturnType<Routine> | undefined, step: IteratorResult<import('./battle_menu_context').Frame, BattleMenuFlags | null | void>;
  const start = () => { program = routine(ctx, host); step = program.next(); };
  const tick = (...input: GameButton[]) => {
    keys = input; frame++;
    if (!step.done) { frames.push(step.value); if (step.value === 'serviced') video.vblank(); step = program!.next(); }
  };
  const advance = (n: number) => { for (let i = 0; i < n; i++) tick(); };
  const row = (y: number, shown = false) => Array.from({ length: 20 }, (_, x) => String((shown ? screen.visibleAt(x, y) : screen.at(x, y)) ?? ' ')).join('');
  return { ctx, host, video, screen, calls, reads, sounds, frames, busy, saved2, start, tick, advance, row,
    get frame() { return frame; }, get done() { return step.done; }, get result() { return step.value; } };
}

beforeEach(() => {
  vi.restoreAllMocks(); vi.mocked(isPassPressed).mockReturnValue(false); vi.mocked(isHeld).mockReturnValue(false);
  setBattleAndStartSavedMenuItem(0); resetListStateForEmptySlot();
  setLowHealthAlarm(0); setLowHealthAlarmDisabled(false); setNoTextDelay(false);
});

describe('DisplayBattleMenu entry, columns and dispatch', () => {
  for (const trainer of [false, true]) for (const h of [0, 5, 10]) it(`normal ${trainer ? 'trainer' : 'wild'}, H=${h}: first read and unmerged palette order`, () => {
    const ctx = context(); ctx.isInBattle = trainer ? 2 : 1;
    if (h) ctx.playerHud.hp = 1; if (h === 10) ctx.enemyHud.hp = 1;
    const r = rig(ctx); r.start();
    r.advance(h + 5); expect(r.reads).toEqual([]); r.tick();
    expect(r.reads).toEqual([h + 6]); expect(r.frames.filter(f => f === 'held')).toHaveLength(h / 5 * 2);
    expect(r.row(14).slice(8)).toBe('│▶FIGHT \uE001\uE002 │');
    expect(r.row(16).slice(8)).toBe('│ ITEM  RUN│');
    r.tick('a'); expect(r.result).toEqual({ carry: false }); expect(ctx.numRunAttempts).toBe(0);
  });

  it('H=10 applies the player palette before alarm and enemy draw, then requests the enemy palette', () => {
    const ctx = context(); ctx.playerHud.hp = ctx.enemyHud.hp = 1;
    const r = rig(ctx, drawHudsAndHpBars); r.start();
    expect(ctx.playerHud.barColor).toBe(2); expect(ctx.enemyHud.barColor).toBe(0);
    expect(lowHealthAlarm()).toBe(0); expect(r.screen.at(1, 0)).toBe(' ');
    r.advance(4); expect(lowHealthAlarm()).toBe(0);
    r.tick(); expect(lowHealthAlarm() & 0x80).toBe(0x80); expect(ctx.enemyHud.barColor).toBe(2);
    expect(r.screen.paletteName(1)).toBe('REDBAR'); r.advance(5); expect(r.done).toBe(true);
    expect(r.frames).toEqual(['held', 'held', 'serviced', 'serviced', 'serviced', 'held', 'held', 'serviced', 'serviced', 'serviced']);
  });

  for (const type of [2, 3] as const) for (const h of [0, 5, 10]) it(`special type${type} skips normal H=${h} and reads at3`, () => {
    const ctx = context(); ctx.battleType = type;
    if (h) ctx.playerHud.hp = 1; if (h === 10) ctx.enemyHud.hp = 1;
    const r = rig(ctx); r.start(); r.advance(2); expect(r.reads).toEqual([]); r.tick(); expect(r.reads).toEqual([3]);
    expect(ctx.playerHud.barColor).toBe(0);
    if (type === 2) { expect(r.row(14).slice(2, 9)).toBe('BALL×30'); expect(r.row(16).slice(2, 17)).toBe('THROW ROCK  RUN'); }
  });

  it('A+RIGHT and A+LEFT change columns before accepting A and preserve the row', () => {
    const r = rig(); r.start(); r.advance(5); r.tick('a', 'right');
    expect(r.done).toBe(false); expect(r.screen.at(15, 14)).toBe('▶'); expect(getBattleAndStartSavedMenuItem()).toBe(0);
    r.advance(2); r.tick('a', 'left'); expect(r.screen.at(9, 14)).toBe('▶');
    r.advance(2); r.tick('down'); expect(r.ctx.currentMenuItem).toBe(1);
    r.advance(2); r.tick('right'); expect(r.screen.at(15, 16)).toBe('▶'); expect(r.screen.at(9, 16)).toBe(' ');
    expect(r.sounds).toEqual([6, 9]);
  });

  it('B and out-of-range UP rearm Delay3 without accepting a choice', () => {
    const r = rig(); r.start(); r.advance(5); r.tick('b'); r.advance(2); r.tick('up');
    expect(r.ctx.currentMenuItem).toBe(0); expect(r.done).toBe(false); r.advance(2); r.tick('a');
    expect(r.reads).toEqual([6, 9, 12]); expect(r.sounds).toEqual([12]);
  });

  it('raw PKMN position2 is saved for START and dispatches party id1 at the stored arrow address', () => {
    setBattleAndStartSavedMenuItem(2);
    const r = rig(); r.start(); r.advance(5); r.tick('a');
    expect(getBattleAndStartSavedMenuItem()).toBe(2); expect(r.calls.some(c => c.name === 'party')).toBe(true);
    expect(r.screen.at(15, 14)).toBe('▷'); expect(r.screen.at(15, 18)).toBe(null);
  });

  for (const [raw, item] of [[0, 'SAFARI_BALL'], [1, 'SAFARI_ROCK'], [2, 'SAFARI_BAIT']] as const) it(`Safari position${raw} routes ${item} without ID swap`, () => {
    const ctx = context(); ctx.battleType = 2; ctx.usingTrappingMove = true; ctx.playerNumAttacksLeft = 2;
    setBattleAndStartSavedMenuItem(raw); const r = rig(ctx); r.start(); r.advance(2); r.tick('a');
    expect(r.calls.find(c => c.name === 'use')?.item).toBe(item); expect(getBattleAndStartSavedMenuItem()).toBe(raw);
    r.advance(6); expect(r.result).toEqual({ carry: false }); expect(ctx.playerNumAttacksLeft).toBe(2);
    expect(r.calls.filter(c => c.name === 'load1')).toHaveLength(1);
  });

  it('unused RUN type rejects PKMN position2 with RunAwayText and preserves seeded byte0', () => {
    const ctx = context(); ctx.battleType = 3;
    const r = rig(ctx); r.start(); r.advance(2); r.tick('right'); r.advance(2); r.tick('a');
    expect(r.calls.some(c => c.name === 'DisplayBattleMenu.RunAwayText')).toBe(true);
    r.advance(5); expect(r.done).toBe(false); expect(getBattleAndStartSavedMenuItem()).toBe(0);
  });
});

describe('battle bag and simulated input', () => {
  for (const type of [1, 4] as const) for (const h of [0, 5, 10]) it(`demo type${type}/H${h}: 20/20/10/3/20, no reads/beeps, name copy and saved-byte preservation`, () => {
    const ctx = context(); ctx.battleType = type; const name = [...ctx.playerName];
    if (h) ctx.playerHud.hp = 1; if (h === 10) ctx.enemyHud.hp = 1;
    setBattleAndStartSavedMenuItem(3);
    const r = rig(ctx, displayBattleMenu, 0, c => { c.actionResultOrTookBattleTurn = 1; c.capturedMonSpecies = 25; });
    r.start(); expect(ctx.linkEnemyTrainerName).toEqual(name);
    expect(ctx.playerName).toEqual(type === 1 ? [0x8e,0x8b,0x83,0x7f,0x8c,0x80,0x8d,0x50,0x8f,0x91,0x8e]
      : [0x8f,0x91,0x8e,0x85,0xe8,0x8e,0x80,0x8a,0x50,0xfa,0x2d]);
    r.advance(MENU_CURSOR_FRAMES); expect(r.screen.at(9, 16)).toBe('▶');
    r.advance(MENU_CURSOR_FRAMES); expect(r.screen.at(9, 16)).toBe(' '); // logical Buffer1/list, not scanout
    expect(r.screen.visibleAt(9, 16)).toBe('▶');
    expect(r.saved2[0][9 + 16 * 20]).toBe('▷');
    r.advance(LIST_FROZEN_FRAMES + LIST_DRAW_FRAMES); expect(r.screen.at(5, 4)).toBe('▶');
    r.advance(LIST_CURSOR_FRAMES); expect(r.calls.find(c => c.name === 'use')?.at).toBe(73);
    expect(ctx.curItem).toBe('POKE_BALL'); expect(ctx.itemIndex).toBe(0);
    r.advance(6); expect(r.result).toEqual({ carry: true }); expect(ctx.capturedMonSpecies).toBe(0);
    expect(r.reads).toEqual([]); expect(r.sounds).toEqual([]); expect(getBattleAndStartSavedMenuItem()).toBe(3);
    expect(ctx.joy7).toBe(0); expect(ctx.menuWatchMovingOutOfBounds).toBe(0); expect(getNoTextDelay()).toBe(false);
  });

  for (const p of [0, 1, 2]) it(`phase${p}: frozen visible filled ITEM versus Buffer2's unfilled cursor, empty box after list draw`, () => {
    setBattleAndStartSavedMenuItem(1); const r = rig(context(), displayBattleMenu, p); r.start(); r.advance(5); r.tick('a');
    const old = r.screen.visibleCells; expect(r.screen.visibleAt(9, 16)).toBe('▶');
    r.advance(10); expect(r.screen.visibleCells).toEqual(old);
    r.advance(3); expect(r.row(16, true).includes('ITEM')).toBe(false);
    expect(r.row(16, true)).toBe('│                  │');
    r.advance(3); r.tick('b'); expect(r.ctx.joy7).toBe(0); expect(r.ctx.menuWatchMovingOutOfBounds).toBe(0);
    r.advance(6); expect(r.screen.at(9, 16)).toBe('▶'); expect(r.done).toBe(false);
  });

  it('retains bag row/scroll after cancellation and clears swap/watch/repeat flags', () => {
    const ctx = context(); ctx.bag = Array.from({ length: 5 }, () => ({ id: 'POTION', count: 1 }));
    setBagSavedMenuItem(1); setListScrollOffset(2);
    const r = rig(ctx, bagWasSelected); r.start(); r.advance(15); r.tick('b');
    expect(r.result).toBe(null); expect(getBagSavedMenuItem()).toBe(1); expect(getListScrollOffset()).toBe(2);
    expect(ctx.menuItemToSwap).toBe(0); expect(ctx.menuWatchMovingOutOfBounds).toBe(0); expect(ctx.joy7).toBe(0);
  });

  it('failed use copies HUD tiles2 then reopens the list without a battle-menu redraw', () => {
    const r = rig(context(), bagWasSelected, 0, () => {}); r.start(); r.advance(15); r.tick('a');
    expect(r.calls.filter(c => c.name === 'use')).toHaveLength(1); r.advance(2);
    expect(textBgTransfer.enabled).toBe(false); expect(r.ctx.joy7).toBe(1);
    r.advance(15); r.tick('b'); expect(r.result).toBe(null);
    expect(r.calls.filter(c => c.name === 'load1').map(c => c.at)).toEqual([0, 18]);
  });

  it('A on CANCEL saves its row without using an item and clears all exit flags', () => {
    setBagSavedMenuItem(1);
    const r = rig(context(), bagWasSelected); r.start(); r.advance(15); r.tick('a');
    expect(r.result).toBe(null); expect(getBagSavedMenuItem()).toBe(1);
    expect(r.calls.some(c => c.name === 'use')).toBe(false);
    expect([r.ctx.menuItemToSwap, r.ctx.menuWatchMovingOutOfBounds, r.ctx.joy7]).toEqual([0, 0, 0]);
    expect(getNoTextDelay()).toBe(false);
  });

  for (const h of [0, 5, 10]) it(`bag choice with H=${h} clears exit flags and has the two-copy plus H+3 noncapture tail`, () => {
    const ctx = context();
    const r = rig(ctx, bagWasSelected, 0, c => {
      c.actionResultOrTookBattleTurn = 1;
      if (h) c.playerHud.hp = 1;
      if (h === 10) c.enemyHud.hp = 1;
    });
    r.start(); r.advance(15); r.tick('a');
    expect(ctx.curItem).toBe('POTION'); expect(ctx.itemIndex).toBe(0); expect(ctx.itemName).toBe('POTION');
    expect([ctx.menuItemToSwap, ctx.menuWatchMovingOutOfBounds, ctx.joy7]).toEqual([0, 0, 0]);
    expect(getNoTextDelay()).toBe(false);
    r.advance(4 + h); expect(r.done).toBe(false); r.tick();
    expect(r.result).toEqual({ carry: false }); expect(ctx.currentMenuItem).toBe(0);
    expect(r.screen.bgp).toBe(0xe4); expect(r.screen.obp0).toBe(0xd0);
  });

  it('SELECT swaps battle bag entries through the unchanged list path before cancellation', () => {
    const ctx = context(); ctx.bag.push({ id: 'ANTIDOTE', count: 1 });
    const r = rig(ctx, bagWasSelected); r.start(); r.advance(15); r.tick('select');
    r.advance(25); r.tick('down'); r.advance(2); r.tick('select'); r.advance(23);
    expect(ctx.bag.map(e => e.id)).toEqual(['ANTIDOTE', 'POTION']);
    r.advance(2); r.tick('b'); expect(r.result).toBe(null); expect(ctx.menuItemToSwap).toBe(0);
  });

  for (const attacks of [1, 2, 0]) it(`successful item decrements trapping counter ${attacks} with byte semantics and noncapture tail5`, () => {
    const ctx = context(); ctx.usingTrappingMove = true; ctx.playerNumAttacksLeft = attacks; ctx.curItem = 'POTION';
    const r = rig(ctx, useBagItem); r.start(); r.advance(1); expect(ctx.playerNumAttacksLeft).toBe(attacks);
    r.tick(); expect(ctx.playerNumAttacksLeft).toBe((attacks - 1) & 255); expect(ctx.usingTrappingMove).toBe(attacks !== 1);
    r.advance(3); expect(r.result).toEqual({ carry: false }); expect(ctx.currentMenuItem).toBe(0); expect(ctx.pseudoItemID).toBe(0);
  });

  it('capture clears species and returns carry/result2 immediately after the two-copy tail', () => {
    const ctx = context(); ctx.curItem = 'POKE_BALL';
    const r = rig(ctx, useBagItem, 0, c => { c.actionResultOrTookBattleTurn = 1; c.capturedMonSpecies = 16; });
    r.start(); r.advance(1); expect(r.done).toBe(false); r.tick(); expect(r.result).toEqual({ carry: true });
    expect(ctx.battleResult).toBe(2); expect(ctx.capturedMonSpecies).toBe(0); expect(r.calls.some(c => c.name === 'load1')).toBe(false);
  });

  it('an item port emptying a stack resets saved bag bytes before failed-use reopen', () => {
    setBagSavedMenuItem(1); setListScrollOffset(1);
    const ctx = context(); ctx.bag = Array.from({ length: 4 }, () => ({ id: 'POTION', count: 1 }));
    const r = rig(ctx, bagWasSelected, 0, () => resetListStateForEmptySlot()); r.start(); r.advance(15); r.tick('a'); r.advance(6);
    expect(getBagSavedMenuItem()).toBe(0); expect(getListScrollOffset()).toBe(0);
  });
});

describe('RUN control flow and sound ports', () => {
  for (const kind of ['ghost', 'safari', 'run-type'] as const) it(`${kind} escapes before trainer/odds and clears wrapper force flag`, () => {
    const ctx = context(); ctx.isInBattle = 2; ctx.forcePlayerToChooseMon = 1;
    if (kind === 'ghost') ctx.ghostBattle = true; else ctx.battleType = kind === 'safari' ? 2 : 3;
    const r = rig(ctx, battleMenuRunWasSelected); r.start(); r.advance(80);
    expect(r.result).toEqual({ carry: true }); expect(ctx.forcePlayerToChooseMon).toBe(0);
    expect(ctx.numRunAttempts).toBe(7); expect(r.host.runOdds).not.toHaveBeenCalled();
  });

  it('trainer RUN does not consume the turn, saves after text, and returns to battle menu', () => {
    const ctx = context(); ctx.isInBattle = 2; setBattleAndStartSavedMenuItem(3);
    const r = rig(ctx); r.start(); r.advance(5); r.tick('a');
    expect(r.calls.find(c => c.name === 'NoRunningText')?.action).toBe(0);
    r.advance(2); expect(ctx.forcePlayerToChooseMon).toBe(0); expect(ctx.actionResultOrTookBattleTurn).toBe(0);
    r.advance(6); expect(r.reads).toEqual([6, 14]); expect(r.done).toBe(false);
  });

  it('wild failure sets action result before text, uses the byte attempt once, and resets force flag', () => {
    const ctx = context(); const r = rig(ctx, battleMenuRunWasSelected); vi.mocked(r.host.runOdds).mockReturnValue(false);
    r.start(); expect(r.calls.find(c => c.name === 'CantEscapeText')?.action).toBe(1);
    expect(r.host.runOdds).toHaveBeenCalledWith(30, 20, 8); r.advance(2);
    expect(r.result).toEqual({ carry: false }); expect(ctx.forcePlayerToChooseMon).toBe(0);
  });

  it('attempt255 wraps to byte0; run.ts receives the 256-attempt meaning without a second increment', () => {
    const ctx = context(); ctx.numRunAttempts = 255; ctx.playerSpeed = 1; ctx.enemySpeed = 100;
    const r = rig(ctx, tryRunningFromBattle); r.start(); expect(ctx.numRunAttempts).toBe(0);
    expect(r.host.runOdds).toHaveBeenCalledWith(1, 100, 0); r.advance(80); expect(r.result).toEqual({ carry: true });
    expect(cartridgeRunOdds(1, 100, 0)).toBe(true);
  });

  it('success waits for selecting beep, RUN, prompt beep, then saves with carry', () => {
    setBattleAndStartSavedMenuItem(3); const r = rig(); r.start(); r.advance(5); r.tick('a');
    expect(r.ctx.battleResult).toBe(2); expect(r.calls.some(c => c.name === 'run')).toBe(false);
    r.advance(17); expect(r.calls.find(c => c.name === 'run')?.at).toBe(23);
    r.advance(40); expect(r.sounds).toEqual([6, 63]); expect(r.done).toBe(false);
    r.advance(16); expect(r.done).toBe(false); r.tick(); expect(r.result).toEqual({ carry: true });
    expect(r.calls.filter(c => ['run', 'GotAwayText', 'wait'].includes(c.name)).map(c => [c.name, c.at]))
      .toEqual([['wait', 6], ['run', 23], ['GotAwayText', 23], ['wait', 25], ['wait', 63]]);
    expect(r.calls[r.calls.length - 1].name).toBe('save1');
  });

  it('wait port ignores channel7 but waits for channel6/8, and alarm bit7 bypasses all waits', () => {
    const ctx = context(); ctx.ghostBattle = true; const r = rig(ctx, tryRunningFromBattle);
    r.busy[7] = 999; r.busy[6] = 4; r.start(); r.advance(3); expect(r.calls.some(c => c.name === 'run')).toBe(false);
    r.tick(); expect(r.calls.find(c => c.name === 'run')?.at).toBe(4);
    setLowHealthAlarm(0x80); r.advance(2); expect(r.result).toEqual({ carry: true }); expect(r.frame).toBe(6);
    expect(r.busy[8]).toBeGreaterThan(r.frame);
  });
});

describe('standalone PrintText commit and subsequent template', () => {
  for (const portion of [0, 1, 2]) it(`phase${portion}: completed text dismisses without erasing committed cells or repainting a later template`, () => {
    let returned = -1;
    const r = rig(context(), function* (ctx, host) {
      yield* host.printText('CP4Text');
      expect(host.screen.at(1, 14)).toBe('H'); expect(host.screen.at(2, 14)).toBe('I');
      returned = r.frame;
      drawBattleMenuTemplate(ctx, host);
      yield* delayFrames(9);
    }, portion);
    r.host.printText = r.video.printText.bind(r.video); r.start();
    for (let i = 0; i < 200 && !r.done; i++) r.tick();
    expect(r.done).toBe(true); expect(returned).toBeGreaterThanOrEqual(3);
    expect(r.video.textBox.active).toBe(false);
    expect(r.screen.at(10, 14)).toBe('F'); expect(r.screen.visibleAt(10, 14)).toBe('F');
    expect(r.screen.visibleAt(1, 14)).toBe('H');
  });
});
