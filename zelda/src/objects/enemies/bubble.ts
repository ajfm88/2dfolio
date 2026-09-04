// Bubble — Z_04.asm:1122 UpdateBubble
// Invulnerable flitting orb (turnRate $40) that bounces around and cannot be killed
// or damaged, and deals no contact damage. On touch it JINXES Link's sword:
//   $2B — flashing: temporarily blocks the sword ($A0 frames)
//   $2C — blue: restores the sword
//   $2D — red: disables the sword until a blue Bubble restores it
// The jinx side-effect is applied in main.ts on Link contact.

import type { Renderer } from '../../render/renderer.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { drawDungeonEnemySpriteScaled, BUBBLE_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

const QSPEED = 0x40;

export const BUBBLE_FLASH = 0x2b;
export const BUBBLE_BLUE = 0x2c;
export const BUBBLE_RED = 0x2d;
export const BUBBLE_TEMP_JINX_FRAMES = 0xa0; // Z_04.asm SwordBlockedLongTimer

export class Bubble extends Enemy {
  private readonly _sub = { value: 0 };
  private _redirectTimer = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false; // cannot be harmed by any weapon
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    const moved = this.moveQSpeed(QSPEED, this._sub, ctx.collision, ctx.screen);
    if (!moved) {
      this._direction = getOppositeDirection(this._direction);
    } else if (--this._redirectTimer <= 0) {
      this._direction = randomDirection();
      this._redirectTimer = 20 + Math.floor(Math.random() * 40);
    }
    this.tickWalkAnimation(4);
  }

  protected override renderEnemy(renderer: Renderer): void {
    let sprite;
    switch (this._objectType) {
      case BUBBLE_BLUE: sprite = BUBBLE_SPRITES.blue; break;
      case BUBBLE_RED: sprite = BUBBLE_SPRITES.red; break;
      default: sprite = BUBBLE_SPRITES.flash;
    }
    drawDungeonEnemySpriteScaled(renderer, sprite, this._x + 4, this._y, 8, 16);
  }
}
