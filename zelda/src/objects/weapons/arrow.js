// Arrow — Z_05.asm:2954 WieldArrow, Z_07.asm:3857 UpdateArrowOrBoomerang (arrow path)
// Straight-line projectile: flies until blocked tile or screen edge, then 3-frame spark.
// Requires bow + 1 rupee per shot. Silver vs wood affects damage and palette only.

import {
  ARROW_QFRAC,
  ARROW_SPARK_FRAMES,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';

import {
  drawProjectileSprite,
  directionToProjectileRow,
  PROJ_COL_ARROW
} from '../../render/projectile-sprite-data.js';

export { ARROW_DAMAGE, SILVER_ARROW_DAMAGE } from '../../core/constants.js';

export const ArrowState = Object.freeze({
  Flying: 0x10,
  Spark: 0x20,
  Dead: 0x00
});

export class Arrow {
   _x;
   _y;
    _direction;
    _isSilver;
   _state = ArrowState.Flying;
   _sparkTimer = ARROW_SPARK_FRAMES;
   _subPixel = 0;

  constructor(x, y, direction, isSilver) {
    this._x = x;
    this._y = y;
    this._direction = direction;
    this._isSilver = isSilver;

    // Z_05.asm:2997 — vertical arrows nudged right by 3px
    if (direction === Direction.Up || direction === Direction.Down) {
      this._x += 3;
    }
  }

  get x() { return this._x; }
  get y() { return this._y; }
  get direction() { return this._direction; }
  get isSilver() { return this._isSilver; }
  get state() { return this._state; }
  get isActive() { return this._state !== ArrowState.Dead; }

  getHitbox() {
    return { x: this._x, y: this._y, width: 8, height: 8 };
  }

  // G1 calls this on enemy hit
  deactivate() {
    if (this._state === ArrowState.Dead) return;
    this._state = ArrowState.Spark;
    this._sparkTimer = ARROW_SPARK_FRAMES;
  }

  update(collision, screen) {
    if (this._state === ArrowState.Dead) return;

    if (this._state === ArrowState.Spark) {
      this._sparkTimer--;
      if (this._sparkTimer <= 0) {
        this._state = ArrowState.Dead;
      }
      return;
    }

    // Flying — move pixel by pixel with QSpeed
    const pixels = this.computePixels();
    const delta = directionDelta(this._direction);

    for (let i = 0; i < pixels; i++) {
      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      if (nx < 0 || nx >= SCREEN_WIDTH || ny < 0 || ny >= PLAY_AREA_HEIGHT) {
        this._state = ArrowState.Spark;
        this._sparkTimer = ARROW_SPARK_FRAMES;
        return;
      }

      if (!collision.isPositionWalkable(screen, nx + 4, ny + 4)) {
        this._state = ArrowState.Spark;
        this._sparkTimer = ARROW_SPARK_FRAMES;
        return;
      }

      this._x = nx;
      this._y = ny;
    }
  }

  render(renderer) {
    if (this._state === ArrowState.Dead) return;

    if (this._state === ArrowState.Spark) {
      // Brief spark — draw a small flash
      const ctx = renderer.ctx;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this._x + 2, this._y + 2, 4, 4);
      return;
    }

    // The sheet has a dedicated cell per direction, so no flipping is needed.
    drawProjectileSprite(
      renderer, PROJ_COL_ARROW, directionToProjectileRow(this._direction),
      this._x, this._y,
    );
  }

   computePixels() {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this._subPixel += ARROW_QFRAC;
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }
}

function directionDelta(dir) {
  switch (dir) {
    case Direction.Up: return { dx: 0, dy: -1 };
    case Direction.Down: return { dx: 0, dy: 1 };
    case Direction.Left: return { dx: -1, dy: 0 };
    case Direction.Right: return { dx: 1, dy: 0 };
  }
}
