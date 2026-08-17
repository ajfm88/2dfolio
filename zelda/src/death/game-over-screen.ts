import {
  GAME_OVER_CONFIRM_FLASH_FRAMES,
  GAME_OVER_CURSOR_X,
  GAME_OVER_FLASH_TOGGLE_INTERVAL,
  GAME_OVER_OPTION_YS,
  GAME_OVER_TEXT_X,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
} from '../core/constants.js';
import { Action, type InputManager } from '../core/input.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from '../ui/bitmap-font.js';

export enum GameOverOption {
  Continue = 0,
  Save = 1,
  Retry = 2,
}

const OPTION_LABELS = ['CONTINUE', 'SAVE', 'RETRY'] as const;
const OPTION_COUNT = OPTION_LABELS.length;

export class GameOverScreen {
  private _selectedOption = GameOverOption.Continue;
  private _confirmed = false;
  private _flashTimer = 0;
  private _isDone = false;

  get done(): boolean {
    return this._isDone;
  }

  get selectedOption(): GameOverOption {
    return this._selectedOption;
  }

  get isConfirmed(): boolean {
    return this._confirmed;
  }

  get flashTimer(): number {
    return this._flashTimer;
  }

  update(input: InputManager): void {
    if (this._isDone) return;

    if (this._confirmed) {
      this._flashTimer++;
      if (this._flashTimer >= GAME_OVER_CONFIRM_FLASH_FRAMES) {
        this._isDone = true;
      }
      return;
    }

    // Z_05.asm:2199 — Select cycles through options
    if (input.isJustPressed(Action.Select)) {
      this._selectedOption = ((this._selectedOption + 1) % OPTION_COUNT) as GameOverOption;
      // TODO(K1): play selection changed sound (Tune0Request = $01)
    }

    if (input.isJustPressed(Action.Start)) {
      this._confirmed = true;
      this._flashTimer = 0;
      // TODO(K1): play confirmation sound
    }
  }

  render(renderer: Renderer, font: BitmapFont): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, '#000');

    for (let i = 0; i < OPTION_COUNT; i++) {
      const y = GAME_OVER_OPTION_YS[i]!;
      const label = OPTION_LABELS[i]!;

      if (i === this._selectedOption) {
        font.drawString(renderer, GAME_OVER_CURSOR_X, y, '>');
      }

      // During confirm flash, toggle selected option visibility every 4 frames
      if (this._confirmed && i === this._selectedOption) {
        const visible = Math.floor(this._flashTimer / GAME_OVER_FLASH_TOGGLE_INTERVAL) % 2 === 0;
        if (!visible) continue;
      }

      font.drawString(renderer, GAME_OVER_TEXT_X, y, label);
    }
  }
}
