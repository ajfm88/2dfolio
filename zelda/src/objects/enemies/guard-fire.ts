// GuardFire ($3F) + StandingFire ($40) — Z_04.asm UpdateGuardFire:9654, UpdateStandingFire:264
// Stationary animated fire objects in dungeon rooms.
// StandingFire: invulnerable, damages Link on contact.
// GuardFire: killable (dies → dead dummy $5D), damages Link on contact.
// GuardFire appears in the Zelda rescue room (4 flames around her).

import type { Renderer } from '../../render/renderer.js';
import { drawNpcSprite, FIRE_SPRITES } from '../../render/boss-sprite-data.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';

export class StandingFire extends Enemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false;
    this._invincibilityMask = 0xff;
  }

  protected override updateAI(_ctx: EnemyUpdateContext): void {
    this.tickWalkAnimation(2);
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIdx = this._walkAnimFrame & 1;
    const frame = FIRE_SPRITES.frames[frameIdx] ?? FIRE_SPRITES.frames[0];
    if (frame) drawNpcSprite(renderer, frame, this._x, this._y);
  }
}

export class GuardFire extends Enemy {
  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._invincibilityMask = 0;
  }

  protected override updateAI(_ctx: EnemyUpdateContext): void {
    this.tickWalkAnimation(2);
  }

  protected override renderEnemy(renderer: Renderer): void {
    const frameIdx = this._walkAnimFrame & 1;
    const frame = FIRE_SPRITES.frames[frameIdx] ?? FIRE_SPRITES.frames[0];
    if (frame) drawNpcSprite(renderer, frame, this._x, this._y);
  }
}
