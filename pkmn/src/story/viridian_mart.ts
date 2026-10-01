// Viridian Mart story script — Oak's Parcel quest
//
// Assembly flow (scripts/ViridianMart.asm):
// 1. On first entry, clerk says "Hey! You came from PALLET TOWN?"
// 2. Player auto-walks LEFT 1, UP 2 toward counter
// 3. Clerk delivers parcel quest speech, gives player OAK's PARCEL
// 4. After delivery, clerk becomes normal shopkeeper

import type { ScriptCommand } from '../script';
import type { Direction } from '../core';
import { substituteNames } from '../core/player_state';
import { getText } from '../text';

/**
 * Build the Viridian Mart parcel pickup cutscene.
 * Trigger: player enters mart without GOT_OAKS_PARCEL flag.
 *
 * Player enters at warp step (3,7) or (4,7), facing up.
 * Assembly: ViridianMartDefaultScript → ViridianMartOaksParcelScript
 */
export function buildViridianMartParcelScript(): ScriptCommand[] {
  // Player walks UP 2 then LEFT 1 to reach the counter
  const playerPath: Direction[] = ['up', 'up', 'left'];

  return [
    // Face up toward clerk before dialogue starts
    { type: 'facePlayer', direction: 'up' },

    // Phase 1: Clerk calls out immediately on entry
    // (text/ViridianMart.asm _ViridianMartClerkYouCameFromPalletTownText)
    { type: 'text', message: getText('MART_CLERK_PALLET_TOWN') },

    // Phase 2: Player auto-walks to counter (UP 2, LEFT 1)
    { type: 'movePlayer', path: playerPath },
    { type: 'wait', frames: 10 },

    // Phase 3: Clerk delivers parcel quest dialogue
    // (text/ViridianMart.asm _ViridianMartClerkParcelQuestText)
    { type: 'text', message: getText('MART_CLERK_PARCEL_QUEST') },

    // Give player OAK's PARCEL
    { type: 'giveItem', itemId: 'OAKS_PARCEL' },
    { type: 'text', message: substituteNames(getText('MART_GOT_PARCEL')) },
    { type: 'setFlag', flag: 'GOT_OAKS_PARCEL' },
  ];
}
