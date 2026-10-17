import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BagSession } from './bag';
import { applyFieldMedicine } from './field_medicine';
import { PartyMenu } from './party_menu';
import { TextBox, initTextSystem, setTextSpeed } from '../text/textbox';
import { textBgTransfer } from '../text/bg_transfer';
import { loadTextPrograms } from '../text/program_data';
import { Bag, type ItemStack } from '../items';
import { createPokemon, loadBattleData } from '../battle/data';
import type { BattlePokemon } from '../battle';
import type { StatusCondition } from '../battle/types';
import {
  getListScrollOffset, getSavedListScrollOffset, setBagSavedMenuItem, setCurrentMenuItem,
  setListScrollOffset, setPartyAndBillsSavedMenuItem, setSavedListScrollOffset,
} from '../list_state';
import { isHeld, isPassPressed, isPressed, syncJoypadRead } from '../input';
import { playSFX } from '../audio';
import { getPikachuHappiness, resetPikachuHappiness } from '../pikachu/pikachu_happiness';
import { getPikachuSpawnState, setPikachuSpawnState } from '../pikachu/pikachu_spawn';
import type { GameButton } from '../core';

vi.mock('../input', () => ({
  isHeld: vi.fn(() => false), isPassPressed: vi.fn(() => false), isPressed: vi.fn(() => false),
  syncJoypadRead: vi.fn(), readJoypad: vi.fn(),
}));
const sound = { done: true };
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => sound.done }));
vi.mock('../renderer', () => ({
  fillRect: vi.fn(), drawTile: vi.fn(), loadFont: vi.fn(async () => ({})), loadTileset: vi.fn(async () => ({})),
  getCtx: vi.fn(), getScale: () => 1,
}));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));
vi.mock('./party_icons', () => ({ drawPartyIcon: vi.fn(), loadPartyIcons: vi.fn() }));
vi.mock('../overworld/ui_entry', () => ({ setOpeningSpriteUpdates: vi.fn() }));

function mon(id: string | number, hp: number, max: number, status: StatusCondition = null): BattlePokemon {
  const pokemon = createPokemon(id, 5)!;
  pokemon.currentHp = hp;
  pokemon.maxHp = max;
  pokemon.status = status;
  return pokemon;
}

function rig(items: ItemStack[], party: BattlePokemon[]) {
  setListScrollOffset(0);
  setBagSavedMenuItem(0);
  setCurrentMenuItem(0);
  setSavedListScrollOffset(0);
  setPartyAndBillsSavedMenuItem(0);
  const bag = new Bag();
  bag.items = items.map(entry => ({ ...entry }));
  const textBox = new TextBox();
  const session = new BagSession(textBox, textBgTransfer);
  let pressed: GameButton[] = [];
  let held: GameButton[] = [];
  const read = vi.fn(() => {
    const seen = pressed;
    const down = held;
    pressed = [];
    vi.mocked(isPassPressed).mockImplementation(key => seen.includes(key));
    vi.mocked(isPressed).mockImplementation(key => seen.includes(key));
    vi.mocked(isHeld).mockImplementation(key => down.includes(key));
  });
  const pressSound = vi.fn();
  const tick = vi.spyOn(textBgTransfer, 'tick');
  return {
    bag, party, textBox, session, read, pressSound, tick,
    press: (...keys: GameButton[]) => { pressed = keys; held = keys; },
    release: () => { pressed = []; held = []; },
    frame: () => session.frame(read, pressSound),
    frames: (n: number) => { for (let i = 0; i < n; i++) session.frame(read, pressSound); },
  };
}

function chooseUse(menu: ReturnType<typeof rig>): void {
  menu.session.open(menu.bag, menu.party);
  menu.frames(15);
  menu.press('a');
  menu.frame();
  menu.frames(2);
  menu.press('a');
  menu.frame();
}

beforeAll(async () => {
  await initTextSystem();
  await loadTextPrograms();
  await loadBattleData();
});

beforeEach(() => {
  setTextSpeed('fast');
  textBgTransfer.enabled = true;
  textBgTransfer.resetPortion();
  sound.done = true;
  resetPikachuHappiness();
  setPikachuSpawnState(0);
  vi.clearAllMocks();
  vi.mocked(isPassPressed).mockReturnValue(false);
  vi.mocked(isPressed).mockReturnValue(false);
  vi.mocked(isHeld).mockReturnValue(false);
});

