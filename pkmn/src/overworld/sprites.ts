// UpdateSprites and Pikachu's follow commands, shared by the overworld and the script
// controller (A6a, walk_pace.ts; slot order and collisions A6c, sprite_collision.ts).

import type { GameMap } from './map';
import type { Npc } from './npc';
import type { Player } from './player';
import type { PikachuFollower } from '../pikachu/pikachu_follower';
import type { CollisionSprite } from './sprite_collision';

/**
 * The sprite table DetectCollisionBetweenSprites reads, built from the live objects: the
 * player in slot 0, the NPCs from slot 1 in map order, Pikachu in slot 15. Pixels are
 * screen pixels, relative to the player's current world position.
 */
export function spriteTable(
  player: Player,
  npcs: readonly Npc[],
  pikachuFollower?: PikachuFollower,
): CollisionSprite[] {
  const table = [player.collisionSprite()];
  npcs.forEach((npc, i) => table.push(npc.collisionSprite(player.x, player.y, i + 1)));
  if (pikachuFollower?.visible) table.push(pikachuFollower.collisionSprite(player.x, player.y));
  return table;
}

/**
 * UpdateSprites: the player's sprite (its collision mask, taken before anyone moves),
 * then every NPC in slot order — each try sees the earlier slots as already updated and
 * the later ones as they were — then Pikachu. The player's walk calls this where the
 * ASM's loop calls it (PlayerWalk), once per pass or not at all on a turning pass.
 */
export function updateSprites(
  npcs: readonly Npc[],
  gameMap: GameMap,
  player: Player,
  pikachuFollower?: PikachuFollower,
): void {
  const table = (): CollisionSprite[] => spriteTable(player, npcs, pikachuFollower);
  player.detectSpriteCollisions(table());
  const playerMapStep = { x: player.mapStepX, y: player.mapStepY };
  npcs.forEach((npc, i) => {
    npc.update({
      isWalkable: (tx, ty) => gameMap.isWalkable(tx, ty),
      playerWalking: player.isMoving,
      playerMapStep,
      playerX: player.x,
      playerY: player.y,
      slot: i + 1,
      sprites: table,
    });
  });
  if (pikachuFollower?.visible) {
    pikachuFollower.updateSprite({
      playerWalking: player.isMoving,
      playerMapStep,
      playerFacing: player.direction,
      inGrass: gameMap.isGrassTile(pikachuFollower.tileX, pikachuFollower.tileY),
    });
  }
}

/**
 * Func_fcc08 runs after UpdateSprites at every step start, including both hop halves.
 * Pikachu executes the command one pass later; bit 6 suppresses the second hop append.
 */
export function recordStepForPikachu(player: Player, pikachuFollower: PikachuFollower): void {
  if (player.startedFollowStep) pikachuFollower.playerStepStarted(player.direction, player.ledgeHopFlag);
}

/** What the overworld scene draws, in one OAM-priority step each. */
export type SceneSprite = 'player' | 'npcs' | 'pikachu';

/**
 * OAM priority, lowest drawn first: ordinarily the NPCs, Pikachu (slot 15), then the
 * player (slot 0) on top. While ApplyPikachuMovementData has swapped Pikachu into slot 0
 * the player (now slot 15) goes first and Pikachu last.
 */
export function spriteDrawOrder(pikachuInSlot0: boolean): SceneSprite[] {
  return pikachuInSlot0 ? ['player', 'npcs', 'pikachu'] : ['npcs', 'pikachu', 'player'];
}
