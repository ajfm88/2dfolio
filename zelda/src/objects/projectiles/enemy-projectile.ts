import {
  ENEMY_PROJECTILE_QFRAC,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../../core/constants.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { type ProjectileType } from '../player/shield.js';

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

  constructor(x: number, y: number, direction: Direction, type: ProjectileType) {
    this._x = x;
    this._y = y;
    this._direction = direction;
    this._type = type;
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

    renderer.fillRect(this._x, this._y, 8, 8, '#c44');
  }

  private updateDeflected(): void {
    this.deflectTimer++;

    const speed = this.deflectTimer < 8 ? 3 : 1;
    const delta = directionDelta(getOppositeDirection(this._direction));

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
