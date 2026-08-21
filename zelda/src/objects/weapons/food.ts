// Food/Bait — Z_05.asm:3003 WieldFood, Z_07.asm:3763 UpdateBoomerangOrFood (food branch)
// Stationary bait that attracts enemies. 3 phases × 255 frames = 765 frames total.
// Does NOT collide with or damage enemies (Z_01.asm:5835 returns immediately for food).
// Enemy attraction (overrides chase target) is wired in G1.
// Food is NOT consumed on placement — only removed by Grumble Goriya (H-phase).

import { FOOD_PHASE_TIMER } from '../../core/constants.js';
import { drawItemSprite } from '../../data/item-sprites.js';

export enum FoodState {
  Phase1 = 0x80,
  Phase2 = 0x81,
  Phase3 = 0x82,
  Dead   = 0x00,
}

const BAIT_ITEM_ID = 0x04;

export class Food {
  private _x: number;
  private _y: number;
  private _state = FoodState.Phase1;
  private _timer = FOOD_PHASE_TIMER;

  constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get state(): FoodState { return this._state; }
  get isActive(): boolean { return this._state !== FoodState.Dead; }

  getPosition(): { x: number; y: number } {
    return { x: this._x, y: this._y };
  }

  update(): void {
    if (this._state === FoodState.Dead) return;

    this._timer--;
    if (this._timer <= 0) {
      this.advancePhase();
    }
  }

  private advancePhase(): void {
    switch (this._state) {
      case FoodState.Phase1:
        this._state = FoodState.Phase2;
        this._timer = FOOD_PHASE_TIMER;
        break;
      case FoodState.Phase2:
        this._state = FoodState.Phase3;
        this._timer = FOOD_PHASE_TIMER;
        break;
      case FoodState.Phase3:
        this._state = FoodState.Dead;
        this._timer = 0;
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D, itemsImage: HTMLCanvasElement | null): void {
    if (this._state === FoodState.Dead) return;

    if (itemsImage) {
      drawItemSprite(ctx, itemsImage, BAIT_ITEM_ID, this._x, this._y);
    } else {
      // Placeholder: red rectangle for bait
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(this._x + 2, this._y + 2, 12, 12);
    }
  }
}
