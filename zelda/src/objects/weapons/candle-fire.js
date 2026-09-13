// Candle fire — Z_01.asm:3991 WieldCandle, Z_07.asm:4658 UpdateFire
// Walks 16px at 0.5px/frame (QSpeed $20), then stands for 63 frames.
// Fire damages enemies (G1 wires collision) and can also damage Link (G1).

import { TILE_SIZE, FIRE_QFRAC, BOOK_FIRE_TIMER } from '../../core/constants.js';
import { Direction } from '../../core/types.js';

import {
  drawFireSprite,
  hasNpcSprites
} from '../../render/boss-sprite-data.js';

export { FIRE_DAMAGE } from '../../core/constants.js';

const FIRE_WALK_DISTANCE = 0x10; // 16px
const FIRE_STAND_TIMER = 0x3F; // 63 frames

// Fire sprite indices in projectiles.png (verify at implementation time)
// The flame is not on projectiles.png (its columns are arrow / sword beam /
// boomerang / fireball / bomb). npcs.png carries the fire art, already used for
// the cave and boss-room flames — see FIRE_SPRITES in boss-sprite-data.ts.
const FIRE_FLICKER_INTERVAL = 5;

export const FireState = Object.freeze({
  Walking: 0x21,
  Standing: 0x22,
  Dead: 0x00
});

export class CandleFire {
   _x;
   _y;
   _direction;
   _state = FireState.Walking;
   _distanceMoved = 0;
   _timer = FIRE_STAND_TIMER;
   _subPixel = 0;
   _frameCount = 0;

  // Z_07.asm:3547 HandleShotBlocked — Book of Magic spawns fire at shot impact
  static createBookFire(x, y) {
    const fire = new CandleFire(x, y, Direction.Down);
    fire._state = FireState.Standing;
    fire._timer = BOOK_FIRE_TIMER;
    return fire;
  }

  constructor(x, y, direction) {
    this._x = x;
    this._y = y;
    this._direction = direction;
  }

  get x() { return this._x; }
  get y() { return this._y; }
  get state() { return this._state; }
  get isActive() { return this._state !== FireState.Dead; }
  get isStanding() { return this._state === FireState.Standing; }
  get direction() { return this._direction; }

  update() {
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

  getHitbox() {
    return { x: this._x, y: this._y, width: TILE_SIZE, height: TILE_SIZE };
  }

  render(renderer) {
    if (this._state === FireState.Dead) return;

    const frameIdx = Math.floor(this._frameCount / FIRE_FLICKER_INTERVAL) % 2;
    if (hasNpcSprites()) {
      drawFireSprite(renderer, frameIdx, this._x, this._y);
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
   computePixels() {
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
