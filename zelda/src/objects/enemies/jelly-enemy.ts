// Jelly base (Gel / Zol) — Z_04.asm UpdateGel / UpdateZol
// Slow, erratic hop-and-pause movement. Changes direction (biased toward Link) at
// the end of each hop, with a brief pause between hops.

import { type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { drawDungeonEnemySprite, drawDungeonEnemySpriteScaled, ZOL_SPRITES, GEL_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

export class JellyEnemy extends Enemy {
  private readonly _sub = { value: 0 };
  protected readonly qSpeed: number;
  private _hopTimer: number;
  private _pauseTimer = 0;
  private readonly _linkBias: number;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
    qSpeed: number, linkBias: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this.qSpeed = qSpeed;
    this._linkBias = linkBias;
    this._hopTimer = 12 + Math.floor(Math.random() * 20);
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (this._pauseTimer > 0) {
      this._pauseTimer--;
      this.tickWalkAnimation(8);
      return;
    }

    const moved = this.moveQSpeed(this.qSpeed, this._sub, ctx.collision, ctx.screen);
    this._hopTimer--;

    if (!moved || this._hopTimer <= 0) {
      this._direction = Math.random() < this._linkBias
        ? this.directionTowardLink(ctx.linkX, ctx.linkY)
        : randomDirection();
      this._hopTimer = 12 + Math.floor(Math.random() * 20);
      this._pauseTimer = Math.floor(Math.random() * 8);
    }

    this.tickWalkAnimation(6);
  }

  // Gels are small; keep the hitbox tight-ish but simple (12×12 centered).
  override getHitbox(): Rect {
    return { x: this._x + 2, y: this._y + 2, width: 12, height: 12 };
  }

  protected override renderEnemy(renderer: Renderer): void {
    const isZol = this._objectType === 0x13;
    const isBlue = !isZol && this._objectType === 0x15;
    if (isZol) {
      const variant = isBlue ? ZOL_SPRITES.blue : ZOL_SPRITES.green;
      const frame = variant[this._walkAnimFrame] ?? variant[0];
      if (frame) {
        drawDungeonEnemySprite(renderer, frame, this._x, this._y);
        return;
      }
    }
    // Gel ($14 green, $15 blue) — 8px wide sprites, draw scaled to 16×16
    const gelVariant = isBlue ? GEL_SPRITES.blue : GEL_SPRITES.green;
    const gelFrame = gelVariant[this._walkAnimFrame] ?? gelVariant[0];
    if (gelFrame) {
      drawDungeonEnemySpriteScaled(renderer, gelFrame, this._x + 4, this._y, 8, 16);
      return;
    }
  }
}
