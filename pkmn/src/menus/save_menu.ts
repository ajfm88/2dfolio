// Save menu — info screen with YES/NO confirmation
// Assembly ref: engine/menus/save.asm, engine/menus/main_menu.asm (PrintSaveScreenText)
// Flow: show info box + "Would you like to SAVE?" + yes/no → saving... → saved!

import { TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import { playSFX } from '../audio';
import { getText } from '../text';

type SaveState = 'info_delay' | 'confirm' | 'saving' | 'saved';

// Info box: assembly hlcoord 4,0; lb bc, 8, 14 → 16×10 tiles (with border)
const INFO_X = 4 * TILE_SIZE;
const INFO_Y = 0;
const INFO_W = 16 * TILE_SIZE;
const INFO_H = 10 * TILE_SIZE;

// Yes/No box: assembly hlcoord 0, 7 → left side, 6×5 tiles
const YESNO_X = 0;
const YESNO_Y = 7 * TILE_SIZE;
const YESNO_W = 6 * TILE_SIZE;
const YESNO_H = 5 * TILE_SIZE;

// Standard bottom text box: 20×6 tiles at row 12
const TEXT_X = 0;
const TEXT_Y = 12 * TILE_SIZE;
const TEXT_W = 20 * TILE_SIZE;
const TEXT_H = 6 * TILE_SIZE;

const INFO_DELAY_FRAMES = 30; // assembly: ld c, 10 + PrintSaveScreenText's own ld c, 30
const SAVING_FRAMES = 60;

export class SaveMenu {
  private state: SaveState = 'info_delay';
  private cursor = 0;
  private delayFrames = 0;
  private savingFrames = 0;
  private playerName = '';
  private badgeCount = 0;
  private pokedexOwned = 0;
  private playTimeMs = 0;

  show(playerName: string, badgeCount: number, pokedexOwned: number, playTimeMs: number): void {
    this.state = 'info_delay';
    this.cursor = 0;
    this.delayFrames = INFO_DELAY_FRAMES;
    this.savingFrames = 0;
    this.playerName = playerName;
    this.badgeCount = badgeCount;
    this.pokedexOwned = pokedexOwned;
    this.playTimeMs = playTimeMs;
  }

  /** Returns 'do_save' on confirm (caller should save), 'closed' when done, null otherwise. */
  update(): 'do_save' | 'closed' | null {
    if (this.state === 'info_delay') {
      this.delayFrames--;
      if (this.delayFrames <= 0) this.state = 'confirm';
      return null;
    } else if (this.state === 'confirm') {
      if (isPressed('up')) this.cursor = 0;
      else if (isPressed('down')) this.cursor = 1;
      else if (isPressed('a')) {
        playSFX('press_ab');
        if (this.cursor === 0) {
          this.state = 'saving';
          this.savingFrames = SAVING_FRAMES;
          return 'do_save';
        }
        return 'closed';
      } else if (isPressed('b')) {
        playSFX('press_ab');
        return 'closed';
      }
    } else if (this.state === 'saving') {
      this.savingFrames--;
      if (this.savingFrames <= 0) this.state = 'saved';
    } else if (this.state === 'saved') {
      if (isPressed('a') || isPressed('b')) {
        playSFX('press_ab');
        return 'closed';
      }
    }
    return null;
  }

  render(): void {
    this.renderInfoBox();
    if (this.state === 'info_delay') {
      // Only info box visible during delay
    } else if (this.state === 'confirm') {
      this.renderYesNo();
      this.renderTextBox('Would you like to', 'SAVE the game?');
    } else if (this.state === 'saving') {
      this.renderTextBox('Saving...', '');
    } else if (this.state === 'saved') {
      this.renderTextBox(`${this.playerName} saved`, 'the game!');
    }
  }

  private renderInfoBox(): void {
    drawBox(INFO_X, INFO_Y, INFO_W, INFO_H);
    const T = TILE_SIZE;
    // Assembly: SaveScreenInfoText at hlcoord 5,2
    drawText('PLAYER', 5 * T, 2 * T);
    drawText(this.playerName, 12 * T, 2 * T);
    drawText('BADGES', 5 * T, 4 * T);
    drawText(String(this.badgeCount).padStart(2), 17 * T, 4 * T);
    drawText(getText('SAVE_POKEDEX_LABEL'), 5 * T, 6 * T);
    drawText(String(this.pokedexOwned).padStart(3), 16 * T, 6 * T);
    drawText('TIME', 5 * T, 8 * T);
    const totalSec = Math.floor(this.playTimeMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    drawText(`${String(h).padStart(3)}:${String(m).padStart(2, '0')}`, 13 * T, 8 * T);
  }

  private renderYesNo(): void {
    drawBox(YESNO_X, YESNO_Y, YESNO_W, YESNO_H);
    const T = TILE_SIZE;
    const textX = YESNO_X + 2 * T;
    const yesY = YESNO_Y + T;
    const noY = YESNO_Y + 3 * T;
    drawText('YES', textX, yesY);
    drawText('NO', textX, noY);
    drawText('\u25B6', YESNO_X + T, this.cursor === 0 ? yesY : noY);
  }

  private renderTextBox(line1: string, line2: string): void {
    drawBox(TEXT_X, TEXT_Y, TEXT_W, TEXT_H);
    const T = TILE_SIZE;
    drawText(line1, TEXT_X + T, TEXT_Y + 2 * T);
    if (line2) drawText(line2, TEXT_X + T, TEXT_Y + 4 * T);
  }
}
