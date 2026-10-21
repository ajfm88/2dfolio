import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { window: { addEventListener() {} } }); });
vi.mock('../input', () => ({ isPressed: vi.fn(() => false), isPassPressed: vi.fn(() => false),
  isHeld: vi.fn(() => false), readJoypad: vi.fn(), syncJoypadRead: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true, setMasterVolume: vi.fn() }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawFadeOverlay: vi.fn(), drawTile: vi.fn(),
  getCtx: () => ({ drawImage() {} }), getScale: () => 1, getMonsterPalette: () => 'MEWMON',
  loadFont: async () => ({ width: 128 }), loadTileset: async () => ({ width: 128 }),
  loadBattleSprite: vi.fn(async () => ({ width: 40, height: 40 })) }));
vi.mock('../menus/party_icons', () => ({ loadPartyIcons: vi.fn(), drawPartyIcon: vi.fn() }));
vi.mock('../menus/menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn(), drawScreenTile: vi.fn() }));

import { PartyMenu } from '../menus/party_menu';
import { drawScreenTile } from '../menus/menu_render';
import { StatusScreenSession, loadStatusScreenAssets } from '../menus/status_screen';
import { createPokemon, loadBattleData } from './data';
import { loadTextPrograms } from '../text/program_data';
import { initTextSystem } from '../text/textbox';
import { isPassPressed, isHeld, syncJoypadRead } from '../input';
import { enablePikachuFollowing, disablePikachuFollowing } from '../pikachu/pikachu_following';
import { getPartyAndBillsSavedMenuItem, setPartyAndBillsSavedMenuItem, setBattleAndStartSavedMenuItem } from '../list_state';
import { textBgTransfer } from '../text/bg_transfer';
import { BattleMenuScreen } from './battle_menu_screen';
import { bindBattlePartyMenu, clearBattlePartySubmenu, drawBattlePartySubmenu, partyMenuOrRockOrRun } from './battle_party_menu';
import type { BattlePartyContext, BattlePartyHost } from './battle_party_menu';
import type { Frame, Program, BattleMenuFlags } from './battle_menu_context';
import type { GameButton } from '../core';
import { displayBattleMenu, drawBattleMenuTemplate } from './battle_menu';

function context(): BattlePartyContext {
  const partyMons = [createPokemon('PIKACHU', 5)!, createPokemon('PIDGEY', 6)!];
  return { moveMenuType: 0, battleMoves: [1, 0, 0, 0], battlePP: [5, 0, 0, 0], enemyMoves: [1, 0, 0, 0],
    party: partyMons.map(m => ({ moves: m.moves.map((_, i) => i + 1), pp: m.moves.map(m => m.pp) })),
    playerMonNumber: 0, whichPokemon: 0, playerMoveListIndex: 0, menuItemToSwap: 0, currentMenuItem: 0,
    numMovesMinusOne: 0, movesString: '', playerDisabledMove: 0, transformed: false,
    playerSelectedMove: 0, playerMove: null, moveData: null, maxPP: 0, battleMenuCurrentPP: 0,
    whoseTurn: 0, monDataLocation: 0, usingPPUp: 0, ppUpCountAndMaxPP: 0,
    cursor: { topX: 0, topY: 0, item: 0, lastItem: 0, tileBehind: ' ', location: null },
    battleType: 0, isInBattle: 1, ghostBattle: false, numRunAttempts: 0, actionResultOrTookBattleTurn: 0,
    battleResult: 0, forcePlayerToChooseMon: 0, capturedMonSpecies: 0, escapedFromBattle: 0,
    usingTrappingMove: false, playerNumAttacksLeft: 0, numSafariBalls: 30, playerName: [], linkEnemyTrainerName: [],
    playerSpeed: 30, enemySpeed: 20, curItem: '', itemIndex: 0, itemName: '', pseudoItemID: 0,
    menuWatchMovingOutOfBounds: 0, joy7: 0, bag: [],
    playerHud: { nickname: 'PIKACHU', level: 5, status: 0, hp: 30, maxHp: 30, barColor: 0, alarm: 0, alarmDisabled: false },
    enemyHud: { nickname: 'PIDGEY', level: 3, status: 0, hp: 20, maxHp: 20, barColor: 0 },
    partySpecies: 25, enemySpecies2: 16, partyMons, battleMonNick: 'ACTIVE', firstMonsNotOutYet: 0,
    enemyHasSubstitute: false, enemyMinimized: false, enemySpecies: 16, enemyPicture: 'enemy',
    curPartySpecies: 0, curSpecies: 0, battleMonSpecies2: 0 };
}

function keys(...pressed: GameButton[]): void {
  vi.mocked(isPassPressed).mockImplementation(k => pressed.includes(k));
  vi.mocked(isHeld).mockImplementation(k => pressed.includes(k));
}
beforeAll(async () => { await loadBattleData(); await loadTextPrograms(); await initTextSystem(); await loadStatusScreenAssets(); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); keys(); enablePikachuFollowing();
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setPartyAndBillsSavedMenuItem(0); setBattleAndStartSavedMenuItem(0);
});

