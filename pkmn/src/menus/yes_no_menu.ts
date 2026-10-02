// YES/NO choice menu — small overlay box at the right side of the screen
// Matches assembly YesNoChoice (home/yes_no.asm): tile (14, 7), 6 wide × 5 tall

import { TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';

// Position: tile column 14, row 7 (right side, above text box)
const MENU_X = 14 * TILE_SIZE; // 112px
const MENU_Y = 7 * TILE_SIZE;  // 56px
const MENU_W = 6 * TILE_SIZE;  // 48px
const MENU_H = 5 * TILE_SIZE;  // 40px (border + YES + gap + NO + border)

export class YesNoMenu {
  private cursor = 0; // 0 = YES, 1 = NO

  show(): void {
    this.cursor = 0;
  }

  /** Returns 'yes', 'no', or null if still choosing. */
  update(): 'yes' | 'no' | null {
    if (isPressed('up')) {
      this.cursor = 0;
    } else if (isPressed('down')) {
      this.cursor = 1;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      return this.cursor === 0 ? 'yes' : 'no';
    } else if (isPressed('b')) {
      playSFX('press_ab');
      return 'no';
    }
    return null;
  }

  render(): void {
    drawBox(MENU_X, MENU_Y, MENU_W, MENU_H);

    const textX = MENU_X + 2 * TILE_SIZE;
    const yesY = MENU_Y + TILE_SIZE;
    const noY = MENU_Y + 3 * TILE_SIZE;

    drawText('YES', textX, yesY);
    drawText('NO', textX, noY);

    // Cursor arrow ▶
    const cursorX = MENU_X + TILE_SIZE;
    const cursorY = this.cursor === 0 ? yesY : noY;
    drawText('\u25B6', cursorX, cursorY);
  }
}
