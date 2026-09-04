// Lanmola — Z_04.asm:9481 InitLamnola / :9671 UpdateLamnola
//
// A fast segmented worm. The head leads; at each 8px grid boundary it re-chooses a
// direction (biased toward Link, avoiding walls) and the body trails along the path
// it carved. Red ($3A) moves 1px/frame, blue ($3B) 2px/frame.
//
// Simplification vs. NES: modelled as ONE object owning its segment trail. Only the
// HEAD is vulnerable/collidable (getHitbox returns the head) — the same player
// experience as the NES "kill the head" rule, without the body-resurrection dance.

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawDungeonEnemySpriteScaled, LANMOLA_SPRITES } from '../../render/enemy-sprite-data.js';
import { Enemy, type EnemyUpdateContext } from './enemy.js';

export const LANMOLA_RED = 0x3a;
export const LANMOLA_BLUE = 0x3b;

const SEGMENTS = 6; // head + 5 body
const SPACING = 8; // px of trail between segment centers

function dirDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.Up: return { dx: 0, dy: -1 };
    case Direction.Down: return { dx: 0, dy: 1 };
    case Direction.Left: return { dx: -1, dy: 0 };
    case Direction.Right: return { dx: 1, dy: 0 };
  }
}

export class Lanmola extends Enemy {
  private readonly _speed: number;
  // Trail of past head positions; _trail[0] is the most recent.
  private readonly _trail: { x: number; y: number }[] = [];

  constructor(x: number, y: number, objectType: number, hp: number, spawnCloudFrames: number) {
    super(x, y, objectType, hp, spawnCloudFrames);
    this._speed = objectType - 0x39; // $3A->1, $3B->2
    this._direction = Direction.Down;
    for (let i = 0; i < SEGMENTS * SPACING; i++) {
      this._trail.push({ x, y });
    }
  }

  // Head-only vulnerability & contact.
  override getHitbox(): Rect {
    return { x: this._x, y: this._y, width: 16, height: 16 };
  }

  protected override updateAI(ctx: EnemyUpdateContext): void {
    for (let s = 0; s < this._speed; s++) {
      this.moveHeadOnePixel(ctx);
      this._trail.unshift({ x: this._x, y: this._y });
      if (this._trail.length > SEGMENTS * SPACING) this._trail.pop();
    }
    this.tickWalkAnimation(4);
  }

  private moveHeadOnePixel(ctx: EnemyUpdateContext): void {
    // At an 8px grid boundary, re-choose a direction biased toward Link.
    if ((this._x & 7) === 0 && (this._y & 7) === 0) {
      this._direction = this.chooseDirection(ctx);
    }
    const { dx, dy } = dirDelta(this._direction);
    let nx = this._x + dx;
    let ny = this._y + dy;
    if (!this.canOccupy(nx, ny, ctx)) {
      // Blocked mid-step — pick any viable direction and retry once.
      this._direction = this.chooseDirection(ctx);
      const d2 = dirDelta(this._direction);
      nx = this._x + d2.dx;
      ny = this._y + d2.dy;
      if (!this.canOccupy(nx, ny, ctx)) return;
    }
    this._x = nx;
    this._y = ny;
  }

  private chooseDirection(ctx: EnemyUpdateContext): Direction {
    const toward = this.directionTowardLink(ctx.linkX, ctx.linkY);
    const back = getOppositeDirection(this._direction);
    const order: Direction[] = [
      toward,
      this._direction,
      Direction.Up, Direction.Down, Direction.Left, Direction.Right,
    ];
    // Prefer a walkable direction that is not an immediate reversal.
    for (const dir of order) {
      if (dir === back) continue;
      const { dx, dy } = dirDelta(dir);
      if (this.canOccupy(this._x + dx * 8, this._y + dy * 8, ctx)) return dir;
    }
    // Everything blocked but backward — reverse.
    return back;
  }

  private canOccupy(nx: number, ny: number, ctx: EnemyUpdateContext): boolean {
    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT) return false;
    if (ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) return false;
    return ctx.collision.isRectWalkable(ctx.screen, nx, ny, 16, 16);
  }

  protected override renderEnemy(renderer: Renderer, _sheet?: SpriteSheet): void {
    const bodyFrame = LANMOLA_SPRITES.body[this._walkAnimFrame] ?? LANMOLA_SPRITES.body[0]!;
    for (let i = SEGMENTS - 1; i >= 1; i--) {
      const p = this._trail[i * SPACING] ?? this._trail[this._trail.length - 1]!;
      drawDungeonEnemySpriteScaled(renderer, bodyFrame, p.x + 4, p.y + 2, 8, 12);
    }
    const headFrame = LANMOLA_SPRITES.head[this._walkAnimFrame] ?? LANMOLA_SPRITES.head[0]!;
    drawDungeonEnemySpriteScaled(renderer, headFrame, this._x + 2, this._y, 12, 16);
  }
}