// A direct party caller handles its tail jump, like the production DisplayBattleMenu loop.
function* partyThenRedisplay(ctx: BattlePartyContext, host: BattlePartyHost): Program<BattleMenuFlags> {
  const result = yield* partyMenuOrRockOrRun(ctx, host);
  if (result) return result;
  return yield* displayBattleMenu(ctx, host);
}
function rig(ctx = context(), portion = 0, routine: (ctx: BattlePartyContext, host: BattlePartyHost) => Program<BattleMenuFlags | null> = partyThenRedisplay) {
  const video = new BattleMenuScreen(), party = new PartyMenu();
  for (let p = 0; p < portion; p++) video.vblank();
  const calls: { name: string; at: number; action: number; bgp: number }[] = [];
  const reads: number[] = [], frames: Frame[] = [];
  let time = 0;
  const record = (name: string) => calls.push({ name, at: time, action: ctx.actionResultOrTookBattleTurn, bgp: video.screen.bgp });
  const host: BattlePartyHost = {
    screen: video.screen, tiles: video.tiles, partyView: party, statusView: null,
    readJoypad() { reads.push(time); }, pressSound() { record('beep'); },
    loadScreenTilesFromBuffer1() { record('load1'); video.loadScreenTilesFromBuffer1(); },
    saveScreenTilesToBuffer1() { record('save1'); video.saveScreenTilesToBuffer1(); },
    loadScreenTilesFromBuffer2() { record('load2'); video.loadScreenTilesFromBuffer2(); },
    saveScreenTilesToBuffer2() { record('save2'); video.saveScreenTilesToBuffer2(); },
    printText: video.printText.bind(video),
    useItem: function* () {}, partyMenu: function* () { return { carry: false }; },
    playSound() {}, waitForSound: function* () {}, runOdds: () => true,
    loadEnemyPicVariant: function* (kind) {
      record(kind); for (let n = 0; n < (kind === 'substitute' ? 10 : 13); n++) yield 'serviced';
    },
    switchPlayerMon: function* () { record('switch'); ctx.currentMenuItem = 2; },
  };
  bindBattlePartyMenu(ctx, host);
  // Caller has already saved the logical unfilled PKMN menu into Buffer2.
  drawBattleMenuTemplate(ctx, host); video.screen.put(15, 14, '▷'); video.saveScreenTilesToBuffer2();
  let step: IteratorResult<Frame, BattleMenuFlags | null>;
  const program = routine(ctx, host);
  const tick = (...pressed: GameButton[]) => {
    keys(...pressed); time++;
    if (step.done) throw new Error('program already returned');
    const kind = step.value; frames.push(kind);
    if (kind === 'serviced') video.vblank();
    // 'session' is advanced by the party/status frame, 'held' advances no interrupt.
    step = program.next();
  };
  const advance = (n: number) => { for (let i = 0; i < n; i++) tick(); };
  const choose = () => { advance(21); tick('a'); };
  step = program.next();
  return { ctx, host, video, party, calls, reads, frames, tick, advance, choose,
    get time() { return time; }, get done() { return step.done; }, get result() { return step.value; } };
}

