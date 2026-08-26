// Lynel — Z_04.asm:1958 UpdateLynel
// Uses Goriya movement pattern, shoots sword shot ($57)
// Blue (type 1): turnRate $A0
// Red (type 2): turnRate $70

import { WalkerEnemy } from './walker-enemy.js';

export function createLynel(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): WalkerEnemy {
  const isBlue = objectType === 1;
  const turnRate = isBlue ? 0xA0 : 0x70;
  return new WalkerEnemy(
    x, y, objectType, hp, spawnCloudFrames,
    turnRate, 0x20, 0x57, isBlue, 12,
  );
}
