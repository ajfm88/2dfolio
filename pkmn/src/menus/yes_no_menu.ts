// YES/NO choice menu — small overlay box at the right side of the screen
// Matches assembly YesNoChoice (home/yes_no.asm): tile (14, 7), 6 wide × 5 tall

import { TILE_SIZE } from '../core';
import { isPressed, isPassPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';
import { setNoTextDelay } from '../text/text_flags';

// Position: tile column 14, row 7 (right side, above text box)
const MENU_X = 14 * TILE_SIZE; // 112px
const MENU_Y = 7 * TILE_SIZE;  // 56px
const MENU_W = 6 * TILE_SIZE;  // 48px
const MENU_H = 5 * TILE_SIZE;  // 40px (border + YES + gap + NO + border)

export class YesNoMenu {
  private cursor = 0; // 0 = YES, 1 = NO
  private pokeCenter = false;
  private actualRead = false;
  private silent = false;
  private readDelay = 0;
  private answerDelay = 0;
  private answer: 'yes' | 'no' | null = null;
  private position: 'left' | 'right' = 'right';

  show(opts: { pokeCenter?: boolean; actualRead?: boolean; silent?: boolean; position?: 'left' | 'right' } = {}): void {
    this.cursor = 0;
    this.pokeCenter = opts.pokeCenter ?? false;
    this.actualRead = opts.actualRead ?? false;
    this.silent = opts.silent ?? false;
    this.readDelay = this.actualRead ? 3 : 0;
    this.answerDelay = 0;
    this.answer = null;
    this.position = opts.position ?? 'right';
    // DisplayTwoOptionMenu clears BIT_NO_TEXT_DELAY after placing its labels,
    // before HandleMenuInput (including its initial Delay3).
    setNoTextDelay(false);
  }

  /** Returns 'yes', 'no', or null if still choosing. */
  update(readJoypad?: () => void): 'yes' | 'no' | null {
    if (this.actualRead) {
      // HandleMenuInput's Delay3 returns into Joypad on its third VBlank.
      if (this.answer) {
        if (--this.answerDelay > 0) return null;
        const result = this.answer; this.answer = null; return result;
      }
      if (this.readDelay > 0 && --this.readDelay > 0) return null;
      readJoypad?.();
      if (isPassPressed('a') || isPassPressed('b')) {
        if (!this.silent) playSFX('press_ab');
        // .choseSecondMenuItem selects NO on B without redrawing the cursor.
        this.answer = isPassPressed('b') ? 'no' : this.cursor === 0 ? 'yes' : 'no';
        this.answerDelay = 15;
        return null;
      }
      if (isPassPressed('up')) this.cursor = 0;
      else if (isPassPressed('down')) this.cursor = 1;
      if ((['up', 'down', 'left', 'right', 'start', 'select'] as const).some(key => isPassPressed(key))) this.readDelay = 3;
      return null;
    }
    const pressed = isPressed;
    if (pressed('up')) {
      this.cursor = 0;
    } else if (pressed('down')) {
      this.cursor = 1;
    } else if (pressed('a')) {
      if (!this.silent) playSFX('press_ab');
      return this.cursor === 0 ? 'yes' : 'no';
    } else if (pressed('b')) {
      if (!this.silent) playSFX('press_ab');
      return 'no';
    }
    return null;
  }

  render(): void {
    // YesNoChoicePokeCenter (home/yes_no.asm): HEAL/CANCEL at tile (11,6).
    const x = this.pokeCenter ? 11 * TILE_SIZE : this.position === 'left' ? 0 : MENU_X;
    const y = this.pokeCenter ? 6 * TILE_SIZE : MENU_Y;
    const width = this.pokeCenter ? 9 * TILE_SIZE : MENU_W;
    drawBox(x, y, width, this.pokeCenter ? 6 * TILE_SIZE : MENU_H);

    const textX = x + 2 * TILE_SIZE;
    const yesY = y + (this.pokeCenter ? 2 : 1) * TILE_SIZE;
    const noY = yesY + 2 * TILE_SIZE;

    drawText(this.pokeCenter ? 'HEAL' : 'YES', textX, yesY);
    drawText(this.pokeCenter ? 'CANCEL' : 'NO', textX, noY);

    // Cursor arrow ▶
    const cursorX = x + TILE_SIZE;
    const cursorY = this.cursor === 0 ? yesY : noY;
    drawText('\u25B6', cursorX, cursorY);
  }
}
