// Stalfos — Z_04.asm:4670 UpdateStalfos
// Turn rate $80, QSpeed $20, wanders toward Link. Cannot shoot in the first quest.
// Type $2A. 2 wooden-sword hits. Reuses the WalkerEnemy wander AI.
// Frame 2 is the horizontal mirror of frame 1 (NES CHR flip).

import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, drawDungeonEnemySpriteFlipped, STALFOS_SPRITES } from '../../render/enemy-sprite-data.js';
import { WalkerEnemy } from './walker-enemy.js';

export class Stalfos extends WalkerEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, 0x80, 0x20, 0, false, -1);
  }

  protected override renderEnemy(renderer: Renderer, _enemySheet?: SpriteSheet): void {
    const frame = STALFOS_SPRITES[0]!;
    if (this._walkAnimFrame === 1) {
      drawDungeonEnemySpriteFlipped(renderer, frame, this._x, this._y);
    } else {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}

export function createStalfos(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): Stalfos {
  return new Stalfos(x, y, objectType, hp, spawnCloudFrames);
}
