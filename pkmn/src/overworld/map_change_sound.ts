// PlayMapChangeSound (home/overworld.asm:665–683), the door sound of a warp.

/** "door tile in tileset 0": the top-left tile of an overworld door square. */
const DOOR_TILE = 0x0b;

/**
 * SFX_GO_INSIDE only when the tile under the player (screen tile (8, 8), the top-left tile of the square the
 * player stands on) is $0B and the tileset is neither FACILITY nor CEMETERY; every other warp plays
 * SFX_GO_OUTSIDE, stairs and gates included. The destination does not matter.
 */
export function mapChangeSound(tileset: string, tileUnderPlayer: number): 'go_inside' | 'go_outside' {
  if (tileset === 'FACILITY' || tileset === 'CEMETERY') return 'go_outside';
  return tileUnderPlayer === DOOR_TILE ? 'go_inside' : 'go_outside';
}
