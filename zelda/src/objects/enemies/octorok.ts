// Octorok — Z_04.asm:2969 UpdateOctorock
// Red slow (type 7): turnRate $70, QSpeed $20
// Red fast (type 8): turnRate $70, QSpeed $40
// Blue slow (type 9): turnRate $A0, QSpeed $20
// Blue fast (type 10): turnRate $A0, QSpeed $40
// Shoots rock (type $53)

import { WalkerEnemy } from './walker-enemy.js';

export function createOctorok(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): WalkerEnemy {
  const isBlue = objectType >= 9;
  const isFast = objectType === 8 || objectType === 10;
  const turnRate = isBlue ? 0xA0 : 0x70;
  const qSpeed = isFast ? 0x40 : 0x20;
  return new WalkerEnemy(
    x, y, objectType, hp, spawnCloudFrames,
    turnRate, qSpeed, 0x53, isBlue, 0,
  );
}
