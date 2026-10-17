import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Bag, addToInventory, removeFromInventoryAt, BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY,
  CLOSE_MENU_ITEMS, ITEM_USE_ROUTINE, PARTY_MENU_ITEMS,
} from './items';
import {
  getBagSavedMenuItem, getCurrentMenuItem, getListScrollOffset, getSavedListScrollOffset,
  setBagSavedMenuItem, setCurrentMenuItem, setListScrollOffset, setSavedListScrollOffset,
} from './list_state';
import type { ItemStack } from './items';
import { restoreBag } from './save';
import type { SaveData } from './save';
import { isPressed } from './input';
import { drawText } from './menus/menu_render';
import { Battle } from './battle/battle';
import { createPokemon, loadBattleData } from './battle/data';
import { loadGameText } from './text/game_text';

vi.mock('./input', () => ({ isPressed: vi.fn(() => false), isHeld: vi.fn(() => false) }));
vi.mock('./audio', () => ({ playSFX: vi.fn() }));
vi.mock('./menus/menu_render', () => ({ drawText: vi.fn(), drawBox: vi.fn() }));
vi.mock('./renderer', () => ({ fillRect: vi.fn() }));
vi.mock('./menus/party_icons', () => ({ loadPartyIcons: vi.fn(async () => {}), drawPartyIcon: vi.fn() }));
vi.mock('./menus/party_menu', async importOriginal => ({
  ...await importOriginal<typeof import('./menus/party_menu')>(), loadPartyTiles: vi.fn(async () => {}),
}));

beforeAll(async () => { await loadBattleData(); await loadGameText(); });

function full(capacity = BAG_ITEM_CAPACITY): ItemStack[] {
  return [{ id: 'POTION', count: 99 }, ...Array.from({ length: capacity - 1 }, (_, i) => ({ id: `ITEM_${i}`, count: 1 }))];
}

beforeEach(() => { vi.mocked(isPressed).mockReturnValue(false); vi.mocked(drawText).mockClear(); });

describe('AddItemToInventory_ slot order and byte arithmetic', () => {
  it('appends a new item', () => {
    const bag = new Bag();
    expect(bag.add('POTION')).toBe(true);
    expect(bag.items).toEqual([{ id: 'POTION', count: 1 }]);
  });
  it.each([
    [98, 1, [99]], [99, 1, [99, 1]], [50, 60, [99, 11]], [99, 99, [99, 99]],
    // add b is an eight-bit operation, even for an unusual saved quantity.
    [200, 60, [4]],
  ])('%i + %i yields slots %j', (existing, count, expected) => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: existing }];
    expect(bag.add('POTION', count)).toBe(true);
    expect(bag.items.map(item => item.count)).toEqual(expected);
  });
  it.each([BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY])('full capacity %i rejects new/overflowing items without writes', capacity => {
    const items = full(capacity);
    const before = structuredClone(items);
    expect(addToInventory(items, 'ANTIDOTE', 1, capacity)).toBe(false);
    expect(items).toEqual(before);
    expect(addToInventory(items, 'POTION', 1, capacity)).toBe(false);
    expect(items).toEqual(before);
    items[0].count = 98;
    expect(addToInventory(items, 'POTION', 1, capacity)).toBe(true);
    expect(items[0].count).toBe(99);
  });
  it.each([BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY])('capacity %i: later matching slots only receive overflow with room', capacity => {
    const items = full(capacity);
    items[items.length - 1] = { id: 'POTION', count: 50 };
    const before = structuredClone(items);
    expect(addToInventory(items, 'POTION', 1, capacity)).toBe(false);
    expect(items).toEqual(before); // first-overflow quirk
    items.splice(1, 1);
    expect(addToInventory(items, 'POTION', 1, capacity)).toBe(true);
    expect(items[items.length - 1]).toEqual({ id: 'POTION', count: 51 });
    expect(items).toHaveLength(capacity - 1);
  });
});

