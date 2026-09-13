// Push block — Z_04.asm UpdateBlock (lines 629-757)

import {
  PUSH_BLOCK_ALIGN_THRESHOLD,
  PUSH_BLOCK_SLIDE_DISTANCE,
  PUSH_BLOCK_TIMER_THRESHOLD,
  TILE_SIZE
} from '../core/constants.js';
import { Direction } from '../core/types.js';

export const PushBlockState = Object.freeze({
  Idle: 0,
  Moving: 1,
  Done: 2
});

export class PushBlock {
   _x;
   _y;
   _state = PushBlockState.Idle;
   pushTimer = 0;
   moveDirection = Direction.Up;
   moveOffset = 0;
   _pushComplete = false;

  constructor(x, y) {
    this._x = x;
    this._y = y;
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  get state() {
    return this._state;
  }

  get pushComplete() {
    return this._pushComplete;
  }

  update(link, allEnemiesDead) {
    switch (this._state) {
      case PushBlockState.Idle:
        this.updateIdle(link, allEnemiesDead);
        break;
      case PushBlockState.Moving:
        this.updateMoving();
        break;
      case PushBlockState.Done:
        break;
    }
  }

  getHitbox() {
    return { x: this._x, y: this._y, width: TILE_SIZE, height: TILE_SIZE };
  }

  render(renderer) {
    if (this._state === PushBlockState.Done) {
      renderer.fillRect(this._x, this._y, TILE_SIZE, TILE_SIZE, '#906830');
      return;
    }
    renderer.fillRect(this._x, this._y, TILE_SIZE, TILE_SIZE, '#b88050');
    // Highlight border for 3D effect
    renderer.fillRect(this._x, this._y, TILE_SIZE, 1, '#d0a070');
    renderer.fillRect(this._x, this._y, 1, TILE_SIZE, '#d0a070');
    renderer.fillRect(this._x, this._y + TILE_SIZE - 1, TILE_SIZE, 1, '#785028');
    renderer.fillRect(this._x + TILE_SIZE - 1, this._y, 1, TILE_SIZE, '#785028');
  }

   updateIdle(link, allEnemiesDead) {
    if (!allEnemiesDead) {
      this.pushTimer = 0;
      return;
    }

    const pushDir = this.getPushDirection(link);
    if (pushDir === null) {
      this.pushTimer = 0;
      return;
    }

    if (link.facing !== pushDir || !link.isMoving) {
      this.pushTimer = 0;
      return;
    }

    this.pushTimer++;
    if (this.pushTimer >= PUSH_BLOCK_TIMER_THRESHOLD) {
      this.moveDirection = pushDir;
      this._state = PushBlockState.Moving;
      this.moveOffset = 0;
    }
  }

   updateMoving() {
    // 1px/frame slide
    switch (this.moveDirection) {
      case Direction.Up:
        this._y--;
        break;
      case Direction.Down:
        this._y++;
        break;
      case Direction.Left:
        this._x--;
        break;
      case Direction.Right:
        this._x++;
        break;
    }

    this.moveOffset++;
    if (this.moveOffset >= PUSH_BLOCK_SLIDE_DISTANCE) {
      this._state = PushBlockState.Done;
      this._pushComplete = true;
    }
  }

  // Determine which direction Link must face to push — Link pushes block
  // in the direction they're facing (toward the block).
  // Returns null if Link is not aligned or not adjacent.
   getPushDirection(link) {
    const bx = this._x;
    const by = this._y;
    // +3 vertical offset matches NES behavior (Link sprite vs hitbox offset)
    const lx = link.posX;
    const ly = link.posY + 3;

    // X-aligned → vertical push
    if (lx === bx) {
      const dy = by - ly;
      if (dy > 0 && dy < PUSH_BLOCK_ALIGN_THRESHOLD) {
        return Direction.Down; // Link above block, face down to push down
      }
      if (dy < 0 && -dy < PUSH_BLOCK_ALIGN_THRESHOLD) {
        return Direction.Up; // Link below block, face up to push up
      }
    }

    // Y-aligned → horizontal push
    if (ly === by) {
      const dx = bx - lx;
      if (dx > 0 && dx < PUSH_BLOCK_ALIGN_THRESHOLD) {
        return Direction.Right; // Link left of block, face right to push right
      }
      if (dx < 0 && -dx < PUSH_BLOCK_ALIGN_THRESHOLD) {
        return Direction.Left; // Link right of block, face left to push left
      }
    }

    return null;
  }
}
