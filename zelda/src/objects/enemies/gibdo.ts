// Gibdo — Z_04.asm:6465 UpdateGibdo
// Mummy. Plain wanderer (turnRate $80, QSpeed $20), no shooting. Type $30, 7 hits.

import { WalkerEnemy } from './walker-enemy.js';

export function createGibdo(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): WalkerEnemy {
  return new WalkerEnemy(
    x, y, objectType, hp, spawnCloudFrames,
    0x80, 0x20, 0 /* no projectile */, false, -1 /* placeholder render */,
  );
}
