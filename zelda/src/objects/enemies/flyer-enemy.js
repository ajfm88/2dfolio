// Flyer base — Z_04.asm ControlKeeseFlight / MoveFlyer
// 6-state free-flight machine: SpeedUp → Decide → Chase/Wander → SlowDown → Delay.
// Flies over walls (ignores tile collision), bounces off the play-area edges.
// Unlike the Peahat, a flyer built on this base is vulnerable at all times.

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';
import { Enemy } from './enemy.js';

const FlyingState = Object.freeze({
  SpeedUp: 0,
  Decide: 1,
  Chase: 2,
  Wander: 3,
  SlowDown: 4,
  Delay: 5
});

const WANDER_TURNS = 6;

export class FlyerEnemy extends Enemy {
   _flyingState = FlyingState.Delay;
   _speed = 0;
   _velX = 0;
   _velY = 0;
   _turnsRemaining = 0;
   _stateTimer;
   _distanceTraveled = 0;
    _maxSpeed;
    _accel;
    _delayMin;
    _delayRange;

  constructor(
    x, y,
    objectType, hp, spawnCloudFrames,
    maxSpeed, accel, delayMin, delayRange,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._maxSpeed = maxSpeed;
    this._accel = accel;
    this._delayMin = delayMin;
    this._delayRange = delayRange;
    this._stateTimer = delayMin + Math.floor(Math.random() * delayRange);
  }

    updateAI(ctx) {
    switch (this._flyingState) {
      case FlyingState.SpeedUp:
        this._speed = Math.min(this._maxSpeed, this._speed + this._accel);
        if (this._speed >= this._maxSpeed) this._flyingState = FlyingState.Decide;
        this.moveFlyer();
        break;

      case FlyingState.Decide: {
        const r = Math.floor(Math.random() * 256);
        if (r >= 0xA0) this._flyingState = FlyingState.Chase;
        else if (r >= 0x20) this._flyingState = FlyingState.Wander;
        else this._flyingState = FlyingState.SlowDown;
        this._turnsRemaining = WANDER_TURNS;
        this.moveFlyer();
        break;
      }

      case FlyingState.Chase:
        this.chaseLink(ctx.linkX, ctx.linkY);
        this.moveFlyer();
        if (--this._turnsRemaining <= 0) this._flyingState = FlyingState.Decide;
        break;

      case FlyingState.Wander:
        if (this._turnsRemaining <= 0 || Math.random() < 0.05) {
          const angle = Math.random() * Math.PI * 2;
          this._velX = Math.cos(angle) * this._speed;
          this._velY = Math.sin(angle) * this._speed;
          this._turnsRemaining--;
        }
        this.moveFlyer();
        if (this._turnsRemaining <= 0) this._flyingState = FlyingState.SlowDown;
        break;

      case FlyingState.SlowDown:
        this._speed = Math.max(0, this._speed - this._accel);
        this.moveFlyer();
        if (this._speed <= 0) {
          this._flyingState = FlyingState.Delay;
          this._stateTimer = this._delayMin + Math.floor(Math.random() * this._delayRange);
        }
        break;

      case FlyingState.Delay:
        if (--this._stateTimer <= 0) {
          this._flyingState = FlyingState.SpeedUp;
          this._speed = 0;
          this.chaseLink(ctx.linkX, ctx.linkY);
        }
        break;
    }

    this._direction = this._velX >= 0 ? Direction.Right : Direction.Left;
  }

   chaseLink(linkX, linkY) {
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this._velX = (dx / dist) * this._speed;
      this._velY = (dy / dist) * this._speed;
    }
  }

   moveFlyer() {
    let nx = this._x + this._velX;
    let ny = this._y + this._velY;
    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) {
      this._velX = -this._velX;
      nx = this._x + this._velX;
    }
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      this._velY = -this._velY;
      ny = this._y + this._velY;
    }
    this._x = Math.max(SCREEN_EDGE_LEFT, Math.min(SCREEN_EDGE_RIGHT, nx));
    this._y = Math.max(SCREEN_EDGE_TOP, Math.min(SCREEN_EDGE_BOTTOM, ny));
    this._distanceTraveled++;
  }
}
