// projectiles.png — the shared sprite source for every in-flight weapon.
//
// **Layout: 6 columns × 4 rows of 40×40 cells**, each sprite centred in its cell.
// Same convention as items.png (see src/data/item-sprites.ts). L0c mistakenly read
// it as 15 columns of 16×16, which put every index on an empty or half-clipped
// cell — the reason placing a bomb or throwing the boomerang drew nothing at all.
//
// The column/row meanings are not guesswork: this file is byte-identical to
// zelda-clone-master's Content/Images/Projectile/projectiles.png, and that repo's
// ProjectileSpriteFactory.cs names them —
//   projectileColumns = 6, projectileRows = 4
//   arrowColumn = 0, swordBeamColumn = 1, boomerangColumn = 3,
//   fireballColumn = 4, bombColumn = 5 (bombRow = 0, bombTotalFrames = 1)
// and Arrow.cs gives the row convention:
//   const int northSprite = 0, southSprite = 1, westSprite = 2, eastSprite = 3;
// SwordBeam.cs toggles a columnModifier of 0/1 over swordBeamColumn, so the beam
// animates across columns 1 and 2.

import { Direction } from '../core/types.js';
import type { Renderer } from './renderer.js';
import { applyTransparency } from './transparency.js';

export const PROJ_COLUMNS = 6;
export const PROJ_ROWS = 4;
export const PROJ_CELL = 40;

// Measured content bounds across every cell are x 11-28, y 12-27 — a centred
// 20×20 window covers all of them. Cropping 20×20 and drawing 20×20 keeps the art
// at 1:1 (no scaling, which would blur pixel art); the -2 destination offset
// re-centres that window on the caller's 16×16 logical position.
const CROP = 20;
const CROP_OFFSET = (PROJ_CELL - CROP) / 2; // 10
const DRAW_OFFSET = (CROP - 16) / 2;        // 2

/** Sheet columns, named per zelda-clone-master's ProjectileSpriteFactory. */
export const PROJ_COL_ARROW = 0;
export const PROJ_COL_SWORD_BEAM = 1; // animates over columns 1 and 2
export const PROJ_COL_SWORD_BEAM_ALT = 2;
export const PROJ_COL_BOOMERANG = 3;
/**
 * Column 4 is the **magic shot**, with a cell per direction down its four rows —
 * the wand's projectile, identified by the user against the sheet (2026-09-04).
 * It was named FIREBALL on the strength of zelda-clone-master's
 * `fireballColumn = 4`, which is why the wand fell back to the sword beam.
 */
export const PROJ_COL_MAGIC = 4;
/** @deprecated Column 4 is the directional magic shot; see PROJ_COL_MAGIC. */
export const PROJ_COL_FIREBALL = PROJ_COL_MAGIC;
export const PROJ_COL_BOMB = 5;

/** Rows are directions (Arrow.cs: north 0, south 1, west 2, east 3). */
export const PROJ_ROW_NORTH = 0;
export const PROJ_ROW_SOUTH = 1;
export const PROJ_ROW_WEST = 2;
export const PROJ_ROW_EAST = 3;

let sheet: CanvasImageSource | null = null;

export function initProjectileSprites(image: HTMLImageElement): void {
  // The sheet ships with real alpha, so there is no key colour to strip; running
  // it through applyTransparency keeps one code path for every sprite source.
  sheet = applyTransparency(image, { primary: (_r, _g, _b) => false });
}

/** Map a facing direction to its sheet row. */
export function directionToProjectileRow(dir: Direction): number {
  switch (dir) {
    case Direction.Up: return PROJ_ROW_NORTH;
    case Direction.Down: return PROJ_ROW_SOUTH;
    case Direction.Left: return PROJ_ROW_WEST;
    default: return PROJ_ROW_EAST;
  }
}

/** Draw one cell, centred on the 16×16 position at (dx, dy). */
export function drawProjectileSprite(
  renderer: Renderer, col: number, row: number, dx: number, dy: number,
): void {
  if (!sheet) return;
  renderer.drawImage(
    sheet,
    col * PROJ_CELL + CROP_OFFSET, row * PROJ_CELL + CROP_OFFSET, CROP, CROP,
    dx - DRAW_OFFSET, dy - DRAW_OFFSET, CROP, CROP,
  );
}

export function drawProjectileSpriteFlipped(
  renderer: Renderer, col: number, row: number, dx: number, dy: number,
  flipH: boolean, flipV: boolean,
): void {
  if (!sheet) return;
  if (!flipH && !flipV) {
    drawProjectileSprite(renderer, col, row, dx, dy);
    return;
  }
  renderer.drawImageFlipped(
    sheet,
    col * PROJ_CELL + CROP_OFFSET, row * PROJ_CELL + CROP_OFFSET, CROP, CROP,
    dx - DRAW_OFFSET, dy - DRAW_OFFSET, CROP, CROP,
    flipH, flipV,
  );
}

/** True once initProjectileSprites has run — lets callers keep a fallback path. */
export function hasProjectileSprites(): boolean {
  return sheet !== null;
}