describe('PartyMenu choose-only mode, shared #73 timing', () => {
  for (const phase of [0, 1, 2]) it(`phase${phase}: C+22 first read (cartridge C+24), one BG tick each frame`, () => {
    const r = rig(undefined, phase), tick = vi.spyOn(textBgTransfer, 'tick');
    for (let f = 1; f <= 22; f++) {
      const n = tick.mock.calls.length; r.tick(); expect(tick.mock.calls.length - n).toBe(1);
      expect(r.party.paletteWhite).toBe(f < 19);
      expect(r.reads).toEqual(f < 22 ? [] : [22]);
    }
    expect(syncJoypadRead).not.toHaveBeenCalled();
  });

  it('wraps both ways, A suppresses movement, saves on A and presents no legacy submenu', () => {
    const r = rig(); r.advance(21); r.tick('up'); r.advance(2); r.tick('a', 'down');
    expect(r.ctx.whichPokemon).toBe(1); expect(getPartyAndBillsSavedMenuItem()).toBe(1);
    expect(r.party.chosenIndex).toBe(1); expect(r.party.cursorGlyph).toBe('▷');
    expect(r.party.choiceOverlay.at(13, 12)).toBe('S');
  });

  it('saves B cursor, and B wins A+B even when forceChoose watches only A', () => {
    const ctx = context(); ctx.forcePlayerToChooseMon = 1; setPartyAndBillsSavedMenuItem(1);
    const r = rig(ctx); expect(ctx.forcePlayerToChooseMon).toBe(0);
    r.advance(21); r.tick('b'); expect(r.calls.some(c => c.name === 'load2')).toBe(false);
    expect(r.party.chosenIndex).toBe(-1); r.advance(2); r.tick('a', 'b');
    expect(getPartyAndBillsSavedMenuItem()).toBe(1); expect(r.party.chosenIndex).toBe(-1);
    r.advance(11); expect(r.calls.find(c => c.name === 'load2')?.at).toBe(31);
  });

  it('sleeping starter uses the shared refusal and returns cancelled after its PrintText', () => {
    disablePikachuFollowing(); const r = rig();
    const print = vi.spyOn(Object.getPrototypeOf(r.party['openingTextBox']), 'printStandalone');
    r.choose(); expect(r.calls.some(c => c.name === 'load2')).toBe(false);
    expect(r.party.cursorGlyph).toBe('▶');
    expect(print).toHaveBeenCalledWith({ program: 'PartyMenuText_12cc' }, { noDelay: false });
    for (let n = 0; n < 500 && !r.calls.some(c => c.name === 'load2'); n++) { if (n % 8 === 0) r.tick('b'); else r.tick(); }
    expect(r.calls.some(c => c.name === 'load2')).toBe(true); expect(r.ctx.actionResultOrTookBattleTurn).toBe(0);
    expect(getPartyAndBillsSavedMenuItem()).toBe(0);
  });

  it('Down wraps from the saved last row and B saves the new row', () => {
    setPartyAndBillsSavedMenuItem(1); const r = rig(); r.advance(21); r.tick('down');
    r.advance(2); r.tick('b'); expect(getPartyAndBillsSavedMenuItem()).toBe(0);
    expect(r.party.chosenIndex).toBe(-1); expect(r.party.cursorGlyph).toBe('▷');
  });
});

