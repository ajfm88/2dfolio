import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { (globalThis as unknown as { window: unknown }).window = { addEventListener() {} }; });
import { BillsPc } from './bills_pc';
import type { PcStorage } from './pc';
import { ScreenTiles } from './screen_tiles';
import type { MenuInput } from './menu_input';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { loadTextPrograms } from '../text/program_data';
import { textBgTransfer } from '../text/bg_transfer';
import { getNoTextDelay, setNoTextDelay } from '../text/text_flags';
import { createPokemon, loadBattleData } from '../battle/data';
import type { BattlePokemon } from '../battle';
import { pokemonToBoxed, type BoxedPokemon } from '../pokemon_storage';
import { readJoypad, setKey, updateInput } from '../input';
import type { GameButton } from '../core';
import { playSFX, isSoundFinished } from '../audio';
import { setListScrollOffset, getListScrollOffset, setPartyAndBillsSavedMenuItem, getPartyAndBillsSavedMenuItem } from '../list_state';
import { getPikachuHappiness, getPikachuMood, restorePikachuHappiness } from '../pikachu/pikachu_happiness';
import { PartyMenu } from './party_menu';
import { POKEBALL_GLYPH } from './menu_glyphs';

vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: vi.fn(() => true) }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadFont: async () => ({}), loadTileset: async () => ({}) }));
const KEYS: GameButton[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'];
beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); await loadBattleData(); });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(isSoundFinished).mockReturnValue(true);
  vi.mocked(playSFX).mockImplementation(() => Promise.resolve());
  setTextSpeed('fast'); textBgTransfer.enabled = true; textBgTransfer.resetPortion();
  setListScrollOffset(0); setPartyAndBillsSavedMenuItem(0); setNoTextDelay(false);
  restorePikachuHappiness(90, 128);
  for (const key of KEYS) setKey(key, false); updateInput(); readJoypad();
});
function mon(species = 'RATTATA', hp?: number) {
  const p = createPokemon(species, 5)!; if (hp !== undefined) p.currentHp = hp; return p;
}
function boxed(species = 'RATTATA', hp?: number) { return pokemonToBoxed(mon(species, hp)); }

function rig(party: BattlePokemon[] = [mon('PIKACHU'), mon()], box: BoxedPokemon[] = [], currentBox = 0, disabled = false) {
  const tiles = new ScreenTiles(); const textBox = new TextBox();
  textBox.open({ autoBox: false }); for (let i = 0; i < 20; i++) textBox.update();
  const boxes = Array.from({ length: 12 }, () => [] as BoxedPokemon[]); boxes[currentBox] = box;
  const sprites = vi.fn();
  const storage: PcStorage = { party, boxes, getCurrentBox: () => currentBox, setCurrentBox: value => { currentBox = value; },
    deserialize: b => {
      const p = createPokemon(b.speciesName, b.level, b.nickname, { atk: b.atkDV, def: b.defDV, spd: b.spdDV, spc: b.spcDV })!;
      p.currentHp = b.currentHp; p.status = b.status; p.moves = structuredClone(b.moves); return p;
    }, hasFlag: () => true, saveGame: vi.fn(), isPikachuFollowingDisabled: () => disabled };
  const printed: { program: string; noDelay: boolean | undefined; frame: number }[] = [];
  let frame = 0;
  const print = textBox.print.bind(textBox);
  vi.spyOn(textBox, 'print').mockImplementation((source, opts) => {
    if ('program' in source) printed.push({ program: source.program, noDelay: opts?.noDelay, frame });
    print(source, opts);
  });
  const pc = new BillsPc(tiles, textBox, textBgTransfer, sprites, storage, tiles.save(textBox));
  const reads = vi.fn(readJoypad);
  const tick = (...keys: GameButton[]) => {
    frame++;
    for (const key of KEYS) setKey(key, keys.includes(key)); updateInput();
    const third = textBgTransfer.nextPortion; const enabled = textBgTransfer.enabled;
    if (pc.advanceText) textBox.update(); else textBox.updateDisplay();
    if (enabled) tiles.copyShownThird(third);
    return pc.frame(reads);
  };
  const frames = (n: number) => { for (let i = 0; i < n; i++) tick(); };
  const until = (pred: () => boolean, limit = 2500) => {
    for (let i = 0; i < limit && !pred(); i++) {
      if (textBox.isWaitingForInput && i % 4 === 0) tick('a'); else tick();
    }
    expect(pred(), `timeout ${frame}, ${printed[printed.length - 1]?.program}`).toBe(true);
  };
  const menu = () => Reflect.get(pc, 'menu') as MenuInput | null;
  const ready = () => { until(() => menu() !== null); frames(3); };
  const branch = (index: number) => {
    ready();
    while (menu()!.item !== index) { tick(menu()!.item < index ? 'down' : 'up'); frames(2); }
    tick('a');
  };
  // Give each menu an idle read of the released A before the next press.
  const choose = () => { frames(16); tick('a'); frames(3); tick('a'); };
  pc.enter();
  return { pc, party, box, boxes, storage, tiles, textBox, printed, reads, sprites, tick, frames, until, ready, branch, choose,
    time: () => frame, menu, currentBox: () => currentBox };
}

