// Trainer card / player info screen
// Assembly ref: engine/menus/start_sub_menus.asm (DrawTrainerInfo),
//               engine/menus/draw_badges.asm (DrawBadges)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from "../core";
import {
  getCtx,
  getScale,
  fillRect,
  loadTileset,
  loadBattleSprite,
  setActivePalette,
  getActivePalette,
  paletteToHex,
} from "../renderer";
import { isPressed } from "../input";
import { drawText } from "./menu_render";
import { playSFX } from "../audio";

// The 8 badges in order (assembly: BIT_BOULDERBADGE .. BIT_EARTHBADGE)
export const BADGE_FLAGS = [
  "BADGE_1",
  "BADGE_2",
  "BADGE_3",
  "BADGE_4",
  "BADGE_5",
  "BADGE_6",
  "BADGE_7",
  "BADGE_8",
] as const;

// Trainer card palette — REDMON gives the red/cream look
const CARD_PALETTE = "REDMON";

export class TrainerCard {
  private playerName = "";
  private money = 0;
  private playTimeMs = 0;
  private badges: boolean[] = [];
  private ready = false;
  private prevPalette = "";

  // Loaded assets
  private badgesSheet: HTMLCanvasElement | null = null;
  private badgeNumbers: HTMLCanvasElement | null = null;
  private playerSprite: HTMLCanvasElement | null = null;
  private bgTiles: HTMLCanvasElement | null = null;
  private circleTile: HTMLCanvasElement | null = null;

  async show(
    playerName: string,
    money: number,
    playTimeMs: number,
    badgeFlags: boolean[]
  ): Promise<void> {
    this.playerName = playerName;
    this.money = money;
    this.playTimeMs = playTimeMs;
    this.badges = badgeFlags;
    this.ready = false;
    this.prevPalette = getActivePalette();
    setActivePalette(CARD_PALETTE);

    const [badgesSheet, badgeNumbers, playerSprite, bgTiles, circleTile] =
      await Promise.all([
        loadTileset("/gfx/trainer_card/badges.png", CARD_PALETTE),
        loadTileset("/gfx/trainer_card/badge_numbers.png", CARD_PALETTE),
        loadBattleSprite("/gfx/player/red.png", CARD_PALETTE),
        loadTileset("/gfx/trainer_card/trainer_info.png", CARD_PALETTE),
        loadTileset("/gfx/trainer_card/circle_tile.png", CARD_PALETTE),
      ]);
    this.badgesSheet = badgesSheet;
    this.badgeNumbers = badgeNumbers;
    this.playerSprite = playerSprite;
    this.bgTiles = bgTiles;
    this.circleTile = circleTile;
    this.ready = true;
  }

  /** Returns true when the card should close. */
  update(): boolean {
    if (!this.ready) return false;
    if (isPressed("a") || isPressed("b") || isPressed("start")) {
      playSFX('press_ab');
      return true;
    }
    return false;
  }

  close(): void {
    setActivePalette(this.prevPalette);
  }

