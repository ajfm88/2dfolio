// Simple item inventory system

import { resetListStateForEmptySlot } from './list_state';
import machineData from '../data/machine_data.json';

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
  OLD_AMBER: { category: "key", price: 0 },
};

// constants/item_constants.asm: HM01–HM05 precede TM01–TM50.
// GetMachinePrice reads each TM's price in thousands (engine/items/tm_prices.asm).
const HM_COUNT = machineData.moves.length - machineData.prices.length;
const TM_COUNT = machineData.prices.length;

export function parseMachineId(id: string): { kind: 'HM' | 'TM'; number: number } | null {
  const match = /^(HM|TM)(\d{2})$/.exec(id);
  if (!match) return null;
  const kind = match[1] as 'HM' | 'TM';
  const number = Number(match[2]);
  return number >= 1 && number <= (kind === 'HM' ? HM_COUNT : TM_COUNT)
    ? { kind, number }
    : null;
}

/** TMToMove indexes TechnicalMachines with TMs first, then HMs. */
export function machineMove(id: string): number | null {
  const machine = parseMachineId(id);
  return machine ? machineData.moves[(machine.kind === 'TM' ? 0 : TM_COUNT) + machine.number - 1] : null;
}

const MACHINE_IDS = [
  ...Array.from({ length: HM_COUNT }, (_, i) => `HM${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: TM_COUNT }, (_, i) => `TM${String(i + 1).padStart(2, '0')}`),
];

// Dynamic item display names — loaded from ROM or static data at startup
let itemDisplayNames: Record<string, string> = {};

/** Initialize item display names (called during startup after data loads). */
export function initItemNames(names: Record<string, string>): void {
  itemDisplayNames = names;
}

export function getAllItemIds(): string[] {
  return [...Object.keys(ITEM_DEFS), ...MACHINE_IDS];
}

// Runtime ids that differ from pret's constants, which key the extracted names
// (constants/item_constants.asm: PARLYZ_HEAL, OAKs_PARCEL).
const PRET_ITEM_KEYS: Record<string, string> = { PARALYZE_HEAL: 'PARLYZ_HEAL', OAKS_PARCEL: 'OAKs_PARCEL' };

export function getItemName(id: string): string {
  if (parseMachineId(id)) return id; // GetMachineName prints the prefix and two digits.
  return itemDisplayNames[PRET_ITEM_KEYS[id] ?? id] ?? id.replace(/_/g, " ");
}

export function getItemCategory(id: string): ItemCategory {
  if (parseMachineId(id)?.kind === 'HM') return 'key';
  return ITEM_DEFS[id]?.category ?? "other";
}

export function getItemPrice(id: string): number {
  const machine = parseMachineId(id);
  if (machine) return machine.kind === 'TM' ? machineData.prices[machine.number - 1] * 1000 : 0;
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

/** UsableItems_PartyMenu (data/items/use_party.asm), for items that exist here. */
export const PARTY_MENU_ITEMS = new Set([
  'ANTIDOTE', 'BURN_HEAL', 'ICE_HEAL', 'AWAKENING', 'PARALYZE_HEAL', 'FULL_RESTORE',
  'MAX_POTION', 'HYPER_POTION', 'SUPER_POTION', 'POTION', 'FULL_HEAL', 'REVIVE',
]);

/** UsableItems_CloseMenu (data/items/use_overworld.asm). Escape Rope is the one sold later. */
export const CLOSE_MENU_ITEMS = new Set([
  'ESCAPE_ROPE', 'ITEMFINDER', 'POKE_FLUTE', 'OLD_ROD', 'GOOD_ROD', 'SUPER_ROD',
]);

/**
 * ItemUsePtrTable routine names for the items defined today.
 * OAK'S PARCEL is ItemUseOaksParcel, which jumps to ItemUseNotYoursToUse.
 */
export const ITEM_USE_ROUTINE: Record<string, string> = {
  MASTER_BALL: 'ItemUseBall',
  ULTRA_BALL: 'ItemUseBall',
  GREAT_BALL: 'ItemUseBall',
  POKE_BALL: 'ItemUseBall',
  TOWN_MAP: 'ItemUseTownMap',
  POTION: 'ItemUseMedicine',
  SUPER_POTION: 'ItemUseMedicine',
  HYPER_POTION: 'ItemUseMedicine',
  MAX_POTION: 'ItemUseMedicine',
  FULL_RESTORE: 'ItemUseMedicine',
  ANTIDOTE: 'ItemUseMedicine',
  PARALYZE_HEAL: 'ItemUseMedicine',
  BURN_HEAL: 'ItemUseMedicine',
  ICE_HEAL: 'ItemUseMedicine',
  AWAKENING: 'ItemUseMedicine',
  FULL_HEAL: 'ItemUseMedicine',
  REVIVE: 'ItemUseMedicine',
  ESCAPE_ROPE: 'ItemUseEscapeRope',
  REPEL: 'ItemUseRepel',
  SUPER_REPEL: 'ItemUseSuperRepel',
  MAX_REPEL: 'ItemUseMaxRepel',
  OAKS_PARCEL: 'ItemUseOaksParcel',
};

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
  if (item.count === 0) {
    items.splice(index, 1);
    // A partial removal changes none of the list cursors.
    resetListStateForEmptySlot();
  }
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
