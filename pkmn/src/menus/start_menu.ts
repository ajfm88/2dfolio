// Start menu (press Start in overworld)
// Appears as a right-aligned box overlaying the overworld scene
// Assembly ref: engine/menus/draw_start_menu.asm, home/start_menu.asm

import { GB_WIDTH, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';
import { getText } from '../text';

export type StartMenuAction = 'dex' | 'party' | 'item' | 'trainer' | 'save' | 'option' | 'exit';

interface MenuItem { label: string; action: StartMenuAction }

// Layout
const MENU_W = 10 * TILE_SIZE; // 80px  (assembly: hlcoord 10, 0 → lb bc, 14, 8)
const MENU_X = GB_WIDTH - MENU_W; // right-aligned
const MENU_Y = 0;
const ITEM_SPACING = 16; // 2 tiles per item (assembly: SCREEN_WIDTH * 2)
const FIRST_ITEM_Y = MENU_Y + TILE_SIZE; // 8px from top border

export class StartMenu {
  private cursor = 0;
  private items: MenuItem[] = [];

  /** Build menu items based on game state. Assembly: DrawStartMenu */
  show(hasPokedex: boolean, playerName: string): void {
    this.cursor = 0;
    this.items = [];
    if (hasPokedex) {
      this.items.push({ label: getText('MENU_POKEDEX'), action: 'dex' });
    }
    this.items.push(
      { label: getText('MENU_POKEMON'), action: 'party' },
      { label: 'ITEM', action: 'item' },
      { label: playerName, action: 'trainer' },
      { label: 'SAVE', action: 'save' },
      { label: 'OPTION', action: 'option' },
      { label: 'EXIT', action: 'exit' },
    );
  }

  /** Returns an action when selected, or null if still navigating. */
  update(): StartMenuAction | null {
    const len = this.items.length;
    if (!len) return 'exit';
    if (isPressed('up')) {
      this.cursor = (this.cursor - 1 + len) % len;
    } else if (isPressed('down')) {
      this.cursor = (this.cursor + 1) % len;
    } else if (isPressed('a')) {
      playSFX('press_ab');
      return this.items[this.cursor].action;
    } else if (isPressed('b') || isPressed('start')) {
      playSFX('press_ab');
      return 'exit';
    }
    return null;
  }

  render(): void {
    const len = this.items.length;
    if (!len) return;
    const menuH = FIRST_ITEM_Y + len * ITEM_SPACING + TILE_SIZE;
    drawBox(MENU_X, MENU_Y, MENU_W, menuH);

    for (let i = 0; i < len; i++) {
      const y = FIRST_ITEM_Y + i * ITEM_SPACING;
      const textX = MENU_X + 2 * TILE_SIZE;
      drawText(this.items[i].label, textX, y);

      // Cursor
      if (i === this.cursor) {
        drawText('\u25B6', MENU_X + TILE_SIZE, y);
      }
    }
  }
}