  render(): void {
    if (!this.ready) return;
    const ctx = getCtx();
    const s = getScale();
    const T = TILE_SIZE;

    // === Fill entire screen with checkered background tile ===
    this.drawCheckerBackground(ctx, s);

    // === Top info box ===
    // Original uses decorative red border tiles from trainer_info.png.
    // We inset a white box with a thin 1px border to match the look.
    const infoX = 1 * T;
    const infoY = 1 * T;
    const infoW = 18 * T; // cols 1-18
    const infoH = 7 * T; // rows 1-7 (tall enough for 3 text rows + sprite)
    fillRect(infoX, infoY, infoW, infoH, 0);
    this.drawThinBorder(ctx, s, infoX, infoY, infoW, infoH);

    // Text labels — assembly: hlcoord(2,2) "NAME/", next(+2rows) "MONEY/", next "TIME/"
    drawText("NAME/", 2 * T, 2 * T);
    drawText("MONEY/", 2 * T, 4 * T);
    drawText("TIME/", 2 * T, 6 * T);

    // Player name — assembly: hlcoord(7,2)
    drawText(this.playerName, 7 * T, 2 * T);

    // Money with ¥ prefix — assembly: hlcoord(8,4)
    drawText("\u00A5" + String(this.money), 8 * T, 4 * T);

    // Play time — assembly: hlcoord(9,6) hours:minutes
    const totalSeconds = Math.floor(this.playTimeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeStr = `${String(hours).padStart(3, " ")}:${String(
      minutes
    ).padStart(2, "0")}`;
    drawText(timeStr, 7 * T, 6 * T);

    // === Red's front sprite — upper-right, cropped to box ===
    // Original shows head/torso, legs are cropped by the box bottom.
    if (this.playerSprite) {
      const spriteW = this.playerSprite.width; // 56
      const visibleH = infoH - T; // box height minus small top padding
      const spriteX = 12 + infoX + infoW - spriteW; // flush with right edge of box
      const spriteY = 4 + infoY; // aligned with top of box
      ctx.drawImage(
        this.playerSprite,
        0,
        0,
        spriteW,
        visibleH,
        spriteX * s,
        spriteY * s,
        spriteW * s,
        visibleH * s
      );
    }

    // === "●BADGES●" label with white band across full width ===
    // Original has white space above and at the text row
    const badgeLabelY = 9 * T;
    fillRect(0, 8 * T, GB_WIDTH, 2 * T, 0); // 2-tile white band (rows 8-9)
    this.drawCircle(ctx, s, 6 * T, badgeLabelY);
    drawText("BADGES", 7 * T, badgeLabelY);
    this.drawCircle(ctx, s, 13 * T, badgeLabelY);

    // === Badge box — assembly: hlcoord(1,10), width 17, height 8 ===
    const badgeBoxX = 1 * T;
    const badgeBoxY = 10 * T;
    const badgeBoxW = 18 * T;
    const badgeBoxH = 8 * T;
    fillRect(badgeBoxX, badgeBoxY, badgeBoxW, badgeBoxH, 0);
    this.drawThinBorder(ctx, s, badgeBoxX, badgeBoxY, badgeBoxW, badgeBoxH);

    // === Draw 8 badges in 2 rows of 4 ===
    this.drawBadges(ctx, s);
  }

  /** Draw a red border inset from the white fill, leaving white padding outside.
   *  Original: checker → white padding (3px) → red line (1px) → white content. */
  private drawThinBorder(
    ctx: CanvasRenderingContext2D,
    s: number,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const hex = paletteToHex(CARD_PALETTE);
    ctx.strokeStyle = hex[2]; // color 2 = red
    ctx.lineWidth = s;
    // Inset the red line 3px from the white fill edge
    const pad = 1 * s;
    const off = s * 0.5;
    ctx.strokeRect(
      x * s + pad + off,
      y * s + pad + off,
      w * s - 2 * pad - s,
      h * s - 2 * pad - s
    );
  }

  /** Fill screen with the checker background tile from trainer_info.png tile 8.
   *  trainer_info.png is 24×24 (3×3 tiles). Tile 8 = bottom-right at (16,16). */
  private drawCheckerBackground(
    ctx: CanvasRenderingContext2D,
    s: number
  ): void {
    if (!this.bgTiles) {
      fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 1);
      return;
    }
    const T = TILE_SIZE;
    // Tile 8 in a 3-wide grid: col=8%3=2, row=floor(8/3)=2 → pixel (16,16)
    const srcX = 2 * T;
    const srcY = 2 * T;
    for (let y = 0; y < GB_HEIGHT; y += T) {
      for (let x = 0; x < GB_WIDTH; x += T) {
        ctx.drawImage(
          this.bgTiles,
          srcX,
          srcY,
          T,
          T,
          x * s,
          y * s,
          T * s,
          T * s
        );
      }
    }
  }

  /** Draw circle decoration tile from circle_tile.png (8×8). */
  private drawCircle(
    ctx: CanvasRenderingContext2D,
    s: number,
    x: number,
    y: number
  ): void {
    if (!this.circleTile) return;
    const T = TILE_SIZE;
    ctx.drawImage(this.circleTile, 0, 0, T, T, x * s, y * s, T * s, T * s);
  }

  /** Draw the 4×2 badge grid.
   *  Assembly: row 1 at hlcoord(2,11), row 2 at hlcoord(2,14), 4 tiles per cell. */
  private drawBadges(ctx: CanvasRenderingContext2D, s: number): void {
    const startX = 2 * TILE_SIZE;
    const row1Y = 11 * TILE_SIZE;
    const row2Y = 14 * TILE_SIZE;
    const cellW = 4 * TILE_SIZE;

    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = startX + col * cellW;
      const y = row === 0 ? row1Y : row2Y;

      this.drawBadgeNumber(ctx, s, i, x, y);
      this.drawBadgeFace(ctx, s, i, x + TILE_SIZE, y + TILE_SIZE);
    }
  }

  /** Draw badge number (1-8) from badge_numbers.png.
   *  Layout: 16×32 (2×4 grid of 8×8 tiles). number[i] at (i%2*8, floor(i/2)*8). */
  private drawBadgeNumber(
    ctx: CanvasRenderingContext2D,
    s: number,
    index: number,
    x: number,
    y: number
  ): void {
    if (!this.badgeNumbers) return;
    const T = TILE_SIZE;
    const srcX = (index % 2) * T;
    const srcY = Math.floor(index / 2) * T;
    ctx.drawImage(
      this.badgeNumbers,
      srcX,
      srcY,
      T,
      T,
      x * s,
      y * s,
      T * s,
      T * s
    );
  }

  /** Draw gym leader face (no badge) or badge icon (badge earned).
   *  badges.png: 16×256, interleaved 16×16 blocks.
   *  face[i] at y=i*32, badge[i] at y=i*32+16. */
  private drawBadgeFace(
    ctx: CanvasRenderingContext2D,
    s: number,
    index: number,
    x: number,
    y: number
  ): void {
    if (!this.badgesSheet) return;
    const faceSize = 16;
    const hasBadge = this.badges[index] ?? false;
    const srcY = index * faceSize * 2 + (hasBadge ? faceSize : 0);
    ctx.drawImage(
      this.badgesSheet,
      0,
      srcY,
      faceSize,
      faceSize,
      x * s,
      y * s,
      faceSize * s,
      faceSize * s
    );
  }
}
