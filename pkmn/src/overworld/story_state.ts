// Story-based NPC state management — visibility, dialogue, and defeated tracking
//
// These functions apply game-progression-dependent changes to NPCs after
// loading a map. They are stateless: all state is passed in as parameters.

import type { Npc } from './npc';
import { hasFlag } from '../events';
import { substituteNames } from '../core/player_state';
import { getText } from '../text';

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

    // RedsHouse1F: Mom's dialogue changes after getting starter
    if (mapName === "RedsHouse1F" && npc.data.id === "mom") {
      if (hasFlag("GOT_STARTER")) {
        // Post-starter: Mom heals your party (handled via script in interaction)
        npc.data.dialogue = "__MOM_HEAL__";
      }
      // else: default dialogue from map JSON ("All boys leave home...")
    }

    // Route 1: Mart employee dialogue changes after giving potion sample
    if (
      mapName === "Route1" &&
      npc.data.id === "youngster1" &&
      hasFlag("GOT_POTION_SAMPLE")
    ) {
      npc.data.dialogue = getText('ROUTE1_POTION_FOLLOWUP');
    }

    // ViridianCity: old man blocks north path
    if (mapName === "ViridianCity") {
      if (hasFlag("GOT_POKEDEX")) {
        // After pokedex: old man stands up but still blocks (no catching tutorial yet)
        if (npc.data.id === "oldman_blocking") {
          npc.data.sprite = "gambler";
          npc.data.direction = "down";
          npc.direction = "down";
          npc.data.dialogue = getText('VIRIDIAN_OLDMAN_DEMO');
          npc.load();
        }
        if (npc.data.id === "oldman1") npc.hidden = true;
        // Girl changes dialogue to talk about Pewter City shopping
        if (npc.data.id === "girl1") {
          npc.data.dialogue = getText('VIRIDIAN_GIRL_PEWTER');
        }
      } else {
        // Before pokedex: old man blocks, walking old man hidden
        if (npc.data.id === "oldman1") npc.hidden = true;
      }
    }

    // ViridianMart: clerk dialogue depends on parcel quest state
    if (mapName === "ViridianMart" && npc.data.id === "clerk") {
      if (!hasFlag("GOT_OAKS_PARCEL")) {
        // Before parcel quest: no shop, dialogue handled by entry script
        npc.data.dialogue = getText('MART_CLERK_PALLET_TOWN');
        npc.data.shopItems = undefined;
      } else if (!hasFlag("OAK_GOT_PARCEL")) {
        // Got parcel, not delivered yet — clerk reminds you
        // (text/ViridianMart.asm _ViridianMartClerkSayHiToOakText)
        npc.data.dialogue = getText('MART_CLERK_SAY_HI');
        npc.data.shopItems = undefined;
      }
      // After OAK_GOT_PARCEL: default shop dialogue from JSON
    }

    // OaksLab: state-dependent NPC visibility and dialogue
    if (mapName === "OaksLab") {
      if (hasFlag("GOT_POKEDEX")) {
        // Post-pokédex: Oak talks about Pokédex progress, rival gone, pokedex items gone
        if (npc.data.id === "prof") {
          npc.hidden = false;
          // (text/OaksLab.asm _OaksLabOak1PokemonAroundTheWorldText)
          npc.data.dialogue = substituteNames(getText('LAB_OAK_POKEMON_AROUND_WORLD'));
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") npc.hidden = true;
        if (npc.data.id === "pokedex1") npc.hidden = true;
        if (npc.data.id === "pokedex2") npc.hidden = true;
      } else if (hasFlag("BATTLED_RIVAL_IN_OAKS_LAB")) {
        // Post-rival-battle: rival has left, waiting for parcel delivery
        if (npc.data.id === "prof") {
          npc.hidden = false;
          // (text/OaksLab.asm _OaksLabOak1YouShouldTalkToIt)
          npc.data.dialogue = getText('LAB_OAK_TALK_TO_IT');
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") npc.hidden = true;
      } else if (hasFlag("GOT_STARTER")) {
        // Post-starter but pre-battle: rival still in lab near ball position
        if (npc.data.id === "prof") {
          npc.hidden = false;
          npc.data.dialogue = getText('LAB_OAK_ADVICE');
        }
        if (npc.data.id === "item_ball") npc.hidden = true;
        if (npc.data.id === "rival") {
          npc.data.dialogue = getText('LAB_RIVAL_MON_STRONGER');
          // After cutscene, rival ended up at step (7,4) facing up (post ball-snatch position)
          npc.x = 7 * 16;
          npc.y = 4 * 16;
          npc.direction = "up";
        }
      } else if (hasFlag("OAK_ASKED_TO_CHOOSE_MON")) {
        // Mid-scene: Oak asked player to choose — Oak visible, correct dialogue
        if (npc.data.id === "prof") {
          npc.hidden = false;
          npc.data.dialogue = getText('LAB_OAK_GO_AHEAD');
        }
        if (npc.data.id === "rival") {
          npc.data.dialogue = substituteNames(getText('LAB_RIVAL_ILL_GET_BETTER'));
        }
      } else {
        // Before intro cutscene: Oak not in lab yet
        if (npc.data.id === "prof") npc.hidden = true;
      }
    }

    // BluesHouse: Daisy's dialogue depends on Pokédex/Town Map state
    // Town map object is hidden after receiving it
    // (scripts/BluesHouse.asm BluesHouseDaisySittingText)
    if (mapName === "BluesHouse") {
      if (npc.data.id === "daisy") {
        if (hasFlag("GOT_TOWN_MAP")) {
          // (text/BluesHouse.asm _BluesHouseDaisyUseMapText)
          npc.data.dialogue = getText('BLUES_HOUSE_USE_MAP');
        } else if (hasFlag("GOT_POKEDEX")) {
          // Will be handled by interaction script — set placeholder
          npc.data.dialogue = "__DAISY_TOWN_MAP__";
        }
        // else: default dialogue from JSON ("Hi RED! BLUE is out at Grandpa's lab.")
      }
      if (npc.data.id === "town_map" && hasFlag("GOT_TOWN_MAP")) {
        npc.hidden = true;
      }
    }
  }
}
