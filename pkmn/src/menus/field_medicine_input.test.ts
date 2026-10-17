// The item-use party menu with the real input module: per-tick key edges (updateInput) and
// the menu's own Joypad reads (readJoypad / isPassPressed). The other medicine tests mock
// input as "pressed until read", which hid review note 46 F-1 (a read every third frame).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { (globalThis as unknown as { window: unknown }).window = { addEventListener() {} }; });
import { BagSession } from './bag';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms } from '../text/program_data';
import { Bag } from '../items';
import { createPokemon, loadBattleData } from '../battle/data';
import type { BattlePokemon } from '../battle';
import { readJoypad, setKey, updateInput } from '../input';
import type { GameButton } from '../core';
import {
  setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setPartyAndBillsSavedMenuItem,
  setSavedListScrollOffset,
} from '../list_state';

vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../renderer', () => ({
  fillRect: vi.fn(), drawTile: vi.fn(), loadFont: vi.fn(async () => ({})), loadTileset: vi.fn(async () => ({})),
  getCtx: vi.fn(), getScale: () => 1,
}));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));
vi.mock('./party_icons', () => ({ drawPartyIcon: vi.fn(), loadPartyIcons: vi.fn() }));
vi.mock('../overworld/ui_entry', () => ({ setOpeningSpriteUpdates: vi.fn() }));

const BUTTONS: GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];

beforeAll(async () => {
  await initTextSystem();
  await loadTextPrograms();
  await loadBattleData();
});

beforeEach(() => {
  setTextSpeed('fast');
  textBgTransfer.enabled = true;
  textBgTransfer.resetPortion();
  setListScrollOffset(0);
  setBagSavedMenuItem(0);
  setCurrentMenuItem(0);
  setSavedListScrollOffset(0);
  setPartyAndBillsSavedMenuItem(0);
  for (const key of BUTTONS) setKey(key, false);
  updateInput();
  readJoypad();
});

function hurt(hp: number): BattlePokemon {
  const mon = createPokemon('RATTATA', 5)!;
  mon.maxHp = 39;
  mon.currentHp = hp;
  return mon;
}

/**
 * Opens START → ITEM → POTION → USE with real taps; returns at R (the USE press frame).
 * A read counts a key only if the previous read saw it up (Joypad's hJoyLast), so each
 * tap follows a read with the key released.
 */
function toPartyMenu(party: BattlePokemon[]) {
  const bag = new Bag();
  bag.items = [{ id: 'POTION', count: 3 }];
  const session = new BagSession(new TextBox(), textBgTransfer);
  session.open(bag, party);
  const tick = (...down: GameButton[]) => {
    for (const key of BUTTONS) setKey(key, down.includes(key));
    updateInput();
    session.frame(readJoypad, () => {});
  };
  for (let i = 0; i < 16; i++) tick();   // the list's first read, S+16, sees A up
  tick('a');                             // A on POTION at S+17 (Q)
  tick(); tick(); tick();                // USE/TOSS's first read, Q+3, sees A up
  tick('a');                             // A on USE at Q+4 (R)
  expect(session.medicineOpen).toBe(true);
  return { bag, session, tick };
}

describe('item-use party menu input (note 46 F-1)', () => {
  it('a one-frame tap on any of three consecutive frames selects the Pokémon', () => {
    for (const offset of [0, 1, 2]) {
      const mon = hurt(13);
      const { bag, tick } = toPartyMenu([mon]);
      // R+15 is the first read and sees A up; taps at R+16, R+17, R+18.
      for (let i = 0; i < 15 + offset; i++) tick();
      tick('a');
      tick();
      expect(bag.items[0].count, `offset ${offset}`).toBe(2);
      expect(mon.currentHp, `offset ${offset}`).toBe(33);
    }
  });

  it('does not read before R+15: a tap released before then is lost', () => {
    const mon = hurt(13);
    const { bag, tick } = toPartyMenu([mon]);
    for (let i = 0; i < 13; i++) tick();
    tick('a');                                     // R+14, released at R+15
    for (let i = 0; i < 4; i++) tick();
    expect(bag.items[0].count).toBe(3);
  });

  it('a cursor move is followed by Delay3: a tap inside it is lost, a key held into the read counts', () => {
    const first = hurt(13);
    const second = hurt(13);
    const { bag, tick } = toPartyMenu([first, second]);
    for (let i = 0; i < 15; i++) tick();           // R+15: the first read
    tick('down');                                  // R+16: the cursor moves to row 1
    tick('a');                                     // R+17: inside Delay3, not read
    tick();                                        // R+18
    expect(bag.items[0].count).toBe(3);
    tick('a');                                     // R+19: read
    tick();
    expect(second.currentHp).toBe(33);
    expect(first.currentHp).toBe(13);

    // The first use saved row 1 (wPartyAndBillsPCSavedMenuItem); start the second on row 0.
    setPartyAndBillsSavedMenuItem(0);
    const a = hurt(13);
    const b = hurt(13);
    const again = toPartyMenu([a, b]);
    for (let i = 0; i < 15; i++) again.tick();
    again.tick('down');                            // R+16
    again.tick('a');                               // R+17, held …
    again.tick('a');                               // R+18, …
    again.tick('a');                               // R+19: the read sees A newly down since R+16
    again.tick();
    expect(b.currentHp).toBe(33);
  });

  it('A and B together cancel: HandlePartyMenuInput tests B first', () => {
    const mon = hurt(13);
    const { bag, tick } = toPartyMenu([mon]);
    for (let i = 0; i < 15; i++) tick();
    tick('a', 'b');
    tick();
    expect(bag.items[0].count).toBe(3);
    expect(mon.currentHp).toBe(13);
  });
});
