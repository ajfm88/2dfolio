// Map transition logic — warp loading and map connection handling
//
// These async functions perform the heavy lifting of map transitions:
// loading new map data, repositioning the player, reloading NPCs, and
// setting up Pikachu's position. They return result structs so the caller
// (main.ts) can update game state accordingly.

import { BLOCK_PX } from '../core';
import { GameMap } from './map';
import { Player } from './player';
import { Npc, loadNpcs } from './npc';
import { PikachuFollower, shouldPikachuFollow } from '../pikachu/pikachu_follower';
import { warpSpawnState, CONNECTION_SPAWN_STATE } from '../pikachu/pikachu_spawn';
import type { BattlePokemon } from '../battle';
import { loadWildEncounters } from '../battle';
import { setActivePalette, getMapPalette } from '../renderer';
import { reloadBorderTiles } from '../text';
import { clearScriptNpcs } from '../script';
import { applyDefeatedTrainers, applyStoryNpcState } from './story_state';

/** Result of loading a warp destination. null means the map failed to load. */
export interface WarpLoadResult {
  npcs: Npc[];
  doorExitStep: boolean;
  standingOnWarp: boolean;
}

/** Load a warp destination map, reposition player and Pikachu.
 *  Returns null if the map fails to load. */
export async function performWarpLoad(
  destMapName: string,
  destWarpId: number,
  gameMap: GameMap,
  player: Player,
  pikachuFollower: PikachuFollower,
  playerParty: BattlePokemon[],
  defeatedTrainers: Set<string>,
  stepPos?: { x: number; y: number }
): Promise<WarpLoadResult | null> {
  // The map being left decides which Pikachu spawn setter runs (WarpFound2)
  const sourceName = gameMap.mapData?.name ?? '';
  const sourceTileset = gameMap.mapData?.tileset ?? '';

  setActivePalette(getMapPalette(destMapName));
  await reloadBorderTiles();

  try {
    await gameMap.load(destMapName);
  } catch (e) {
    console.warn(`Map "${destMapName}" not found, staying on current map`);
    return null;
  }

  await player.loadSprite();
  const npcs = await loadNpcs(gameMap.mapData?.npcs ?? []);
  applyDefeatedTrainers(destMapName, npcs, defeatedTrainers);
  applyStoryNpcState(destMapName, npcs);

  await loadWildEncounters(destMapName);

  // Place player at the destination warp position
  if (stepPos) {
    player.setTilePosition(stepPos.x * 2, stepPos.y * 2);
  } else {
    const destWarp = gameMap.getWarpByIndex(destWarpId);
    if (destWarp) {
      // Warp coords are in step units (16px), convert to tile units (*2)
      player.setTilePosition(destWarp.x * 2, destWarp.y * 2);
    }
  }

  // The player keeps facing the way they walked in: the assembly never resets the
  // facing on a warp (ResetPlayerSpriteData runs only at Continue and new game).
  // Auto-step out from door tiles (matching assembly PlayerStepOutFromDoor) — that
  // step turns them down.
  const doorExitStep = gameMap.isDoorTile(player.tileX, player.tileY);
  // If landing on a non-instant warp tile (e.g. door mat inside a building),
  // set standingOnWarp so pressing into the edge immediately triggers the warp.
  const landingWarp = gameMap.getWarpAt(player.tileX, player.tileY);
  const standingOnWarp =
    !!landingWarp &&
    !gameMap.isInstantWarpTile(player.tileX, player.tileY) &&
    !doorExitStep;

  // Clear script NPCs when changing maps
  clearScriptNpcs();

  // Place Pikachu the way Yellow does (pikachu_spawn.ts: pikachu_follow.asm spawn
  // states, the setter chosen as in WarpFound2), from the facing the warp fired with.
  // Nothing hides it for a door step: PlayerStepOutFromDoor is an ordinary step, so a
  // Pikachu on the player's tile shows up as the player walks off it.
  pikachuFollower.visible = shouldPikachuFollow(playerParty);
  if (pikachuFollower.visible) {
    const state = warpSpawnState(
      sourceName, sourceTileset,
      destMapName, gameMap.mapData?.tileset ?? '',
      player.direction,
    );
    pikachuFollower.spawnAtState(player.x, player.y, player.direction, state);
  }

  return { npcs, doorExitStep, standingOnWarp };
}

/** Load a connected map (player walked off map edge), reposition player and Pikachu. */
export async function performMapConnection(
  destMapName: string,
  connectionDir: 'north' | 'south' | 'east' | 'west',
  offset: number,
  gameMap: GameMap,
  player: Player,
  pikachuFollower: PikachuFollower,
  playerParty: BattlePokemon[],
  defeatedTrainers: Set<string>
): Promise<Npc[]> {
  setActivePalette(getMapPalette(destMapName));
  await reloadBorderTiles();

  // Save current position before loading new map
  const oldX = player.x;
  const oldY = player.y;

  await gameMap.load(destMapName);
  await player.loadSprite();
  const npcs = await loadNpcs(gameMap.mapData?.npcs ?? []);
  applyDefeatedTrainers(destMapName, npcs, defeatedTrainers);
  applyStoryNpcState(destMapName, npcs);

  await loadWildEncounters(destMapName);

  // Calculate new player position based on connection direction and offset.
  // Assembly formula: adjustment = offset * -2 steps = -offset * BLOCK_PX pixels.
  const adj = -offset * BLOCK_PX;

  switch (connectionDir) {
    case 'north':
      player.x = oldX + adj;
      player.y = gameMap.height * BLOCK_PX - 16;
      break;
    case 'south':
      player.x = oldX + adj;
      player.y = 0;
      break;
    case 'west':
      player.x = gameMap.width * BLOCK_PX - 16;
      player.y = oldY + adj;
      break;
    case 'east':
      player.x = 0;
      player.y = oldY + adj;
      break;
  }

  // Reset stale movement state — player may have been mid-step when the connection fired
  player.cancelMovement();

  // Respawn Pikachu 1 step behind the player on the new map (spawn state 2,
  // CheckMapConnections .loadNewMap).
  pikachuFollower.visible = shouldPikachuFollow(playerParty);
  if (pikachuFollower.visible) {
    pikachuFollower.spawnAtState(player.x, player.y, player.direction, CONNECTION_SPAWN_STATE);
  }

  return npcs;
}
