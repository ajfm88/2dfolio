// Wild Pokemon encounter system

import type { WildEncounterData, BattlePokemon } from './types';
import { ENCOUNTER_SLOTS } from './types';
import { getWildData, createPokemon } from './data';

let currentMapWild: WildEncounterData | null = null;
let currentMapName = '';

/** Load wild encounter data for a map. Call when entering a new map. */
export async function loadWildEncounters(mapName: string): Promise<void> {
  if (mapName === currentMapName) return;
  currentMapName = mapName;
  currentMapWild = await getWildData(mapName);
}

/** Check if a random encounter should trigger.
 *  Call each time the player takes a step in grass/water.
 *  Returns a BattlePokemon if an encounter triggers, null otherwise. */
export function tryWildEncounter(inGrass: boolean): BattlePokemon | null {
  if (!currentMapWild) return null;

  const rate = inGrass ? currentMapWild.grassRate : currentMapWild.waterRate;
  const pool = inGrass ? currentMapWild.grass : currentMapWild.water;

  if (rate === 0 || pool.length === 0) return null;

  // Encounter check: random 0-255, must be < rate
  if (Math.floor(Math.random() * 256) >= rate) return null;

  // Select encounter slot
  const slotRoll = Math.floor(Math.random() * 256);
  let slotIndex = 0;
  for (const slot of ENCOUNTER_SLOTS) {
    if (slotRoll < slot.threshold) {
      slotIndex = slot.slot;
      break;
    }
  }

  if (slotIndex >= pool.length) slotIndex = pool.length - 1;
  const encounter = pool[slotIndex];

  return createPokemon(encounter.pokemon, encounter.level);
}
