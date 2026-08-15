// Shield deflection — Z_01.asm CheckLinkCollision (lines 5653-5717)

import { DEFLECTION_BOUNCE_FRAMES } from '../../core/constants.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { Direction } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';

// NES projectile type IDs from UpdateObject_JumpTable (Z_07.asm:5405)
export enum ProjectileType {
  Rock = 0x53,
  RockVariant = 0x54,
  Fireball = 0x55,
  Fireball2Unblockable = 0x56,
  SwordShot = 0x57,
  MagicShot = 0x58,
  MagicShot2 = 0x59,
  UnblockableShot = 0x5a,
  Arrow = 0x5b,
  EnemyBoomerang = 0x5c,
}

const UNBLOCKABLE_TYPES: ReadonlySet<ProjectileType> = new Set([
  ProjectileType.Fireball2Unblockable,
  ProjectileType.UnblockableShot,
]);

const MAGIC_SHIELD_ONLY_MIN = 0x55;
const MAGIC_SHIELD_ONLY_MAX = 0x5a;

export function canShieldBlock(
  linkDirection: Direction,
  projectileDirection: Direction,
  projectileType: ProjectileType,
  hasMagicShield: boolean,
  linkIsIdle: boolean,
): boolean {
  if (!linkIsIdle) return false;
  if (UNBLOCKABLE_TYPES.has(projectileType)) return false;
  if (getOppositeDirection(linkDirection) !== projectileDirection) return false;

  if (projectileType >= MAGIC_SHIELD_ONLY_MIN && projectileType <= MAGIC_SHIELD_ONLY_MAX) {
    return hasMagicShield;
  }

  return true;
}

export class ShieldDeflection {
  private _x: number;
  private _y: number;
  private readonly _direction: Direction;
  private _timer = 0;
  private _active = true;

  constructor(x: number, y: number, awayDirection: Direction) {
    this._x = x;
    this._y = y;
    this._direction = awayDirection;
  }

  isActive(): boolean {
    return this._active;
  }

  update(): void {
    if (!this._active) return;

    this._timer++;

    // Bounce away from Link, decelerating — Z_04.asm BounceShot
    const speed = this._timer < 8 ? 2 : 1;
    switch (this._direction) {
      case Direction.Up:
        this._y -= speed;
        break;
      case Direction.Down:
        this._y += speed;
        break;
      case Direction.Left:
        this._x -= speed;
        break;
      case Direction.Right:
        this._x += speed;
        break;
    }

    if (this._timer >= DEFLECTION_BOUNCE_FRAMES) {
      this._active = false;
    }
  }

  render(renderer: Renderer): void {
    if (!this._active) return;

    // Flash between white and yellow for spark effect
    const color = this._timer % 2 === 0 ? '#fff' : '#ff0';
    renderer.fillRect(this._x + 2, this._y + 2, 4, 4, color);
    renderer.fillRect(this._x, this._y + 4, 8, 1, color);
    renderer.fillRect(this._x + 4, this._y, 1, 8, color);
  }
}
