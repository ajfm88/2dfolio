// Trainer sight (engine/overworld/trainer_sight.asm TrainerEngage, TrainerWalkUpToPlayer;
// home/trainers.asm CheckForEngagingTrainers). Pure: screen bytes in, decisions out.
// notes/20-a1c-plan.md §1.2–§1.4.

import type { Direction } from '../core';

/** The player's fixed screen position (YPIXELS $3c, XPIXELS $40). */
const PLAYER_Y = 0x3c;
const PLAYER_X = 0x40;

/** What TrainerEngage reads of one trainer's sprite. */
export interface SightTrainer {
  /** SPRITESTATEDATA1_XPIXELS / YPIXELS, bytes (sprite_collision.ts screenPixels). */
  x: number;
  y: number;
  /** SPRITESTATEDATA1_FACINGDIRECTION. */
  facing: Direction;
  /** IMAGEINDEX ≠ $ff: on the window, not hidden, refreshed by a standing UpdateSprites. */
  onScreen: boolean;
  /** Trainer header byte 1: sight << 4 (wTrainerEngageDistance). */
  engageDistance: number;
}

/** CalcDifference (home/pathfinding.asm): |a − b| over unsigned bytes. */
export function byteDiff(a: number, b: number): number {
  return Math.abs((a & 0xff) - (b & 0xff));
}

/** CheckSpriteCanSeePlayer: in range, and looking along the axis the player is on. */
function canSeePlayer(t: SightTrainer, distance: number): boolean {
  if (distance > t.engageDistance) return false;
  if (t.facing === 'down' || t.facing === 'up') return t.x === PLAYER_X;
  return t.y === PLAYER_Y;
}

/** CheckPlayerIsInFrontOfSprite: skipped on the Power Plant (its Voltorbs). */
function playerInFront(t: SightTrainer, powerPlant: boolean): boolean {
  if (powerPlant) return true;
  // "special case if sprite is on topmost tile (Y = $fc (-4)), make it come down a block"
  const y = t.y === 0xfc ? 0x0c : t.y;
  switch (t.facing) {
    case 'down': return y < PLAYER_Y;
    case 'up': return y >= PLAYER_Y;
    case 'left': return t.x >= PLAYER_X;
    case 'right': return t.x < PLAYER_X;
  }
}

/**
 * TrainerEngage: does this trainer see the player? The quirks stay (Hard rule 7): a
 * trainer facing down 4 steps above sits at Y = $fc, 192 pixels away by CalcDifference,
 * so it can't see 4 steps; and an image index latched at $ff (pop-in) hides it.
 */
export function trainerEngages(t: SightTrainer, powerPlant = false): boolean {
  if (!t.onScreen) return false;
  let distance: number;
  if (t.y === PLAYER_Y) distance = byteDiff(PLAYER_X, t.x);
  else if (t.x === PLAYER_X) distance = byteDiff(PLAYER_Y, t.y);
  else return false;
  if (distance === 0) return false;
  if (!canSeePlayer(t, distance)) return false;
  return playerInFront(t, powerPlant);
}

/**
 * CheckForEngagingTrainers: the map's trainer headers in order (header order is slot
 * order), beaten ones skipped; the first that engages wins.
 */
export function engagingTrainer<T>(
  trainers: readonly T[],
  sight: (trainer: T) => SightTrainer | null,
  powerPlant = false,
): T | null {
  for (const trainer of trainers) {
    const s = sight(trainer);
    if (s && trainerEngages(s, powerPlant)) return trainer;
  }
  return null;
}

/**
 * TrainerWalkUpToPlayer: the steps toward the player along the facing — none when
 * adjacent ($10), else `swap(distance) − 1` as a byte (distance / 16 − 1 for a standing
 * trainer; exact for any byte).
 */
export function walkUpSteps(t: Pick<SightTrainer, 'x' | 'y' | 'facing'>): number {
  const d = t.facing === 'down' || t.facing === 'up' ? byteDiff(PLAYER_Y, t.y) : byteDiff(PLAYER_X, t.x);
  if (d === 0x10) return 0;
  const swapped = ((d >> 4) | (d << 4)) & 0xff;
  return (swapped - 1) & 0xff;
}
