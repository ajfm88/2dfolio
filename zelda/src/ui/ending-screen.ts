// Ending sequence (NES Mode $13, Z_02.asm InitMode13_Full + UpdateMode13WinGame).
//
// Five phases after Zelda rescue:
//   Flash    — background palette cycles 4 NES colors for $C0 (192) frames,
//              first $40 (64) frames static. Link + Zelda + Triforces shown.
//   PeaceText — typewriter text "FINALLY, PEACE RETURNS TO HYRULE. THIS ENDS
//               THE STORY." one character every 8 frames. Long timer $280 (640f).
//   Credits  — scrolling credits inside a brick-walled frame. Staff roles +
//              "ANOTHER QUEST WILL START FROM HERE." + player name + death count.
//   AshTriforce — Ganon's ashes + Triforce. Press Start to finish.
//   Done     — signals main.ts to transition to Second Quest / title.

import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';
import type { Renderer } from '../render/renderer.js';
import { drawLinkEndingSpriteUp, drawNpcSprite, ZELDA_NPC_SPRITES } from '../render/boss-sprite-data.js';
import { drawItemSprite, getProcessedItemsCanvas } from '../data/item-sprites.js';
import type { BitmapFont } from './bitmap-font.js';

export enum EndingPhase {
  Flash,
  PeaceText,
  Credits,
  AshTriforce,
  Done,
}

// Z_02.asm EndingFlashColors: $0F=black, $12=blue, $16=red, $2A=green
// Mapped to approximate CSS colors from the NES palette.
const FLASH_COLORS = ['#000000', '#0000a8', '#d82800', '#008800'] as const;
const FLASH_START = 64;   // first $40 frames: no color cycling
const FLASH_TOTAL = 192;  // $C0 total frames

// Z_02.asm PeaceText decoded (NES PPU tile IDs → ASCII)
const PEACE_TEXT = 'FINALLY, PEACE RETURNS TO HYRULE.THIS ENDS THE STORY.';
const PEACE_CHAR_INTERVAL = 8; // one character every 8 frames
const PEACE_LONG_TIMER = 640; // $40 × 10 = $280 frames total display

// PeaceText line layout: 3 lines inside a textbox at the bottom of the play area.
// NES VRAM addresses map to these approximate screen positions.
const PEACE_LINES: readonly { text: string; x: number; y: number }[] = [
  { text: 'FINALLY,', x: 96, y: 152 },
  { text: 'PEACE RETURNS TO HYRULE.', x: 32, y: 168 },
  { text: 'THIS ENDS THE STORY.', x: 48, y: 184 },
];

// NES credits text (Q1: lines 0-15, from CreditsTextLines.dat).
// Each line is centered within the 256px-wide brick frame.
const CREDITS_LINES: readonly string[] = [
  '',
  'STAFF',
  '',
  'EXECUTIVE PRODUCER',
  '',
  'H.YAMAUCHI',
  '',
  'PRODUCER AND DIRECTOR',
  '',
  'S.MIYAMOTO',
  '',
  'MUSIC',
  '',
  'K.KONDO',
  '',
  'SOUND PROGRAM',
  '',
  'T.WAKAI',
  '',
  'WRITTEN BY',
  '',
  'T.TEZUKA',
  '',
  'TECHNICIAN',
  '',
  'T.NAKAZOO',
  '',
  'ANOTHER QUEST WILL',
  'START FROM HERE.',
  '',
  'PRESS THE START BUTTON.',
  '',
  // Player name + death count are injected at render time.
];
const CREDITS_LINE_HEIGHT = 16;
const CREDITS_SCROLL_SPEED = 0.5; // ~0.5 px/frame, same as title backstory
const CREDITS_TOP_PADDING = 48;
const BRICK_BORDER = 16;

// AshTriforce: static display with Triforce + ashes, wait for Start.
const ASH_TRIFORCE_MIN_FRAMES = 64; // $40 minimum wait before Start registers

const LINK_DISPLAY_X = 88;
const LINK_DISPLAY_Y = 80;
const ZELDA_DISPLAY_X = 152;
const ZELDA_DISPLAY_Y = 80;
const TRIFORCE_OFFSET_Y = -16;

const CHAR_WIDTH = 8;

export class EndingScreen {
  private _phase = EndingPhase.Flash;
  private timer = 0;

  // PeaceText state
  private peaceCharIndex = 0;
  private peaceLongTimer = 0;

  // Credits state
  private creditsScrollY = 0;
  private readonly playerName: string;
  private readonly deathCount: number;

