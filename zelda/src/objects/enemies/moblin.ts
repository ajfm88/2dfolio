// Moblin — Z_04.asm:1950 UpdateMoblin
// Blue (type 3): turnRate $A0, QSpeed $20, shoots arrow ($5B)
// Red (type 4): turnRate $A0, QSpeed $20, shoots arrow ($5B)

import { WalkerEnemy } from './walker-enemy.js';

export function createMoblin(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): WalkerEnemy {
  const isBlue = objectType === 3;
  return new WalkerEnemy(
    x, y, objectType, hp, spawnCloudFrames,
    0xA0, 0x20, 0x5B, isBlue, 4,
  );
}
