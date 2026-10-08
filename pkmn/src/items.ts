// Simple item inventory system

export interface ItemStack {
  id: string;
  count: number;
}

export type ItemCategory = "ball" | "medicine" | "key" | "other";

interface ItemDef {
  category: ItemCategory;
  price: number;
}

const ITEM_DEFS: Record<string, ItemDef> = {
  POKE_BALL: { category: "ball", price: 200 },
  GREAT_BALL: { category: "ball", price: 600 },
  ULTRA_BALL: { category: "ball", price: 1200 },
  MASTER_BALL: { category: "ball", price: 0 },
  POTION: { category: "medicine", price: 300 },
  SUPER_POTION: { category: "medicine", price: 700 },
  HYPER_POTION: { category: "medicine", price: 1500 },
  MAX_POTION: { category: "medicine", price: 2500 },
  FULL_RESTORE: { category: "medicine", price: 3000 },
  ANTIDOTE: { category: "medicine", price: 100 },
  PARALYZE_HEAL: { category: "medicine", price: 200 },
  BURN_HEAL: { category: "medicine", price: 250 },
  ICE_HEAL: { category: "medicine", price: 250 },
  AWAKENING: { category: "medicine", price: 200 },
  FULL_HEAL: { category: "medicine", price: 600 },
  REVIVE: { category: "medicine", price: 1500 },
  ESCAPE_ROPE: { category: "other", price: 550 },
  REPEL: { category: "other", price: 350 },
  SUPER_REPEL: { category: "other", price: 500 },
  MAX_REPEL: { category: "other", price: 700 },
  OAKS_PARCEL: { category: "key", price: 0 },
  TOWN_MAP: { category: "key", price: 0 },
};

// Dynamic item display names — loaded from ROM or static data at startup
let itemDisplayNames: Record<string, string> = {};

/** Initialize item display names (called during startup after data loads). */
export function initItemNames(names: Record<string, string>): void {
  itemDisplayNames = names;
}

export function getAllItemIds(): string[] {
  return Object.keys(ITEM_DEFS);
}

export function getItemName(id: string): string {
  return itemDisplayNames[id] ?? id.replace(/_/g, " ");
}

export function getItemCategory(id: string): ItemCategory {
  return ITEM_DEFS[id]?.category ?? "other";
}

export function getItemPrice(id: string): number {
  return ITEM_DEFS[id]?.price ?? 0;
}

export function isBall(id: string): boolean {
  return getItemCategory(id) === "ball";
}

export function isKeyItem(id: string): boolean {
  return getItemCategory(id) === "key";
}

export function isTossable(id: string): boolean {
  return !isKeyItem(id);
}

// Assembly: constants/menu_constants.asm
export const BAG_ITEM_CAPACITY = 20;
export const PC_ITEM_CAPACITY = 50;

/** AddItemToInventory_ (engine/items/inventory.asm): scan in slot order, splitting
 * at 99 only when a new slot is available. A full inventory fails at its FIRST
 * overflowing matching stack, even if a later stack has room. */
export function addToInventory(
  items: ItemStack[],
  id: string,
  count: number,
  capacity: number
): boolean {
  const room = items.length < capacity;
  let remaining = count;
  for (const item of items) {
    if (item.id !== id) continue;
    const sum = (item.count + remaining) & 0xff;
    if (sum < 100) {
      item.count = sum;
      return true;
    }
    // No writes have happened if room is false, so failure is atomic.
    if (!room) return false;
    item.count = 99;
    remaining = sum - 99;
  }
  if (!room) return false;
  items.push({ id, count: remaining });
  return true;
}

/** RemoveItemFromInventory_ (engine/items/inventory.asm): subtract from the
 * selected slot; remove just that slot at zero and shift later slots up. */
export function removeFromInventoryAt(items: ItemStack[], index: number, count: number): boolean {
  const item = items[index];
  if (!item || count < 0 || item.count < count) return false;
  item.count -= count;
  if (item.count === 0) items.splice(index, 1);
  return true;
}

/** Remove items from an inventory array. Returns false if insufficient. */
export function removeFromInventory(
  items: ItemStack[],
  id: string,
  count: number
): boolean {
  return removeFromInventoryAt(items, items.findIndex(i => i.id === id), count);
}

/** The player's bag. */
export class Bag {
  items: ItemStack[] = [];

  add(id: string, count = 1): boolean {
    return addToInventory(this.items, id, count, BAG_ITEM_CAPACITY);
  }

  remove(id: string, count = 1): boolean {
    // RemoveItemByID (engine/menus/pc.asm): the first matching slot only.
    return removeFromInventory(this.items, id, count);
  }

  removeAt(index: number, count = 1): boolean {
    return removeFromInventoryAt(this.items, index, count);
  }

  getCount(id: string): number {
    return this.items.find((i) => i.id === id)?.count ?? 0;
  }

  getBalls(): ItemStack[] {
    return this.items.filter((i) => isBall(i.id));
  }

  getMedicine(): ItemStack[] {
    return this.items.filter((i) => getItemCategory(i.id) === "medicine");
  }
}
