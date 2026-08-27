// Goriya — Z_04.asm:434 UpdateGoriya
// Wanders like a Walker (QSpeed $20). When Link is within $51 (81px) on an axis it
// faces him and throws a boomerang ($5C) that flies out and homes back. Goriya is
// frozen while its boomerang is in flight (NES state $80 "delay after shooting").
// Blue ($05) throws readily; Red ($06) throws only occasionally. 5/3 hits.

import { Direction } from '../../core/types.js';
import { Enemy, type EnemyUpdateContext, randomDirection } from './enemy.js';
import { GoriyaBoomerang } from './goriya-boomerang.js';

const QSPEED = 0x20;
const THROW_RANGE = 0x51; // 81px — NES "wants to shoot" distance
const BLUE_TYPE = 0x05;

export class Goriya extends Enemy {
  private readonly _sub = { value: 0 };
  private readonly _isBlue: boolean;
  private _turnTimer = 0;
  private _throwCooldown = 60;
  private _boomerang: GoriyaBoomerang | null = null;

  constructor(
    x: number, y: number,
    objectType: number, hp: number, spawnCloudFrames: number,
  ) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._isBlue = objectType === BLUE_TYPE;
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    // Frozen while the boomerang is out; unfreeze when it is caught / dies.
    if (this._boomerang) {
      if (!this._boomerang.isActive()) {
        this._boomerang = null;
        this._throwCooldown = this._isBlue ? 30 : 90;
      } else {
        this.tickWalkAnimation(8);
        return;
      }
    }

    // Wander.
    const moved = this.moveQSpeed(QSPEED, this._sub, ctx.collision, ctx.screen);
    if (!moved || this._turnTimer <= 0) {
      this._direction = Math.random() < 0.5
        ? this.directionTowardLink(ctx.linkX, ctx.linkY)
        : randomDirection();
      this._turnTimer = 12 + Math.floor(Math.random() * 24);
    } else {
      this._turnTimer--;
    }

    // Throw check.
    if (this._throwCooldown > 0) {
      this._throwCooldown--;
    } else {
      this.tryThrow(ctx.linkX, ctx.linkY);
    }

    this.tickWalkAnimation(6);
  }

  private tryThrow(linkX: number, linkY: number): void {
    const dx = linkX - this._x;
    const dy = linkY - this._y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Face along the dominant axis; only throw if Link is within range on it.
    let dir: Direction;
    let dist: number;
    if (absDy >= absDx) {
      dir = dy > 0 ? Direction.Down : Direction.Up;
      dist = absDy;
    } else {
      dir = dx > 0 ? Direction.Right : Direction.Left;
      dist = absDx;
    }
    if (dist >= THROW_RANGE) return;

    // Red Goriya only throws sometimes (NES gates on specific random values).
    if (!this._isBlue && Math.random() >= 0.35) {
      this._throwCooldown = 20;
      return;
    }

    this._direction = dir;
    this._boomerang = new GoriyaBoomerang(this._x + 4, this._y + 4, dir, this);
    this._pendingProjectile = this._boomerang;
  }
}
