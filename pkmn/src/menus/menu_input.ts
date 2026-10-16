// HandleMenuInput_ (home/window.asm), one frame per update.
//
// .loop1 places the cursor and runs Delay3 with no Joypad read; .loop2 then reads once a
// frame (JoypadLowSensitivity, hJoy7 = 0: newly pressed buttons only). Up/Down move the
// item unless A is pressed too. A press with no watched key goes back to .loop1: another
// Delay3. A watched key returns at once; A or B first plays SFX_PRESS_AB. There is no
// tail here: DisplayTwoOptionMenu's 15 frames belong to the yes/no menu (yes_no_menu.ts).
// wMenuWrappingEnabled is cleared on every return and no current caller sets it.
// wMenuWatchMovingOutOfBounds is 0 on every path traced to these menus (A5b6 plan §3.2);
// a value left by a list menu is a J2 menu-input audit question.

import { isHeld, isPassPressed } from '../input';
import type { GameButton } from '../core';

const KEYS: readonly GameButton[] = ['a', 'b', 'select', 'start', 'right', 'left', 'up', 'down'];

export interface MenuInputConfig {
  /** wMenuWatchedKeys */
  watched: readonly GameButton[];
  /** wMaxMenuItem */
  maxItem: number;
  /** wTopMenuItemX / wTopMenuItemY, in tiles; items are two rows apart (PlaceMenuCursor) */
  topX: number;
  topY: number;
  /** wCurrentMenuItem on entry */
  item?: number;
  /** wMenuWatchMovingOutOfBounds. Default off: Up at 0 and Down at the end re-arm Delay3. */
  watchOutOfBounds?: boolean;
  /** hJoy7 = 1 and hJoy6 = 0. Default off: new presses only. */
  repeat?: boolean;
}

export class MenuInput {
  item: number;
  private delay = 3;
  private repeatCounter = 0;

  constructor(readonly config: MenuInputConfig) {
    this.item = config.item ?? 0;
  }

  /** The list loop calls HandleMenuInput again. Delay3 restarts; hFrameCounter does not. */
  restart(): void { this.delay = 3; }

  /** One VBlank of hFrameCounter, including frames spent inside Delay3. */
  elapse(): void {
    if (this.config.repeat && this.repeatCounter > 0) this.repeatCounter--;
  }

  /** The ▶ written by PlaceMenuCursor, in tiles. */
  get cursor(): { x: number; y: number } {
    return { x: this.config.topX, y: this.config.topY + 2 * this.item };
  }

  /**
   * One frame. Returns the keys pressed at this frame's read once one of them is watched,
   * otherwise null. `readJoypad` is the actual read; `pressSound` plays SFX_PRESS_AB.
   */
  update(readJoypad: () => void, pressSound: () => void): GameButton[] | null {
    this.elapse();
    // Delay3 returns into Joypad on its third VBlank.
    if (this.delay > 0 && --this.delay > 0) return null;
    readJoypad();
    const fresh = KEYS.filter(key => isPassPressed(key));
    let pressed: GameButton[];
    if (this.config.repeat) {
      if (fresh.length > 0) {
        this.repeatCounter = 30;
        pressed = KEYS.filter(key => isHeld(key));
      } else if (this.repeatCounter > 0) {
        return null;
      } else {
        const held = KEYS.filter(key => isHeld(key));
        this.repeatCounter = 5;
        // hJoy6 is 0: a held A or B reports nothing. An empty hold waits out the short delay too.
        if (held.length === 0 || held.includes('a') || held.includes('b')) return null;
        pressed = held;
      }
    } else {
      pressed = fresh;
    }
    if (pressed.length === 0) return null;
    let pastEnd = false;
    if (!pressed.includes('a')) {
      if (pressed.includes('up')) {
        if (this.item > 0) this.item--;
        else pastEnd = true;
      } else if (pressed.includes('down')) {
        if (this.item < this.config.maxItem) this.item++;
        else pastEnd = true;
      }
    }
    const watched = pressed.some(key => this.config.watched.includes(key));
    if (!watched && !(pastEnd && this.config.watchOutOfBounds)) {
      this.delay = 3; // .loop1: PlaceMenuCursor, Delay3
      return null;
    }
    if (pressed.includes('a') || pressed.includes('b')) pressSound();
    return pressed;
  }
}
