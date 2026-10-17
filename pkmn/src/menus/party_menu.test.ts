import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TILE_SIZE } from '../core';
import type { BattlePokemon } from '../battle';
import { drawTile } from '../renderer';
import { isPressed } from '../input';
import { playSFX } from '../audio';
import { drawText } from './menu_render';
import { PartyMenu, loadPartyTiles } from './party_menu';
import { PARTY_HP_FRACTION_COL, formatHpFraction } from './hp_bar';
import { getPartyAndBillsSavedMenuItem, setPartyAndBillsSavedMenuItem } from '../list_state';
import { loadTextPrograms } from '../text/program_data';

vi.mock('../renderer', () => ({
  fillRect: vi.fn(), drawTile: vi.fn(),
  loadFont: vi.fn(async () => ({})), loadTileset: vi.fn(async () => ({})),
  getCtx: vi.fn(), getScale: () => 1,
}));
vi.mock('../renderer/ui_tiles', () => ({ uiTiles: { cover: vi.fn() } }));
vi.mock('./party_icons', () => ({ drawPartyIcon: vi.fn(), loadPartyIcons: vi.fn() }));
vi.mock('../audio', () => ({ playSFX: vi.fn() }));
vi.mock('../input', () => ({ isPressed: vi.fn(() => false) }));
vi.mock('../battle', () => ({ loadPokemonSprites: vi.fn(), expToNextLevel: () => 0 }));
vi.mock('./menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn() }));

function mon(currentHp: number, maxHp: number): BattlePokemon {
  return {
    species: { id: 19, name: 'RATTATA' },
    nickname: 'RATTATA',
    level: 5,
    currentHp,
    maxHp,
    status: null,
  } as BattlePokemon;
}

function press(key: 'a' | 'b' | 'up' | 'down'): void {
  vi.mocked(isPressed).mockImplementation(pressed => pressed === key);
}

function programLines(name: string): string[] {
  const file = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as {
    programs: Record<string, { op: string; program?: string; text?: string }[]>;
  };
  const far = file.programs[name][0].program ?? name;
  const text = file.programs[far][0].text ?? '';
  return text.replace(/<(?:DONE|PROMPT)>$/, '').split('\n');
}

beforeAll(async () => {
  await loadPartyTiles();
  await loadTextPrograms();
});

describe('PartyMenu HP row', () => {
  it('draws the fraction at column 13 from the static HP', () => {
    const menu = new PartyMenu();
    menu.show([mon(13, 39)]);
    menu.render();
    const fraction = vi.mocked(drawText).mock.calls.find(call => call[0] === formatHpFraction(13, 39));
    expect(fraction).toEqual([formatHpFraction(13, 39), PARTY_HP_FRACTION_COL * TILE_SIZE, TILE_SIZE]);
  });

  it('draws an HP override instead of the party data', () => {
    const menu = new PartyMenu();
    menu.show([mon(13, 39)]);
    menu.setHpOverride(0, { pixels: 3, shownHp: 7 });
    vi.mocked(drawTile).mockClear();
    menu.render();
    expect(vi.mocked(drawText).mock.calls).toContainEqual([
      formatHpFraction(7, 39), PARTY_HP_FRACTION_COL * TILE_SIZE, TILE_SIZE,
    ]);
    const fills = vi.mocked(drawTile).mock.calls
      .filter(call => call[3] === TILE_SIZE && call[2] >= 6 * TILE_SIZE && call[2] < 12 * TILE_SIZE)
      .map(call => call[1]);
    expect(fills).toEqual([4, 1, 1, 1, 1, 1]);
  });
});

describe('PartyMenu useItem and the saved cursor', () => {
  it('A picks the saved row and B cancels, both with press_ab, and Down wraps', () => {
    const menu = new PartyMenu();
    const party = [mon(13, 39), mon(10, 20)];
    setPartyAndBillsSavedMenuItem(1);
    menu.showForItem(party);
    press('a');
    expect(menu.update()).toBe('close');
    expect(menu.chosenIndex).toBe(1);
    expect(playSFX).toHaveBeenCalledWith('press_ab');
    expect(getPartyAndBillsSavedMenuItem()).toBe(1);

    menu.showForItem(party);
    press('b');
    expect(menu.update()).toBe('close');
    expect(menu.chosenIndex).toBe(-1);
    expect(playSFX).toHaveBeenCalledWith('press_ab');

    setPartyAndBillsSavedMenuItem(1);
    menu.showForItem(party);
    press('down');
    expect(menu.update()).toBeNull();
    press('a');
    expect(menu.update()).toBe('close');
    expect(menu.chosenIndex).toBe(0);
    expect(getPartyAndBillsSavedMenuItem()).toBe(0);
  });

  it('reopens the overworld menu on the row it closed on', () => {
    const menu = new PartyMenu();
    const party = [mon(13, 39), mon(10, 20)];
    setPartyAndBillsSavedMenuItem(0);
    menu.show(party);
    press('down');
    menu.update();
    press('b');
    expect(menu.update()).toBe('close');
    expect(getPartyAndBillsSavedMenuItem()).toBe(1);
    menu.show(party);
    press('a');
    menu.update();
    expect(menu.chosenIndex).toBe(-1);
    menu.showForItem(party);
    press('a');
    expect(menu.update()).toBe('close');
    expect(menu.chosenIndex).toBe(1);
  });

  it('battle still starts on row 0 and does not write the saved cursor', () => {
    const menu = new PartyMenu();
    const party = [mon(13, 39), mon(10, 20)];
    setPartyAndBillsSavedMenuItem(1);
    menu.showForBattle(party, 0, false);
    press('a');
    expect(menu.update()).toBeNull();
    press('a');
    expect(menu.update()).toBeNull();
    expect(menu.selectedSwitchIndex).toBe(-1);
    expect(getPartyAndBillsSavedMenuItem()).toBe(1);

    menu.showForBattle(party, 0, true);
    press('b');
    expect(menu.update()).toBeNull();
    expect(getPartyAndBillsSavedMenuItem()).toBe(1);
  });
});

describe('PartyMenu prompts', () => {
  it('draws the normal and SWITCH programs, not the invented line', () => {
    const menu = new PartyMenu();
    const party = [mon(13, 39), mon(10, 20)];
    setPartyAndBillsSavedMenuItem(0);
    menu.show(party);
    vi.mocked(drawText).mockClear();
    menu.render();
    const normal = programLines('PartyMenuNormalText');
    expect(normal).toEqual(['Choose a POKéMON.']);
    expect(vi.mocked(drawText).mock.calls).toContainEqual([normal[0], TILE_SIZE, 14 * TILE_SIZE]);

    press('a');
    menu.update();
    press('a');
    menu.update();
    vi.mocked(drawText).mockClear();
    menu.render();
    const swap = programLines('PartyMenuSwapMonText');
    expect(swap).toEqual(['Move POKéMON', 'where?']);
    expect(vi.mocked(drawText).mock.calls).toContainEqual([swap[0], TILE_SIZE, 14 * TILE_SIZE]);
    expect(vi.mocked(drawText).mock.calls).toContainEqual([swap[1], TILE_SIZE, 16 * TILE_SIZE]);
    expect(vi.mocked(drawText).mock.calls.some(call => call[0] === 'Move to where?')).toBe(false);

    menu.showForItem(party);
    vi.mocked(drawText).mockClear();
    menu.render();
    const item = programLines('PartyMenuItemUseText');
    expect(item[0]).toBe('Use item on which');
    expect(item[1]).toBe('POKéMON?');
    expect(vi.mocked(drawText).mock.calls).toContainEqual([item[0], TILE_SIZE, 14 * TILE_SIZE]);
    expect(vi.mocked(drawText).mock.calls).toContainEqual([item[1], TILE_SIZE, 16 * TILE_SIZE]);
  });
});
