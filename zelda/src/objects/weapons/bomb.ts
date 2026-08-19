// Bomb stub for E3 — Z_07.asm:4792 UpdateBomb
// Minimal implementation: placement + 4-phase timer for secret triggering.
// Full bomb implementation (inventory, count, damage, sprites) deferred to F2.

import { TILE_SIZE } from '../../core/constants.js';
import type { Rect } from '../../core/types.js';

// BombTimes from Z_07.asm:4783: $30, $18, $0C, $06
const BOMB_TIMES: readonly number[] = [0x30, 0x18, 0x0C, 0x06];

export enum BombState {
  Idle = 0x11,
  Fuse = 0x12,
  Detonating = 0x13,
  Exploding = 0x14,
  Dead = 0x15,
}

export class Bomb {
  private _x: number;
  private _y: number;
  private _state = BombState.Idle;
  private _timer = BOMB_TIMES[0]!;

  constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get state(): BombState { return this._state; }
  get isActive(): boolean { return this._state !== BombState.Dead; }
  get isDetonating(): boolean { return this._state === BombState.Detonating; }

  update(): void {
    if (this._state === BombState.Dead) return;

    this._timer--;
    if (this._timer <= 0) {
      this.advanceState();
    }
  }

  private advanceState(): void {
    switch (this._state) {
      case BombState.Idle:
        this._state = BombState.Fuse;
        this._timer = BOMB_TIMES[1]!;
        break;
      case BombState.Fuse:
        this._state = BombState.Detonating;
        this._timer = BOMB_TIMES[2]!;
        break;
      case BombState.Detonating:
        this._state = BombState.Exploding;
        this._timer = BOMB_TIMES[3]!;
        break;
      case BombState.Exploding:
        this._state = BombState.Dead;
        this._timer = 0;
        break;
    }
  }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: TILE_SIZE, height: TILE_SIZE };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._state === BombState.Dead) return;

    if (this._state === BombState.Exploding || this._state === BombState.Detonating) {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(this._x - 8, this._y - 8, TILE_SIZE + 16, TILE_SIZE + 16);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(this._x - 4, this._y - 4, TILE_SIZE + 8, TILE_SIZE + 8);
    } else {
      ctx.fillStyle = '#333333';
      ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
      if (this._state === BombState.Fuse && (this._timer & 0x04)) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this._x + 6, this._y, 4, 4);
      }
    }
  }
}
