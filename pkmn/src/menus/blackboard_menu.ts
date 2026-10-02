// Blackboard interactive menu — 2-column grid menu with status descriptions
// Matches assembly PrintBlackboardLinkCableText / ViridianSchoolBlackboard
// (engine/events/hidden_events/school_blackboard.asm)

import { TILE_SIZE } from '../core';
import { isPressed } from '../input';
import { drawText, drawBox } from './menu_render';
import type { TextBox } from '../text';
import { playSFX } from '../audio';
import { getText } from '../text/game_text';

export interface BlackboardConfig {
  introText: string;
  promptText: string;
  /** Labels per column (e.g. [["SLP","PSN","PRZ"], ["BRN","FRZ","QUIT"]]). */
  columns: string[][];
  /** Flat descriptions indexed by column * rowCount + row. null = exit action. */
  descriptions: (string | null)[];
  /** Total box size in tiles (including border). */
  boxWidthTiles: number;
  boxHeightTiles: number;
  /** Tile column where each column's text starts (including leading space for cursor). */
  columnXTiles: number[];
  /** Tile row of the first item. Items are spaced 2 tiles apart vertically. */
  firstRowTile: number;
}

type Phase = 'intro' | 'menu' | 'description' | 'done';

export class BlackboardMenu {
  private config!: BlackboardConfig;
  private textBox!: TextBox;
  private phase: Phase = 'done';
  private column = 0;
  private row = 0;
  private promptReady = false; // true once prompt text is fully typed

  show(textBox: TextBox, config: BlackboardConfig): void {
    this.config = config;
    this.textBox = textBox;
    this.phase = 'intro';
    this.column = 0;
    this.row = 0;
    this.promptReady = false;
    textBox.show(config.introText);
  }

  /** Returns 'open' while active, 'closed' when done. */
  update(): 'open' | 'closed' {
    if (this.phase === 'done') return 'closed';

    if (this.phase === 'intro') {
      this.textBox.update();
      if (!this.textBox.active) {
        this.phase = 'menu';
        this.promptReady = false;
        this.textBox.show(this.config.promptText);
      }
      return 'open';
    }

    if (this.phase === 'menu') {
      // Let prompt text finish typing before accepting menu input
      if (!this.promptReady) {
        this.textBox.update();
        if (this.textBox.isWaitingForInput) {
          this.promptReady = true;
        }
        return 'open';
      }

      // Menu cursor navigation
      const rowCount = this.config.columns[this.column].length;

      if (isPressed('up')) {
        this.row = (this.row - 1 + rowCount) % rowCount;
      } else if (isPressed('down')) {
        this.row = (this.row + 1) % rowCount;
      } else if (isPressed('left') && this.config.columns.length > 1) {
        this.column = 0;
        this.row = Math.min(this.row, this.config.columns[0].length - 1);
      } else if (isPressed('right') && this.config.columns.length > 1) {
        this.column = 1;
        this.row = Math.min(this.row, this.config.columns[1].length - 1);
      } else if (isPressed('b')) {
        playSFX('press_ab');
        this.phase = 'done';
        this.textBox.dismiss();
        return 'closed';
      } else if (isPressed('a')) {
        playSFX('press_ab');
        const index = this.column * this.config.columns[0].length + this.row;
        const desc = this.config.descriptions[index];
        if (desc === null) {
          // QUIT or exit action
          this.phase = 'done';
          this.textBox.dismiss();
          return 'closed';
        }
        // Show status description
        this.phase = 'description';
        this.textBox.show(desc);
      }
      return 'open';
    }

    if (this.phase === 'description') {
      this.textBox.update();
      if (!this.textBox.active) {
        // Return to menu
        this.phase = 'menu';
        this.promptReady = false;
        this.textBox.show(this.config.promptText);
      }
      return 'open';
    }

    return 'closed';
  }

  render(): void {
    if (this.phase === 'done' || this.phase === 'intro') return;

    // Draw menu box at top-left of screen
    const boxW = this.config.boxWidthTiles * TILE_SIZE;
    const boxH = this.config.boxHeightTiles * TILE_SIZE;
    drawBox(0, 0, boxW, boxH);

    // Draw column labels
    for (let c = 0; c < this.config.columns.length; c++) {
      const colX = this.config.columnXTiles[c] * TILE_SIZE;
      for (let r = 0; r < this.config.columns[c].length; r++) {
        const rowY = (this.config.firstRowTile + r * 2) * TILE_SIZE;
        drawText(this.config.columns[c][r], colX, rowY);
      }
    }

    // Draw cursor ▶
    const cursorX = this.config.columnXTiles[this.column] * TILE_SIZE;
    const cursorY = (this.config.firstRowTile + this.row * 2) * TILE_SIZE;
    drawText('\u25B6', cursorX, cursorY);
  }
}

// Viridian School blackboard configuration (school_blackboard.asm)
// Box: lb bc, 6, 10 → inner 6×10, border adds 2 each = 8×12 tiles
// Left column at tile (1,2): " SLP" " PSN" " PAR"
// Right column at tile (6,2): " BRN" " FRZ" " QUIT"
export function getSchoolBlackboardConfig(): BlackboardConfig {
  return {
    introText: getText('BLACKBOARD_INTRO'),
    promptText: 'Which heading do\nyou want to read?',
    columns: [
      [' SLP', ' PSN', ' PAR'],
      [' BRN', ' FRZ', ' QUIT'],
    ],
    descriptions: [
      getText('BLACKBOARD_SLEEP'),
      getText('BLACKBOARD_POISON'),
      getText('BLACKBOARD_PARALYSIS'),
      'A burn reduces\npower and speed.\nIt also causes\nongoing damage.\fBurns remain\nafter battles.\fUse BURN HEAL to\ncure a burn!',
      getText('BLACKBOARD_FREEZE'),
      null,
    ],
    boxWidthTiles: 12,
    boxHeightTiles: 8,
    columnXTiles: [1, 6],
    firstRowTile: 2,
  };
}
// Keep SCHOOL_BLACKBOARD_CONFIG for API compat — caller should use getSchoolBlackboardConfig()
export const SCHOOL_BLACKBOARD_CONFIG = {} as BlackboardConfig;
