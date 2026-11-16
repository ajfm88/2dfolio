// TilePairCollisionsLand (data/tilesets/pair_collision_tile_ids.asm, ROM 00:0ada): pairs of tiles the player
// may not cross between, in either direction. CollisionCheckOnLand (home/overworld.asm) reads them through
// CheckForJumpingAndTilePairCollisions, after the sprite checks and before CheckTilePassable. The tiles are
// the bottom-left tile the player stands on (coord 8,9) and the same tile one step ahead.
//
// CheckForTilePairCollisions has a pointer slip: when the standing tile is a row's first tile and the tile
// ahead isn't its second, the loop resumes one byte early and from then on reads every third byte as a
// tileset id. That scan leaves the table, crosses TilePairCollisionsWater and LoadCurrentMapView's code, and
// ends at the $ff at 00:0b84. It never finds a pair there: for every tileset id and every pair of tile ids
// the routine's answer is this table read symmetrically. tile_pair_collision.test.ts runs the routine over
// the ROM's bytes to pin that (note 94 §2.2), so the table is all the port needs.
//
// Surf's TilePairCollisionsWater is a separate table (F2). The boulder check (CheckForCollisionWhenPushingBoulder)
// reads this one for the tile two steps ahead; it comes with Strength.

/** ROM order: tileset, tile 1, tile 2. */
export const TILE_PAIR_COLLISIONS_LAND: readonly (readonly [tileset: string, tile1: number, tile2: number])[] = [
  ['CAVERN', 0x20, 0x05],
  ['CAVERN', 0x41, 0x05],
  ['FOREST', 0x30, 0x2e],
  ['CAVERN', 0x2a, 0x05],
  ['CAVERN', 0x05, 0x21],
  ['FOREST', 0x52, 0x2e],
  ['FOREST', 0x55, 0x2e],
  ['FOREST', 0x56, 0x2e],
  ['FOREST', 0x20, 0x2e],
  ['FOREST', 0x5e, 0x2e],
  ['FOREST', 0x5f, 0x2e],
];

/** True when the step from `standing` to `front` crosses a land tile pair of this tileset. */
export function landTilePairCollision(tileset: string | undefined, standing: number, front: number): boolean {
  return TILE_PAIR_COLLISIONS_LAND.some(([rowTileset, tile1, tile2]) => rowTileset === tileset
    && ((tile1 === standing && tile2 === front) || (tile2 === standing && tile1 === front)));
}
