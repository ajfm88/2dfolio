import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bag, addToInventory, removeFromInventoryAt, BAG_ITEM_CAPACITY, PC_ITEM_CAPACITY } from './items';
import type { ItemStack } from './items';
import { restoreBag } from './save';
import type { SaveData } from './save';
import { ShopMenu } from './menus/shop_menu';
import { PcMenu } from './menus/pc_menu';
import { isPressed } from './input';
import { drawText } from './menus/menu_render';
import { ItemMenu } from './menus/item_menu';
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
  it('a failed buy leaves both the bag and money unchanged', () => {
    const bag = new Bag(); bag.items = full();
    const before = structuredClone(bag.items);
    const money = vi.fn();
    const menu = new ShopMenu(); menu.show(['POTION'], bag, 1000, money);
    press(menu); press(menu); press(menu);
    expect(bag.items).toEqual(before);
    expect(money).not.toHaveBeenCalled();
    menu.render();
    expect(drawText).toHaveBeenCalledWith("You can't carry", expect.any(Number), expect.any(Number));
    // Free a slot, dismiss the refusal, and repeat: money is charged once.
    bag.items.pop(); press(menu); press(menu); press(menu);
    expect(money).toHaveBeenCalledExactlyOnceWith(-300);
    expect(bag.items[19]).toEqual({ id: 'POTION', count: 1 });
  });
  it('selling a later duplicate removes that filtered bag slot', () => {
    const bag = new Bag();
    bag.items = [{ id: 'TOWN_MAP', count: 1 }, { id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const menu = new ShopMenu(); menu.show([], bag, 1000, vi.fn());
    press(menu, 'down'); press(menu); press(menu, 'down'); press(menu); press(menu);
    expect(bag.items).toEqual([{ id: 'TOWN_MAP', count: 1 }, { id: 'POTION', count: 99 }]);
  });
  it('failed withdrawal changes neither inventory; retry removes the selected PC slot', () => {
    const bag = new Bag(); bag.items = full();
    const pc = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const before = structuredClone(bag.items);
    const menu = new PcMenu(); menu.show(bag, pc);
    press(menu); press(menu, 'down'); press(menu); press(menu);
    expect(bag.items).toEqual(before);
    expect(pc).toEqual([{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }]);
    menu.render();
    expect(drawText).toHaveBeenCalledWith("You can't carry", expect.any(Number), expect.any(Number));
    bag.items.pop(); press(menu); press(menu); press(menu);
    expect(pc).toEqual([{ id: 'POTION', count: 99 }]);
    expect(bag.items[19]).toEqual({ id: 'POTION', count: 1 });
  });
  it('deposit removes the selected bag slot', () => {
    const bag = new Bag(); bag.items = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const pc: ItemStack[] = [];
    const menu = new PcMenu(); menu.show(bag, pc);
    press(menu, 'down'); press(menu); press(menu, 'down'); press(menu); press(menu);
    expect(bag.items).toEqual([{ id: 'POTION', count: 99 }]);
    expect(pc).toEqual([{ id: 'POTION', count: 1 }]);
  });
  it('PC toss removes the selected duplicate slot', () => {
    const bag = new Bag();
    const pc = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const menu = new PcMenu(); menu.show(bag, pc);
    press(menu, 'down'); press(menu, 'down'); press(menu); press(menu, 'down');
    press(menu); press(menu); press(menu);
    expect(pc).toEqual([{ id: 'POTION', count: 99 }]);
  });
  it('bag toss removes only the selected duplicate', () => {
    const bag = new Bag(); bag.items = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const menu = new ItemMenu(); menu.show(bag, []);
    press(menu, 'down'); press(menu); press(menu, 'down'); press(menu); press(menu); press(menu);
    expect(bag.items).toEqual([{ id: 'POTION', count: 99 }]);
  });
  it('field healing uses the selected duplicate medicine slot', () => {
    const bag = new Bag(); bag.items = [{ id: 'POTION', count: 99 }, { id: 'POTION', count: 1 }];
    const mon = createPokemon('RATTATA', 5)!; mon.currentHp = 1;
    const menu = new ItemMenu(); menu.show(bag, [mon]);
    press(menu, 'down'); press(menu); press(menu); press(menu);
    expect(bag.items).toEqual([{ id: 'POTION', count: 99 }]);
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
