// The cartridge's toggleable objects (V5c checkpoint-03a/03b, note 93 §12, §16). Live since checkpoint-03b.
// engine/overworld/toggleable_objects.asm, data/maps/toggleable_objects.asm, constants/toggle_constants.asm.
import type { ToggleableObjectsData } from '../rom/extractors/toggleable_objects';

/** constants/toggle_constants.asm: the TOGGLE_* indexes of the rows today's maps own and scripts name. */
export const TOGGLE = {
  PALLET_TOWN_OAK: 0x00,
  LYING_OLD_MAN: 0x01,
  OLD_MAN_1: 0x02,
  OLD_MAN_2: 0x03,
  MUSEUM_GUY: 0x04,
  GYM_GUY: 0x05,
  ROUTE_22_RIVAL_1: 0x23,
  ROUTE_22_RIVAL_2: 0x24,
  DAISY_SITTING: 0x28,
  DAISY_WALKING: 0x29,
  TOWN_MAP: 0x2a,
  OAKS_LAB_RIVAL: 0x2b,
  STARTER_BALL_1: 0x2c,
  OAKS_LAB_OAK_1: 0x2d,
  POKEDEX_1: 0x2e,
  POKEDEX_2: 0x2f,
  OAKS_LAB_OAK_2: 0x30,
  OLD_AMBER: 0x33,
} as const;

/** wToggleableObjectFlags: `flag_array $100` (ram/wram.asm), one bit per global toggle index. */
export const TOGGLEABLE_OBJECT_FLAG_BYTES = 0x20;
const flags = new Uint8Array(TOGGLEABLE_OBJECT_FLAG_BYTES);

let data: ToggleableObjectsData | undefined;
/** Called from startup (main.ts init). No extraction code runs in the browser. The flags start as New Game's:
 *  the cartridge runs InitializeToggleableObjectsFlags or loads a save before any map is entered. */
export async function loadToggleableObjects(): Promise<void> {
  const response = await fetch('toggleable_objects.json');
  if (!response.ok) throw new Error(`toggleable objects: HTTP ${response.status}`);
  data = await response.json() as ToggleableObjectsData;
  flags.set(initial());
}
function table(): ToggleableObjectsData {
  if (!data) throw new Error('toggleable objects not loaded');
  return data;
}

// ToggleableObjectFlagAction: byte = index >> 3, mask = 1 << (index & 7).
function checked(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index > 0xff) throw new Error(`toggle index ${index}`);
  return index;
}
function write(bytes: Uint8Array, index: number, hidden: boolean): void {
  const mask = 1 << (checked(index) & 7);
  if (hidden) bytes[index >> 3] |= mask;
  else bytes[index >> 3] &= ~mask;
}
function test(bytes: Uint8Array, index: number): boolean {
  return (bytes[checked(index) >> 3] & (1 << (index & 7))) !== 0;
}
function initial(): Uint8Array {
  const bytes = new Uint8Array(TOGGLEABLE_OBJECT_FLAG_BYTES);
  table().states.forEach((row, index) => { if (!row.on) write(bytes, index, true); });
  return bytes;
}

/** InitializeToggleableObjectsFlags (New Game): clear every flag, then set the flag of each OFF row. */
export function initializeToggleableObjectFlags(): void {
  flags.set(initial());
}

/** MarkTownVisitedAndLoadToggleableObjects' wToggleableObjectList: the map's (object, global index) pairs,
 *  from the map's pointer until the rows stop naming that map. */
export function toggleableObjectList(mapName: string): { object: number; index: number }[] {
  const { states, mapFirst } = table();
  const first = mapFirst[mapName];
  if (first === undefined) throw new Error(`toggleable objects: ${mapName} is not an extracted map`);
  const list: { object: number; index: number }[] = [];
  if (first === null) return list; // NoToggleData
  for (let index = first; index < states.length && states[index].map === states[first].map; index++) {
    list.push({ object: states[index].object, index });
  }
  return list;
}

/** PickUpItem's and EndTrainerBattle's lookup: the object's global index, or null when it has no list entry. */
export function toggleableObjectIndex(mapName: string, objectId: number): number | null {
  return toggleableObjectList(mapName).find(entry => entry.object === objectId)?.index ?? null;
}

/** IsObjectHidden: an object without a list entry is never hidden; otherwise its flag decides. */
export function isObjectHidden(mapName: string, objectId: number): boolean {
  const index = toggleableObjectIndex(mapName, objectId);
  return index !== null && test(flags, index);
}

