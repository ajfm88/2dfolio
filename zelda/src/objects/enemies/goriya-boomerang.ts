// Goriya boomerang — Z_07.asm:3857 UpdateArrowOrBoomerang (enemy boomerang $5C)
// Flies out in the thrown direction, then homes back to the Goriya that threw it.
// Reuses the EnemyProjectile pipeline (SpawnManager tracks/updates/renders it, and
// checkEnemyProjectileCollisions handles Link damage + shield deflection).

import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { EnemyProjectile, ProjectileState } from '../projectiles/enemy-projectile.js';
import { ProjectileType } from '../player/shield.js';

const OUT_SPEED = 2;          // px/frame outbound
const RETURN_SPEED = 2;       // px/frame homing back
const MAX_OUT_DISTANCE = 64;  // px before turning around
const CATCH_THRESHOLD = 8;    // px from owner center to be caught
const MAX_LIFETIME = 160;     // safety cap so an orphaned boomerang always dies

interface BoomerangOwner {
  getCollisionCenter(): { cx: number; cy: number };
  readonly isDead: boolean;
}

enum Phase {
  Out,
  Return,
}

export class GoriyaBoomerang extends EnemyProjectile {
  private readonly _owner: BoomerangOwner;
  private _phase = Phase.Out;
  private _outTraveled = 0;
  private _lifetime = 0;
  private _animFrame = 0;

  constructor(x: number, y: number, direction: Direction, owner: BoomerangOwner) {
    super(x, y, direction, ProjectileType.EnemyBoomerang);
    this._owner = owner;
  }

  override update(): void {
    if (this._state === ProjectileState.Dead) return;

    // Shield deflection is handled by the base class (bounce away, then die).
    if (this._state === ProjectileState.Deflected) {
      super.update();
      return;
    }

    this._lifetime++;
    this._animFrame = (this._animFrame + 1) & 0x03;
    if (this._lifetime >= MAX_LIFETIME) {
      this._state = ProjectileState.Dead;
      return;
    }

    if (this._phase === Phase.Out) {
      const delta = directionDelta(this._direction);
      this._x += delta.dx * OUT_SPEED;
      this._y += delta.dy * OUT_SPEED;
      this._outTraveled += OUT_SPEED;
      if (this._outTraveled >= MAX_OUT_DISTANCE) {
        this._phase = Phase.Return;
      }
      return;
    }

    // Return phase — home toward the owner's current center.
    if (this._owner.isDead) {
      // Owner gone: keep drifting the way it was, die on lifetime cap.
      const delta = directionDelta(this._direction);
      this._x += delta.dx * RETURN_SPEED;
      this._y += delta.dy * RETURN_SPEED;
      return;
    }

    const { cx, cy } = this._owner.getCollisionCenter();
    const dx = cx - (this._x + 4);
    const dy = cy - (this._y + 4);
    const dist = Math.hypot(dx, dy);
    if (dist <= CATCH_THRESHOLD) {
      this._state = ProjectileState.Dead; // caught
      return;
    }
    this._x += (dx / dist) * RETURN_SPEED;
    this._y += (dy / dist) * RETURN_SPEED;
  }

  override render(renderer: Renderer): void {
    if (this._state === ProjectileState.Dead) return;
    if (this._state === ProjectileState.Deflected) {
      super.render(renderer);
      return;
    }
    // Spinning boomerang — alternate a horizontal/vertical bar for a "rotation" feel.
    const color = '#f0d078';
    if ((this._animFrame & 1) === 0) {
      renderer.fillRect(this._x, this._y + 2, 8, 4, color);
      renderer.fillRect(this._x + 2, this._y, 4, 8, color);
    } else {
      renderer.fillRect(this._x + 1, this._y + 1, 6, 6, color);
    }
  }
}

function directionDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.Up: return { dx: 0, dy: -1 };
    case Direction.Down: return { dx: 0, dy: 1 };
    case Direction.Left: return { dx: -1, dy: 0 };
    case Direction.Right: return { dx: 1, dy: 0 };
  }
}
