// Pikachu's idle behavior (A6c): engine/pikachu/pikachu_follow.asm Func_fc803 and the four
// antics it can start (statuses 6–9), plus the follow-command bytes they read.
//
// Pure: PikachuFollower owns the live facing and animation counters and calls these on
// each UpdateSprites. The idle countdown shares the byte the follow moves count with
// (wSpritePikachuStateData2WalkAnimationCounter), so a finished move leaves it at zero and
// the first idle update wraps it to 255.

import type { Direction } from '../core';
import type { WalkAnim } from '../overworld/walk_pace';

/** Follow command directions: 1–4 down, up, left, right; 5–8 the same as two steps. */
const COMMAND_DIRECTIONS: readonly Direction[] = ['down', 'up', 'left', 'right'];

/** Func_fcc42 / Func_fcc64: the command the player's step appends (a ledge hop: 5–8). */
export function followCommandFor(dir: Direction, twoStep: boolean): number {
  return COMMAND_DIRECTIONS.indexOf(dir) + 1 + (twoStep ? 4 : 0);
}

/** A command's facing: ((command - 1) & 3) × 4 as a SPRITE_FACING value. */
export function commandFacing(command: number): Direction {
  return COMMAND_DIRECTIONS[(command - 1) & 3];
}

/**
 * ComputePikachuFollowCommand (RefreshPikachuFollow): from Pikachu's map position toward
 * the player's, Y first. One step away gives 1–4, two or more 5–8; 0 when they overlap
 * (no command is appended). Positions in steps.
 */
export function seedFollowCommand(pika: { x: number; y: number }, player: { x: number; y: number }): number {
  const dy = player.y - pika.y;
  if (dy !== 0) return (dy > 0 ? 1 : 2) + (Math.abs(dy) < 2 ? 0 : 4);
  const dx = player.x - pika.x;
  if (dx !== 0) return (dx > 0 ? 4 : 3) + (Math.abs(dx) < 2 ? 0 : 4);
  return 0;
}

/**
 * ComputePikachuFacingDirection, when a follow move ends: the newest command's facing if
 * commands remain to execute; otherwise toward the player by map position, Y first, or the
 * player's own facing when they overlap.
 */
export function followEndFacing(
  queued: boolean,
  newestCommand: number,
  pika: { x: number; y: number },
  player: { x: number; y: number },
  playerFacing: Direction,
): Direction {
  if (queued && newestCommand !== 0) return commandFacing(newestCommand);
  if (pika.y !== player.y) return pika.y < player.y ? 'down' : 'up';
  if (pika.x !== player.x) return pika.x < player.x ? 'right' : 'left';
  return playerFacing;
}

/** Pointer_fc8d6: the bounce's screen offsets as stored (Y, X), read from the end. */
export const BOUNCE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0], [-2, 1], [-4, 2], [-2, 3], [0, 4],
  [-2, 3], [-4, 2], [-2, 1], [0, 0], [-2, -1],
  [-4, -2], [-2, -3], [0, -4], [-2, -3], [-4, -2],
  [-2, -1], [0, 0],
];

/** The antics by `Random & 3` (PointerTable_fc85a), with their update counts. */
export type PikachuAntic = 'bounce' | 'walkInPlace' | 'shuffle' | 'spin';
const ANTICS: readonly PikachuAntic[] = ['bounce', 'walkInPlace', 'shuffle', 'spin'];
export const ANTIC_UPDATES: Record<PikachuAntic, number> = {
  bounce: 0x11, walkInPlace: 0x30, shuffle: 0x20, spin: 0x20,
};

/** .TurnClockwise: down → left → up → right → down. */
const SPIN_NEXT: Record<Direction, Direction> = { down: 'left', left: 'up', up: 'right', right: 'down' };

/** The sprite fields the idle routines change. */
export interface PikachuIdleSprite {
  facing: Direction;
  readonly anim: WalkAnim;
}

