// wListScrollOffset, wCurrentMenuItem, wBagSavedMenuItem, wSavedListScrollOffset.
// RemoveItemFromInventory_ zeroes all four when a removal empties a slot
// (engine/items/inventory.asm). The Mart and the bag share them. No rendering.

let listScrollOffset = 0;
let currentMenuItem = 0;
let bagSavedMenuItem = 0;
let savedListScrollOffset = 0;
/** wPartyAndBillsPCSavedMenuItem. The party menu reloads it. An emptied bag slot does not clear it. */
let partyAndBillsSavedMenuItem = 0;
/** wBattleAndStartSavedMenuItem. WRAM only; battle takes ownership in A5c. */
let battleAndStartSavedMenuItem = 0;
/** Bumps when a slot empties, so an open list can drop its cursor and scroll. */
let emptySlotGeneration = 0;

export function getListScrollOffset(): number { return listScrollOffset; }
export function setListScrollOffset(value: number): void { listScrollOffset = value; }

export function getCurrentMenuItem(): number { return currentMenuItem; }
export function setCurrentMenuItem(value: number): void { currentMenuItem = value; }

export function getBagSavedMenuItem(): number { return bagSavedMenuItem; }
export function setBagSavedMenuItem(value: number): void { bagSavedMenuItem = value; }

export function getSavedListScrollOffset(): number { return savedListScrollOffset; }
export function setSavedListScrollOffset(value: number): void { savedListScrollOffset = value; }

export function getPartyAndBillsSavedMenuItem(): number { return partyAndBillsSavedMenuItem; }
export function setPartyAndBillsSavedMenuItem(value: number): void { partyAndBillsSavedMenuItem = value; }

export function getBattleAndStartSavedMenuItem(): number { return battleAndStartSavedMenuItem; }
export function setBattleAndStartSavedMenuItem(value: number): void { battleAndStartSavedMenuItem = value; }

export function getEmptySlotGeneration(): number { return emptySlotGeneration; }

/** RemoveItemFromInventory_ after the emptied slot has been shifted away. */
export function resetListStateForEmptySlot(): void {
  listScrollOffset = 0;
  currentMenuItem = 0;
  bagSavedMenuItem = 0;
  savedListScrollOffset = 0;
  emptySlotGeneration++;
}
