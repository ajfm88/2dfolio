// Event flags system — tracks story progression
// Flags are simple strings stored in a Set, persisted via save/load

const flags = new Set<string>();

export function setFlag(flag: string): void {
  flags.add(flag);
}

export function hasFlag(flag: string): boolean {
  return flags.has(flag);
}

export function clearFlag(flag: string): void {
  flags.delete(flag);
}

/** Get all flags for save serialization. */
export function getAllFlags(): string[] {
  return [...flags];
}

/** Restore flags from saved data. */
export function restoreFlags(saved: string[]): void {
  flags.clear();
  for (const f of saved) flags.add(f);
}

// Map script states — the resting value of each map's w<Map>CurScript (wram.asm
// wGameProgressFlags), saved with the game and cleared only by a new game
// (init_player_data.asm). Maps without an entry are at 0. DECISIONS #34.

const mapScripts = new Map<string, number>();

export function getMapScript(mapName: string): number {
  return mapScripts.get(mapName) ?? 0;
}

export function setMapScript(mapName: string, state: number): void {
  if (state === 0) mapScripts.delete(mapName);
  else mapScripts.set(mapName, state);
}

/** Get all map script states for save serialization. */
export function getAllMapScripts(): Record<string, number> {
  return Object.fromEntries(mapScripts);
}

/** Restore map script states from saved data. */
export function restoreMapScripts(saved: Record<string, number>): void {
  mapScripts.clear();
  for (const [mapName, state] of Object.entries(saved)) setMapScript(mapName, state);
}

// HideObject (engine/overworld/toggleable_objects.asm). Today's pickup objects start ON;
// a future ShowObject caller can extend this model. Clear with init_player_data.asm.
const hiddenObjects = new Set<string>();

export function hideObject(map: string, npcId: string): void {
  hiddenObjects.add(`${map}:${npcId}`);
}

export function isObjectHidden(map: string, npcId: string): boolean {
  return hiddenObjects.has(`${map}:${npcId}`);
}

export function getAllHiddenObjects(): string[] {
  return [...hiddenObjects];
}

export function restoreHiddenObjects(saved: string[]): void {
  hiddenObjects.clear();
  for (const key of saved) hiddenObjects.add(key);
}

// Event flag constants
export const EVENT = {
  // Pallet Town intro sequence
  OAK_APPEARED_IN_PALLET: 'OAK_APPEARED_IN_PALLET',
  FOLLOWED_OAK_INTO_LAB: 'FOLLOWED_OAK_INTO_LAB',
  GOT_STARTER: 'GOT_STARTER',
  OAK_ASKED_TO_CHOOSE_MON: 'OAK_ASKED_TO_CHOOSE_MON',
  BATTLED_RIVAL_IN_OAKS_LAB: 'BATTLED_RIVAL_IN_OAKS_LAB',
  GOT_POKEDEX: 'GOT_POKEDEX',
  GOT_POKEBALLS_FROM_OAK: 'GOT_POKEBALLS_FROM_OAK',
  GOT_OAKS_PARCEL: 'GOT_OAKS_PARCEL',
  OAK_GOT_PARCEL: 'OAK_GOT_PARCEL',
  GOT_TOWN_MAP: 'GOT_TOWN_MAP',
  // Gym badges (assembly: wObtainedBadges bits 0-7)
  BADGE_1: 'BADGE_1',
  BADGE_2: 'BADGE_2',
  BADGE_3: 'BADGE_3',
  BADGE_4: 'BADGE_4',
  BADGE_5: 'BADGE_5',
  BADGE_6: 'BADGE_6',
  BADGE_7: 'BADGE_7',
  BADGE_8: 'BADGE_8',
} as const;
