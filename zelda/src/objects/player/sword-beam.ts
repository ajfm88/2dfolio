import {
  LINK_SHEET_COLUMNS,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  SWORD_BEAM_QFRAC,
  SWORD_BEAM_START_ROW,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { Renderer } from '../../render/renderer.js';
import { type SpriteSheet, directionToSpriteCol } from '../../render/sprite-renderer.js';
import type { TileCollisionMap } from '../../world/collision.js';

export class SwordBeam {
  private _x: number;
  private _y: number;
  private readonly _direction: Direction;
  private _active = true;
  private subPixel = 0;
  private animFrame = 0;

  constructor(x: number, y: number, direction: Direction) {
    this._x = x;
    this._y = y;
    this._direction = direction;
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

  isActive(): boolean {
    return this._active;
  }

  update(collision: TileCollisionMap, screen: OverworldScreen): void {
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

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 8, height: 8 };
  }

  render(renderer: Renderer, spriteSheet: SpriteSheet): void {
    if (!this._active) return;

    const col = directionToSpriteCol(this._direction);
    const row = SWORD_BEAM_START_ROW + this.animFrame;
    const frameIndex = row * LINK_SHEET_COLUMNS + col;
    spriteSheet.drawFrame(renderer, frameIndex, this._x, this._y);
  }

  private computePixels(): number {
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
