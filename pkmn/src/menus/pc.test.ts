import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { (globalThis as unknown as { window: unknown }).window = { addEventListener() {} }; });
import { PcSession } from './pc';
import { ScreenTiles } from './screen_tiles';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { Bag, type ItemStack } from '../items';
import { readJoypad, setKey, updateInput } from '../input';
import type { GameButton } from '../core';
import { playSFX, isSoundFinished } from '../audio';
import { getListScrollOffset, setListScrollOffset, setCurrentMenuItem, setBagSavedMenuItem } from '../list_state';
import { loadGameText } from '../text/game_text';
import { getNoTextDelay, setNoTextDelay } from '../text/text_flags';

vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadFont: async () => ({}), loadTileset: async () => ({}) }));
vi.mock('../overworld/ui_entry', () => ({ setOpeningSpriteUpdates: vi.fn() }));
const BUTTONS: GameButton[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'];
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadGameText(); });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(isSoundFinished).mockReturnValue(true);
  vi.mocked(playSFX).mockImplementation(() => Promise.resolve());
  textBgTransfer.enabled = true; textBgTransfer.resetPortion(); setTextSpeed('fast');
  setListScrollOffset(0); setCurrentMenuItem(0); setBagSavedMenuItem(0);
  setNoTextDelay(false);
  for (const key of BUTTONS) setKey(key, false); updateInput(); readJoypad();
});

function rig(items: ItemStack[] = [{ id: 'POTION', count: 3 }], stored: ItemStack[] = [{ id: 'ANTIDOTE', count: 2 }], options?: { dex?: boolean; metBill?: boolean }) {
  const bag = new Bag(); bag.items = structuredClone(items);
  const pc = structuredClone(stored); const box = new TextBox(); const tiles = new ScreenTiles();
  box.open({ autoBox: !options }); for (let i = 0; i < 20; i++) box.update();
  const printed: { program: string; at: number; noDelay: boolean | undefined }[] = [];
  let frame = 0; const print = box.print.bind(box);
  vi.spyOn(box, 'print').mockImplementation((source, opts) => {
    if ('program' in source) printed.push({ program: source.program, at: frame, noDelay: opts?.noDelay });
    print(source, opts);
  });
  let currentBox = 2;
  const sprites = vi.fn(); const session = new PcSession(tiles, box, textBgTransfer, bag, pc, sprites, options ? 'generic' : 'direct', {
    party: [], boxes: Array.from({ length: 12 }, () => []), getCurrentBox: () => currentBox,
    setCurrentBox: index => { currentBox = index; }, deserialize: () => null,
    hasFlag: flag => flag === 'GOT_POKEDEX' ? !!options?.dex : flag === 'MET_BILL' ? !!options?.metBill : false,
    saveGame: vi.fn(), isPikachuFollowingDisabled: () => false,
  });
  const reads = vi.fn(readJoypad);
  const tick = (...keys: GameButton[]) => {
    frame++;
    for (const key of BUTTONS) setKey(key, keys.includes(key)); updateInput();
    const third = textBgTransfer.nextPortion; const enabled = textBgTransfer.enabled;
    if (session.advanceText) box.update(); else box.updateDisplay();
    if (enabled) session.copyThird(third);
    return session.frame(reads, () => { throw new Error('PC menu must be silent'); });
  };
  const frames = (n: number) => { for (let i = 0; i < n; i++) tick(); };
  const until = (predicate: () => boolean, limit = 2000) => {
    for (let i = 0; i < limit && !predicate(); i++) {
      // Native text prompts get real, spaced A presses; menu keys are explicit.
      if (box.isWaitingForInput && i % 4 === 0) tick('a'); else tick();
    }
    expect(predicate(), `timeout at ${frame}, ${printed[printed.length - 1]?.program}`).toBe(true);
  };
  session.enter();
  const menu = () => { until(() => tiles.at(1, 2) === '▶'); frames(3); };
  const branch = (index: number) => {
    menu(); for (let i = 0; i < index; i++) { tick('down'); frames(3); }
    tick('a'); frames(19); // PrintText 3 + list opening 16
  };
  // ListMenu clears BIT_NO_TEXT_DELAY: PrintText Delay3 + nine "How many?" glyphs.
  const choose = () => { tick('a'); frames(12); };
  return { bag, pc, box, tiles, session, printed, sprites, reads, tick, frames, until, menu, branch, choose, time: () => frame, currentBox: () => currentBox };
}

