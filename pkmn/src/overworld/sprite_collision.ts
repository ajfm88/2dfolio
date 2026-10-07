// Sprite collisions as Yellow computes them (A6c): pixel geometry in the Game Boy's
// screen basis, not tile reservations.
//
//   - DetectCollisionBetweenSprites (engine/overworld/sprite_collisions.asm) builds a
//     sprite's mask of blocked directions against every other available slot;
//   - CanWalkOntoTile (engine/overworld/movement.asm) adds the screen-edge test;
//   - IsSpriteInFrontOfPlayer (home/overworld.asm) is CollisionCheckOnLand's exact-pixel
//     fallback, where the following Pikachu has its own rule (wPikachuCollisionCounter).
//
// Pure: the sprite table is built from the live objects by overworld/sprites.ts.

import type { Direction } from '../core';

export const PLAYER_SLOT = 0;
/** PIKACHU_SPRITE_INDEX: Pikachu is always the last slot. */
export const PIKACHU_SLOT = 15;

/** The player's sprite on screen: SCREEN X $40, Y $3c. */
export const PLAYER_SCREEN_X = 0x40;
export const PLAYER_SCREEN_Y = 0x3c;

/** Collision mask bits (PLAYER_DIR_*). */
export const DIRECTION_BIT: Record<Direction, number> = { right: 1, left: 2, down: 4, up: 8 };

/** One sprite slot as DetectCollisionBetweenSprites reads it. */
export interface CollisionSprite {
  slot: number;
  /** PICTUREID set and IMAGEINDEX ≠ $ff. */
  available: boolean;
  /** SPRITESTATEDATA1_XPIXELS / YPIXELS (bytes). */
  x: number;
  y: number;
  /** SPRITESTATEDATA1_XSTEPVECTOR / YSTEPVECTOR: -1, 0 or 1. */
  vx: number;
  vy: number;
}

const u8 = (v: number): number => v & 0xff;

/** A sprite's screen pixels: world pixels relative to the player, who stands at ($40, $3c).
 *  `offX`/`offY` are screen-only offsets (Pikachu's idle bounce). */
export function screenPixels(
  worldX: number, worldY: number, playerX: number, playerY: number, offX = 0, offY = 0,
): { x: number; y: number } {
  return {
    x: u8(worldX - playerX + PLAYER_SCREEN_X + offX),
    y: u8(worldY - playerY + PLAYER_SCREEN_Y + offY),
  };
}

export function unitVector(dir: Direction | null): { vx: number; vy: number } {
  return {
    vx: dir === 'left' ? -1 : dir === 'right' ? 1 : 0,
    vy: dir === 'up' ? -1 : dir === 'down' ? 1 : 0,
  };
}

/** SetSpriteCollisionValues + `add b; and $f0; or c`: a coordinate moved to its block and
 *  tagged with the direction of movement (0 still, 7 forward, 9 backward). */
export function adjustedCoord(coord: number, v: number): number {
  const b = v === -1 ? -1 : 0;
  const c = v === 0 ? 0 : v === -1 ? 9 : 7;
  return (u8(coord + b) & 0xf0) | c;
}

/**
 * DetectCollisionBetweenSprites for sprite `self` against `table`: the directions in
 * which another available sprite overlaps it. Per axis the adjusted coordinates may differ
 * by at most 7 or 9 for each sprite (9 when it moves on that axis); the unsigned byte
 * difference is not a shortest wrap-around distance. When both axes overlap, the X bit is
 * kept if self's Y half-width is smaller than its X half-width (it moves horizontally),
 * otherwise the Y bit.
 *
 * The player's overlap with Pikachu (Func_4d0a, wd433) never enters the player's mask;
 * CollisionCheckOnLand handles Pikachu through the exact-front check instead.
 */
export function collisionMask(self: CollisionSprite, table: readonly CollisionSprite[]): number {
  const selfY = adjustedCoord(u8(self.y + 4), self.vy);
  const selfX = adjustedCoord(self.x, self.vx);
  const halfY = (selfY & 0xf) === 0 ? 7 : 9;
  const halfX = (selfX & 0xf) === 0 ? 7 : 9;
  let mask = 0;
  for (const other of table) {
    if (other.slot === self.slot || !other.available) continue;
    const otherY = adjustedCoord(u8(other.y + 4), other.vy);
    const dy = otherY - selfY;
    if (Math.abs(dy) > halfY + (other.vy === 0 ? 7 : 9)) continue;
    const otherX = adjustedCoord(other.x, other.vx);
    const dx = otherX - selfX;
    if (Math.abs(dx) > halfX + (other.vx === 0 ? 7 : 9)) continue;
    if (self.slot === PLAYER_SLOT && other.slot === PIKACHU_SLOT) continue;
    // The borrow of each subtraction: self's coordinate is the larger one
    const bits = halfY < halfX
      ? (dx < 0 ? DIRECTION_BIT.left : DIRECTION_BIT.right)
      : (dy < 0 ? DIRECTION_BIT.up : DIRECTION_BIT.down);
    mask |= bits;
  }
  return mask;
}

/** CanWalkOntoTile's screen-edge test, from the sprite's own screen pixels and the unit
 *  step: YPIXELS + 4 + dy below $80, XPIXELS + dx below $90, as unsigned bytes. */
export function stepStaysOnScreen(x: number, y: number, dir: Direction): boolean {
  const { vx, vy } = unitVector(dir);
  return u8(y + 4 + vy) < 0x80 && u8(x + vx) < 0x90;
}

/** IsSpriteInFrontOfPlayer: the first available sprite (slots 1–15 in order) standing
 *  exactly 16 px in front of the player's screen position. */
export function spriteInFront(table: readonly CollisionSprite[], dir: Direction): CollisionSprite | null {
  const { vx, vy } = unitVector(dir);
  const x = PLAYER_SCREEN_X + vx * 16;
  const y = PLAYER_SCREEN_Y + vy * 16;
  let found: CollisionSprite | null = null;
  for (const s of table) {
    if (s.slot === PLAYER_SLOT || !s.available || s.x !== x || s.y !== y) continue;
    if (!found || s.slot < found.slot) found = s;
  }
  return found;
}

/**
 * CollisionCheckOnLand when the sprite in front is Pikachu. `counter` is
 * wPikachuCollisionCounter (a turn arms 8). Following disabled: an ordinary obstruction.
 * Otherwise B held or a zero counter lets the player through; else the counter counts
 * down and blocks until it reaches zero — seven blocked checks, the eighth passes.
 */
export function pikachuInFront(
  counter: number, bHeld: boolean, followingDisabled: boolean,
): { blocked: boolean; counter: number } {
  if (followingDisabled) return { blocked: true, counter };
  if (bHeld || counter === 0) return { blocked: false, counter };
  const next = counter - 1;
  return { blocked: next !== 0, counter: next };
}
