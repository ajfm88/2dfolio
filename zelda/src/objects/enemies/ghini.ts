// Ghini — Z_04.asm:3070 UpdateGhini / Z_04.asm:3976 UpdateFlyingGhini
// Main Ghini (type 33): walks with turnRate $FF, death kills all flying Ghini
// Flying Ghini (type 34): flies freely, spawned by gravestone touch

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

export class Ghini extends Enemy {
  private _subPixel = 0;
  private _turnTimer = 0;
  private _siblings: Enemy[] = [];

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
  }

  setSiblings(siblings: Enemy[]): void {
    this._siblings = siblings;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // turnRate $FF = turn every frame
    if (this._turnTimer <= 0) {
      if (Math.floor(Math.random() * 256) < 0xFF) {
        this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      } else {
        this._direction = randomDirection();
      }
      this._turnTimer = Math.floor(Math.random() * 8) + 2;
    }
    this._turnTimer--;

    // Walk with QSpeed $20
    for (let i = 0; i < 4; i++) {
      this._subPixel += 0x20;
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        this.moveOnePixel(ctx.collision, ctx.screen);
      }
    }

    this.tickWalkAnimation(8);
  }

  // Z_04.asm:3080 — killing main Ghini kills all flying Ghini
  protected override onDeath(): void {
    for (const sibling of this._siblings) {
      if (sibling.objectType === 34 && sibling.isActive) {
        sibling.takeDamage(0xFF, Direction.Down);
      }
    }
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(this._x, this._y, 16, 16);
    // Ghost face
    ctx.fillStyle = '#000000';
    ctx.fillRect(this._x + 3, this._y + 4, 3, 3);
    ctx.fillRect(this._x + 10, this._y + 4, 3, 3);
    ctx.fillRect(this._x + 5, this._y + 10, 6, 2);
    // Wavy bottom
    ctx.fillStyle = '#aaaaaa';
    if (this._walkAnimFrame === 0) {
      ctx.fillRect(this._x, this._y + 14, 4, 2);
      ctx.fillRect(this._x + 8, this._y + 14, 4, 2);
    } else {
      ctx.fillRect(this._x + 4, this._y + 14, 4, 2);
      ctx.fillRect(this._x + 12, this._y + 14, 4, 2);
    }
  }
}

export class FlyingGhini extends Enemy {
  private velX: number;
  private velY: number;
  private distanceTraveled = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    const angle = Math.random() * Math.PI * 2;
    this.velX = Math.cos(angle) * 0.75;
    this.velY = Math.sin(angle) * 0.75;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Fly toward Link with slight randomness
    if (Math.random() < 0.02) {
      const dx = ctx.linkX - this._x;
      const dy = ctx.linkY - this._y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.velX = (dx / dist) * 0.75;
        this.velY = (dy / dist) * 0.75;
      }
    }

    let nx = this._x + this.velX;
    let ny = this._y + this.velY;

    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this.velX = -this.velX;
      nx = this._x + this.velX;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this.velY = -this.velY;
      ny = this._y + this.velY;
    }

    this._x = nx;
    this._y = ny;
    this.distanceTraveled++;
    this._direction = this.velX > 0 ? Direction.Right : Direction.Left;
  }

  protected override renderEnemy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const alpha = 0.6 + (this.distanceTraveled & 1) * 0.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(this._x, this._y, 16, 16);
    ctx.fillStyle = '#000000';
    ctx.fillRect(this._x + 3, this._y + 4, 3, 3);
    ctx.fillRect(this._x + 10, this._y + 4, 3, 3);
    ctx.restore();
  }
}
