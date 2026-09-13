// Inventory subscreen slide transition (Z_01.asm MenuState 7/9: 3px/frame scroll)
import { PLAY_AREA_HEIGHT } from '../core/constants.js';

const SLIDE_SPEED = 3;

export const SlidePhase = Object.freeze({
  Idle: 0,
  SlideDown: 1,
  Active: 2,
  SlideUp: 3
});

export class InventorySlide {
   _phase = SlidePhase.Idle;
   _offset = 0;

  get phase() { return this._phase; }
  get offset() { return this._offset; }
  get isActive() { return this._phase === SlidePhase.Active; }
  get isVisible() { return this._phase !== SlidePhase.Idle; }

  open() {
    if (this._phase !== SlidePhase.Idle) return;
    this._phase = SlidePhase.SlideDown;
    this._offset = 0;
  }

  close() {
    if (this._phase !== SlidePhase.Active) return;
    this._phase = SlidePhase.SlideUp;
  }

  /**
   * Snap shut with no scroll. The NES save chord resets MenuState outright before
   * switching to Mode $08 (Z_05.asm:362 UpdateMenuActive, JSR EndGameMode / STA
   * MenuState) rather than playing the scroll-up.
   */
  hideImmediately() {
    this._phase = SlidePhase.Idle;
    this._offset = 0;
  }

  update() {
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
