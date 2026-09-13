// Gibdo — Z_04.asm:6465 UpdateGibdo
// Mummy. Plain wanderer (turnRate $80, QSpeed $20), no shooting. Type $30, 7 hits.
import { drawDungeonEnemySprite, GIBDO_SPRITES } from '../../render/enemy-sprite-data.js';
import { WalkerEnemy } from './walker-enemy.js';

export class Gibdo extends WalkerEnemy {
  constructor(
    x, y,
    objectType, hp, spawnCloudFrames,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames, 0x80, 0x20, 0, false, -1);
  }

    renderEnemy(renderer, _enemySheet) {
    const frame = GIBDO_SPRITES[this._walkAnimFrame] ?? GIBDO_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}

export function createGibdo(
  x, y,
  objectType, hp, spawnCloudFrames,
) {
  return new Gibdo(x, y, objectType, hp, spawnCloudFrames);
}
