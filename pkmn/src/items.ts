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

/** Add items to an inventory array, respecting capacity. Returns false if no room. */
export function addToInventory(
  items: ItemStack[],
  id: string,
  count: number,
  capacity: number
): boolean {
  const existing = items.find((i) => i.id === id);
  if (existing) {
    existing.count += count;
    return true;
  }
  if (items.length >= capacity) return false;
  items.push({ id, count });
  return true;
}

/** Remove items from an inventory array. Returns false if insufficient. */
export function removeFromInventory(
  items: ItemStack[],
  id: string,
  count: number
): boolean {
  const existing = items.find((i) => i.id === id);
  if (!existing || existing.count < count) return false;
  existing.count -= count;
  if (existing.count <= 0) {
    const idx = items.indexOf(existing);
    if (idx >= 0) items.splice(idx, 1);
  }
  return true;
}

/** The player's bag. */
export class Bag {
  items: ItemStack[] = [];

  add(id: string, count = 1): boolean {
    return addToInventory(this.items, id, count, BAG_ITEM_CAPACITY);
  }

  remove(id: string, count = 1): boolean {
    const existing = this.items.find((i) => i.id === id);
    if (!existing || existing.count < count) return false;
    existing.count -= count;
    if (existing.count <= 0) {
      this.items = this.items.filter((i) => i.id !== id);
    }
    return true;
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