describe('ActivatePC / PCMainMenu', () => {
  it.each([false, true])('uses the source layout with GOT_POKEDEX=%s', dex => {
    const r = rig([], [], { dex }); r.menu();
    const row = (y: number) => Array.from({ length: 16 }, (_, x) => r.tiles.at(x, y) ?? '').join('');
    expect(row(2)).toContain("SOMEONE's PC");
    expect(row(4)).toContain("'s PC");
    expect(row(6)).toContain(dex ? "PROF.OAK's PC" : 'LOG OFF');
    expect(r.tiles.at(0, dex ? 9 : 7)).toBe('└');
    expect(r.box.uiTileAt(1, 12)).toBe(0);
    expect(r.printed[0]).toMatchObject({ program: 'TurnedOnPC1Text', noDelay: false });
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'turn_on_pc')).toHaveLength(1);
  });

  it('waits for turn-on after its prompt; Delay3 then the main menu Delay3 read', () => {
    const r = rig([], [], {});
    // Let text finish normally, but keep the turn-on sound pending after the prompt.
    r.until(() => r.box.isWaitingForInput); r.frames(3);
    // The prompt starts press_ab immediately before returning. That sound is still
    // live when ActivatePC's own WaitForSoundToFinish runs in the same CPU tick.
    vi.mocked(playSFX).mockImplementation(() => { vi.mocked(isSoundFinished).mockReturnValue(false); return Promise.resolve(); });
    r.tick('a');
    const reads = r.reads.mock.calls.length; r.frames(8);
    expect(r.tiles.at(0, 0)).toBeNull(); expect(r.reads.mock.calls.length).toBe(reads);
    vi.mocked(isSoundFinished).mockReturnValue(true); r.tick();
    r.frames(2); expect(r.tiles.at(0, 0)).toBeNull();
    r.tick(); expect(r.tiles.at(1, 2)).toBe('▶');
    r.frames(2); expect(r.reads.mock.calls.length).toBe(reads);
    r.tick(); expect(r.reads.mock.calls.length).toBe(reads + 1);
  });

  it('nested player PC uses enter_pc and returns at top without turn-on/off', () => {
    const r = rig([], [], { dex: true }); r.menu(); r.tick('down'); r.frames(3); r.tick('a');
    r.until(() => r.printed.some(p => p.program === 'WhatDoYouWantText')); r.frames(6);
    expect(r.printed.some(p => p.program === 'AccessedMyPCText' && !p.noDelay)).toBe(true);
    r.tick('b');
    expect(r.tiles.at(1, 2)).toBe('▶');
    expect(r.tiles.at(2, 2)).toBe('S');
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'turn_on_pc')).toHaveLength(1);
    expect(playSFX).toHaveBeenCalledWith('enter_pc');
    expect(playSFX).not.toHaveBeenCalledWith('turn_off_pc');
  });

  it.each(['yes', 'no'] as const)('Oak %s keeps choices silent, types closure, restores main cursor 0', answer => {
    const r = rig([], [], { dex: true }); r.menu();
    for (let i = 0; i < 2; i++) { r.tick('down'); r.frames(3); }
    r.tick('a');
    r.until(() => r.printed.some(p => p.program === 'GetDexRatedText') && !r.session.advanceText);
    r.frames(3); const sounds = vi.mocked(playSFX).mock.calls.length;
    r.tick(answer === 'yes' ? 'a' : 'b'); r.frames(15);
    expect(vi.mocked(playSFX).mock.calls.length).toBe(sounds);
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'ClosedOaksPCText', noDelay: false });
    r.until(() => r.tiles.at(1, 2) === '▶');
    expect(r.box.uiTileAt(1, 12)).toBe(0);
  });

  it.each([false, true])('Bill preamble uses MET_BILL=%s; retained visit preserves current box and resets parent row', metBill => {
    const r = rig([], [], { dex: true, metBill }); r.menu(); r.tick('a');
    r.until(() => r.tiles.at(2, 2) === 'W' && r.tiles.at(1, 2) === '▶'); r.frames(3);
    expect(r.printed.some(p => p.program === (metBill ? 'AccessedBillsPCText' : 'AccessedSomeonesPCText') && !p.noDelay)).toBe(true);
    r.tick('b');
    expect(r.session.fullScreen).toBe(false);
    expect(r.currentBox()).toBe(2);
    expect(r.tiles.at(1, 2)).toBe('▶');
  });

  it('B+A on main logs off, waits without reads, keeps its source screen', () => {
    const r = rig([], [], { dex: true }); r.menu();
    vi.mocked(isSoundFinished).mockReturnValue(false); r.tick('a', 'b');
    const reads = r.reads.mock.calls.length; r.frames(10);
    expect(r.reads.mock.calls.length).toBe(reads);
    expect(playSFX).toHaveBeenLastCalledWith('turn_off_pc');
    expect(r.tiles.at(2, 2)).toBe('S');
    vi.mocked(isSoundFinished).mockReturnValue(true); expect(r.tick()).toBe(true);
  });
});

