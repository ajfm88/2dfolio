// Stalfos — Z_04.asm:4670 UpdateStalfos
// Turn rate $80, QSpeed $20, wanders toward Link. Cannot shoot in the first quest.
// Type $2A. 2 wooden-sword hits. Reuses the WalkerEnemy wander AI.

import { WalkerEnemy } from './walker-enemy.js';

export function createStalfos(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): WalkerEnemy {
  return new WalkerEnemy(
    x, y, objectType, hp, spawnCloudFrames,
    0x80, 0x20, 0 /* no projectile */, false, -1 /* placeholder render */,
  );
}