  // AshTriforce
  private ashTimer = 0;

  constructor(playerName: string, deathCount: number) {
    this.playerName = playerName.toUpperCase().padEnd(8, ' ');
    this.deathCount = deathCount;
  }

  get phase(): EndingPhase { return this._phase; }
  get isDone(): boolean { return this._phase === EndingPhase.Done; }

  update(startPressed: boolean): void {
    this.timer++;

    switch (this._phase) {
      case EndingPhase.Flash:
        if (this.timer >= FLASH_TOTAL) {
          this._phase = EndingPhase.PeaceText;
          this.timer = 0;
          this.peaceCharIndex = 0;
          this.peaceLongTimer = 0;
        }
        break;

      case EndingPhase.PeaceText:
        this.peaceLongTimer++;
        // Emit one character every PEACE_CHAR_INTERVAL frames
        if (this.peaceCharIndex < PEACE_TEXT.length) {
          if (this.timer % PEACE_CHAR_INTERVAL === PEACE_CHAR_INTERVAL - 1) {
            this.peaceCharIndex++;
          }
        }
        if (this.peaceLongTimer >= PEACE_LONG_TIMER) {
          this._phase = EndingPhase.Credits;
          this.timer = 0;
          this.creditsScrollY = 0;
        }
        break;

      case EndingPhase.Credits:
        this.creditsScrollY += CREDITS_SCROLL_SPEED;
        if (this.creditsScrollY >= this.creditsTotalHeight()) {
          this._phase = EndingPhase.AshTriforce;
          this.timer = 0;
          this.ashTimer = 0;
        }
        break;

      case EndingPhase.AshTriforce:
        this.ashTimer++;
        if (this.ashTimer > ASH_TRIFORCE_MIN_FRAMES && startPressed) {
          this._phase = EndingPhase.Done;
        }
        break;

      case EndingPhase.Done:
        break;
    }
  }

  private creditsTotalHeight(): number {
    // Enough scroll for all lines + player line + margin to go fully off-screen.
    const lineCount = CREDITS_LINES.length + 2; // +2 for player name line + blank
    return SCREEN_HEIGHT + CREDITS_TOP_PADDING + lineCount * CREDITS_LINE_HEIGHT + 64;
  }

  private allCreditsLines(): readonly string[] {
    // Append the player name + death count line
    const deathStr = this.deathCount.toString().padStart(3, ' ');
    const playerLine = `${this.playerName.trim()}  -${deathStr}`;
    return [...CREDITS_LINES, playerLine, ''];
  }

  render(renderer: Renderer, font: BitmapFont): void {
    switch (this._phase) {
      case EndingPhase.Flash:
        this.renderFlash(renderer, font);
        break;
      case EndingPhase.PeaceText:
        this.renderPeaceText(renderer, font);
        break;
      case EndingPhase.Credits:
        this.renderCredits(renderer, font);
        break;
      case EndingPhase.AshTriforce:
        this.renderAshTriforce(renderer, font);
        break;
      case EndingPhase.Done:
        break;
    }
  }

  private renderFlash(renderer: Renderer, _font: BitmapFont): void {
    // Background color cycles through NES palette colors after $40 frames
    let bgColor = '#000000';
    if (this.timer >= FLASH_START) {
      const colorIndex = (this.timer - FLASH_START) & 0x03;
      bgColor = FLASH_COLORS[colorIndex] ?? '#000000';
    }
    renderer.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, bgColor);

