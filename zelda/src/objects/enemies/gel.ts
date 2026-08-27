// Gel — Z_04.asm:1384 UpdateGel
// Small, fast, erratic jelly. Dies in one hit (HP 0). Types $14 (normal) and
// $15 (child spawned from a Zol split).

import { JellyEnemy } from './jelly-enemy.js';

const GEL_QSPEED = 0x28; // slightly faster + more erratic than a Zol
const GEL_LINK_BIAS = 0.25;

export class Gel extends JellyEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, GEL_QSPEED, GEL_LINK_BIAS);
  }
}
