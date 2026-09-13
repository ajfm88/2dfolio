// GuardFire ($3F) + StandingFire ($40) — Z_04.asm UpdateGuardFire:9654, UpdateStandingFire:264
// Stationary animated fire objects in dungeon rooms.
// StandingFire: invulnerable, damages Link on contact.
// GuardFire: killable (dies → dead dummy $5D), damages Link on contact.
// GuardFire appears in the Zelda rescue room (4 flames around her).
import { drawFireSprite } from '../../render/boss-sprite-data.js';
import { Enemy } from './enemy.js';

export class StandingFire extends Enemy {
  constructor(
    x, y,
    objectType, hp, spawnCloudFrames,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._vulnerable = false;
    this._invincibilityMask = 0xff;
  }

    updateAI(_ctx) {
    this.tickWalkAnimation(2);
  }

    renderEnemy(renderer) {
    drawFireSprite(renderer, this._walkAnimFrame & 1, this._x, this._y);
  }
}

export class GuardFire extends Enemy {
  constructor(
    x, y,
    objectType, hp, spawnCloudFrames,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._invincibilityMask = 0;
  }

    updateAI(_ctx) {
    this.tickWalkAnimation(2);
  }

    renderEnemy(renderer) {
    drawFireSprite(renderer, this._walkAnimFrame & 1, this._x, this._y);
  }
}
