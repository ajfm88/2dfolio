// Main menu — CONTINUE / NEW GAME / OPTION
// Assembly ref: engine/menus/main_menu.asm
// Shows CONTINUE only if a save file exists

import { TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';

export type MainMenuAction = 'continue' | 'new_game' | 'new_game_quick' | 'option' | 'back';

// Layout from assembly main_menu.asm
// With save: TextBoxBorder at (0,0), lb bc, 6, 13 → 13 wide, 6 tall (inner)
// Without save: TextBoxBorder at (0,0), lb bc, 4, 13 → 13 wide, 4 tall (inner)
// TextBoxBorder adds 2 for border → actual box is (w+2)×(h+2) tiles
const BOX_X = 0;
const BOX_Y = 0;
const BOX_INNER_W = 13;
const BOX_BORDER = 2; // 1 tile border on each side
const MENU_TEXT_COL = 2;  // assembly: hlcoord 2, 2
const MENU_TEXT_ROW = 2;
const ROW_SPACING = 2; // 2 tile rows between items
const CURSOR_COL = 1;

// "Skip intro?" yes/no overlay — right side, similar to YesNoChoice
const SKIP_BOX_X = 6 * TILE_SIZE;
const SKIP_BOX_Y = 0;
const SKIP_BOX_W = 14 * TILE_SIZE;
const SKIP_BOX_H = 7 * TILE_SIZE;

export class MainMenu {
  private cursor = 0;
  private hasSave = false;
  private items: string[] = [];
  private showSkipIntro = false;
  private skipCursor = 0; // 0 = YES, 1 = NO

  show(hasSave: boolean): void {
    this.hasSave = hasSave;
    this.cursor = 0;
    this.showSkipIntro = false;
    this.skipCursor = 0;
    this.items = hasSave
      ? ['CONTINUE', 'NEW GAME', 'OPTION']
      : ['NEW GAME', 'OPTION'];
  }

  update(): MainMenuAction | null {
    // Sub-menu: skip intro yes/no
    if (this.showSkipIntro) {
      if (isPressed('up')) {
        this.skipCursor = 0;
      } else if (isPressed('down')) {
        this.skipCursor = 1;
      } else if (isPressed('a')) {
        playSFX('press_ab');
        this.showSkipIntro = false;
        return this.skipCursor === 0 ? 'new_game_quick' : 'new_game';
      } else if (isPressed('b')) {
        playSFX('press_ab');
        this.showSkipIntro = false;
      }
      return null;
    }

    // Main menu navigation
    if (isPressed('up')) {
      this.cursor = (this.cursor - 1 + this.items.length) % this.items.length;
    } else if (isPressed('down')) {
      this.cursor = (this.cursor + 1) % this.items.length;
    }

    if (isPressed('a')) {
      playSFX('press_ab');
      const item = this.items[this.cursor];
      if (item === 'CONTINUE') return 'continue';
      if (item === 'NEW GAME') {
        this.showSkipIntro = true;
        this.skipCursor = 0;
        return null;
      }
      if (item === 'OPTION') return 'option';
    }

    if (isPressed('b')) {
      playSFX('press_ab');
      return 'back';
    }

    return null;
  }

  render(): void {
    // Box height: assembly uses inner height 4 (no save, 2 items) or 6 (with save, 3 items)
    const innerH = this.hasSave ? 6 : 4;
    const boxW = (BOX_INNER_W + BOX_BORDER) * TILE_SIZE;
    const boxH = (innerH + BOX_BORDER) * TILE_SIZE;
    drawBox(BOX_X, BOX_Y, boxW, boxH);

    // Menu items
    for (let i = 0; i < this.items.length; i++) {
      const row = MENU_TEXT_ROW + i * ROW_SPACING;
      drawText(this.items[i], MENU_TEXT_COL * TILE_SIZE, row * TILE_SIZE);
    }

    // Cursor
    const cursorRow = MENU_TEXT_ROW + this.cursor * ROW_SPACING;
    drawText('\u25B6', CURSOR_COL * TILE_SIZE, cursorRow * TILE_SIZE);

    // Skip intro overlay
    if (this.showSkipIntro) {
      drawBox(SKIP_BOX_X, SKIP_BOX_Y, SKIP_BOX_W, SKIP_BOX_H);

      const textX = SKIP_BOX_X + 2 * TILE_SIZE;
      const questionY = SKIP_BOX_Y + TILE_SIZE;
      drawText('Skip intro?', textX, questionY);

      const yesY = SKIP_BOX_Y + 3 * TILE_SIZE;
      const noY = SKIP_BOX_Y + 5 * TILE_SIZE;
      drawText('YES', textX, yesY);
      drawText('NO', textX, noY);

      const cursorX = SKIP_BOX_X + TILE_SIZE;
      const cursorY = this.skipCursor === 0 ? yesY : noY;
      drawText('\u25B6', cursorX, cursorY);
    }
  }
}