/** FLAG_TEST on wToggleableObjectFlags. */
export function isToggledOff(index: number): boolean {
  return test(flags, index);
}

/** HideObject's flag write (FLAG_SET). Its `jp UpdateSprites` is the caller's. */
export function hideObject(index: number): void {
  write(flags, index, true);
}

/** ShowObject's flag write (FLAG_RESET). Its `jp UpdateSprites` is the caller's. */
export function showObject(index: number): void {
  write(flags, index, false);
}

/** The save's copy of wToggleableObjectFlags. */
export function getToggleableObjectFlags(): number[] {
  return [...flags];
}

export function restoreToggleableObjectFlags(saved: readonly number[]): void {
  if (!Array.isArray(saved) || saved.length !== TOGGLEABLE_OBJECT_FLAG_BYTES
    || saved.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) {
    throw new Error('saved toggleable-object flags');
  }
  flags.set(saved);
}

/** Saves made before checkpoint-03b keep hidden objects as `Map:npcId` keys (A1b). Each key's toggle index. */
export const LEGACY_HIDDEN_OBJECT_TOGGLES: Readonly<Record<string, number>> = {
  'PalletTown:prof': TOGGLE.PALLET_TOWN_OAK,
  'ViridianCity:oldman_blocking': TOGGLE.LYING_OLD_MAN,
  'ViridianCity:oldman1': TOGGLE.OLD_MAN_1,
  'ViridianCity:oldman2': TOGGLE.OLD_MAN_2,
  'PewterCity:super_nerd1': TOGGLE.MUSEUM_GUY,
  'PewterCity:youngster': TOGGLE.GYM_GUY,
  'Route2:moon_stone': 0x1a,
  'Route2:hp_up': 0x1b,
  'Route22:rival1': TOGGLE.ROUTE_22_RIVAL_1, // PewterGym's hide; the object itself arrives in checkpoint-04
  'BluesHouse:daisy': TOGGLE.DAISY_SITTING,
  'BluesHouse:town_map': TOGGLE.TOWN_MAP,
  'OaksLab:rival': TOGGLE.OAKS_LAB_RIVAL,
  'OaksLab:item_ball': TOGGLE.STARTER_BALL_1,
  'OaksLab:prof': TOGGLE.OAKS_LAB_OAK_1,
  'OaksLab:pokedex1': TOGGLE.POKEDEX_1,
  'OaksLab:pokedex2': TOGGLE.POKEDEX_2,
  'Museum1F:old_amber': TOGGLE.OLD_AMBER,
  'ViridianForest:potion1': 0x64,
  'ViridianForest:potion2': 0x65,
  'ViridianForest:poke_ball': 0x66,
};

/** Migration, not cartridge behaviour: the flags an older save stands for. New Game's flags, then the
 *  visibility rules overworld/story_state.ts applied from event flags, then the saved `hiddenObjects`
 *  keys (a key hid its object before any rule ran). Pure: the live flags are not touched. */
export function legacyToggleableObjectFlags(hiddenObjects: readonly string[], hasFlag: (flag: string) => boolean): number[] {
  const bytes = initial();
  const pokedex = hasFlag('GOT_POKEDEX');
  const battled = pokedex || hasFlag('BATTLED_RIVAL_IN_OAKS_LAB');
  const starter = battled || hasFlag('GOT_STARTER');
  write(bytes, TOGGLE.LYING_OLD_MAN, pokedex);
  write(bytes, TOGGLE.OLD_MAN_2, !pokedex || hasFlag('COMPLETED_CATCH_TRAINING'));
  write(bytes, TOGGLE.OLD_MAN_1, !hasFlag('SPAWNED_OLD_MAN_1'));
  write(bytes, TOGGLE.OAKS_LAB_OAK_1, !starter && !hasFlag('OAK_ASKED_TO_CHOOSE_MON'));
  if (starter) write(bytes, TOGGLE.STARTER_BALL_1, true);
  if (battled) write(bytes, TOGGLE.OAKS_LAB_RIVAL, true);
  if (pokedex) { write(bytes, TOGGLE.POKEDEX_1, true); write(bytes, TOGGLE.POKEDEX_2, true); }
  if (hasFlag('GOT_TOWN_MAP')) write(bytes, TOGGLE.TOWN_MAP, true);
  for (const key of hiddenObjects) {
    const index = LEGACY_HIDDEN_OBJECT_TOGGLES[key];
    if (index === undefined) throw new Error(`legacy hidden object ${key} has no toggle`);
    write(bytes, index, true);
  }
  return [...bytes];
}
