// Inventory subscreen slide transition (Z_01.asm MenuState 7/9: 3px/frame scroll)
import { PLAY_AREA_HEIGHT } from '../core/constants.js';

const SLIDE_SPEED = 3;

export enum SlidePhase {
  Idle,
  SlideDown,
  Active,
  SlideUp,
}

export class InventorySlide {
  private _phase = SlidePhase.Idle;
  private _offset = 0;

  get phase(): SlidePhase { return this._phase; }
  get offset(): number { return this._offset; }
  get isActive(): boolean { return this._phase === SlidePhase.Active; }
  get isVisible(): boolean { return this._phase !== SlidePhase.Idle; }

  open(): void {
    if (this._phase !== SlidePhase.Idle) return;
    this._phase = SlidePhase.SlideDown;
    this._offset = 0;
  }

  close(): void {
    if (this._phase !== SlidePhase.Active) return;
    this._phase = SlidePhase.SlideUp;
  }

  update(): void {
    if (this._phase === SlidePhase.SlideDown) {
      this._offset = Math.min(this._offset + SLIDE_SPEED, PLAY_AREA_HEIGHT);
      if (this._offset >= PLAY_AREA_HEIGHT) {
        this._phase = SlidePhase.Active;
      }
    } else if (this._phase === SlidePhase.SlideUp) {
      this._offset = Math.max(this._offset - SLIDE_SPEED, 0);
      if (this._offset <= 0) {
        this._phase = SlidePhase.Idle;
      }
    }
  }
}
