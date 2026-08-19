// Candle fire stub for E3 — Z_07.asm:4658 UpdateFire
// Minimal implementation: walks 16px in direction, then stands for 63 frames.
// Full candle implementation (blue/red distinction, inventory) deferred to F3.

import { TILE_SIZE } from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';

const FIRE_WALK_DISTANCE = 0x10; // 16px
const FIRE_STAND_TIMER = 0x3F; // 63 frames

export enum FireState {
  Walking = 0x21,
  Standing = 0x22,
  Dead = 0x00,
}

export class CandleFire {
  private _x: number;
  private _y: number;
  private _direction: Direction;
  private _state = FireState.Walking;
  private _distanceMoved = 0;
  private _timer = FIRE_STAND_TIMER;

  constructor(x: number, y: number, direction: Direction) {
    this._x = x;
    this._y = y;
    this._direction = direction;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get state(): FireState { return this._state; }
  get isActive(): boolean { return this._state !== FireState.Dead; }
  get isStanding(): boolean { return this._state === FireState.Standing; }

  update(): void {
    if (this._state === FireState.Dead) return;

    if (this._state === FireState.Walking) {
      switch (this._direction) {
        case Direction.Up: this._y--; break;
        case Direction.Down: this._y++; break;
        case Direction.Left: this._x--; break;
        case Direction.Right: this._x++; break;
      }
      this._distanceMoved++;
      if (this._distanceMoved >= FIRE_WALK_DISTANCE) {
        this._state = FireState.Standing;
        this._timer = FIRE_STAND_TIMER;
      }
      return;
    }

    // Standing
    this._timer--;
    if (this._timer <= 0) {
      this._state = FireState.Dead;
    }
  }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: TILE_SIZE, height: TILE_SIZE };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._state === FireState.Dead) return;

    // Flickering fire effect
    const flicker = (this._timer & 0x02) ? 0 : 2;
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(this._x + 2 + flicker, this._y + 2, 12 - flicker, 12);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
    ctx.fillStyle = '#ffff44';
    ctx.fillRect(this._x + 6, this._y + 6, 4, 4);
  }
}
