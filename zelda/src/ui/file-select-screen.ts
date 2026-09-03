// File-select screen (NES Mode 1 menu; Z_02.asm UpdateMode1Menu).
//
// Three save-file rows plus "REGISTER YOUR NAME" and "ELIMINATION MODE" options,
// navigated with Up/Down and confirmed with Start. A '>' glyph marks the cursor
// (consistent with GameOverScreen; a Link-head sprite cursor is deferred to the
// L0 sprite-polish slice). Selecting an unregistered file is a no-op (the NES
// requires registering a name first). Register/Eliminate are wired in J1b.
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';
import { Action, type InputManager } from '../core/input.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from './bitmap-font.js';
import { SAVE_SLOT_COUNT, type SaveSlot } from '../save/save-manager.js';

export type FileSelectAction =
  | { kind: 'slot'; index: number }
  | { kind: 'register' }
  | { kind: 'eliminate' };

// Cursor targets: slots 0..2, then Register (3), then Eliminate (4).
const REGISTER_TARGET = SAVE_SLOT_COUNT;
const ELIMINATE_TARGET = SAVE_SLOT_COUNT + 1;
const TARGET_COUNT = SAVE_SLOT_COUNT + 2;

// Full-screen layout (256×240). Exported so Register/Elimination screens share it.
export const FS_TITLE_Y = 24;
export const FS_SLOT_Y0 = 72;
export const FS_SLOT_SPACING = 24;
const OPTION_Y0 = 168;
const OPTION_SPACING = 20;
export const FS_CURSOR_X = 48;
export const FS_LABEL_X = 64;

export const CURSOR_FLASH_FRAMES = 8;

function targetY(target: number): number {
  if (target < SAVE_SLOT_COUNT) return FS_SLOT_Y0 + target * FS_SLOT_SPACING;
  return OPTION_Y0 + (target - SAVE_SLOT_COUNT) * OPTION_SPACING;
}

/** Red "THE LEGEND OF / ZELDA" header shared by all three front-end file screens. */
export function drawFrontEndTitle(renderer: Renderer, redFont: BitmapFont): void {
  redFont.drawString(renderer, FS_LABEL_X, FS_TITLE_Y, 'THE LEGEND OF');
  redFont.drawString(renderer, FS_LABEL_X + 24, FS_TITLE_Y + 16, 'ZELDA');
}

/** One save-file row: the name (or dashes when empty) and, if registered, deaths. */
export function drawSlotRow(
  renderer: Renderer,
  font: BitmapFont,
  y: number,
  slot: SaveSlot | undefined,
  showDeaths = true,
): void {
  const label = slot && slot.registered && slot.name.trim().length > 0
    ? slot.name.padEnd(8, ' ')
    : '- - - - -';
  font.drawString(renderer, FS_LABEL_X, y, label);
  if (showDeaths && slot && slot.registered) {
    font.drawString(renderer, FS_LABEL_X + 88, y, `-${slot.deaths}`);
  }
}

export class FileSelectScreen {
  private cursor = 0;
  private cursorVisible = true;
  private cursorTimer = 0;
  private _selection: FileSelectAction | null = null;

  get cursorIndex(): number {
    return this.cursor;
  }

  /** Pending confirmed selection; main.ts reads it then calls clearSelection(). */
  get selection(): FileSelectAction | null {
    return this._selection;
  }

  clearSelection(): void {
    this._selection = null;
  }

  reset(): void {
    this.cursor = 0;
    this._selection = null;
    this.cursorVisible = true;
    this.cursorTimer = 0;
  }

  update(input: InputManager): void {
    this.cursorTimer++;
    if (this.cursorTimer >= CURSOR_FLASH_FRAMES) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
    }

    if (input.isJustPressed(Action.Down)) {
      this.cursor = (this.cursor + 1) % TARGET_COUNT;
    } else if (input.isJustPressed(Action.Up)) {
      this.cursor = (this.cursor - 1 + TARGET_COUNT) % TARGET_COUNT;
    }

    if (input.isJustPressed(Action.Start)) {
      if (this.cursor === REGISTER_TARGET) {
        this._selection = { kind: 'register' };
      } else if (this.cursor === ELIMINATE_TARGET) {
        this._selection = { kind: 'eliminate' };
      } else {
        this._selection = { kind: 'slot', index: this.cursor };
      }
    }
  }

  render(
    renderer: Renderer,
    font: BitmapFont,
    redFont: BitmapFont,
    slots: readonly SaveSlot[],
  ): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawFrontEndTitle(renderer, redFont);

    // Three save-file rows.
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      drawSlotRow(renderer, font, FS_SLOT_Y0 + i * FS_SLOT_SPACING, slots[i]);
    }

    // Options.
    font.drawString(renderer, FS_LABEL_X, OPTION_Y0, 'REGISTER YOUR');
    font.drawString(renderer, FS_LABEL_X, OPTION_Y0 + 10, 'NAME');
    font.drawString(renderer, FS_LABEL_X, OPTION_Y0 + OPTION_SPACING, 'ELIMINATION');
    font.drawString(renderer, FS_LABEL_X, OPTION_Y0 + OPTION_SPACING + 10, 'MODE');

    // Cursor.
    if (this.cursorVisible) {
      font.drawString(renderer, FS_CURSOR_X, targetY(this.cursor), '>');
    }
  }
}
