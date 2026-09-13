import {
  LINK_SHEET_COLUMNS,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  SWORD_BEAM_QFRAC,
  SWORD_BEAM_START_ROW
} from '../../core/constants.js';
import { Direction } from '../../core/types.js';

import { directionToSpriteCol } from '../../render/sprite-renderer.js';

export class SwordBeam {
   _x;
   _y;
    _direction;
   _active = true;
   subPixel = 0;
   animFrame = 0;

  constructor(x, y, direction) {
    this._x = x;
    this._y = y;
    this._direction = direction;
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  get direction() {
    return this._direction;
  }

  isActive() {
    return this._active;
  }

  deactivate() {
    this._active = false;
  }

  update(collision, screen) {
    if (!this._active) return;

    this.animFrame = (this.animFrame + 1) % 4;

    const pixels = this.computePixels();
    const delta = directionDelta(this._direction);

    for (let i = 0; i < pixels; i++) {
      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      if (nx < 0 || nx >= SCREEN_WIDTH || ny < 0 || ny >= PLAY_AREA_HEIGHT) {
        this._active = false;
        return;
      }

      if (!collision.isPositionWalkable(screen, nx + 4, ny + 4)) {
        this._active = false;
        return;
      }

      this._x = nx;
      this._y = ny;
    }
  }

  getHitbox() {
    return { x: this._x, y: this._y, width: 8, height: 8 };
  }

  render(renderer, spriteSheet) {
    if (!this._active) return;

    const col = directionToSpriteCol(this._direction);
    const row = SWORD_BEAM_START_ROW + this.animFrame;
    const frameIndex = row * LINK_SHEET_COLUMNS + col;
    spriteSheet.drawFrame(renderer, frameIndex, this._x, this._y);
  }

   computePixels() {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this.subPixel += SWORD_BEAM_QFRAC;
      if (this.subPixel >= 256) {
        this.subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }
}

function directionDelta(dir) {
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
