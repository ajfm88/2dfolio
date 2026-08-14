import {
  LINK_SHEET_COLUMNS,
  SWORD_EXTENDED_FRAMES,
  SWORD_SPRITE_ROW,
  SWORD_WINDUP_FRAMES,
} from '../../core/constants.js';
import { Direction, type Rect } from '../../core/types.js';
import type { Renderer } from '../../render/renderer.js';
import { type SpriteSheet, directionToSpriteCol } from '../../render/sprite-renderer.js';

export enum SwordState {
  Inactive,
  Windup,
  Extended,
  Retracting,
}

export interface SwordUpdateResult {
  readonly done: boolean;
  readonly shouldFireBeam: boolean;
}

// Z_07.asm:4370 PlayerToWeaponOffsetsX/Y — per-state, per-direction (Up, Down, Left, Right)
// State 2 (Extended) offsets
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

// State 3 (first retract frame)
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

// State 4 (second retract frame)
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

export class SwordSwing {
  private _state = SwordState.Inactive;
  private timer = 0;
  private retractStep = 0;
  private _direction = Direction.Down;

  get state(): SwordState {
    return this._state;
  }

  get direction(): Direction {
    return this._direction;
  }

  isActive(): boolean {
    return this._state !== SwordState.Inactive;
  }

  start(direction: Direction): void {
    this._state = SwordState.Windup;
    this._direction = direction;
    this.timer = SWORD_WINDUP_FRAMES;
    this.retractStep = 0;
  }

  update(): SwordUpdateResult {
    if (this._state === SwordState.Inactive) {
      return { done: false, shouldFireBeam: false };
    }

    this.timer--;
    if (this.timer > 0) {
      return { done: false, shouldFireBeam: false };
    }

    switch (this._state) {
      case SwordState.Windup:
        this._state = SwordState.Extended;
        this.timer = SWORD_EXTENDED_FRAMES;
        return { done: false, shouldFireBeam: false };

      case SwordState.Extended:
        this._state = SwordState.Retracting;
        this.retractStep = 0;
        this.timer = 1;
        return { done: false, shouldFireBeam: true };

      case SwordState.Retracting:
        this.retractStep++;
        if (this.retractStep >= 3) {
          this._state = SwordState.Inactive;
          return { done: true, shouldFireBeam: false };
        }
        this.timer = 1;
        return { done: false, shouldFireBeam: false };

      default:
        return { done: false, shouldFireBeam: false };
    }
  }

  getHitbox(linkX: number, linkY: number): Rect | null {
    if (this._state !== SwordState.Extended) return null;

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

  getSwordPosition(linkX: number, linkY: number): { x: number; y: number } | null {
    if (this._state === SwordState.Inactive || this._state === SwordState.Windup) {
      return null;
    }

    let offX: Record<Direction, number>;
    let offY: Record<Direction, number>;

    if (this._state === SwordState.Extended) {
      offX = EXTENDED_OFFSET_X;
      offY = EXTENDED_OFFSET_Y;
    } else if (this.retractStep === 0) {
      offX = RETRACT1_OFFSET_X;
      offY = RETRACT1_OFFSET_Y;
    } else {
      offX = RETRACT2_OFFSET_X;
      offY = RETRACT2_OFFSET_Y;
    }

    return {
      x: linkX + offX[this._direction],
      y: linkY + offY[this._direction],
    };
  }

  render(renderer: Renderer, spriteSheet: SpriteSheet, linkX: number, linkY: number): void {
    const pos = this.getSwordPosition(linkX, linkY);
    if (!pos) return;

    // State 5 (retractStep 2) — no draw
    if (this._state === SwordState.Retracting && this.retractStep >= 2) return;

    const col = directionToSpriteCol(this._direction);
    const frameIndex = SWORD_SPRITE_ROW * LINK_SHEET_COLUMNS + col;
    spriteSheet.drawFrame(renderer, frameIndex, pos.x, pos.y);
  }
}
