// Candle fire — Z_01.asm:3991 WieldCandle, Z_07.asm:4658 UpdateFire
// Walks 16px at 0.5px/frame (QSpeed $20), then stands for 63 frames.
// Fire damages enemies (G1 wires collision) and can also damage Link (G1).

import { TILE_SIZE, FIRE_QFRAC, BOOK_FIRE_TIMER } from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';

export { FIRE_DAMAGE } from '../../core/constants.js';

const FIRE_WALK_DISTANCE = 0x10; // 16px
const FIRE_STAND_TIMER = 0x3F; // 63 frames

// Fire sprite indices in projectiles.png (verify at implementation time)
const FIRE_SPRITE_FRAME_A = 6;
const FIRE_SPRITE_FRAME_B = 7;
const FIRE_FLICKER_INTERVAL = 5;

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
  private _subPixel = 0;
  private _frameCount = 0;

  // Z_07.asm:3547 HandleShotBlocked — Book of Magic spawns fire at shot impact
  static createBookFire(x: number, y: number): CandleFire {
    const fire = new CandleFire(x, y, Direction.Down);
    fire._state = FireState.Standing;
    fire._timer = BOOK_FIRE_TIMER;
    return fire;
  }

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

    this._frameCount++;

    if (this._state === FireState.Walking) {
      // Z_07.asm:4658 — QSpeed $20 = 0.5px/frame
      const pixels = this.computePixels();
      for (let i = 0; i < pixels; i++) {
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
          return;
        }
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

  render(renderer: Renderer, spriteSheet?: SpriteSheet): void {
    if (this._state === FireState.Dead) return;

    if (spriteSheet) {
      const frame = Math.floor(this._frameCount / FIRE_FLICKER_INTERVAL) % 2 === 0
        ? FIRE_SPRITE_FRAME_A
        : FIRE_SPRITE_FRAME_B;
      spriteSheet.drawFrame(renderer, frame, this._x, this._y);
    } else {
      // Placeholder fallback
      const ctx = renderer.ctx;
      const flicker = (this._frameCount & 0x02) ? 0 : 2;
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(this._x + 2 + flicker, this._y + 2, 12 - flicker, 12);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(this._x + 4, this._y + 4, 8, 8);
      ctx.fillStyle = '#ffff44';
      ctx.fillRect(this._x + 6, this._y + 6, 4, 4);
    }
  }

  // QSpeed sub-pixel accumulator — Z_07.asm:4658 uses $20 = 0.5px/frame
  private computePixels(): number {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this._subPixel += FIRE_QFRAC;
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }
}