describe('RemoveItemFromInventory_ and save slots', () => {
  it('decrements the selected slot, removes only that empty slot, and shifts', () => {
    const items = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 2 }, { id: 'ANTIDOTE', count: 1 }];
    expect(removeFromInventoryAt(items, 1, 1)).toBe(true);
    expect(items[1].count).toBe(1);
    expect(removeFromInventoryAt(items, 1, 1)).toBe(true);
    expect(items).toEqual([{ id: 'POTION', count: 99 }, { id: 'ANTIDOTE', count: 1 }]);
  });
  it('RemoveItemByID takes only the first matching slot', () => {
    const bag = new Bag();
    bag.items = [{ id: 'POTION', count: 1 }, { id: 'POTION', count: 50 }];
    expect(bag.remove('POTION')).toBe(true);
    expect(bag.items).toEqual([{ id: 'POTION', count: 50 }]);
    expect(bag.removeAt(0, 51)).toBe(false);
    expect(bag.items[0].count).toBe(50);
  });
  it('zeroes the shared list cursors only when the removed quantity empties the slot', () => {
    setListScrollOffset(3);
    setCurrentMenuItem(1);
    setBagSavedMenuItem(2);
    setSavedListScrollOffset(4);
    const items = [{ id: 'POTION', count: 2 }, { id: 'ANTIDOTE', count: 1 }];
    expect(removeFromInventoryAt(items, 0, 1)).toBe(true);
    expect(getListScrollOffset()).toBe(3);
    expect(getCurrentMenuItem()).toBe(1);
    expect(getBagSavedMenuItem()).toBe(2);
    expect(getSavedListScrollOffset()).toBe(4);
    expect(removeFromInventoryAt(items, 0, 1)).toBe(true);
    expect(items).toEqual([{ id: 'ANTIDOTE', count: 1 }]);
    expect(getListScrollOffset()).toBe(0);
    expect(getCurrentMenuItem()).toBe(0);
    expect(getBagSavedMenuItem()).toBe(0);
    expect(getSavedListScrollOffset()).toBe(0);
    setListScrollOffset(5);
    const parcel = new Bag();
    parcel.items = [{ id: 'OAKS_PARCEL', count: 1 }];
    expect(parcel.remove('OAKS_PARCEL')).toBe(true);
    expect(getListScrollOffset()).toBe(0);
  });
  it('restores all saved slots verbatim, without aliasing or GiveItem merging', () => {
    const saved = { bag: full() } as SaveData;
    saved.bag[19] = { id: 'POTION', count: 1 };
    const bag = restoreBag(saved);
    expect(bag.items).toEqual(saved.bag);
    expect(bag.items[0]).not.toBe(saved.bag[0]);
  });
});

function press(menu: { update: () => unknown }, button = 'a'): void {
  vi.mocked(isPressed).mockImplementation(key => key === button);
  menu.update();
}

describe('inventory callers through menu input', () => {
  it('names the use routines for the items defined today', () => {
    expect(ITEM_USE_ROUTINE.POKE_BALL).toBe('ItemUseBall');
    expect(ITEM_USE_ROUTINE.TOWN_MAP).toBe('ItemUseTownMap');
    expect(ITEM_USE_ROUTINE.OAKS_PARCEL).toBe('ItemUseOaksParcel');
    expect(ITEM_USE_ROUTINE.POTION).toBe('ItemUseMedicine');
    expect(ITEM_USE_ROUTINE.ESCAPE_ROPE).toBe('ItemUseEscapeRope');
    expect(PARTY_MENU_ITEMS.has('POTION')).toBe(true);
    expect(PARTY_MENU_ITEMS.has('POKE_BALL')).toBe(false);
    expect(CLOSE_MENU_ITEMS.has('ESCAPE_ROPE')).toBe(true);
  });
  it.each(['POKE_BALL', 'POTION', 'ANTIDOTE'])('battle consumes the selected second %s slot', id => {
    const bag = new Bag(); bag.items = [{ id, count: 99 }, { id, count: 1 }];
    const player = createPokemon('RATTATA', 5)!; player.currentHp = 1; player.status = 'PSN';
    const enemy = createPokemon('PIDGEY', 3)!;
    const battle = new Battle(player, enemy, [player], bag);
    battle.state = 'choose_action';
    press(battle, 'down'); press(battle); // ITEM
    expect(battle.state).toBe('choose_item');
    press(battle, 'down'); press(battle);
    expect(bag.items).toEqual([{ id, count: 99 }]);
  });
});