    // Link + Zelda + Triforces
    this.drawLinkSprite(renderer, LINK_DISPLAY_X, LINK_DISPLAY_Y);
    this.drawZeldaSprite(renderer, ZELDA_DISPLAY_X, ZELDA_DISPLAY_Y);
    this.drawTriforce(renderer, LINK_DISPLAY_X + 4, LINK_DISPLAY_Y + TRIFORCE_OFFSET_Y);
    this.drawTriforce(renderer, ZELDA_DISPLAY_X + 4, ZELDA_DISPLAY_Y + TRIFORCE_OFFSET_Y);
  }

  private renderPeaceText(renderer: Renderer, font: BitmapFont): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, '#000');

    // Show Link + Zelda + Triforces while long timer >= 4
    const longTimerCountdown = PEACE_LONG_TIMER - this.peaceLongTimer;
    if (longTimerCountdown >= 4) {
      this.drawLinkSprite(renderer, LINK_DISPLAY_X, LINK_DISPLAY_Y);
      this.drawZeldaSprite(renderer, ZELDA_DISPLAY_X, ZELDA_DISPLAY_Y);
      this.drawTriforce(renderer, LINK_DISPLAY_X + 4, LINK_DISPLAY_Y + TRIFORCE_OFFSET_Y);
      this.drawTriforce(renderer, ZELDA_DISPLAY_X + 4, ZELDA_DISPLAY_Y + TRIFORCE_OFFSET_Y);
    }

    // Typewriter: reveal characters one-at-a-time across the 3 peace lines
    let charBudget = this.peaceCharIndex;
    for (const line of PEACE_LINES) {
      if (charBudget <= 0) break;
      const showCount = Math.min(charBudget, line.text.length);
      const partial = line.text.slice(0, showCount);
      font.drawString(renderer, line.x, line.y, partial);
      charBudget -= line.text.length;
    }
  }

  private renderCredits(renderer: Renderer, font: BitmapFont): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, '#000');

    // Draw brick border frame (NES uses $FA wall bricks tile)
    const ctx = renderer.ctx;
    const brickColor = '#b85820';
    // Top wall
    ctx.fillStyle = brickColor;
    ctx.fillRect(BRICK_BORDER, 0, SCREEN_WIDTH - 2 * BRICK_BORDER, BRICK_BORDER);
    // Bottom wall
    ctx.fillRect(BRICK_BORDER, SCREEN_HEIGHT - BRICK_BORDER, SCREEN_WIDTH - 2 * BRICK_BORDER, BRICK_BORDER);
    // Left wall
    ctx.fillRect(0, 0, BRICK_BORDER, SCREEN_HEIGHT);
    // Right wall
    ctx.fillRect(SCREEN_WIDTH - BRICK_BORDER, 0, BRICK_BORDER, SCREEN_HEIGHT);

    // Clip inside the brick frame for scrolling text
    ctx.save();
    ctx.beginPath();
    ctx.rect(BRICK_BORDER, BRICK_BORDER, SCREEN_WIDTH - 2 * BRICK_BORDER, SCREEN_HEIGHT - 2 * BRICK_BORDER);
    ctx.clip();

    const allLines = this.allCreditsLines();
    const firstLineY = SCREEN_HEIGHT - Math.round(this.creditsScrollY) + CREDITS_TOP_PADDING;

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i]!;
      if (line.length === 0) continue;
      const y = firstLineY + i * CREDITS_LINE_HEIGHT;
      if (y < BRICK_BORDER - CREDITS_LINE_HEIGHT || y > SCREEN_HEIGHT - BRICK_BORDER) continue;
      const x = Math.round((SCREEN_WIDTH - line.length * CHAR_WIDTH) / 2);
      font.drawString(renderer, x, y, line);
    }

    ctx.restore();
  }

  private renderAshTriforce(renderer: Renderer, font: BitmapFont): void {
    renderer.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, '#000');

    // Ganon ashes — grey pile placeholder
    const ashX = 112;
    const ashY = 100;
    const ctx = renderer.ctx;
    ctx.fillStyle = '#808080';
    ctx.fillRect(ashX, ashY, 32, 8);
    ctx.fillRect(ashX + 4, ashY - 4, 24, 4);
    ctx.fillRect(ashX + 8, ashY - 8, 16, 4);

    // Triforce above ashes
    this.drawTriforce(renderer, ashX + 12, ashY - 32);

    // "PUSH START" hint at bottom
    const hintText = 'PUSH START BUTTON';
    const hintX = Math.round((SCREEN_WIDTH - hintText.length * CHAR_WIDTH) / 2);
    font.drawString(renderer, hintX, 152, hintText);
  }

  private drawLinkSprite(renderer: Renderer, x: number, y: number): void {
    drawLinkEndingSpriteUp(renderer, x, y);
  }

  private drawZeldaSprite(renderer: Renderer, x: number, y: number): void {
    drawNpcSprite(renderer, ZELDA_NPC_SPRITES.rescued, x + 1, y);
  }

  private drawTriforce(renderer: Renderer, x: number, y: number): void {
    const itemsCanvas = getProcessedItemsCanvas();
    if (itemsCanvas) {
      drawItemSprite(renderer.ctx, itemsCanvas, 0x1b, x, y, 8);
      return;
    }
    const ctx = renderer.ctx;
    ctx.fillStyle = '#f8d870';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 8, y + 8);
    ctx.closePath();
    ctx.fill();
  }
}
