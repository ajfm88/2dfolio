// Armos — Z_04.asm:3310 UpdateArmos
// Stationary statue until Link touches, then walks like Goriya
// Type 30 ($1E). No spawn cloud (Z_07.asm:5283).

import type { Renderer } from '../../render/renderer.js';
import { drawOverworldEnemySprite, ARMOS_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';

enum ArmosPhase {
  Dormant,
  Active,
}

export class Armos extends Enemy {
  private phase = ArmosPhase.Dormant;
  private _subPixel = 0;
  private _turnTimer = 0;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, _spawnCloudFrames: number,
  ) {
    // Armos has no spawn cloud (Z_07.asm:5283)
    super(x, y, objectType, hp, 0);
    this._vulnerable = false;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    if (this.phase === ArmosPhase.Dormant) {
      // Activate when Link is touching
      const dx = Math.abs(ctx.linkX - this._x);
      const dy = Math.abs(ctx.linkY - this._y);
      if (dx < 16 && dy < 16) {
        this.phase = ArmosPhase.Active;
        this._vulnerable = true;
        this._direction = randomDirection();
      }
      return;
    }

    // Active — Goriya-like walker with turnRate $A0
    if (this._turnTimer <= 0) {
      if (0xA0 >= Math.floor(Math.random() * 256)) {
        this._direction = this.directionTowardLink(ctx.linkX, ctx.linkY);
      } else {
        this._direction = randomDirection();
      }
      this._turnTimer = Math.floor(Math.random() * 16) + 8;
    }
    this._turnTimer--;

    for (let i = 0; i < 4; i++) {
      this._subPixel += 0x20;
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        this.moveOnePixel(ctx.collision, ctx.screen);
      }
    }

    this.tickWalkAnimation(6);
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frame = ARMOS_SPRITES[0];
    if (frame) {
      drawOverworldEnemySprite(renderer, frame, this._x, this._y);
      return;
    }
  }
}
