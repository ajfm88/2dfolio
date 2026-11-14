// Story-based NPC state management — visibility, dialogue, and defeated tracking
//
// These functions apply game-progression-dependent changes to NPCs after
// loading a map. They are stateless: all state is passed in as parameters.

import type { Npc } from './npc';
import { hasFlag } from '../events';
import { isObjectHidden, toggleableObjectIndex } from './toggleable_objects';

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

/** Apply each NPC's toggle and the story's remaining placement. Called after loading NPCs for a map, and
 *  after scripts end. An object with a row in the map's toggle list is hidden or shown by its flag
 *  (IsObjectHidden); any other NPC keeps the `hidden` it has. */
export function applyStoryNpcState(mapName: string, npcs: Npc[]): void {
  for (const npc of npcs) {
    const objectId = npc.data.objectId;
    if (objectId !== undefined && toggleableObjectIndex(mapName, objectId) !== null) {
      npc.hidden = isObjectHidden(mapName, objectId);
    }
    // OaksLab, after the starter and before the battle: the rival stands where the ball
    // snatch left him, step (7,4) facing up. Not a toggle.
    if (mapName === "OaksLab" && npc.data.id === "rival" && !npc.hidden
      && hasFlag("GOT_STARTER") && !hasFlag("BATTLED_RIVAL_IN_OAKS_LAB") && !hasFlag("GOT_POKEDEX")) {
      npc.x = 7 * 16;
      npc.y = 4 * 16;
      npc.direction = "up";
    }
  }
}