describe('applyFieldMedicine', () => {
  it('heals HP items and refuses the ones that cannot', () => {
    const potion = mon('RATTATA', 13, 39);
    expect(applyFieldMedicine('POTION', potion)).toMatchObject({ effect: 'hp', newHp: 33, program: 'PotionText', sound: 'heal_hp' });
    const superPotion = mon('RATTATA', 10, 80);
    expect(applyFieldMedicine('SUPER_POTION', superPotion).newHp).toBe(60);
    const hyper = mon('RATTATA', 10, 300);
    expect(applyFieldMedicine('HYPER_POTION', hyper).newHp).toBe(210);
    const max = mon('RATTATA', 10, 80);
    expect(applyFieldMedicine('MAX_POTION', max).newHp).toBe(80);
    const clamped = mon('RATTATA', 90, 100);
    expect(applyFieldMedicine('POTION', clamped).newHp).toBe(100);

    const full = mon('RATTATA', 20, 20);
    expect(applyFieldMedicine('POTION', full).effect).toBe('none');
    const fainted = mon('RATTATA', 0, 20);
    expect(applyFieldMedicine('POTION', fainted).effect).toBe('none');
    const live = mon('RATTATA', 4, 20);
    expect(applyFieldMedicine('REVIVE', live).effect).toBe('none');
  });

  it('revives with floor(max/2) or full, and respawns only the starter', () => {
    const half = mon('RATTATA', 0, 39);
    expect(applyFieldMedicine('REVIVE', half)).toMatchObject({ effect: 'hp', newHp: 19, program: 'ReviveText', respawn: false });
    expect(getPikachuSpawnState()).toBe(0);
    const odd = mon('RATTATA', 0, 5);
    expect(applyFieldMedicine('REVIVE', odd).newHp).toBe(2);
    const maxed = mon('RATTATA', 0, 40);
    expect(applyFieldMedicine('MAX_REVIVE', maxed).newHp).toBe(40);
    const pikachu = mon(25, 0, 20);
    expect(applyFieldMedicine('REVIVE', pikachu)).toMatchObject({ newHp: 10, respawn: true });
    expect(getPikachuSpawnState()).toBe(3);
  });

  it('cures a matching status, including Full Restore at full HP, and ignores HP', () => {
    const poisoned = mon('RATTATA', 0, 20, 'PSN');
    expect(applyFieldMedicine('ANTIDOTE', poisoned)).toMatchObject({ effect: 'status', program: 'AntidoteText', sound: 'heal_ailment' });
    expect(poisoned.status).toBeNull();
    expect(poisoned.currentHp).toBe(0);
    const burned = mon('RATTATA', 10, 20, 'BRN');
    expect(applyFieldMedicine('ANTIDOTE', burned).effect).toBe('none');
    expect(burned.status).toBe('BRN');
    const asleep = mon('RATTATA', 10, 20, 'SLP');
    expect(applyFieldMedicine('AWAKENING', asleep).effect).toBe('status');
    const healthy = mon('RATTATA', 0, 20, null);
    expect(applyFieldMedicine('FULL_HEAL', healthy).effect).toBe('none');

    const fullStatus = mon('RATTATA', 20, 20, 'PSN');
    expect(applyFieldMedicine('FULL_RESTORE', fullStatus)).toMatchObject({
      effect: 'status', program: 'FullHealText', sound: 'heal_ailment', newHp: 20,
    });
    expect(fullStatus.status).toBeNull();
    const fullClean = mon('RATTATA', 20, 20, null);
    expect(applyFieldMedicine('FULL_RESTORE', fullClean).effect).toBe('none');
    const hurt = mon('RATTATA', 10, 50, 'PSN');
    expect(applyFieldMedicine('FULL_RESTORE', hurt)).toMatchObject({ effect: 'hp', newHp: 50, program: 'PotionText', sound: 'heal_hp' });
    expect(hurt.status).toBeNull();
  });

  it('raises happiness only for the starter, and only for an item at or below Calcium, before the effect check', () => {
    expect(getPikachuHappiness()).toBe(90);
    applyFieldMedicine('POTION', mon('RATTATA', 20, 20));
    expect(getPikachuHappiness()).toBe(90);
    applyFieldMedicine('POTION', mon(25, 20, 20));
    expect(getPikachuHappiness()).toBe(95);
    applyFieldMedicine('ANTIDOTE', mon(25, 10, 20, 'BRN'));
    expect(getPikachuHappiness()).toBe(100);
    const before = getPikachuHappiness();
    applyFieldMedicine('FULL_HEAL', mon(25, 10, 20, 'PSN'));
    applyFieldMedicine('REVIVE', mon(25, 0, 20));
    expect(getPikachuHappiness()).toBe(before);
  });
});

