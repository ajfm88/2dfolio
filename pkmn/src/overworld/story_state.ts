// Story-based NPC state management — visibility, dialogue, and defeated tracking
//
// These functions apply game-progression-dependent changes to NPCs after
// loading a map. They are stateless: all state is passed in as parameters.

import type { Npc } from './npc';
import { hasFlag, isObjectHidden } from '../events';
import { viridianOldMenVisible } from '../story/viridian_city';

/** Mark trainer NPCs as defeated based on the global tracking set. */
export function applyDefeatedTrainers(
  mapName: string,
  npcs: Npc[],
  defeatedTrainers: Set<string>
): void {
  for (const npc of npcs) {
    if (
      npc.data.trainerClass &&
      defeatedTrainers.has(`${mapName}:${npc.data.id}`)
    ) {
      npc.data.defeated = true;
    }
  }
}

/** Record a trainer NPC as defeated in the global tracking set. */
export function recordDefeated(
  mapName: string,
  npcId: string,
  defeatedTrainers: Set<string>
): void {
  defeatedTrainers.add(`${mapName}:${npcId}`);
}

/** Apply story-based NPC visibility and dialogue changes.
 *  Called after loading NPCs for a map, and after scripts end. */
export function applyStoryNpcState(mapName: string, npcs: Npc[]): void {
  for (const npc of npcs) {
    if (isObjectHidden(mapName, npc.data.id)) {
      npc.hidden = true;
      continue;
    }
    // PalletTown: Oak is always hidden here — he only appears during the
    // grass cutscene (as a script NPC) and lives in the lab afterward
    if (mapName === "PalletTown" && npc.data.id === "prof") {
      npc.hidden = true;
    }

    // OaksLab: Hide map NPC Oak during the intro cutscene (before GOT_STARTER).
    // The intro script uses its own script NPCs (prof_enter, prof_desk) instead.
    if (mapName === "OaksLab" && npc.data.id === "prof" && !hasFlag("GOT_STARTER")) {
      npc.hidden = true;
    }

    // ViridianCity: the three old men, from the events that toggle them
    // (story/viridian_city.ts viridianOldMenVisible)
    if (mapName === "ViridianCity") {
      const visible = viridianOldMenVisible(hasFlag);
      if (npc.data.id === "oldman_blocking" || npc.data.id === "oldman2" || npc.data.id === "oldman1") {
        npc.hidden = !visible[npc.data.id];
      }
    }

    // ViridianMart: only shop availability is swapped; text comes from its call table.
    if (mapName === "ViridianMart" && npc.data.id === "clerk") {
      if (!hasFlag("GOT_OAKS_PARCEL")) {
        // Before parcel quest: no shop, dialogue handled by entry script
        npc.data.shopItems = undefined;
      } else if (!hasFlag("OAK_GOT_PARCEL")) {
        // Got parcel, not delivered yet — clerk reminds you
        // (text/ViridianMart.asm _ViridianMartClerkSayHiToOakText)
        npc.data.shopItems = undefined;
      }
      // After OAK_GOT_PARCEL: default shop dialogue from JSON
    }

    // OaksLab: state-dependent NPC visibility; handlers select text at talk time.
    if (mapName === "OaksLab") {
      if (hasFlag("GOT_POKEDEX")) {
        // Post-Pokédex: Oak visible, rival and Pokédex objects gone.
        if (npc.data.id === "prof") {
          npc.hidden = false;
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") npc.hidden = true;
        if (npc.data.id === "pokedex1") npc.hidden = true;
        if (npc.data.id === "pokedex2") npc.hidden = true;
      } else if (hasFlag("BATTLED_RIVAL_IN_OAKS_LAB")) {
        // Post-rival-battle: rival has left, waiting for parcel delivery
        if (npc.data.id === "prof") {
          npc.hidden = false;
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") npc.hidden = true;
      } else if (hasFlag("GOT_STARTER")) {
        // Post-starter but pre-battle: rival still in lab near ball position
        if (npc.data.id === "prof") {
          npc.hidden = false;
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") {
          // After cutscene, rival ended up at step (7,4) facing up (post ball-snatch position)
          npc.x = 7 * 16;
          npc.y = 4 * 16;
          npc.direction = "up";
        }
      } else if (hasFlag("OAK_ASKED_TO_CHOOSE_MON")) {
        // Mid-scene: Oak asked player to choose; show Oak on a resumed map.
        if (npc.data.id === "prof") {
          npc.hidden = false;
        }
      } else {
        // Before intro cutscene: Oak not in lab yet
        if (npc.data.id === "prof") npc.hidden = true;
      }
    }

    // BluesHouse: Daisy's handler selects text at talk time; keep object visibility here.
    // (scripts/BluesHouse.asm BluesHouseDaisySittingText)
    if (mapName === "BluesHouse") {
      if (npc.data.id === "town_map" && hasFlag("GOT_TOWN_MAP")) {
        npc.hidden = true;
      }
    }
  }
}