describe('party submenu cells, deselection, quit and switch', () => {
  for (const phase of [0, 1, 2]) it(`phase${phase}: completed refusal stays shown through HP-copy4, then releases on the next bottom third`, () => {
    const r = rig(undefined, phase); r.choose(); r.advance(2); r.tick('a');
    for (let n = 0; n < 500 && r.party.choiceOverlay.at(0, 12) !== ' '; n++) {
      if (n % 8 === 0) r.tick('b'); else r.tick();
    }
    expect(r.party.choiceOverlay.at(0, 12)).toBe(' '); // logical 129-cell clear already happened
    expect(textBgTransfer.enabled).toBe(false);
    const shown = r.party.choiceOverlay.saveVisibleTiles();
    expect(shown.join('')).toContain('ACTIVE');
    expect(r.party.choiceOverlay.saveTiles().join('')).not.toContain('ACTIVE');
    const bottomWait = 3 - textBgTransfer.nextPortion;
    const transfer = vi.spyOn(textBgTransfer, 'tick');
    for (let i = 0; i < 4; i++) {
      const ticks = transfer.mock.calls.length; r.tick();
      expect(transfer.mock.calls.length - ticks).toBe(1);
      expect(r.party.choiceOverlay.saveVisibleTiles()).toEqual(shown);
      vi.mocked(drawScreenTile).mockClear(); r.party.render();
      expect(drawScreenTile).toHaveBeenCalledWith('A', 8, 14 * 8);
    }
    expect(textBgTransfer.enabled).toBe(true);
    // Other thirds can release row11 while the refusal's bottom third still retains its picture.
    for (let i = 1; i < bottomWait; i++) { r.tick(); expect(r.party.choiceOverlay.saveVisibleTiles().slice(240)).toEqual(shown.slice(240)); }
    r.tick(); expect(r.party.choiceOverlay.saveVisibleTiles().join('')).not.toContain('ACTIVE');
  });

  for (const cancel of ['list B', 'submenu CANCEL'] as const) it(`${cancel} returns null exactly at +11 for the caller to redisplay`, () => {
    const r = rig(undefined, 0, partyMenuOrRockOrRun); r.advance(21);
    if (cancel === 'list B') r.tick('b');
    else { r.tick('a'); r.advance(2); r.tick('down'); r.advance(2); r.tick('down'); r.advance(2); r.tick('a'); }
    const k = r.time; r.advance(10); expect(r.done).toBe(false); r.tick();
    expect(r.done).toBe(true); expect(r.result).toBe(null); expect(r.time).toBe(k + 11);
    expect(r.video.screen.bgp).toBe(0xe4);
  });

  it('repeated PKMN cancellations redisplay in one loop with at most one live party generator', () => {
    setBattleAndStartSavedMenuItem(2); const r = rig(undefined, 0, displayBattleMenu);
    const bound = r.host.partyMenu;
    let active = 0, peak = 0, entries = 0;
    r.host.partyMenu = function* (ctx) {
      entries++; active++; peak = Math.max(peak, active);
      try { return yield* bound(ctx); } finally { active--; }
    };
    r.advance(5);
    for (let visit = 0; visit < 6; visit++) {
      r.tick('a'); expect(active).toBe(1); r.advance(21);
      if (visit % 2 === 0) r.tick('b');
      else { r.tick('a'); r.advance(2); r.tick('down'); r.advance(2); r.tick('down'); r.advance(2); r.tick('a'); }
      r.advance(11); expect(active).toBe(0); expect(peak).toBe(1); expect(r.done).toBe(false);
      r.advance(5); // next battle read is at +17, with the same saved raw PKMN position2
    }
    r.tick('left'); r.advance(2); r.tick('a');
    expect(r.done).toBe(true); expect(r.result).toEqual({ carry: false });
    expect(entries).toBe(6); expect(active).toBe(0); expect(peak).toBe(1);
  });

  it('writes the exact rectangle and the linear 129-cell clear, with opaque spaces outside the box', () => {
    const party = new PartyMenu(); party.choiceOverlay.clearArea(0, 0, 18, 20);
    drawBattlePartySubmenu(party);
    const row = (y: number) => Array.from({ length: 9 }, (_, i) => party.choiceOverlay.at(11 + i, y)).join('');
    expect(Array.from({ length: 7 }, (_, i) => row(11 + i))).toEqual([
      '┌───────┐', '│▶SWITCH│', '│       │', '│ STATS │', '│       │', '│ CANCEL│', '└───────┘']);
    party.choiceOverlay.clearArea(0, 0, 18, 20); const writes = vi.spyOn(party.choiceOverlay, 'put');
    clearBattlePartySubmenu(party); expect(writes).toHaveBeenCalledTimes(129);
    expect(writes.mock.calls[0]).toEqual([11, 11, ' ']); expect(writes.mock.calls[128]).toEqual([19, 17, ' ']);
    expect(writes.mock.calls.some(([x, y]) => x === 0 && y === 12)).toBe(true);
  });

  for (const phase of [0, 1, 2]) it(`phase${phase}: row11 tears before bottom, B+A deselects and GoBack reads at +16 (#73; ASM18)`, () => {
    const r = rig(undefined, phase); r.choose();
    expect(r.party.choiceOverlay.at(11, 11)).toBe('┌');
    expect(r.party.choiceOverlay.visibleAt(11, 11)).toBe(null);
    const order: (string | null)[][] = [];
    for (let i = 0; i < 3; i++) { r.tick(); order.push([r.party.choiceOverlay.visibleAt(11, 11), r.party.choiceOverlay.visibleAt(11, 12)]); }
    expect(order.some(([middle, bottom]) => (middle === '┌') !== (bottom === '│'))).toBe(true);
    vi.mocked(drawScreenTile).mockClear(); r.party.render();
    expect(drawScreenTile).toHaveBeenCalledWith('S', 13 * 8, 12 * 8);
    expect(drawScreenTile).toHaveBeenCalledWith(' ', 12 * 8, 13 * 8);
    r.tick('a', 'b'); const b = r.time; expect(r.ctx.actionResultOrTookBattleTurn).toBe(0);
    expect(r.party.choiceOverlay.at(0, 12)).toBe(' ');
    r.advance(15); expect(r.reads[r.reads.length - 1]).toBe(b); r.tick(); expect(r.reads[r.reads.length - 1]).toBe(b + 16);
    vi.mocked(drawScreenTile).mockClear(); r.party.render();
    expect(vi.mocked(drawScreenTile).mock.calls.some(([glyph]) => glyph === 'S')).toBe(false);
  });

  for (const phase of [0, 1, 2]) it(`phase${phase}: CANCEL restores Buffer2 at+6, normal at+11, then exactly three empty bottom frames`, () => {
    const r = rig(undefined, phase); r.choose(); r.advance(2); r.tick('down'); r.advance(2); r.tick('down'); r.advance(2); r.tick('a');
    const k = r.time; r.advance(5); expect(r.video.screen.bgp).toBe(0); r.tick();
    expect(r.calls.find(c => c.name === 'load2')?.at).toBe(k + 6);
    expect(r.video.screen.at(15, 14)).toBe('▷'); r.advance(5); expect(r.video.screen.bgp).toBe(0xe4);
    const seen: boolean[] = [];
    for (let i = 0; i < 6; i++) { r.tick(); seen.push(r.video.screen.visibleAt(10, 14) === 'F'); }
    expect(seen.filter(v => !v)).toHaveLength(3);
    expect(r.reads[r.reads.length - 1]).toBe(k + 17);
    expect(r.frames.slice(k, k + 11)).toEqual(['serviced', 'serviced', 'serviced', 'serviced', 'serviced', 'serviced', 'held', 'held', 'serviced', 'serviced', 'serviced']);
  });

  it('B in the list uses the same quit tail and CP4 host.partyMenu is actually bound', () => {
    setBattleAndStartSavedMenuItem(2); const r = rig(undefined, 0, displayBattleMenu);
    r.advance(5); r.tick('a'); r.advance(21); r.tick('b'); const k = r.time;
    r.advance(17); expect(r.reads[r.reads.length - 1]).toBe(k + 17);
    expect(r.calls.some(c => c.name === 'save2')).toBe(true); expect(r.ctx.actionResultOrTookBattleTurn).toBe(0);
  });

  for (const initial of [0, 1]) it(`fainted nonactive mon: NoWillText only when firstMonsNotOutYet=${initial} is zero`, () => {
    const ctx = context(); ctx.firstMonsNotOutYet = initial; ctx.partyMons[1].currentHp = 0;
    setPartyAndBillsSavedMenuItem(1); const r = rig(ctx), print = vi.spyOn(r.party, 'printBattleChoiceText');
    r.choose(); r.advance(2); r.tick('a');
    expect(print.mock.calls.map(c => c[0])).toEqual(initial === 0 ? ['NoWillText'] : []);
    expect(ctx.actionResultOrTookBattleTurn).toBe(0); expect(r.calls.some(c => c.name === 'switch')).toBe(false);
    for (let n = 0; n < 500 && r.party.choiceOverlay.at(0, 12) !== ' '; n++) { if (n % 8 === 0) r.tick('b'); else r.tick(); }
    expect(r.party.choiceOverlay.at(0, 12)).toBe(' ');
    expect(getPartyAndBillsSavedMenuItem()).toBe(1);
  });

  it('AlreadyOutText binds the active battle nickname, then deselects without spending a turn', () => {
    const r = rig(), print = vi.spyOn(r.party, 'printBattleChoiceText'); r.choose(); r.advance(2); r.tick('a');
    expect(print).toHaveBeenCalledWith('AlreadyOutText', { battleMonNick: 'ACTIVE' });
    for (let n = 0; n < 500 && r.party.choiceOverlay.at(0, 12) !== ' '; n++) { if (n % 8 === 0) r.tick('b'); else r.tick(); }
    expect(r.party.choiceOverlay.at(0, 12)).toBe(' ');
    expect(r.ctx.actionResultOrTookBattleTurn).toBe(0); expect(r.calls.some(c => c.name === 'switch')).toBe(false);
  });

  it('valid switch writes result1 before white/copies, Buffer1 at+6 and switch port at+11', () => {
    setPartyAndBillsSavedMenuItem(1); const r = rig(); r.choose(); r.advance(2); r.tick('a'); const k = r.time;
    expect(r.ctx.actionResultOrTookBattleTurn).toBe(1); expect(r.video.screen.bgp).toBe(0);
    r.advance(10); expect(r.done).toBe(false); r.tick(); expect(r.result).toEqual({ carry: false });
    expect(r.calls.filter(c => ['load1', 'switch'].includes(c.name)).map(c => [c.name, c.at])).toEqual([['load1', 0], ['load1', k + 6], ['switch', k + 11]]);
    expect(r.ctx.currentMenuItem).toBe(2); expect(r.video.screen.bgp).toBe(0xe4);
    expect(r.calls.some(c => c.name === 'load2')).toBe(false);
  });
});

