import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BagSession } from './bag';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms } from '../text/program_data';
import { Bag, type ItemStack } from '../items';
import {
  getBagSavedMenuItem, getListScrollOffset, getSavedListScrollOffset, setBagSavedMenuItem,
  setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset,
} from '../list_state';
import { isHeld, isPassPressed, syncJoypadRead } from '../input';
import type { GameButton } from '../core';

vi.mock('../input', () => ({
  isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false),
  syncJoypadRead: vi.fn(), readJoypad: vi.fn(),
}));
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({ fillRect: vi.fn(), drawTile: vi.fn(), loadFont: vi.fn(), loadTileset: vi.fn() }));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));
vi.mock('../overworld/ui_entry', () => ({ setOpeningSpriteUpdates: vi.fn() }));

function rig(items: ItemStack[], item = 0, offset = 0) {
  setListScrollOffset(offset);
  setBagSavedMenuItem(item);
  setCurrentMenuItem(0);
  setSavedListScrollOffset(0);
  const bag = new Bag();
  bag.items = items.map(entry => ({ ...entry }));
  const textBox = new TextBox();
  const transfer = textBgTransfer;
  const session = new BagSession(textBox, transfer);
  let pressed: GameButton[] = [];
  let held: GameButton[] = [];
  const read = vi.fn(() => {
    const seen = pressed;
    const down = held;
    pressed = [];
    vi.mocked(isPassPressed).mockImplementation(key => seen.includes(key));
    vi.mocked(isHeld).mockImplementation(key => down.includes(key));
  });
  const sound = vi.fn();
  const tick = vi.spyOn(transfer, 'tick');
  return {
    bag, textBox, transfer, session, read, sound, tick, tiles: session.tiles,
    press: (...keys: GameButton[]) => { pressed = keys; held = keys; },
    frame: () => session.frame(read, sound),
    frames: (n: number) => { for (let i = 0; i < n; i++) session.frame(read, sound); },
  };
}

beforeAll(async () => { await initTextSystem(); await loadTextPrograms(); });

beforeEach(() => {
  setTextSpeed('fast');
  textBgTransfer.enabled = true;
  textBgTransfer.resetPortion();
  vi.clearAllMocks();
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isHeld).mockReturnValue(false);
});

