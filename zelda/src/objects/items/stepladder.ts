// Stepladder — Z_07.asm:3225 ladder spawn, Z_05.asm:3217 CheckLadder
// Auto-activates when Link walks into water while holding the ladder item.
// Creates a bridge sprite at the water tile and overrides collision.

import {
  LADDER_DISTANCE_THRESHOLD,
  TILE_SIZE,
} from '../../core/constants.js';
import { getOppositeDirection } from '../../core/collision-utils.js';
import { Direction } from '../../core/types.js';
import type { OverworldScreen } from '../../data/overworld-types.js';
import type { Renderer } from '../../render/renderer.js';
import type { TileCollisionMap } from '../../world/collision.js';

export enum LadderState {
  Done       = 0,
  Approaching = 1,
  OnLadder   = 2,
}

// Z_07.asm:3163 LinkToLadderOffsetsX/Y — indexed by opposite direction
// Link facing Right → opposite Left(2) → offsets[2]: X=+16, Y=+3
// Link facing Left → opposite Right(3) → offsets[3]: X=-16, Y=+3
// Link facing Down → opposite Up(0) → offsets[0]: X=0, Y=+19
// Link facing Up → opposite Down(1) → offsets[1]: X=0, Y=-5
const OFFSET_X: Record<Direction, number> = {
  [Direction.Up]: 0,
  [Direction.Down]: 0,
  [Direction.Left]: -16,
  [Direction.Right]: 16,
};
const OFFSET_Y: Record<Direction, number> = {
  [Direction.Up]: -5,
  [Direction.Down]: 19,
  [Direction.Left]: 3,
  [Direction.Right]: 3,
};

export class Stepladder {
  private _x: number;
  private _y: number;
  private readonly _direction: Direction;
  private _state = LadderState.Approaching;

  constructor(linkX: number, linkY: number, direction: Direction) {
    this._direction = direction;
    this._x = linkX + OFFSET_X[direction];
    this._y = linkY + OFFSET_Y[direction];
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get direction(): Direction { return this._direction; }
  get state(): LadderState { return this._state; }
  get isActive(): boolean { return this._state !== LadderState.Done; }

  get tileRow(): number { return Math.floor(this._y / TILE_SIZE); }
  get tileCol(): number { return Math.floor(this._x / TILE_SIZE); }

  update(linkX: number, linkY: number): void {
    if (this._state === LadderState.Done) return;

    const distance = this.computeDistance(linkX, linkY);

    if (distance > LADDER_DISTANCE_THRESHOLD) {
      this._state = LadderState.Done;
      return;
    }

    if (distance < LADDER_DISTANCE_THRESHOLD) {
      this._state = LadderState.OnLadder;
      return;
    }

    // distance === LADDER_DISTANCE_THRESHOLD
    if (this._state === LadderState.OnLadder) {
      this._state = LadderState.Done;
    }
  }

  // Z_05.asm:3297 — determines if Link's movement direction is allowed
  shouldAllowMovement(
    inputDir: Direction,
    linkX: number,
    linkY: number,
    collision: TileCollisionMap,
    screen: OverworldScreen,
  ): boolean {
    if (this._state === LadderState.Done) return true;

    const distance = this.computeDistance(linkX, linkY);

    // If distance != 0 and Link faces ladder direction: allow
    if (distance !== 0 && inputDir === this._direction) return true;

    // If distance == 0 and moving in ladder direction: allow
    if (distance === 0 && inputDir === this._direction) return true;

    // Retreat: opposite of ladder direction is always allowed
    if (inputDir === getOppositeDirection(this._direction)) return true;

    // Special: ladder Up + input Up — check tile 8px above for walkability
    if (this._direction === Direction.Up && inputDir === Direction.Up) {
      return collision.isPositionWalkable(screen, linkX + 4, linkY - 8 + 4);
    }

    return false;
  }

  render(renderer: Renderer): void {
    if (this._state === LadderState.Done) return;

    const ctx = renderer.ctx;
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(this._x, this._y, TILE_SIZE, TILE_SIZE);
    // Cross-plank pattern
    ctx.fillStyle = '#6b4f10';
    ctx.fillRect(this._x + 2, this._y + 3, TILE_SIZE - 4, 2);
    ctx.fillRect(this._x + 2, this._y + 8, TILE_SIZE - 4, 2);
    ctx.fillRect(this._x + 2, this._y + 13, TILE_SIZE - 4, 2);
  }

  private computeDistance(linkX: number, linkY: number): number {
    // Z_05.asm:3231 — vertical ladder checks X match, measures Y distance
    // Y uses linkY + 3 offset for Link's vertical center
    if (this._direction === Direction.Up || this._direction === Direction.Down) {
      return Math.abs((linkY + 3) - this._y);
    }
    return Math.abs(linkX - this._x);
  }
}