describe('FieldMedicine frames', () => {
  function openToRead(menu: ReturnType<typeof rig>): void {
    chooseUse(menu);
    expect(menu.session.paletteWhite).toBe(true);
    const reads = menu.read.mock.calls.length;
    menu.frames(11);
    expect(menu.session.paletteWhite).toBe(true);
    expect(menu.read).toHaveBeenCalledTimes(reads);
    menu.frame();
    expect(menu.session.paletteWhite).toBe(false);
    menu.frames(2);
    expect(menu.read).toHaveBeenCalledTimes(reads);
  }

  it('whites out through R+12 and reads at R+15, one tick and no second joypad', () => {
    const menu = rig([{ id: 'POTION', count: 2 }], [mon('RATTATA', 13, 39)]);
    menu.session.open(menu.bag, menu.party);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('a');
    const ticks = menu.tick.mock.calls.length;
    const reads = menu.read.mock.calls.length;
    menu.frame();
    expect(menu.session.paletteWhite).toBe(true);
    for (let frame = 1; frame <= 15; frame++) {
      const beforeTicks = menu.tick.mock.calls.length;
      const beforeReads = menu.read.mock.calls.length;
      const syncs = vi.mocked(syncJoypadRead).mock.calls.length;
      menu.release();
      menu.frame();
      expect(menu.tick.mock.calls.length - beforeTicks, `tick ${frame}`).toBe(1);
      const owners = (menu.read.mock.calls.length - beforeReads) + (vi.mocked(syncJoypadRead).mock.calls.length - syncs);
      expect(owners, `owners ${frame}`).toBeLessThanOrEqual(1);
      if (frame < 15) expect(menu.read).toHaveBeenCalledTimes(beforeReads);
      else expect(menu.read.mock.calls.length).toBe(beforeReads + 1);
      if (frame < 12) expect(menu.session.paletteWhite).toBe(true);
      if (frame === 12) expect(menu.session.paletteWhite).toBe(false);
    }
    expect(menu.tick.mock.calls.length).toBeGreaterThan(ticks);
    expect(menu.read.mock.calls.length).toBeGreaterThan(reads);
  });

  it('B cancels and the bag is visible at P+19, first read P+22', () => {
    const menu = rig([{ id: 'POTION', count: 2 }], [mon('RATTATA', 13, 39)]);
    openToRead(menu);
    const hp = menu.party[0].currentHp;
    menu.press('b');
    menu.frame();
    expect(menu.session.paletteWhite).toBe(true);
    expect(menu.party[0].currentHp).toBe(hp);
    expect(menu.bag.items[0].count).toBe(2);
    menu.frames(18);
    expect(menu.session.paletteWhite).toBe(true);
    menu.frame();
    expect(menu.session.paletteWhite).toBe(false);
    const reads = menu.read.mock.calls.length;
    menu.frames(2);
    expect(menu.read).toHaveBeenCalledTimes(reads);
    menu.frame();
    expect(menu.read.mock.calls.length).toBe(reads + 1);
  });

  it('plays press_ab, waits, then the heal sound, and removes the selected stack', () => {
    const menu = rig(
      [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }],
      [mon('RATTATA', 1, 300)],
    );
    setBagSavedMenuItem(1);
    setSavedListScrollOffset(4);
    openToRead(menu);
    sound.done = false;
    menu.press('a');
    menu.frame();
    expect(playSFX).toHaveBeenCalledWith('press_ab');
    expect(playSFX).not.toHaveBeenCalledWith('heal_hp');
    expect(menu.party[0].currentHp).toBe(21);
    expect(menu.bag.items).toEqual([{ id: 'POTION', count: 99 }]);
    const reads = menu.read.mock.calls.length;
    menu.release();
    menu.frames(2);
    expect(playSFX).not.toHaveBeenCalledWith('heal_hp');
    expect(menu.read).toHaveBeenCalledTimes(reads);
    sound.done = true;
    menu.frame();
    expect(playSFX).toHaveBeenCalledWith('heal_hp');
    expect(getSavedListScrollOffset()).toBe(0);
  });

  it('an emptied stack resets the list, and a no-effect potion does not', () => {
    const emptied = rig([{ id: 'POTION', count: 1 }], [mon('RATTATA', 1, 30)]);
    openToRead(emptied);
    setListScrollOffset(2);
    emptied.press('a');
    emptied.frame();
    expect(emptied.bag.items).toEqual([]);
    expect(getListScrollOffset()).toBe(0);

    resetPikachuHappiness();
    const full = rig([{ id: 'POTION', count: 2 }], [mon(25, 20, 20)]);
    openToRead(full);
    const before = getPikachuHappiness();
    full.press('a');
    full.frame();
    expect(full.party[0].currentHp).toBe(20);
    expect(full.bag.items[0].count).toBe(2);
    expect(getPikachuHappiness()).toBe(before + 5);
    expect(full.textBox.active).toBe(true);
  });
});