describe('StartMenu_Item', () => {
  const potions = (): ItemStack[] => [
    { id: 'POTION', count: 2 }, { id: 'ANTIDOTE', count: 1 }, { id: 'POKE_BALL', count: 4 },
    { id: 'BURN_HEAL', count: 1 }, { id: 'AWAKENING', count: 1 },
  ];

  it('writes the list at S, shows it at S+11, and reads at S+16 on the saved row', () => {
    const menu = rig(potions(), 1, 1);
    menu.session.open(menu.bag);
    expect(menu.tiles.at(4, 2)).toBe('┌');
    expect(menu.transfer.enabled).toBe(false);
    expect(menu.tiles.at(6, 4)).toBe(' ');
    menu.frames(10);
    expect(menu.transfer.enabled).toBe(true);
    expect(menu.tiles.at(6, 4)).toBe('A');
    expect(menu.tiles.visibleAt(6, 4)).toBeNull();
    menu.frame();
    expect(menu.tiles.visibleAt(6, 4)).toBe('A');
    menu.frames(2);
    expect(menu.tiles.at(5, 6)).toBe('▶');
    expect(menu.read).not.toHaveBeenCalled();
    menu.frames(2);
    expect(menu.read).not.toHaveBeenCalled();
    menu.frame();
    expect(menu.read).toHaveBeenCalledTimes(1);
    expect(getListScrollOffset()).toBe(1);
    expect(getBagSavedMenuItem()).toBe(1);
  });

  it('counts one transfer tick per frame and never a second joypad owner', () => {
    const menu = rig(potions());
    menu.session.open(menu.bag);
    for (let frame = 1; frame <= 16; frame++) {
      const ticks = menu.tick.mock.calls.length;
      const reads = menu.read.mock.calls.length;
      const syncs = vi.mocked(syncJoypadRead).mock.calls.length;
      if (frame === 16) menu.press('b');
      menu.frame();
      expect(menu.tick.mock.calls.length - ticks, `tick ${frame}`).toBe(1);
      const joy = (menu.read.mock.calls.length - reads) + (vi.mocked(syncJoypadRead).mock.calls.length - syncs);
      expect(joy, `owners ${frame}`).toBeLessThanOrEqual(1);
      expect(menu.read.mock.calls.length - reads > 0 && vi.mocked(syncJoypadRead).mock.calls.length > syncs).toBe(false);
    }
  });

  it('Down, B, then reopen puts ▶ on the row that was moved to', () => {
    const menu = rig(potions());
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('down');
    menu.frame();
    menu.frames(5);
    menu.press('b');
    expect(menu.frame()).toBe('closed');
    expect(getBagSavedMenuItem()).toBe(1);
    menu.session.open(menu.bag);
    menu.frames(13);
    expect(menu.tiles.at(5, 6)).toBe('▶');
    expect(menu.tiles.at(5, 4)).not.toBe('▶');
  });

  it('B saves the row, turns the transfer on, and drops the bag tiles', () => {
    const menu = rig(potions(), 1);
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('b');
    expect(menu.frame()).toBe('closed');
    expect(getBagSavedMenuItem()).toBe(1);
    expect(menu.transfer.enabled).toBe(true);
    expect(menu.textBox.active).toBe(false);
    expect(menu.tiles.at(4, 2)).toBeNull();
    expect(menu.tiles.visibleAt(4, 2)).toBeNull();
    menu.session.open(menu.bag);
    menu.frames(13);
    expect(menu.tiles.at(5, 6)).toBe('▶');
    expect(getListScrollOffset()).toBe(0);
  });

  it('keeps a scrolled offset across a close and the next open', () => {
    const menu = rig(potions(), 0, 1);
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('b');
    expect(menu.frame()).toBe('closed');
    expect(getListScrollOffset()).toBe(1);
    menu.session.open(menu.bag);
    menu.frames(10);
    expect(menu.tiles.at(6, 4)).toBe('A');
  });

  it('A draws ▷ and USE/TOSS at Q, and the menu reads at Q+3', () => {
    const menu = rig([{ id: 'POTION', count: 2 }, { id: 'ANTIDOTE', count: 1 }]);
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('a');
    expect(menu.frame()).toBe('open');
    expect(menu.tiles.at(5, 4)).toBe('▷');
    expect(menu.tiles.at(5, 6)).toBe(' ');
    expect(menu.tiles.at(5, 8)).toBe(' ');
    expect(menu.tiles.at(5, 10)).toBe(' ');
    expect(menu.tiles.at(13, 10)).toBe('┌');
    expect(menu.tiles.at(15, 11)).toBe('U');
    expect(menu.tiles.at(15, 13)).toBe('T');
    expect(menu.tiles.at(14, 11)).toBe('▶');
    const reads = menu.read.mock.calls.length;
    menu.frames(2);
    expect(menu.read).toHaveBeenCalledTimes(reads);
    menu.press('b');
    menu.frame();
    expect(menu.read).toHaveBeenCalledTimes(reads + 1);
    expect(menu.session.useTossChoice).toBe('b');
    expect(menu.sound).toHaveBeenCalledTimes(2);
    expect(menu.transfer.enabled).toBe(false);
  });

  it('A+B on USE/TOSS cancels, and B returns a visible list at R+11', () => {
    const menu = rig([{ id: 'POTION', count: 2 }]);
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('a', 'b');
    menu.frame();
    expect(menu.session.useTossChoice).toBe('b');
    expect(menu.transfer.enabled).toBe(false);
    // The shown copy keeps ▷ until the new list's first third, at R+11.
    expect(menu.tiles.visibleAt(5, 4)).toBe('▷');
    menu.frames(10);
    expect(menu.transfer.enabled).toBe(true);
    expect(menu.tiles.visibleAt(5, 4)).toBe('▷');
    menu.frame();
    expect(menu.tiles.visibleAt(5, 4)).toBe(' ');

    textBgTransfer.enabled = true;
    textBgTransfer.resetPortion();
    const again = rig([{ id: 'POTION', count: 2 }]);
    again.session.open(again.bag);
    again.frames(15);
    again.press('a');
    again.frame();
    again.frames(2);
    again.press('b');
    again.frame();
    expect(again.tiles.visibleAt(5, 4)).toBe('▷');
    again.frames(10);
    expect(again.tiles.visibleAt(5, 4)).toBe('▷');
    again.frame();
    expect(again.tiles.visibleAt(5, 4)).toBe(' ');
    expect(again.transfer.enabled).toBe(true);
  });

  /** List A, then Down to TOSS, then A. Ends on R, the frame the toss begins. */
  function chooseToss(menu: ReturnType<typeof rig>): void {
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('down');
    menu.frame();
    menu.frames(2);
    menu.press('a');
    menu.frame();
  }

  it('TOSS opens a silent quantity at R+1, then Is it OK at P with a glyph at P+3', () => {
    const menu = rig([{ id: 'POTION', count: 5 }]);
    chooseToss(menu);
    expect(menu.session.useTossChoice).toBe('toss');
    expect(menu.tiles.at(16, 10)).toBe('×');
    expect(menu.sound).toHaveBeenCalledTimes(2);
    const reads = menu.read.mock.calls.length;
    menu.frame();
    expect(menu.read).toHaveBeenCalledTimes(reads + 1);
    expect(menu.sound).toHaveBeenCalledTimes(2);
    menu.press('a');
    const sounds = menu.sound.mock.calls.length;
    menu.frame();
    expect(menu.sound).toHaveBeenCalledTimes(sounds);
    expect(menu.textBox.active).toBe(true);
    expect(menu.textBox.saveScreen().buffer.join('')).not.toContain('I');
    menu.frames(3);
    expect(menu.textBox.saveScreen().buffer.join('')).toContain('I');
  });

  it('YES tosses the selected stack, and a partial toss keeps the saved offset', () => {
    const menu = rig([{ id: 'POTION', count: 5 }]);
    setSavedListScrollOffset(4);
    chooseToss(menu);
    menu.press('a');
    menu.frame();
    menu.press('a');
    menu.frame();
    let prompted = false;
    let done = -1;
    for (let frame = 0; done < 0 && frame < 400; frame++) {
      if (menu.textBox.isWaitingForInput) prompted = true;
      vi.mocked(isHeld).mockImplementation(key => prompted && key === 'a');
      const reads = menu.read.mock.calls.length;
      menu.frame();
      expect(menu.read.mock.calls.length).toBe(reads);
      if (prompted && menu.textBox.isComplete && !menu.textBox.isWaitingForInput) done = frame;
    }
    expect(done).toBeGreaterThan(0);
    const decided = done;
    menu.frames(2);
    menu.press('a');
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 5 }]);
    menu.frames(14);
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 5 }]);
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 4 }]);
    expect(getSavedListScrollOffset()).toBe(4);
    expect(menu.textBox.active).toBe(true);
    expect(decided).toBeGreaterThan(0);
  });

  it('Up to 2, then YES, removes two from the stack', () => {
    const menu = rig([{ id: 'POTION', count: 5 }]);
    setSavedListScrollOffset(4);
    chooseToss(menu);
    menu.press('up');
    menu.frame();
    menu.press('a');
    menu.frame();
    menu.press('a');
    menu.frame();
    let prompted = false;
    for (let frame = 0; frame < 400; frame++) {
      if (menu.textBox.isWaitingForInput) prompted = true;
      vi.mocked(isHeld).mockImplementation(key => prompted && key === 'a');
      menu.frame();
      if (prompted && menu.textBox.isComplete && !menu.textBox.isWaitingForInput) break;
    }
    menu.frames(2);
    menu.press('a');
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 5 }]);
    menu.frames(14);
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 5 }]);
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 3 }]);
    expect(getSavedListScrollOffset()).toBe(4);
  });

  it('tosses only the selected duplicate, then keeps the message until the bottom third', () => {
    const menu = rig([{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }], 1);
    setSavedListScrollOffset(4);
    chooseToss(menu);
    menu.press('a');
    menu.frame();
    menu.press('a');
    menu.frame();
    const finishPrompt = () => {
      let prompted = false;
      for (let frame = 0; frame < 400; frame++) {
        if (menu.textBox.isWaitingForInput) prompted = true;
        vi.mocked(isHeld).mockImplementation(key => prompted && key === 'a');
        menu.frame();
        if (prompted && menu.textBox.isComplete && !menu.textBox.isWaitingForInput) return frame;
      }
      return -1;
    };
    const asked = finishPrompt();
    expect(asked).toBeGreaterThan(0);
    menu.frames(2);
    menu.press('a');
    menu.frame();
    menu.frames(14);
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }]);
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 99 }]);
    expect(getSavedListScrollOffset()).toBe(0);
    expect(getBagSavedMenuItem()).toBe(0);
    const threw = finishPrompt();
    expect(threw).toBeGreaterThan(0);
    expect(menu.textBox.saveScreen().buffer.join('')).toContain('Threw away');
    expect(menu.textBox.active).toBe(true);
    expect(menu.transfer.enabled).toBe(false);
    let dismissed = -1;
    for (let frame = 1; dismissed < 0 && frame < 40; frame++) {
      const third = menu.transfer.nextPortion;
      const enabled = menu.transfer.enabled;
      vi.mocked(isHeld).mockReturnValue(false);
      menu.frame();
      if (enabled && third === 2 && !menu.textBox.active) dismissed = frame;
    }
    expect(dismissed).toBeGreaterThan(10);
    expect(menu.textBox.active).toBe(false);
  });

  it('B on the quantity and NO leave the stack, and a key item has no quantity box', () => {
    const menu = rig([{ id: 'POTION', count: 2 }]);
    chooseToss(menu);
    menu.press('b');
    menu.frame();
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 2 }]);
    expect(menu.transfer.enabled).toBe(false);
    expect(menu.textBox.active).toBe(false);

    const no = rig([{ id: 'POTION', count: 2 }]);
    chooseToss(no);
    no.press('a');
    no.frame();
    no.press('a');
    no.frame();
    let prompted = false;
    for (let frame = 0; frame < 400 && !(prompted && no.textBox.isComplete); frame++) {
      if (no.textBox.isWaitingForInput) prompted = true;
      vi.mocked(isHeld).mockImplementation(key => prompted && key === 'a');
      no.frame();
    }
    expect(prompted).toBe(true);
    no.frames(2);
    no.press('b');
    no.frame();
    no.frames(15);
    expect(no.bag.items).toEqual([{ id: 'POTION', count: 2 }]);
    expect(no.textBox.active).toBe(true);

    const key = rig([{ id: 'TOWN_MAP', count: 1 }]);
    chooseToss(key);
    expect(key.tiles.at(16, 10)).not.toBe('×');
    expect(key.textBox.active).toBe(true);
    let impor = false;
    for (let frame = 0; frame < 80 && !impor; frame++) {
      key.frame();
      impor = key.textBox.saveScreen().buffer.join('').includes('impor');
    }
    expect(impor).toBe(true);
    expect(key.tiles.at(16, 10)).not.toBe('×');
  });

  function chooseUse(menu: ReturnType<typeof rig>): void {
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('a');
    expect(menu.frame()).toBe('open');
  }

  it('USE on a ball prints Oak at R+3 and returns to the list', () => {
    const menu = rig([{ id: 'POKE_BALL', count: 1 }]);
    chooseUse(menu);
    expect(menu.textBox.active).toBe(true);
    expect(menu.textBox.saveScreen().buffer.join('')).not.toContain('O');
    menu.frames(3);
    expect(menu.textBox.saveScreen().buffer.join('')).toContain('O');
    for (let frame = 0; frame < 900 && !menu.textBox.isComplete; frame++) {
      if (menu.textBox.isWaitingForInput) vi.mocked(isHeld).mockImplementation(key => key === 'a');
      else vi.mocked(isHeld).mockReturnValue(false);
      menu.frame();
    }
    expect(menu.textBox.isComplete).toBe(true);
    expect(menu.textBox.saveScreen().buffer.join('')).toContain('time');
    expect(menu.transfer.enabled).toBe(false);
  });

  it('USE on OAK\'S PARCEL prints that it is not yours to use', () => {
    const menu = rig([{ id: 'OAKS_PARCEL', count: 1 }]);
    chooseUse(menu);
    expect(menu.textBox.active).toBe(true);
    const before = menu.textBox.saveScreen().buffer.join('');
    expect(before).not.toContain('T');
    menu.frames(3);
    expect(menu.textBox.saveScreen().buffer.join('')).toContain('T');
    for (let frame = 0; frame < 900 && !menu.textBox.isComplete; frame++) {
      if (menu.textBox.isWaitingForInput) vi.mocked(isHeld).mockImplementation(key => key === 'a');
      else vi.mocked(isHeld).mockReturnValue(false);
      menu.frame();
    }
    expect(menu.textBox.isComplete).toBe(true);
    const shown = menu.textBox.saveScreen().buffer.join('');
    expect(shown).toContain('yours');
    expect(shown).not.toContain('time');
    expect(menu.transfer.enabled).toBe(false);
  });

  it('USE on the Town Map leaves for the map and ItemMenuLoop brings the bag back', () => {
    const menu = rig([{ id: 'TOWN_MAP', count: 1 }]);
    menu.session.open(menu.bag);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('a');
    expect(menu.frame()).toBe('town_map');
    expect(menu.textBox.active).toBe(false);
    menu.session.returnFromTownMap();
    textBgTransfer.resetPortion();
    expect(menu.transfer.enabled).toBe(false);
    expect(menu.tiles.at(4, 2)).toBe('┌');
    menu.frames(11);
    expect(menu.tiles.visibleAt(6, 4)).toBe('T');
  });
});
