// Gibdo — Z_04.asm:6465 UpdateGibdo
// Mummy. Plain wanderer (turnRate $80, QSpeed $20), no shooting. Type $30, 7 hits.

import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, GIBDO_SPRITES } from '../../render/enemy-sprite-data.js';
import { WalkerEnemy } from './walker-enemy.js';

export class Gibdo extends WalkerEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, 0x80, 0x20, 0, false, -1);
  }

  protected override renderEnemy(renderer: Renderer, _enemySheet?: SpriteSheet): void {
    const frame = GIBDO_SPRITES[this._walkAnimFrame] ?? GIBDO_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}

export function createGibdo(
  x: number, y: number,
  objectType: number, hp: number, spawnCloudFrames: number,
): Gibdo {
  return new Gibdo(x, y, objectType, hp, spawnCloudFrames);
}
