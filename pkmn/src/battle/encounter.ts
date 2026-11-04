// Wild Pokemon encounter system

import type { WildEncounterData, BattlePokemon } from './types';
import { ENCOUNTER_SLOTS } from './types';
import { getWildData, createPokemon } from './data';
import { overworldRandomBytes } from '../overworld/overworld_random';

let currentMapWild: WildEncounterData | null = null;
let currentMapName = '';

/** NewBattle / TryDoWildEncounter's gates. Repel is implemented in A3. */
export interface EncounterContext {
  inGrass: boolean;
  inWater: boolean;
  indoor: boolean;
  forest: boolean;
  controlled: boolean;
  movementBlocked: boolean;
  onDoorOrWarp: boolean;
  outsideMap: boolean;
  cooldown: number;
  disabled: boolean;
}

/** Returns the encounter pool, or null before consuming any random number. */
export function encounterTerrain(context: EncounterContext): 'grass' | 'water' | null {
  if (context.controlled || context.movementBlocked || context.onDoorOrWarp ||
      context.outsideMap || context.cooldown > 0 || context.disabled) return null;
  if (context.inGrass) return 'grass';
  if (context.inWater) return 'water';
  return context.indoor && !context.forest ? 'grass' : null;
}

/** Load wild encounter data for a map. Call when entering a new map. */
export async function loadWildEncounters(mapName: string): Promise<void> {
  if (mapName === currentMapName) return;
  currentMapName = mapName;
  currentMapWild = await getWildData(mapName);
}

/** Check if a random encounter should trigger.
 *  Call after an ordinary step or a turn, with the ASM's conditions.
 *  Returns a BattlePokemon if an encounter triggers, null otherwise. */
export function tryWildEncounter(context: EncounterContext): BattlePokemon | null {
  if (!currentMapWild) return null;
  const terrain = encounterTerrain(context);
  if (terrain === null) return null;
  const inGrass = terrain === 'grass';
  const rate = inGrass ? currentMapWild.grassRate : currentMapWild.waterRate;
  const pool = inGrass ? currentMapWild.grass : currentMapWild.water;

  if (rate === 0 || pool.length === 0) return null;

  // wild_encounters.asm:50-56: hRandomAdd against the rate, then hRandomSub picks the slot. Neither calls
  // Random; they read what VBlank's Random (and any overworld call since) left.
  const { hRandomAdd, hRandomSub } = overworldRandomBytes();
  if (hRandomAdd >= rate) return null;

  // Select encounter slot
  const slotRoll = hRandomSub;
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
