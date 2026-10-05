// Where Pikachu appears after a warp — a port of Yellow's spawn states.
//
// Assembly:
//   engine/pikachu/pikachu_follow.asm — SetPikachuSpawnOutside / SetPikachuSpawnWarpPad /
//     SetPikachuSpawnBackOutside pick wPikachuSpawnState; CalculatePikachuPlacementCoords
//     and CalculatePikachuFacingDirection apply it
//   home/overworld.asm — WarpFound2 picks the setter; CheckMapConnections uses state 2
//
// Map names are pret's map_header names, which are our map JSON names. The lists
// include maps that aren't extracted yet: they're data from the game's code, not V1's.

import type { Direction } from '../core';

/** wPikachuSpawnState */
export type PikachuSpawnState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** home/overworld.asm CheckIfInOutsideMap: towns and routes */
export function isOutsideTileset(tileset: string): boolean {
  return tileset === 'OVERWORLD' || tileset === 'PLATEAU';
}

// SetPikachuSpawnOutside, Pointer_fc64b: state 4 (below the player)
const OUTSIDE_BELOW_PLAYER = new Set([
  'VictoryRoad2F', 'Route7Gate', 'Route8Gate', 'Route16Gate1F',
  'Route18Gate1F', 'Route15Gate1F', 'Route11Gate1F',
]);

// SetPikachuSpawnOutside, Pointer_fc653: state 3 if the player faces down, else 1
const OUTSIDE_ON_PLAYER_IF_FACING_DOWN = new Set([
  'ViridianForestNorthGate', 'CeruleanBadgeHouse', 'CeruleanTrashedHouse',
  'VermilionDock', 'CeladonMansion1F', 'Route2Gate', 'FuchsiaGoodRodHouse',
]);

// SetPikachuSpawnWarpPad, Pointer_fc68e: state 1 (right of the player)
const WARP_PAD_RIGHT_OF_PLAYER = new Set([
  'ViridianForest',
  'SafariZoneCenterRestHouse', 'SafariZoneWestRestHouse', 'SafariZoneEastRestHouse',
  'SafariZoneNorthRestHouse', 'SafariZoneSecretHouse',
  'SilphCoElevator', 'CeladonMartElevator',
  'CinnabarLabTradeRoom', 'CinnabarLabMetronomeRoom', 'CinnabarLabFossilRoom',
]);

/** SetPikachuSpawnOutside — warping out of a town or route; checks the destination. */
function spawnOutside(destMap: string, facing: Direction): PikachuSpawnState {
  if (destMap === 'OaksLab') return 6;
  if (destMap === 'Route22Gate') return facing === 'down' ? 3 : 1;
  if (destMap === 'MtMoonB1F' || destMap === 'RockTunnel1F') return 3;
  if (OUTSIDE_BELOW_PLAYER.has(destMap)) return 4;
  if (OUTSIDE_ON_PLAYER_IF_FACING_DOWN.has(destMap) && facing === 'down') return 3;
  return 1;
}

/** SetPikachuSpawnWarpPad — indoor to indoor; checks the destination. */
function spawnWarpPad(destMap: string, facing: Direction): PikachuSpawnState {
  if (destMap === 'ViridianForestNorthGate') return facing === 'up' ? 1 : 0;   // leaving the Forest
  if (destMap === 'ViridianForestSouthGate') return facing === 'down' ? 0 : 1; // leaving it southward
  return WARP_PAD_RIGHT_OF_PLAYER.has(destMap) ? 1 : 0;
}

/** SetPikachuSpawnBackOutside — back out to the town or route (LAST_MAP); checks the source. */
function spawnBackOutside(sourceMap: string, facing: Direction): PikachuSpawnState {
  if (sourceMap === 'Route22Gate' || sourceMap === 'Route2Gate') return facing === 'up' ? 1 : 3;
  return 3;
}

/**
 * The spawn state for a warp, with the setter chosen as in home/overworld.asm WarpFound2:
 * out of an outside map → SetPikachuSpawnOutside; else to LAST_MAP →
 * SetPikachuSpawnBackOutside; else SetPikachuSpawnWarpPad.
 *
 * Our map JSON has LAST_MAP resolved already. No Yellow indoor map warps explicitly to
 * an outside map (checked over every data/maps/objects file), so "the destination is
 * outside" identifies a LAST_MAP warp exactly. `facing` is the player's facing when the
 * warp fires (it survives the warp — see performWarpLoad).
 */
export function warpSpawnState(
  sourceMap: string, sourceTileset: string,
  destMap: string, destTileset: string,
  facing: Direction,
): PikachuSpawnState {
  if (isOutsideTileset(sourceTileset)) return spawnOutside(destMap, facing);
  if (isOutsideTileset(destTileset)) return spawnBackOutside(sourceMap, facing);
  return spawnWarpPad(destMap, facing);
}

/** CheckMapConnections .loadNewMap: walking over a map edge puts Pikachu behind the player. */
export const CONNECTION_SPAWN_STATE: PikachuSpawnState = 2;

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** One step in each direction, in steps */
const STEP: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

/** CalculatePikachuPlacementCoords: Pikachu's offset from the player, in steps. */
function placementOffset(state: PikachuSpawnState, playerFacing: Direction): { dx: number; dy: number } {
  switch (state) {
    case 0: case 3: return { dx: 0, dy: 0 };        // on the player's tile
    case 1: return STEP.right;
    case 2: return STEP[OPPOSITE[playerFacing]];    // behind (.check_player_facing2)
    case 4: return STEP.down;
    case 5: return STEP.up;
    case 6: return STEP.left;
    case 7: return STEP[playerFacing];              // in front (.check_player_facing)
  }
}

/** CalculatePikachuFacingDirection for a freshly placed Pikachu. */
function spawnFacing(state: PikachuSpawnState, offset: { dx: number; dy: number }, playerFacing: Direction): Direction {
  switch (state) {
    case 0: case 1: case 4: case 6: return playerFacing;  // .copy_player_facing
    case 3: return 'down';                                // .force_facing_down
    case 7: return OPPOSITE[playerFacing];                // .face_the_other_way
    case 2: case 5:
      // ComputePikachuFacingDirection, with the follow buffer just cleared: face the player
      if (offset.dy !== 0) return offset.dy < 0 ? 'down' : 'up';
      if (offset.dx !== 0) return offset.dx < 0 ? 'right' : 'left';
      return playerFacing;
  }
}

/** Where Pikachu stands (steps from the player) and which way it faces, for a spawn state. */
export function spawnPlacement(
  state: PikachuSpawnState, playerFacing: Direction,
): { dx: number; dy: number; facing: Direction } {
  const offset = placementOffset(state, playerFacing);
  return { ...offset, facing: spawnFacing(state, offset, playerFacing) };
}