describe('PlayerPC on the retained display', () => {
  it('turn-on precedes typed text; the item menu is no-delay and reads at P+6', () => {
    const r = rig();
    expect(playSFX).toHaveBeenCalledWith('turn_on_pc');
    expect(r.printed[0]).toMatchObject({ program: 'TurnedOnPC2Text', noDelay: false });
    r.menu();
    const p = r.printed.find(p => p.program === 'WhatDoYouWantText')!;
    expect(p.noDelay).toBe(true);
    expect(r.time()).toBe(p.at + 6);
    expect(r.reads).toHaveBeenCalledTimes(1);
    expect(r.tiles.at(2, 2)).toBe('W'); expect(r.tiles.at(15, 9)).toBe('┘');
  });

  it('list clears text delay: quantity draws at Q+12, reads Q+13, then result types', () => {
    const r = rig(); r.menu(); const m = r.time() + 1;
    r.tick('a'); r.frames(18);
    const reads = r.reads.mock.calls.length;
    r.tick(); expect(r.reads.mock.calls.length).toBe(reads + 1);
    expect(r.time()).toBe(m + 19);
    expect(r.printed[r.printed.length - 1]?.program).toBe('WhatToWithdrawText');
    expect(getNoTextDelay()).toBe(true);
    const q = r.time() + 1; r.tick('a'); r.frames(3);
    expect(getNoTextDelay()).toBe(false);
    expect(r.box.saveScreen().buffer.filter(c => c !== ' ').join('')).toBe('H');
    expect(r.tiles.at(15, 9)).not.toBe('┌');
    r.frames(8); expect(r.tiles.at(15, 9)).not.toBe('┌');
    r.tick(); expect(r.time()).toBe(q + 12);
    expect(r.tiles.at(15, 9)).toBe('┌');
    expect(r.tiles.at(16, 10)).toBe('×');
    r.tick(); expect(r.time()).toBe(q + 13);
    r.tick('a');
    expect(r.bag.items).toContainEqual({ id: 'ANTIDOTE', count: 1 });
    expect(r.pc[0].count).toBe(1);
    expect(playSFX).toHaveBeenLastCalledWith('withdraw_deposit');
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'WithdrewItemText', noDelay: false });
  });

  it('deposits two from the selected duplicate slot, preserving the parent menu cursor', () => {
    const r = rig([{ id: 'POTION', count: 4 }, { id: 'POTION', count: 3 }], []);
    r.branch(1); r.tick('down'); r.frames(3); r.choose();
    r.tick('up'); r.tick(); r.tick('a');
    expect(r.pc).toEqual([{ id: 'POTION', count: 2 }]);
    expect(r.bag.items.map(i => i.count)).toEqual([4, 1]);
    r.until(() => r.printed[r.printed.length - 1]?.program === 'WhatToDepositText');
    expect(r.printed[r.printed.length - 1].noDelay).toBe(false);
    r.until(() => !r.session.advanceText); r.frames(16); r.tick('b'); r.frames(6);
    expect(r.tiles.at(1, 4)).toBe('▶');
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'WhatDoYouWantText', noDelay: true });
    r.tick('b');
    expect(getNoTextDelay()).toBe(false);
  });

  it.each([0, 1, 2])('empty branch %s prints its source message then returns', index => {
    const r = rig([], []); r.branch(index);
    expect(r.printed.some(p => p.program === (index === 1 ? 'NothingToDepositText' : 'NothingStoredText'))).toBe(true);
    expect(r.printed.find(p => p.program === (index === 1 ? 'NothingToDepositText' : 'NothingStoredText'))?.noDelay).toBe(true);
  });

  it.each(['withdraw', 'deposit'] as const)('%s failure leaves source and destination intact', mode => {
    const full = Array.from({ length: mode === 'withdraw' ? 20 : 50 }, () => ({ id: 'POTION', count: 99 }));
    const r = mode === 'withdraw' ? rig(full, [{ id: 'ANTIDOTE', count: 2 }]) : rig([{ id: 'ANTIDOTE', count: 2 }], full);
    const before = structuredClone([r.bag.items, r.pc]);
    r.branch(mode === 'withdraw' ? 0 : 1); r.choose(); r.tick(); r.tick('a');
    expect([r.bag.items, r.pc]).toEqual(before);
    expect(r.printed[r.printed.length - 1]?.program).toBe(mode === 'withdraw' ? 'CantCarryMoreText' : 'NoRoomToStoreText');
  });

  it('key items transfer quantity one with no quantity box', () => {
    const r = rig([{ id: 'TOWN_MAP', count: 1 }], []); r.branch(1); r.tick('a');
    expect(r.pc).toEqual([{ id: 'TOWN_MAP', count: 1 }]);
    expect(r.bag.items).toEqual([]); expect(getListScrollOffset()).toBe(0);
    expect(r.printed.some(p => p.program === 'DepositHowManyText')).toBe(false);
  });

  it('failed withdrawal can retry the selected duplicate after space is freed', () => {
    const r = rig(Array.from({ length: 20 }, () => ({ id: 'POTION', count: 99 })), [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }]);
    r.branch(0); r.tick('down'); r.frames(3); r.choose(); r.tick(); r.tick('a');
    expect(r.pc.map(s => s.count)).toEqual([99, 1]);
    expect(r.printed[r.printed.length - 1]?.program).toBe('CantCarryMoreText');
    r.bag.items.pop(); r.until(() => r.printed[r.printed.length - 1]?.program === 'WhatToWithdrawText');
    expect(r.printed[r.printed.length - 1].noDelay).toBe(false);
    r.until(() => !r.session.advanceText); r.frames(16); r.choose(); r.tick(); r.tick('a');
    expect(r.pc).toEqual([{ id: 'POTION', count: 99 }]);
    expect(r.bag.items[19]).toEqual({ id: 'POTION', count: 1 });
    expect(getListScrollOffset()).toBe(0);
  });

  it('toss removes the selected second duplicate rather than the first matching id', () => {
    const r = rig([], [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }]);
    r.branch(2); r.tick('down'); r.frames(3); r.choose(); r.tick(); r.tick('a');
    r.until(() => !r.session.advanceText); r.frames(3); r.tick('a'); r.frames(15);
    expect(r.pc).toEqual([{ id: 'POTION', count: 99 }]);
    expect(getListScrollOffset()).toBe(0);
  });

  it('SELECT swaps the live PC source slots, retaining item names and quantities', () => {
    const r = rig([], [{ id: 'POTION', count: 3 }, { id: 'ANTIDOTE', count: 2 }]);
    r.branch(0); r.tick('select'); r.frames(26); r.tick('down'); r.frames(3); r.tick('select'); r.frames(20);
    expect(r.pc).toEqual([{ id: 'ANTIDOTE', count: 2 }, { id: 'POTION', count: 3 }]);
  });

  it.each(['TOWN_MAP', 'HM01'])('toss refuses %s without a quantity box', id => {
    const r = rig([], [{ id, count: 1 }]); r.branch(2); r.tick('a');
    expect(r.printed[r.printed.length - 1]?.program).toBe('TooImportantToTossText');
    expect(r.printed.some(p => p.program === 'TossHowManyText')).toBe(false);
    expect(r.pc).toEqual([{ id, count: 1 }]);
  });

  it('quantity B and toss NO preserve the source and reopen its list', () => {
    const r = rig([], [{ id: 'POTION', count: 3 }]); r.branch(2); r.choose();
    r.tick('b'); r.until(() => !r.session.advanceText); r.frames(16); r.choose(); r.tick(); r.tick('a');
    r.until(() => !r.session.advanceText); r.frames(3); r.tick('b'); r.frames(15);
    expect(r.pc).toEqual([{ id: 'POTION', count: 3 }]);
    expect(r.printed[r.printed.length - 1]?.program).toBe('WhatToTossText');
  });

  it('transfer waits for current sound, then its own sound, without input reads', () => {
    const r = rig(); r.branch(0); r.choose(); r.tick();
    vi.mocked(isSoundFinished).mockReturnValue(false);
    r.tick('a'); const reads = r.reads.mock.calls.length;
    expect(r.pc[0].count).toBe(1); // write occurs before the sound wait
    expect(playSFX).not.toHaveBeenCalledWith('withdraw_deposit');
    r.frames(10); expect(r.reads.mock.calls.length).toBe(reads);
    vi.mocked(playSFX).mockImplementation(() => { vi.mocked(isSoundFinished).mockReturnValue(false); return Promise.resolve(); });
    vi.mocked(isSoundFinished).mockReturnValue(true); r.tick();
    expect(playSFX).toHaveBeenLastCalledWith('withdraw_deposit');
    r.frames(10); expect(r.reads.mock.calls.length).toBe(reads);
    expect(r.printed[r.printed.length - 1]?.program).toBe('WithdrawHowManyText');
    vi.mocked(isSoundFinished).mockReturnValue(true); r.tick();
    expect(r.printed[r.printed.length - 1]?.program).toBe('WithdrewItemText');
  });

  it('toss two confirms silently and removes only after YES', () => {
    const r = rig([], [{ id: 'POTION', count: 3 }]); r.branch(2); r.choose();
    r.tick('up'); r.tick(); r.tick('a');
    expect(r.pc[0].count).toBe(3);
    r.until(() => !r.session.advanceText); r.frames(3); r.tick('a'); r.frames(15);
    expect(r.pc[0].count).toBe(1);
    expect(r.printed[r.printed.length - 1]?.program).toBe('ThrewAwayItemText');
    expect(vi.mocked(playSFX).mock.calls.filter(c => c[0] === 'press_ab')).toHaveLength(2); // turn-on and toss text prompts only
  });

  it('B+A exits, waits for turn-off without reads and restores the empty box', () => {
    const r = rig(); r.menu(); const reads = r.reads.mock.calls.length;
    vi.mocked(isSoundFinished).mockReturnValue(false);
    r.tick('a', 'b'); expect(playSFX).toHaveBeenLastCalledWith('turn_off_pc');
    r.frames(12); expect(r.reads.mock.calls.length).toBe(reads + 1);
    vi.mocked(isSoundFinished).mockReturnValue(true);
    expect(r.tick()).toBe(true);
    expect(r.tiles.at(0, 0)).toBeNull(); expect(r.box.uiTileAt(1, 12)).toBeTruthy();
    expect(r.box.saveScreen().buffer.filter(glyph => glyph !== ' ')).toHaveLength(0);
  });
});

// Review F-1 (note 48): PlaceUnfilledArrowMenuCursor runs only in PlayerPCMenu, after its B test.
describe('menu cursor after a choice', () => {
  it('the main menu keeps the filled arrow on PROF.OAK\'s PC', () => {
    const r = rig([], [], { dex: true }); r.menu();
    r.tick('down'); r.frames(3); r.tick('down'); r.frames(3); r.tick('a');
    r.until(() => r.printed.some(p => p.program === 'GetDexRatedText'));
    expect(r.tiles.at(1, 6)).toBe('▶');
  });

  it('B in the item PC keeps the filled arrow through the turn-off sound', () => {
    const r = rig(); r.menu();
    vi.mocked(isSoundFinished).mockReturnValue(false);
    r.tick('b'); r.frames(2);
    expect(r.tiles.at(1, 2)).toBe('▶');
  });

  it('A on LOG OFF draws the unfilled arrow', () => {
    const r = rig(); r.menu();
    for (let i = 0; i < 3; i++) { r.tick('down'); r.frames(3); }
    vi.mocked(isSoundFinished).mockReturnValue(false);
    r.tick('a'); r.frames(2);
    expect(r.tiles.at(1, 8)).toBe('▷');
  });
});
