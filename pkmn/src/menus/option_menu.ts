// Option menu — full-screen settings overlay
// Assembly ref: engine/menus/options.asm
// Options: TEXT SPEED (fast/mid/slow), ANIMATION (on/off), BATTLESTYLE (shift/set)
// SOUND and PRINT are omitted (not relevant for browser)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';
import { setTextSpeed } from '../text/textbox';

export type TextSpeed = 'FAST' | 'MID' | 'SLOW';
export type AnimationOpt = 'ON' | 'OFF';
export type BattleStyle = 'SHIFT' | 'SET';

export interface GameOptions {
  textSpeed: TextSpeed;
  animation: AnimationOpt;
  battleStyle: BattleStyle;
}

// Default options match the original game (assembly: TEXT_DELAY_MEDIUM)
const DEFAULT_OPTIONS: GameOptions = {
  textSpeed: 'MID',
  animation: 'ON',
  battleStyle: 'SHIFT',
};

// Cycle arrays for left/right navigation
const TEXT_SPEED_VALUES: TextSpeed[] = ['FAST', 'MID', 'SLOW'];
const ANIMATION_VALUES: AnimationOpt[] = ['ON', 'OFF'];
const BATTLE_STYLE_VALUES: BattleStyle[] = ['SHIFT', 'SET'];

// Layout (tile coordinates from assembly)
// Box: full screen 20×18 tiles
const BOX_X = 0;
const BOX_Y = 0;
const BOX_W = GB_WIDTH;   // 160px = 20 tiles
const BOX_H = GB_HEIGHT;  // 144px = 18 tiles

// Label positions (tile coords)
const LABEL_COL = 2;
const VALUE_COL = 14;  // assembly: hlcoord 14, row
const CURSOR_COL = 1;

// Row positions in tiles (assembly uses rows 2, 4, 6 for options, 16 for cancel)
const OPTION_ROWS = [2, 4, 6];
const CANCEL_ROW = 16;

// Option index: 0=text speed, 1=animation, 2=battle style, 3=cancel
const CANCEL_INDEX = 3;

export class OptionMenu {
  private cursor = 0;
  private options: GameOptions;

  constructor() {
    this.options = { ...DEFAULT_OPTIONS };
  }

  getOptions(): GameOptions {
    return this.options;
  }

  show(): void {
    this.cursor = 0;
  }

  /** Returns true when menu should close. */
  update(): boolean {
    // Navigate up/down
    if (isPressed('up')) {
      if (this.cursor === 0) {
        this.cursor = CANCEL_INDEX;
      } else if (this.cursor === CANCEL_INDEX) {
        // Skip from CANCEL to last option (BATTLESTYLE)
        this.cursor = CANCEL_INDEX - 1;
      } else {
        this.cursor--;
      }
    } else if (isPressed('down')) {
      if (this.cursor === CANCEL_INDEX) {
        this.cursor = 0;
      } else if (this.cursor === CANCEL_INDEX - 1) {
        // Skip from last option to CANCEL
        this.cursor = CANCEL_INDEX;
      } else {
        this.cursor++;
      }
    }

    // Left/right changes option value
    if (isPressed('left') || isPressed('right')) {
      const dir = isPressed('right') ? 1 : -1;
      this.cycleOption(this.cursor, dir);
    }

    // A on CANCEL, or B/Start exits
    if (isPressed('a') && this.cursor === CANCEL_INDEX) {
      playSFX('press_ab');
      return true;
    }
    if (isPressed('b') || isPressed('start')) {
      playSFX('press_ab');
      return true;
    }

    return false;
  }

  render(): void {
    // Full-screen box
    drawBox(BOX_X, BOX_Y, BOX_W, BOX_H);

    // Labels with colons (assembly: AllOptionsText)
    drawText('TEXT SPEED :', LABEL_COL * TILE_SIZE, OPTION_ROWS[0] * TILE_SIZE);
    drawText('ANIMATION  :', LABEL_COL * TILE_SIZE, OPTION_ROWS[1] * TILE_SIZE);
    drawText('BATTLESTYLE:', LABEL_COL * TILE_SIZE, OPTION_ROWS[2] * TILE_SIZE);

    // Values (right-padded to avoid leftover characters)
    drawText(this.padValue(this.options.textSpeed, 5), VALUE_COL * TILE_SIZE, OPTION_ROWS[0] * TILE_SIZE);
    drawText(this.padValue(this.options.animation, 5), VALUE_COL * TILE_SIZE, OPTION_ROWS[1] * TILE_SIZE);
    drawText(this.padValue(this.options.battleStyle, 5), VALUE_COL * TILE_SIZE, OPTION_ROWS[2] * TILE_SIZE);

    // CANCEL at bottom
    drawText('CANCEL', LABEL_COL * TILE_SIZE, CANCEL_ROW * TILE_SIZE);

    // Cursor ▶
    const cursorRow = this.cursor === CANCEL_INDEX ? CANCEL_ROW : OPTION_ROWS[this.cursor];
    drawText('\u25B6', CURSOR_COL * TILE_SIZE, cursorRow * TILE_SIZE);
  }

  private padValue(val: string, len: number): string {
    return val.padEnd(len);
  }

  private cycleOption(index: number, dir: number): void {
    switch (index) {
      case 0: {
        const i = TEXT_SPEED_VALUES.indexOf(this.options.textSpeed);
        this.options.textSpeed = TEXT_SPEED_VALUES[(i + dir + TEXT_SPEED_VALUES.length) % TEXT_SPEED_VALUES.length];
        // Apply to textbox system
        const speedMap: Record<TextSpeed, 'fast' | 'medium' | 'slow'> = { FAST: 'fast', MID: 'medium', SLOW: 'slow' };
        setTextSpeed(speedMap[this.options.textSpeed]);
        break;
      }
      case 1: {
        const i = ANIMATION_VALUES.indexOf(this.options.animation);
        this.options.animation = ANIMATION_VALUES[(i + dir + ANIMATION_VALUES.length) % ANIMATION_VALUES.length];
        break;
      }
      case 2: {
        const i = BATTLE_STYLE_VALUES.indexOf(this.options.battleStyle);
        this.options.battleStyle = BATTLE_STYLE_VALUES[(i + dir + BATTLE_STYLE_VALUES.length) % BATTLE_STYLE_VALUES.length];
        break;
      }
    }
  }
}