describe('BillsPC_ on the retained display', () => {
  it.each([0, 1])('labels the branch %i submenu WITHDRAW or DEPOSIT (note 51 M2)', branch => {
    const r = rig(undefined, [boxed()]); r.branch(branch); r.frames(16); r.tick('a');
    const label = Array.from({ length: 8 }, (_, x) => r.tiles.at(11 + x, 12)).join('').trimEnd();
    expect(label).toBe(branch === 0 ? 'WITHDRAW' : 'DEPOSIT');
  });

  it('draws BillsPCMenu\'s empty bottom box at (0,12), 4 by 18 inside (note 51 M10)', () => {
    const border = vi.spyOn(ScreenTiles.prototype, 'textBoxBorder');
    const r = rig(); r.frames(5);
    expect(border).toHaveBeenCalledWith(0, 12, 4, 18);
    // The main menu and BOX No. overlay parts of this box; inspect the exposed cells.
    expect([r.tiles.at(18, 12), r.tiles.at(19, 12), r.tiles.at(0, 17)]).toEqual(['─', '┐', '└']);
    for (let y = 14; y <= 16; y++) {
      expect(r.tiles.at(0, y)).toBe('│');
      for (let x = 1; x <= 8; x++) expect(r.tiles.at(x, y), `empty box (${x},${y})`).toBe(' ');
    }
    border.mockRestore();
  });

  it.each([0, 1])('STATS from branch %i shares both pages and restores Buffer1 on STATS, first read E+6', branch => {
    const r = rig(undefined, [boxed()]); const original = structuredClone(r.box);
    r.branch(branch); r.frames(16); r.tick('a'); r.frames(3); r.tick('down'); r.frames(3);
    const before = r.tiles.save(r.textBox); r.tick('a'); expect(r.pc.fullScreen).toBe(true);
    const stats = Reflect.get(r.pc, 'stats'); expect(Reflect.get(stats, 'statsPage')).toBe(1);
    r.tick(); r.tick('a'); expect(Reflect.get(stats, 'statsPage')).toBe(2);
    r.tick(); const e = r.time() + 1; r.tick('a'); expect(r.pc.fullScreen).toBe(false);
    expect(r.tiles.save(r.textBox)).toEqual(before); expect(r.box).toEqual(original);
    const reads = r.reads.mock.calls.length; r.frames(5); expect(r.reads.mock.calls.length).toBe(reads);
    r.tick(); expect(r.time()).toBe(e + 6); expect(r.reads.mock.calls.length).toBe(reads + 1);
    expect(r.menu()!.item).toBe(1); expect(playSFX).not.toHaveBeenCalled();
  });

  it('prints the empty PRINT BOX program and returns directly for a nonempty printer gap', () => {
    const empty = rig(); empty.branch(4);
    expect(empty.printed[empty.printed.length - 1]).toMatchObject({ program: 'NoPokemonText', noDelay: true });
    const nonempty = rig(undefined, [boxed()]); nonempty.branch(4); nonempty.ready();
    expect(nonempty.printed).toHaveLength(0); expect(nonempty.menu()!.item).toBe(4);
  });

  it('keeps Change Box transfer off through all 15 medium glyph delays; layout C+48/read C+51', () => {
    const r = rig(undefined, [boxed()], 9); r.boxes[0].push(boxed()); r.branch(3);
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'WhenYouChangeBoxText', noDelay: true });
    r.until(() => !r.pc.advanceText); r.frames(3); r.tick('a');
    setTextSpeed('medium'); r.frames(15); const c = r.time();
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'ChooseABoxText', noDelay: false });
    expect(textBgTransfer.enabled).toBe(false); const portion = textBgTransfer.nextPortion;
    const shown = r.tiles.visibleAt(12, 1); r.frames(47);
    expect(textBgTransfer.enabled).toBe(false); expect(textBgTransfer.nextPortion).toBe(portion);
    expect(r.tiles.visibleAt(12, 1)).toBe(shown); r.tick();
    expect(r.time()).toBe(c + 48); expect(textBgTransfer.enabled).toBe(true);
    expect(r.tiles.at(8, 2)).toBe('1'); expect(r.tiles.at(9, 2)).toBe('0');
    expect(r.tiles.at(18, 1)).toBe(POKEBALL_GLYPH); expect(r.tiles.at(18, 10)).toBe(POKEBALL_GLYPH);
    expect(r.tiles.at(18, 2)).toBe(' '); expect(r.menu()!.cursor).toEqual({ x: 12, y: 10 });
    const reads = r.reads.mock.calls.length; r.frames(2); expect(r.reads.mock.calls.length).toBe(reads);
    r.tick('down'); expect(r.time()).toBe(c + 51); expect(r.menu()!.cursor).toEqual({ x: 12, y: 11 });
    r.frames(3); r.tick('down'); r.frames(3); r.tick('down'); expect(r.menu()!.item).toBe(11);
    expect(r.storage.saveGame).not.toHaveBeenCalled();
  });

  it.each(['no', 'b', 'same', 'other'] as const)('Change Box %s follows warning/cancel/save branches', answer => {
    const r = rig(); r.branch(3); r.until(() => !r.pc.advanceText); r.frames(3);
    r.tick(answer === 'no' ? 'b' : 'a'); r.frames(15);
    if (answer === 'no') {
      r.ready(); expect(r.storage.saveGame).not.toHaveBeenCalled(); return;
    }
    r.until(() => !r.pc.advanceText); r.frames(3);
    if (answer === 'b') {
      r.tick('b'); r.ready(); expect(r.storage.saveGame).not.toHaveBeenCalled(); return;
    }
    if (answer === 'other') { r.tick('down'); r.frames(3); }
    const current = answer === 'other' ? 1 : 0;
    vi.mocked(r.storage.saveGame).mockImplementation(() => { expect(r.currentBox()).toBe(current); });
    // Wait on an existing channel before starting save; then wait on save itself.
    vi.mocked(isSoundFinished).mockReturnValue(false); const reads = r.reads.mock.calls.length;
    r.tick('a'); r.frames(7);
    expect(r.tiles.at(12, current + 1)).toBe('▶'); // ChangeBox never places an unfilled arrow
    expect(playSFX).not.toHaveBeenCalledWith('save'); expect(r.storage.saveGame).not.toHaveBeenCalled();
    expect(r.reads.mock.calls.length).toBe(reads + 1);
    vi.mocked(isSoundFinished).mockReturnValue(true);
    vi.mocked(playSFX).mockImplementation(name => { if (name === 'save') vi.mocked(isSoundFinished).mockReturnValue(false); return Promise.resolve(); });
    r.tick(); expect(playSFX).toHaveBeenCalledWith('save'); r.frames(5); expect(r.storage.saveGame).not.toHaveBeenCalled();
    vi.mocked(isSoundFinished).mockReturnValue(true); r.tick(); expect(r.storage.saveGame).toHaveBeenCalledOnce();
    r.ready(); expect(r.menu()!.item).toBe(3); expect(r.currentBox()).toBe(current);
    expect(r.printed[r.printed.length - 1].program).toBe('ChooseABoxText'); // no save text
  });

  it('copies for 4+1 frames, places the menu at +5/cursor +8, first reads +11, silently', () => {
    const r = rig();
    expect(getNoTextDelay()).toBe(true); expect(textBgTransfer.enabled).toBe(false);
    r.frames(4); expect(r.tiles.at(0, 0)).toBeNull();
    r.tick(); expect(r.time()).toBe(5); expect(r.tiles.at(0, 0)).toBe('┌');
    expect(r.tiles.at(1, 2)).toBe(' '); r.frames(3); expect(r.tiles.at(1, 2)).toBe('▶');
    r.frames(2); expect(r.reads).not.toHaveBeenCalled(); r.tick(); expect(r.reads).toHaveBeenCalledOnce();
    const row = (y: number, x: number, len: number) => Array.from({ length: len }, (_, i) => r.tiles.at(x + i, y)).join('');
    expect(row(2, 2, 11)).toBe('WITHDRAW \uE001\uE002');
    expect(row(10, 2, 9)).toBe('PRINT BOX'); expect(row(12, 2, 7)).toBe('SEE YA!');
    expect(row(16, 10, 7)).toBe('BOX No.'); expect(r.tiles.at(18, 16)).toBe('1');
    expect(playSFX).not.toHaveBeenCalled();
  });

  it.each([1, 9, 10, 12])('right-aligns BOX No. %i', number => {
    const r = rig(undefined, [], number - 1); r.frames(5);
    expect(r.tiles.at(18, 16)).toBe(String(number).slice(-1));
    expect(r.tiles.at(17, 16)).toBe(number < 10 ? ' ' : '1');
  });

  it('pushes/pops list offset, resets party cursor, exits B+A silently without an unfilled arrow', () => {
    setListScrollOffset(4); setPartyAndBillsSavedMenuItem(3);
    const r = rig(); r.ready(); expect(getListScrollOffset()).toBe(0); expect(getPartyAndBillsSavedMenuItem()).toBe(0);
    expect(r.tick('a', 'b')).toBe(true);
    expect(getListScrollOffset()).toBe(4); expect(getNoTextDelay()).toBe(false);
    expect(playSFX).not.toHaveBeenCalled();
  });

  it('types NoMon only after a list has returned, and keeps the parent row during a visit', () => {
    const r = rig(); r.branch(0);
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'NoMonText', noDelay: true });
    r.branch(1); r.frames(16); r.tick('b'); r.branch(0);
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'NoMonText', noDelay: false });
  });

  it('checks last party mon before full box, and full box before opening a list', () => {
    const full = Array.from({ length: 20 }, () => boxed());
    const last = rig([mon()], full); last.branch(1);
    expect(last.printed[last.printed.length - 1]?.program).toBe('CantDepositLastMonText');
    const r = rig([mon(), mon()], full); r.branch(1);
    expect(r.printed[r.printed.length - 1]?.program).toBe('BoxFullText');
  });

  it('rejects a full party before the withdraw list and never changes either collection', () => {
    const r = rig(Array.from({ length: 6 }, () => mon()), [boxed()]); r.branch(0);
    expect(r.printed[r.printed.length - 1]?.program).toBe('CantTakeMonText'); expect(r.party).toHaveLength(6); expect(r.box).toHaveLength(1);
  });

  it.each([false, true])('deposit appends before removal, even when the last-but-one is fainted (%s)', fainted => {
    const r = rig([mon('RATTATA', fainted ? 0 : 1), mon('PIKACHU')]);
    const splice = vi.spyOn(r.party, 'splice').mockImplementation((start, count) => {
      expect(r.box).toHaveLength(1); return Array.prototype.splice.call(r.party, start, count ?? 0);
    });
    r.branch(1); const d = r.time(); r.choose();
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'MonWasStoredText', noDelay: false });
    expect(r.printed[r.printed.length - 1]?.frame).toBe(d + 21);
    expect(splice).toHaveBeenCalled(); expect(r.box[0].currentHp).toBe(fainted ? 0 : 1);
    expect(getPikachuHappiness()).toBe(90); // not the starter
    expect(r.sprites.mock.calls.length).toBeGreaterThan(3);
    r.ready(); expect(r.menu()!.item).toBe(1); expect(getPartyAndBillsSavedMenuItem()).toBe(0);
    const partyMenu = new PartyMenu(); partyMenu.show(r.party); expect(Reflect.get(partyMenu, 'cursor')).toBe(0);
  });

  it('deposits the starter with happiness/mood, but refuses it when following is disabled', () => {
    const r = rig(); r.branch(1); r.choose();
    expect(getPikachuHappiness()).toBe(87); expect(getPikachuMood()).toBe(0x62);
    expect(r.box[0].speciesName).toBe('Pikachu');
    const refused = rig(undefined, [], 0, true); refused.branch(1); refused.frames(16); refused.tick('a');
    expect(refused.printed[refused.printed.length - 1]?.program).toBe('SleepingPikachuText2');
    expect(refused.party).toHaveLength(2); expect(refused.box).toHaveLength(0);
  });

  it.each([0, 1])('withdraw appends before removing the boxed mon and preserves HP=%i/status/PP', hp => {
    const b = boxed('PIKACHU', hp); b.status = 'PSN'; b.moves[0].pp = 1;
    const r = rig([mon()], [b]);
    vi.spyOn(r.box, 'splice').mockImplementation((start, count) => {
      expect(r.party).toHaveLength(2); return Array.prototype.splice.call(r.box, start, count ?? 0);
    });
    r.branch(0); r.choose();
    expect(r.party[1]).toMatchObject({ currentHp: hp, status: 'PSN', moves: b.moves }); expect(r.box).toHaveLength(0);
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'MonIsTakenOutText', noDelay: false });
  });

  it('waits on real sound completion before the result and never plays transfer SFX', () => {
    const r = rig(); r.branch(1); r.frames(16); r.tick('a'); r.frames(3);
    vi.mocked(isSoundFinished).mockReturnValue(false); r.tick('a');
    expect(r.party).toHaveLength(1); const reads = r.reads.mock.calls.length; r.frames(8);
    expect(r.printed).toHaveLength(0); expect(r.reads.mock.calls.length).toBe(reads);
    vi.mocked(isSoundFinished).mockReturnValue(true); r.tick();
    expect(r.printed[r.printed.length - 1]?.program).toBe('MonWasStoredText'); expect(playSFX).not.toHaveBeenCalled();
  });

  it('refuses to release the starter without a confirmation or mutation', () => {
    const r = rig(undefined, [boxed('PIKACHU')]); r.branch(2); r.frames(16); r.tick('a');
    expect(r.printed[r.printed.length - 1]).toMatchObject({ program: 'PikachuUnhappyText', noDelay: false });
    expect(r.box).toHaveLength(1);
  });

  it('release NO preserves selected row/offset and the old question; YES removes after its 15-frame tail', () => {
    const r = rig(undefined, Array.from({ length: 5 }, () => boxed())); r.branch(2); r.frames(16);
    r.tick('down'); r.frames(3); r.tick('down'); r.frames(3); r.tick('down'); r.frames(6);
    r.tick('a'); r.until(() => !r.pc.advanceText); r.frames(3);
    const question = r.textBox.saveScreen().buffer.join(''); expect(question).toContain('gone forever. OK?');
    r.tick('b'); r.frames(14); expect(Reflect.get(r.pc, 'list')).toBeNull(); r.tick();
    expect(r.textBox.saveScreen().buffer.join('')).toBe(question); expect(getListScrollOffset()).toBe(1);
    r.frames(16); r.tick('a'); r.until(() => !r.pc.advanceText); r.frames(3); r.tick('a');
    r.frames(14); expect(r.box).toHaveLength(5); r.tick(); expect(r.box).toHaveLength(4);
    expect(r.printed[r.printed.length - 1]?.program).toBe('MonWasReleasedText');
  });
});
