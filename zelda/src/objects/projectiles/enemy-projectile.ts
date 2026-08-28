import {
  ENEMY_PROJECTILE_QFRAC,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { ProjectileType } from '../player/shield.js';

export enum ProjectileState {
  Flying,
  Deflected,
  Dead,
}

export class EnemyProjectile {
  protected _x: number;
  protected _y: number;
  protected _direction: Direction;
  protected readonly _type: ProjectileType;
  protected _state = ProjectileState.Flying;
  private subPixel = 0;
  private deflectTimer = 0;
  private animTimer = 0;
  // Extra vertical drift applied every other frame while flying (Aquamentus'
  // fan: middle 0, lower +1, upper -1). Default 0 = straight cardinal travel.
  protected readonly _verticalDrift: number;

  constructor(
    x: number,
    y: number,
    direction: Direction,
    type: ProjectileType,
    verticalDrift = 0,
  ) {
    this._x = x;
    this._y = y;
    this._direction = direction;
    this._type = type;
    this._verticalDrift = verticalDrift;
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get direction(): Direction {
    return this._direction;
  }

  get type(): ProjectileType {
    return this._type;
  }

  get state(): ProjectileState {
    return this._state;
  }

  isActive(): boolean {
    return this._state !== ProjectileState.Dead;
  }

  isFlying(): boolean {
    return this._state === ProjectileState.Flying;
  }

  deflect(linkDirection: Direction): void {
    this._state = ProjectileState.Deflected;
    this._direction = linkDirection;
    this.deflectTimer = 0;
    this.subPixel = 0;
  }

  deactivate(): void {
    this._state = ProjectileState.Dead;
  }

  update(): void {
    if (this._state === ProjectileState.Dead) return;

    this.animTimer++;

    if (this._state === ProjectileState.Deflected) {
      this.updateDeflected();
      return;
    }

    const pixels = this.computePixels();
    const delta = directionDelta(this._direction);

    for (let i = 0; i < pixels; i++) {
      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      if (nx < -8 || nx >= SCREEN_WIDTH + 8 || ny < -8 || ny >= PLAY_AREA_HEIGHT + 8) {
        this._state = ProjectileState.Dead;
        return;
      }

      this._x = nx;
      this._y = ny;
    }

    // Fan spread: nudge Y by the drift every other frame (NES Aquamentus_Shoot
    // @SpreadOutFireballs runs on alternate screen frames).
    if (this._verticalDrift !== 0 && (this.animTimer & 1) === 0) {
      const ny = this._y + this._verticalDrift;
      if (ny < -8 || ny >= PLAY_AREA_HEIGHT + 8) {
        this._state = ProjectileState.Dead;
        return;
      }
      this._y = ny;
    }
  }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 8, height: 8 };
  }

  render(renderer: Renderer): void {
    if (this._state === ProjectileState.Dead) return;

    if (this._state === ProjectileState.Deflected) {
      const color = this.deflectTimer % 2 === 0 ? '#fff' : '#aaa';
      renderer.fillRect(this._x, this._y, 8, 8, color);
      return;
    }

    this.renderByType(renderer);
  }

  // Distinct placeholder visual per shot type so the player can read what's
  // coming at them (all shots previously drew as one red square). Sprite rows
  // for these live in projectiles.png; deferred like the enemy rows.
  private renderByType(renderer: Renderer): void {
    const x = this._x;
    const y = this._y;
    const horizontal =
      this._direction === Direction.Left || this._direction === Direction.Right;
    const flick = this.animTimer % 4 < 2;

    switch (this._type) {
      case ProjectileType.Rock:
      case ProjectileType.RockVariant:
        renderer.fillRect(x + 1, y + 1, 6, 6, '#a89878');
        renderer.fillRect(x + 2, y + 2, 3, 3, '#d8c8a8');
        return;

      case ProjectileType.Fireball:
      case ProjectileType.Fireball2Unblockable:
        renderer.fillRect(x, y, 8, 8, flick ? '#f83800' : '#f87858');
        renderer.fillRect(x + 2, y + 2, 4, 4, flick ? '#f8d800' : '#f8f8a8');
        return;

      case ProjectileType.SwordShot:
        renderer.fillRect(x, y, 8, 8, '#a8e8f8');
        if (horizontal) renderer.fillRect(x - 2, y + 3, 12, 2, '#ffffff');
        else renderer.fillRect(x + 3, y - 2, 2, 12, '#ffffff');
        return;

      case ProjectileType.MagicShot:
      case ProjectileType.MagicShot2:
      case ProjectileType.UnblockableShot:
        renderer.fillRect(x, y, 8, 8, flick ? '#d858f8' : '#5878f8');
        renderer.fillRect(x + 2, y + 2, 4, 4, '#f8f8f8');
        return;

      case ProjectileType.Arrow:
        if (horizontal) {
          renderer.fillRect(x, y + 3, 8, 2, '#d0d0d0');
          const hx = this._direction === Direction.Right ? x + 6 : x;
          renderer.fillRect(hx, y + 2, 2, 4, '#f8f8f8');
        } else {
          renderer.fillRect(x + 3, y, 2, 8, '#d0d0d0');
          const hy = this._direction === Direction.Down ? y + 6 : y;
          renderer.fillRect(x + 2, hy, 4, 2, '#f8f8f8');
        }
        return;

      default:
        renderer.fillRect(x, y, 8, 8, '#c44');
    }
  }

  private updateDeflected(): void {
    this.deflectTimer++;

    const speed = this.deflectTimer < 8 ? 3 : 1;
    // deflect() stored linkDirection — the way Link faces, i.e. back toward the
    // shooter. The bounce travels that way; the opposite would send it back
    // into Link (the shot's original incoming heading).
    const delta = directionDelta(this._direction);

    for (let i = 0; i < speed; i++) {
      this._x += delta.dx;
      this._y += delta.dy;
    }

    if (this.deflectTimer >= 16) {
      this._state = ProjectileState.Dead;
    }
  }

  private computePixels(): number {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this.subPixel += ENEMY_PROJECTILE_QFRAC;
      if (this.subPixel >= 256) {
        this.subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }
}

function directionDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.Up:
      return { dx: 0, dy: -1 };
    case Direction.Down:
      return { dx: 0, dy: 1 };
    case Direction.Left:
      return { dx: -1, dy: 0 };
    case Direction.Right:
      return { dx: 1, dy: 0 };
  }
}