export interface PikachuIdleContext {
  /** wWalkCounter ≠ 0 (Func_fc82e). */
  playerWalking: boolean;
  /** Func_fcae2: Pikachu's map position is the player's. */
  overlapsPlayer: boolean;
  /** GetPikachuFollowCommand: the retained command (0 when the buffer is empty). */
  followCommand: number;
  /** A random byte (hRandomAdd). */
  random: () => number;
}

/** What the update did to the image: hidden ($ff), refreshed (UpdatePikachuWalkingSprite),
 *  or left as it was (the bounce never refreshes it). */
export type PikachuImageUpdate = 'hidden' | 'refresh' | 'latched';

/** Idle and antic state: the shared countdown, the antic under way, the bounce offset. */
export class PikachuIdle {
  /** wSpritePikachuStateData2WalkAnimationCounter */
  counter = 0;
  /** Statuses 6–9, or null when ready (status 1). */
  antic: PikachuAntic | null = null;
  /** The bounce's screen offset (wd431 / wd432): never Pikachu's map position. */
  offsetX = 0;
  offsetY = 0;

  /**
   * Func_fc803, reached from the ready state when no follow command can execute. Hidden
   * and nothing counted while Pikachu stands on the player's map position. Otherwise the
   * countdown drops; at zero a retained single-step command (or none) picks a random facing
   * and reloads 32, while a two-step command starts an antic, which runs its first update
   * now.
   */
  idle(sprite: PikachuIdleSprite, ctx: PikachuIdleContext): PikachuImageUpdate {
    if (ctx.overlapsPlayer) return 'hidden';
    this.counter = (this.counter - 1) & 0xff;
    if (this.counter === 0) {
      if (ctx.followCommand >= 5) return this.startAntic(sprite, ctx);
      this.counter = 0x20;
      sprite.facing = COMMAND_DIRECTIONS[(ctx.random() & 0x0c) >> 2];
    }
    sprite.anim.intra = 0;
    sprite.anim.frame = 0;
    return 'refresh';
  }

  /** One update of the antic under way (asm_fc87f, asm_fc904, asm_fc937, asm_fc969). Each
   *  first checks wWalkCounter: a walking player ends it at once. */
  anticUpdate(sprite: PikachuIdleSprite, ctx: PikachuIdleContext): PikachuImageUpdate {
    if (ctx.playerWalking) {
      // Func_fc8c7 takes the bounce's offset back off
      this.offsetX = 0;
      this.offsetY = 0;
      this.finish();
      return 'latched';
    }
    if (this.antic === 'bounce') {
      [this.offsetY, this.offsetX] = BOUNCE_OFFSETS[this.counter - 1];
      this.countDown();
      return 'latched';
    }
    const anim = sprite.anim;
    anim.intra = (anim.intra + 1) & 0xff;
    if (anim.intra === 8) {
      anim.intra = 0;
      if (this.antic === 'walkInPlace') anim.frame = (anim.frame + 1) & 3;
      else if (this.antic === 'shuffle') anim.frame ^= 1;
      else sprite.facing = SPIN_NEXT[sprite.facing];
    }
    this.countDown();
    return 'refresh';
  }

  /** Back to ready with a zero countdown, no antic and no offset (a respawn, or a script
   *  taking Pikachu over as Func_fc76a does). */
  reset(): void {
    this.counter = 0;
    this.antic = null;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** Func_fc842 */
  private startAntic(sprite: PikachuIdleSprite, ctx: PikachuIdleContext): PikachuImageUpdate {
    const antic = ANTICS[ctx.random() & 3];
    if (antic === 'bounce') {
      // Func_fc862: face the command's way; the image keeps what it showed
      sprite.facing = commandFacing(ctx.followCommand);
      this.offsetX = 0;
      this.offsetY = 0;
    }
    this.antic = antic;
    this.counter = ANTIC_UPDATES[antic];
    return this.anticUpdate(sprite, ctx);
  }

  private countDown(): void {
    this.counter--;
    if (this.counter === 0) this.finish();
  }

  /** Func_fc835: ready, with 16 on the countdown. */
  private finish(): void {
    this.counter = 0x10;
    this.antic = null;
  }
}