describe('the result screen (review note 46 F-2, F-3, N-1, N-2)', () => {
  function screenText(menu: ReturnType<typeof rig>): string {
    return menu.textBox.active ? menu.textBox.saveScreen().buffer.join('') : '';
  }
  function useOn(menu: ReturnType<typeof rig>): void {
    menu.session.open(menu.bag, menu.party);
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.frames(2);
    menu.press('a');
    menu.frame();
    menu.release();
    menu.frames(15);
    menu.press('a');
    menu.frame();
    menu.release();
  }

  it.each(['Pikachu', 'Sparky'])('prints %s in capitals in the medicine result without changing its saved nickname', nickname => {
    const pokemon = mon(25, 13, 39);
    pokemon.nickname = nickname;
    const menu = rig([{ id: 'POTION', count: 1 }], [pokemon]);
    useOn(menu);
    for (let frame = 0; frame < 400 && !screenText(menu).includes('recovered'); frame++) menu.frame();
    expect(screenText(menu)).toContain(nickname.toUpperCase());
    expect(screenText(menu)).toContain('recovered by 20!');
    expect(screenText(menu)).not.toContain(nickname);
    expect(pokemon.nickname).toBe(nickname);
  });

  it('prints the result, all at once, and keeps it until a press returns to the bag', () => {
    const menu = rig([{ id: 'POTION', count: 2 }], [mon('RATTATA', 13, 39)]);
    useOn(menu);
    expect(menu.party[0].currentHp).toBe(33);
    let shown = -1;
    for (let frame = 0; frame < 400 && shown < 0; frame++) {
      menu.frame();
      const text = screenText(menu);
      // No delay: the first frame with any glyph already holds the whole message.
      if (/[A-Za-z]/.test(text)) {
        shown = frame;
        expect(text).toContain('recovered by 20!');
      }
    }
    expect(shown).toBeGreaterThan(70);
    // 3 frames of thirds, 50 frames, then the silent wait: nothing returns without a press.
    menu.frames(120);
    expect(screenText(menu)).toContain('recovered by 20!');
    expect(menu.session.paletteWhite).toBe(false);
    menu.press('a');
    menu.frame();
    menu.release();
    expect(menu.session.paletteWhite).toBe(true);
    expect(menu.textBox.active).toBe(false);
  });

  it('cures and says so: "cured of poison!"', () => {
    const menu = rig([{ id: 'ANTIDOTE', count: 1 }], [mon('RATTATA', 20, 39, 'PSN')]);
    useOn(menu);
    let text = '';
    for (let frame = 0; frame < 200 && !text.includes('cured'); frame++) {
      menu.frame();
      text = screenText(menu);
    }
    expect(text).toContain('cured of poison!');
    expect(menu.party[0].status).toBeNull();
  });

  it('the row keeps its pre-use color and status until the redraw; ▷ after the choice, no cursor after', () => {
    const spy = vi.spyOn(PartyMenu.prototype, 'setHpOverride');
    const menu = rig([{ id: 'FULL_RESTORE', count: 1 }], [mon('RATTATA', 1, 39, 'PSN')]);
    useOn(menu);
    expect(menu.party[0].status).toBeNull();
    const party = spy.mock.contexts[0] as PartyMenu;
    expect(spy.mock.calls[0][1]).toMatchObject({ shownHp: 1, pixels: 1, colorPixels: 1, status: 'PSN' });
    expect(party.cursorGlyph).toBe('▷');
    for (let frame = 0; frame < 400 && !screenText(menu).includes('recovered'); frame++) menu.frame();
    const calls = spy.mock.calls;
    const live = calls.map(call => call[1]).filter(o => o !== null);
    // 1 → 39 of 39 HP: the bar walks from red (1 px) through yellow and green lengths…
    expect(live.some(o => (o?.pixels ?? 0) >= 27)).toBe(true);
    // …but the palette and the status text stay as last drawn (SetPartyMenuHPBarColor runs
    // only in RedrawPartyMenu_).
    expect(live.every(o => o?.colorPixels === 1 && o?.status === 'PSN')).toBe(true);
    expect(calls[calls.length - 1][1]).toBeNull();
    expect(party.cursorVisible).toBe(false);
    spy.mockRestore();
  });
});