describe('STATS session hand-offs (#73: S+27 and Q+32, ASM S+29 and Q+34)', () => {
  for (const kind of ['plain', 'substitute', 'minimize'] as const) it(`${kind}: both pages, white Q+3, reload7/10/13, then full opening22; no duplicate BG tick`, () => {
    const ctx = context(); ctx.enemyHasSubstitute = kind === 'substitute'; ctx.enemyMinimized = kind !== 'plain';
    const r = rig(ctx); const create = vi.fn((mon, options) => new StatusScreenSession(mon, options)); r.host.createStatusScreen = create;
    r.choose(); r.advance(2); r.tick('down'); r.advance(2); r.tick('a'); const s = r.time;
    expect(create).toHaveBeenCalledWith(ctx.partyMons[0], { syncRead: false });
    const transfer = vi.spyOn(textBgTransfer, 'tick');
    for (let i = 0; i < 27; i++) { const n = transfer.mock.calls.length; r.tick(); expect(transfer.mock.calls.length - n).toBe(1); }
    expect(r.reads[r.reads.length - 1]).toBe(s + 27); expect(r.host.statusView?.paletteWhite).toBe(false);
    r.tick('a'); r.advance(2); r.tick('b'); const q = r.time;
    expect(r.host.statusView?.paletteWhite).toBe(true);
    r.advance(2); expect(r.host.statusView).not.toBe(null); const n = transfer.mock.calls.length; r.tick();
    expect(transfer.mock.calls.length - n).toBe(1); expect(r.host.statusView).toBe(null); expect(ctx.whoseTurn).toBe(1);
    expect(r.video.screen.bgp).toBe(0); const reload = kind === 'plain' ? 7 : kind === 'substitute' ? 10 : 13;
    r.advance(reload); expect(r.calls[r.calls.length - 1]).toMatchObject({ name: 'load1', at: q + 3 + reload });
    if (kind === 'plain') { expect(ctx.curPartySpecies).toBe(16); expect(r.video.screen.frontSlot(48)?.picture).toBe('enemy'); }
    else expect(r.calls.some(c => c.name === kind && c.at === q + 3)).toBe(true);
    r.advance(21); expect(r.reads[r.reads.length - 1]).toBe(q); r.tick();
    expect(r.reads[r.reads.length - 1]).toBe(q + 3 + reload + 22);
    expect(syncJoypadRead).not.toHaveBeenCalled();
  });
});
