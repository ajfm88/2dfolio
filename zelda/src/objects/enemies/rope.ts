// Rope — Z_04.asm:4549 UpdateRope
// Wanders slowly (QSpeed $20). When it becomes aligned with Link on an axis, it
// turns to face Link and rushes fast (QSpeed $60) until it hits a wall, then
// resumes wandering. Type $28, 1 wooden-sword hit.

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySprite, ROPE_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

const WANDER_QSPEED = 0x20;
const RUSH_QSPEED = 0x60;
const ALIGN_THRESHOLD = 8; // px on the perpendicular axis to trigger a rush

export class Rope extends Enemy {
  private readonly _sub = { value: 0 };
  private _rushing = false;
  private _turnTimer = 0;

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Check alignment with Link and start a rush toward him.
    if (!this._rushing) {
      if (Math.abs(ctx.linkX - this._x) < ALIGN_THRESHOLD) {
        this._direction = ctx.linkY > this._y ? Direction.Down : Direction.Up;
        this._rushing = true;
      } else if (Math.abs(ctx.linkY - this._y) < ALIGN_THRESHOLD) {
        this._direction = ctx.linkX > this._x ? Direction.Right : Direction.Left;
        this._rushing = true;
      }
    }

    const qSpeed = this._rushing ? RUSH_QSPEED : WANDER_QSPEED;
    const moved = this.moveQSpeed(qSpeed, this._sub, ctx.collision, ctx.screen);

    if (!moved) {
      // Blocked: stop rushing and pick a fresh direction.
      this._rushing = false;
      this._direction = Math.random() < 0.5
        ? this.directionTowardLink(ctx.linkX, ctx.linkY)
        : randomDirection();
      this._turnTimer = 8 + Math.floor(Math.random() * 24);
    } else if (!this._rushing) {
      // Wandering: occasionally re-aim.
      if (this._turnTimer > 0) {
        this._turnTimer--;
      } else {
        this._direction = Math.random() < 0.4
          ? this.directionTowardLink(ctx.linkX, ctx.linkY)
          : randomDirection();
        this._turnTimer = 16 + Math.floor(Math.random() * 32);
      }
    }

    this.tickWalkAnimation(this._rushing ? 4 : 10);
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    // Rope faces Left or Right primarily; map all 4 dirs to 2 facing sprites
    const facingLeft = this._direction === Direction.Left || this._direction === Direction.Up;
    const baseIndex = facingLeft ? 0 : 2;
    const frame = ROPE_SPRITES.frames[baseIndex + this._walkAnimFrame] ?? ROPE_SPRITES.frames[baseIndex];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, this._y);
    }
  }
}
