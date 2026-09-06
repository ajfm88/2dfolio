// Magic Shot — Z_07.asm:4546 (shot creation), Z_07.asm:3456 UpdateSwordShotOrMagicShot
// Straight-line projectile fired by the Magic Rod. QSpeed $A0 = 2.5 px/frame.
// When blocked by a wall, if the player has the Book of Magic, fire spawns at impact.

import {
  MAGIC_SHOT_QFRAC,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import {
  drawProjectileSprite,
  directionToProjectileRow,
  PROJ_COL_MAGIC,
} from '../../render/projectile-sprite-data.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { Renderer } from '../../render/renderer.js';
import type { TileCollisionMap } from '../../world/collision.js';

export { MAGIC_SHOT_DAMAGE } from '../../core/constants.js';

export enum MagicShotState {
  Flying = 0x80,
  Dead   = 0x00,
}

// Z_07.asm:4546 — horizontal edge boundaries
const EDGE_MIN_X = 0x14; // 20
const EDGE_MAX_X = 0xEC; // 236

export class MagicShot {
  private _x: number;
  private _y: number;
  private readonly _direction: Direction;
  private _state = MagicShotState.Flying;
  private _subPixel = 0;
  private _frameCount = 0;
  private _wasBlocked = false;

  constructor(x: number, y: number, direction: Direction) {
    this._x = x;
    this._y = y;
    this._direction = direction;

    // Z_07.asm:4546 — if horizontal and too close to screen edge, immediately dead
    if (direction === Direction.Left || direction === Direction.Right) {
      if (x < EDGE_MIN_X || x >= EDGE_MAX_X) {
        this._state = MagicShotState.Dead;
      }
    }
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get direction(): Direction { return this._direction; }
  get state(): MagicShotState { return this._state; }
  get isActive(): boolean { return this._state !== MagicShotState.Dead; }
  get wasBlocked(): boolean { return this._wasBlocked; }

  getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 8, height: 8 };
  }

  // G1 calls this on enemy hit — not a wall block, so no book fire
  deactivate(): void {
    if (this._state === MagicShotState.Dead) return;
    this._state = MagicShotState.Dead;
  }

  update(collision: TileCollisionMap, screen: OverworldScreen): void {
    if (this._state === MagicShotState.Dead) return;

    this._frameCount++;

    const pixels = this.computePixels();
    const delta = directionDelta(this._direction);

    for (let i = 0; i < pixels; i++) {
      const nx = this._x + delta.dx;
      const ny = this._y + delta.dy;

      // Screen boundary check
      if (nx < 0 || nx >= SCREEN_WIDTH || ny < 0 || ny >= PLAY_AREA_HEIGHT) {
        this._wasBlocked = true;
        this._state = MagicShotState.Dead;
        return;
      }

      // Tile collision check
      if (!collision.isPositionWalkable(screen, nx + 4, ny + 4)) {
        this._wasBlocked = true;
        this._state = MagicShotState.Dead;
        return;
      }

      this._x = nx;
      this._y = ny;
    }
  }

  render(renderer: Renderer): void {
    if (this._state === MagicShotState.Dead) return;
    // Column 4 carries the magic shot itself, one cell per direction — no
    // frame toggle, which is also what stops the shot strobing between two
    // sword-beam frames as it flies.
    drawProjectileSprite(
      renderer, PROJ_COL_MAGIC, directionToProjectileRow(this._direction),
      this._x, this._y,
    );
  }

  private computePixels(): number {
    let pixels = 0;
    for (let i = 0; i < 4; i++) {
      this._subPixel += MAGIC_SHOT_QFRAC;
      if (this._subPixel >= 256) {
        this._subPixel -= 256;
        pixels++;
      }
    }
    return pixels;
  }
}

function directionDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.Up: return { dx: 0, dy: -1 };
    case Direction.Down: return { dx: 0, dy: 1 };
    case Direction.Left: return { dx: -1, dy: 0 };
    case Direction.Right: return { dx: 1, dy: 0 };
  }
}
