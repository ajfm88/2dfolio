// Pols Voice — Z_04.asm:6533 UpdatePolsVoice
// Big-eared hopper: drifts and jumps around, bouncing off walls. In the NES it is
// resistant to the sword (very high HP) and weak to arrows/flute — we keep the high
// HP; the flute-kill is deferred. Type $16, ~10 sword hits.

import { Direction } from '../../core/types.js';
import { drawDungeonEnemySprite, POLS_VOICE_SPRITES } from '../../render/enemy-sprite-data.js';
import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_EDGE_LEFT,
  SCREEN_EDGE_RIGHT,
  SCREEN_EDGE_TOP
} from '../../core/constants.js';

import { getOppositeDirection } from '../../core/collision-utils.js';
import { Enemy, randomDirection } from './enemy.js';

const QSPEED = 0x20;
const BOB_PERIOD = 16;

export class PolsVoice extends Enemy {
    _sub = { value: 0 };
   _hopTimer = 40;
   _bob = 0;

    updateAI(ctx) {
    const moved = this.moveQSpeed(QSPEED, this._sub, ctx.collision, ctx.screen);
    // moveQSpeed also returns false on frames where the sub-pixel accumulator
    // didn't emit a full pixel yet — only bounce when a wall is actually ahead.
    if (!moved && this.isBlockedAhead(ctx)) {
      this._direction = getOppositeDirection(this._direction);
    }

    if (--this._hopTimer <= 0) {
      this._direction = Math.random() < 0.5
        ? this.directionTowardLink(ctx.linkX, ctx.linkY)
        : randomDirection();
      this._hopTimer = 50 + Math.floor(Math.random() * 60);
    }

    this._bob = (this._bob + 1) % BOB_PERIOD;
    this.tickWalkAnimation(6);
  }

   isBlockedAhead(ctx) {
    const dx = this._direction === Direction.Left ? -1 : this._direction === Direction.Right ? 1 : 0;
    const dy = this._direction === Direction.Up ? -1 : this._direction === Direction.Down ? 1 : 0;
    const nx = this._x + dx;
    const ny = this._y + dy;
    if (nx < SCREEN_EDGE_LEFT || nx > SCREEN_EDGE_RIGHT ||
        ny < SCREEN_EDGE_TOP || ny > SCREEN_EDGE_BOTTOM) {
      return true;
    }
    return !ctx.collision.isRectWalkable(ctx.screen, nx, ny, 16, 16);
  }

   getHitbox() {
    return { x: this._x + 1, y: this._y + 1, width: 14, height: 14 };
  }

    renderEnemy(renderer) {
    const lift = this._bob < BOB_PERIOD / 2 ? this._bob >> 1 : (BOB_PERIOD - this._bob) >> 1;
    const y = this._y - lift;
    const frame = POLS_VOICE_SPRITES[this._walkAnimFrame] ?? POLS_VOICE_SPRITES[0];
    if (frame) {
      drawDungeonEnemySprite(renderer, frame, this._x, y);
    }
  }
}
