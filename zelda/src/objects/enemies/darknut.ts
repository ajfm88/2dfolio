// Darknut — Z_04.asm:6475 UpdateDarknut, parry at Z_01.asm:6316
// Armored knight. Wanders (turnRate $80). Never stunned. PARRIES melee/beam hits
// that come along the same axis it faces — only side hits (perpendicular axis)
// deal damage. Red ($0B, 4 hits) is slower; Blue ($0C, 8 hits) is faster/tougher.

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { drawDungeonEnemySprite, DARKNUT_SPRITES } from '../../render/enemy-sprite-data.js';
import { WalkerEnemy } from './walker-enemy.js';

const BLUE_TYPE = 0x0c;

export class Darknut extends WalkerEnemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    const qSpeed = objectType === BLUE_TYPE ? 0x30 : 0x20;
    super(x, y, objectType, hp, spawnCloudFrames, 0x80, qSpeed, 0, false, -1);
  }

  protected override renderEnemy(renderer: Renderer, _enemySheet?: SpriteSheet): void {
    const color = this._objectType === BLUE_TYPE ? DARKNUT_SPRITES.blue : DARKNUT_SPRITES.red;
    const rows = this._walkAnimFrame === 0 ? color.row1 : color.row2;
    const frame = rows[this._direction];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }

  // Never stunned (Z_04.asm zeroes ObjStunTimer every frame).
  override stun(): void {
    // no-op
  }

  // Parry a frontal hit: the weapon travels opposite to the Darknut's facing
  // (Z_01.asm ORs the two directions and blocks $0C / $03 — opposite same-axis).
  // Hits from behind or the sides still deal damage.
  override blocksAttackFrom(weaponDirection: Direction): boolean {
    return weaponDirection === getOppositeDirection(this._direction);
  }
}
