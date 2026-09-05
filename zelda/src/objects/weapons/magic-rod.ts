// Magic Rod — Z_05.asm:3036 WieldRod, Z_07.asm:4390 UpdateSwordOrRod (rod path)
// Same state machine as sword swing: Windup (5f) → Extended (8f) → FireShot (1f) → Retract (2×1f).
// Fires a magic shot instead of a sword beam at the Extended→FireShot transition.

import {
  ROD_EXTENDED_FRAMES,
  ROD_WINDUP_FRAMES,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import type { SpriteSheet } from '../../render/sprite-renderer.js';
import { drawProjectileFrameFlipped, ROD_VERTICAL, ROD_HORIZONTAL } from '../../render/projectile-sprite-data.js';

export { MAGIC_SHOT_DAMAGE } from '../../core/constants.js';

export enum RodState {
  Inactive = 0x00,
  Windup   = 0x01,
  Extended = 0x02,
  FireShot = 0x03,
  Retract1 = 0x04,
  Retract2 = 0x05,
}

export interface RodUpdateResult {
  readonly done: boolean;
  readonly shouldFireShot: boolean;
}

// Z_07.asm:4370 PlayerToWeaponOffsetsX/Y — same tables as sword
const EXTENDED_OFFSET_X: Record<Direction, number> = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -11,
  [Direction.Right]: 11,
};
const EXTENDED_OFFSET_Y: Record<Direction, number> = {
  [Direction.Up]: -9,
  [Direction.Down]: 13,
  [Direction.Left]: 3,
  [Direction.Right]: 3,
};

const RETRACT1_OFFSET_X: Record<Direction, number> = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -7,
  [Direction.Right]: 7,
};
const RETRACT1_OFFSET_Y: Record<Direction, number> = {
  [Direction.Up]: -3,
  [Direction.Down]: 9,
  [Direction.Left]: 3,
  [Direction.Right]: 3,
};

const RETRACT2_OFFSET_X: Record<Direction, number> = {
  [Direction.Up]: -1,
  [Direction.Down]: 1,
  [Direction.Left]: -3,
  [Direction.Right]: 3,
};
const RETRACT2_OFFSET_Y: Record<Direction, number> = {
  [Direction.Up]: -1,
  [Direction.Down]: 5,
  [Direction.Left]: 3,
  [Direction.Right]: 3,
};

export class MagicRod {
  private _state = RodState.Inactive;
  private timer = 0;
  private _direction = Direction.Down;

  get state(): RodState {
    return this._state;
  }

  get direction(): Direction {
    return this._direction;
  }

  isActive(): boolean {
    return this._state !== RodState.Inactive;
  }

  cancel(): void {
    this._state = RodState.Inactive;
    this.timer = 0;
  }

  start(direction: Direction): void {
    this._state = RodState.Windup;
    this._direction = direction;
    this.timer = ROD_WINDUP_FRAMES;
  }

  update(): RodUpdateResult {
    if (this._state === RodState.Inactive) {
      return { done: false, shouldFireShot: false };
    }

    this.timer--;
    if (this.timer > 0) {
      return { done: false, shouldFireShot: false };
    }

    switch (this._state) {
      case RodState.Windup:
        this._state = RodState.Extended;
        this.timer = ROD_EXTENDED_FRAMES;
        return { done: false, shouldFireShot: false };

      case RodState.Extended:
        this._state = RodState.FireShot;
        this.timer = 1;
        return { done: false, shouldFireShot: true };

      case RodState.FireShot:
        this._state = RodState.Retract1;
        this.timer = 1;
        return { done: false, shouldFireShot: false };

      case RodState.Retract1:
        this._state = RodState.Retract2;
        this.timer = 1;
        return { done: false, shouldFireShot: false };

      case RodState.Retract2:
        this._state = RodState.Inactive;
        return { done: true, shouldFireShot: false };

      default:
        return { done: false, shouldFireShot: false };
    }
  }

  getHitbox(linkX: number, linkY: number): Rect | null {
    if (this._state !== RodState.Extended) return null;

    switch (this._direction) {
      case Direction.Up:
        return { x: linkX - 4, y: linkY - 16, width: 24, height: 32 };
      case Direction.Down:
        return { x: linkX - 4, y: linkY, width: 24, height: 32 };
      case Direction.Left:
        return { x: linkX - 16, y: linkY - 4, width: 32, height: 24 };
      case Direction.Right:
        return { x: linkX, y: linkY - 4, width: 32, height: 24 };
    }
  }

  getRodPosition(linkX: number, linkY: number): { x: number; y: number } | null {
    if (this._state === RodState.Inactive || this._state === RodState.Windup) {
      return null;
    }

    let offX: Record<Direction, number>;
    let offY: Record<Direction, number>;

    switch (this._state) {
      case RodState.Extended:
      case RodState.FireShot:
        offX = EXTENDED_OFFSET_X;
        offY = EXTENDED_OFFSET_Y;
        break;
      case RodState.Retract1:
        offX = RETRACT1_OFFSET_X;
        offY = RETRACT1_OFFSET_Y;
        break;
      default:
        offX = RETRACT2_OFFSET_X;
        offY = RETRACT2_OFFSET_Y;
        break;
    }

    return {
      x: linkX + offX[this._direction],
      y: linkY + offY[this._direction],
    };
  }

  render(renderer: Renderer, _spriteSheet: SpriteSheet, linkX: number, linkY: number): void {
    const pos = this.getRodPosition(linkX, linkY);
    if (!pos) return;

    // Retract2 — invisible (same as sword's last retract frame)
    if (this._state === RodState.Retract2) return;

    const isVertical = this._direction === Direction.Up || this._direction === Direction.Down;
    const spriteIdx = isVertical ? ROD_VERTICAL : ROD_HORIZONTAL;
    const flipH = this._direction === Direction.Right;
    const flipV = this._direction === Direction.Down;
    drawProjectileFrameFlipped(renderer, spriteIdx, pos.x, pos.y, flipH, flipV);
  }
}
