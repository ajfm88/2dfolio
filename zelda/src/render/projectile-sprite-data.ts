import { SpriteSheet } from './sprite-renderer.js';
import type { Renderer } from './renderer.js';

let sheet: SpriteSheet | null = null;

export function initProjectileSprites(image: HTMLImageElement): void {
  sheet = new SpriteSheet({
    image,
    columns: 15,
    autoDetectTransparency: true,
  });
}

export function drawProjectileFrame(
  renderer: Renderer, index: number, dx: number, dy: number,
): void {
  if (!sheet) return;
  sheet.drawFrame(renderer, index, dx, dy);
}

export function drawProjectileFrameFlipped(
  renderer: Renderer, index: number, dx: number, dy: number,
  flipH: boolean, flipV: boolean,
): void {
  if (!sheet) return;
  sheet.drawFrameFlipped(renderer, index, dx, dy, flipH, flipV);
}

// ─── Sprite index constants (projectiles.png, 15 cols × 10 rows, 16×16) ───

// Arrows (same as player arrow — reused for enemy arrows)
export const ARROW_UP = 0;
export const ARROW_DOWN = 15;
export const ARROW_LEFT = 30;

// Boomerang (reused for goriya boomerang)
export const BOOMERANG_BASE = 1;

// Magic rod swing sprite
export const ROD_VERTICAL = 16;    // row 1, col 1
export const ROD_HORIZONTAL = 34;  // row 2, col 4

// Magic shot (wand projectile) — blue circle, alternates with fire frames for flicker
export const MAGIC_SHOT_A = 14;    // row 0, col 14 — blue circle
export const MAGIC_SHOT_B = 6;     // row 0, col 6 — reuse fire frame for flicker effect

// Sword shot (enemy sword beam) — reuse arrow sprites rotated
export const SWORD_SHOT_UP = 0;
export const SWORD_SHOT_DOWN = 15;
export const SWORD_SHOT_LEFT = 30;
