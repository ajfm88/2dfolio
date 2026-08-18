import { PLAY_AREA_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../core/constants.js';
import { Direction } from '../core/types.js';
import type { Renderer } from '../render/renderer.js';
import type { SpriteSheet } from '../render/sprite-renderer.js';
import { BitmapFont } from '../ui/bitmap-font.js';
import type { Link } from '../objects/player/link.js';

// NES cave layout: Old Man at top center, fires flanking, item on pedestal below.
// Link enters from bottom center facing up, walks to item.
// Z_01.asm InitModeB_EnterCave_Bank5: Link placed at ($70, $DD) → play-area ($70, $99)

// Cave interior positions (play-area-relative), matched to NES layout
const OLD_MAN_X = 120;
const OLD_MAN_Y = 72;
const FIRE_LEFT_X = 88;
const FIRE_RIGHT_X = 152;
const FIRE_Y = 72;
const ITEM_X = 120;
const ITEM_Y = 96;
const TEXT_Y = 48;

const CAVE_ENTRY_X = 112;
const CAVE_ENTRY_Y = 153; // NES $DD (221) - HUD 64 = 157, adjusted for play area

// Link can walk within the cave floor area
const CAVE_FLOOR_LEFT = 48;
const CAVE_FLOOR_RIGHT = 192;
const CAVE_FLOOR_TOP = 64;
const CAVE_FLOOR_BOTTOM = 160;

const CAVE_EXIT_Y = 160;

export interface CaveContents {
  readonly caveIndex: number;
  readonly items: readonly number[];
  readonly itemFlags: readonly number[];
  readonly prices: readonly number[];
}

export class CaveRoom {
  private readonly caveMap: HTMLImageElement;
  private readonly itemsImage: HTMLImageElement;
  private readonly npcsImage: HTMLImageElement;
  private readonly font: BitmapFont;
  private readonly contents: CaveContents;
  private readonly sourceScreenId: number;
  private _itemPickedUp = false;
  private _exitRequested = false;
  private _walkInFrames = 32; // NES: ObjGridOffset=$30 (48px) at ~1.5px/frame ≈ 32 frames

  constructor(
    caveMap: HTMLImageElement,
    itemsImage: HTMLImageElement,
    npcsImage: HTMLImageElement,
    font: BitmapFont,
    contents: CaveContents,
    sourceScreenId: number,
  ) {
    this.caveMap = caveMap;
    this.itemsImage = itemsImage;
    this.npcsImage = npcsImage;
    this.font = font;
    this.contents = contents;
    this.sourceScreenId = sourceScreenId;
  }

  get exitRequested(): boolean {
    return this._exitRequested;
  }

  get itemPickedUp(): boolean {
    return this._itemPickedUp;
  }

  get returnScreenId(): number {
    return this.sourceScreenId;
  }

  initLink(link: Link): void {
    link.setPosition(CAVE_ENTRY_X, CAVE_ENTRY_Y);
    link.setDirection(Direction.Up);
  }

  update(link: Link): void {
    // Walk-in phase: Link auto-walks up
    if (this._walkInFrames > 0) {
      this._walkInFrames--;
      link.walkForward();
      return;
    }

    // Check if Link reached exit (bottom of cave)
    if (link.posY >= CAVE_EXIT_Y) {
      this._exitRequested = true;
      return;
    }

    // Check if Link is near the item and hasn't picked it up
    if (!this._itemPickedUp && this.hasItem()) {
      const dx = Math.abs(link.posX - ITEM_X);
      const dy = Math.abs(link.posY - ITEM_Y);
      if (dx < 12 && dy < 12) {
        this._itemPickedUp = true;
      }
    }
  }

  updateMovement(link: Link, dx: number, dy: number): void {
    if (this._walkInFrames > 0) return;

    const nx = link.posX + dx;
    const ny = link.posY + dy;

    if (nx >= CAVE_FLOOR_LEFT && nx <= CAVE_FLOOR_RIGHT &&
        ny >= CAVE_FLOOR_TOP && ny <= CAVE_FLOOR_BOTTOM + TILE_SIZE) {
      link.setPosition(nx, ny);
    }
  }

  render(renderer: Renderer, link: Link, linkSheet: SpriteSheet): void {
    const ctx = renderer.ctx;

    // Draw cave background
    ctx.drawImage(this.caveMap, 0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT, 0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);

    // Draw fires (orange rectangles as placeholder — fire sprites from npcs.png row 1)
    this.drawFire(ctx, FIRE_LEFT_X, FIRE_Y);
    this.drawFire(ctx, FIRE_RIGHT_X, FIRE_Y);

    // Draw Old Man (blue robed figure from npcs.png)
    this.drawOldMan(ctx, OLD_MAN_X, OLD_MAN_Y);

    // Draw item on pedestal (if not picked up)
    if (!this._itemPickedUp && this.hasItem()) {
      this.drawItem(ctx, ITEM_X, ITEM_Y);
    }

    // Draw text
    this.drawCaveText(renderer);

    // Draw Link
    if (link.isVisible) {
      link.render(renderer, linkSheet);
    }
  }

  private hasItem(): boolean {
    // Item at index 1 is the main cave item (center pedestal)
    const item = this.contents.items[1];
    return item !== undefined && item !== 63; // 63 = None
  }

  private getItemId(): number {
    return this.contents.items[1] ?? 63;
  }

  private drawFire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Animated fire placeholder — orange/red flickering rectangles
    const flicker = Math.random() > 0.5;
    ctx.fillStyle = flicker ? '#f80' : '#f40';
    ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = flicker ? '#ff0' : '#fa0';
    ctx.fillRect(x + 4, y + 4, 8, 6);
  }

  private drawOldMan(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Draw Old Man from npcs.png — first character, row 0, ~16x16
    // npcs.png layout: Old Man is at approximately (0,0), 16x16
    ctx.drawImage(this.npcsImage, 1, 11, 16, 16, x, y, 16, 16);
  }

  private drawItem(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const itemId = this.getItemId();
    if (itemId === 1) {
      // Wooden Sword — brown blade, orange crossguard
      ctx.fillStyle = '#B86428';
      ctx.fillRect(x + 6, y + 2, 4, 10); // blade
      ctx.fillStyle = '#D89048';
      ctx.fillRect(x + 4, y + 10, 8, 2); // crossguard
      ctx.fillStyle = '#804010';
      ctx.fillRect(x + 6, y + 12, 4, 3); // handle
    } else {
      // Generic item placeholder
      ctx.fillStyle = '#fc0';
      ctx.fillRect(x + 2, y + 2, 12, 12);
    }
  }

  private drawCaveText(renderer: Renderer): void {
    const itemId = this.getItemId();
    if (itemId === 1) {
      // Center each line: 8px per char, screen is 256px wide
      const line1 = "IT'S DANGEROUS TO";
      const line2 = 'GO ALONE! TAKE THIS.';
      const x1 = (SCREEN_WIDTH - line1.length * 8) / 2;
      const x2 = (SCREEN_WIDTH - line2.length * 8) / 2;
      this.font.drawString(renderer, x1, TEXT_Y, line1);
      this.font.drawString(renderer, x2, TEXT_Y + 12, line2);
    }
  }
}
