// Elimination mode (NES Mode F; Z_02.asm UpdateModeFElimination / DeleteSlot).
//
// A slot cursor over the three save files + an "END" target. Start on a file
// deletes it (NES plays the "Hurt" SFX and blanks the name); Start on END returns
// to file select. Like FileSelectScreen, this screen emits intents that main.ts
// performs against the SaveManager, rather than holding the manager itself.
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';
import { Action, type InputManager } from '../core/input.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from './bitmap-font.js';
import { SAVE_SLOT_COUNT, type SaveSlot } from '../save/save-manager.js';
import {
  CURSOR_FLASH_FRAMES,
  FS_CURSOR_X,
  FS_LABEL_X,
  FS_SLOT_SPACING,
  FS_SLOT_Y0,
  drawFrontEndTitle,
  drawSlotRow,
} from './file-select-screen.js';

const END_TARGET = SAVE_SLOT_COUNT;      // cursor index of the "END" row
const TARGET_COUNT = SAVE_SLOT_COUNT + 1;
const END_Y = FS_SLOT_Y0 + SAVE_SLOT_COUNT * FS_SLOT_SPACING + 16;

function targetY(target: number): number {
  return target < SAVE_SLOT_COUNT ? FS_SLOT_Y0 + target * FS_SLOT_SPACING : END_Y;
}

export class EliminationScreen {
  private cursor = 0;
  private cursorVisible = true;
  private cursorTimer = 0;
  private _pendingEliminate: number | null = null;
  private _done = false;

  get cursorIndex(): number {
    return this.cursor;
  }

  /** Slot index whose deletion main.ts should perform, then clearPending(). */
  get pendingEliminate(): number | null {
    return this._pendingEliminate;
  }

  get done(): boolean {
    return this._done;
  }

  clearPending(): void {
    this._pendingEliminate = null;
  }

  reset(): void {
    this.cursor = 0;
    this._pendingEliminate = null;
    this._done = false;
    this.cursorVisible = true;
    this.cursorTimer = 0;
  }

  update(input: InputManager): void {
    this.cursorTimer++;
    if (this.cursorTimer >= CURSOR_FLASH_FRAMES) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
    }

    // No character board here, so Up/Down and Select all move the slot cursor.
    if (input.isJustPressed(Action.Down) || input.isJustPressed(Action.Select)) {
      this.cursor = (this.cursor + 1) % TARGET_COUNT;
    } else if (input.isJustPressed(Action.Up)) {
      this.cursor = (this.cursor - 1 + TARGET_COUNT) % TARGET_COUNT;
    }

    if (input.isJustPressed(Action.Start)) {
      if (this.cursor === END_TARGET) {
        this._done = true;
      } else {
        this._pendingEliminate = this.cursor;
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

    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      drawSlotRow(renderer, font, FS_SLOT_Y0 + i * FS_SLOT_SPACING, slots[i]);
    }
    font.drawString(renderer, FS_LABEL_X, END_Y, 'END');

    if (this.cursorVisible) {
      font.drawString(renderer, FS_CURSOR_X, targetY(this.cursor), '>');
    }
  }
}
