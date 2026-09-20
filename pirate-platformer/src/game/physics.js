/**
 * Tile-grid collision resolver.
 * Ported from Super-Pirate-World code_complete/player.py collision/semi_collision,
 * adapted from per-sprite iteration to cell-range iteration against LevelModel.
 */

import { TILE } from '../settings.js';

/**
 * @typedef {import('../core/rect.js').Rect} Rect
 * @typedef {import('../level/model.js').LevelModel} LevelModel
 */

/**
 * @param {number} x
 * @param {number} w
 * @param {number} cols
 * @returns {[number, number]}
 */
function cellRangeX(x, w, cols) {
  const c0 = Math.max(0, Math.floor(x / TILE));
  const c1 = Math.min(cols - 1, Math.floor((x + w - 0.001) / TILE));
  return [c0, c1];
}

/**
 * @param {number} y
 * @param {number} h
 * @param {number} rows
 * @returns {[number, number]}
 */
function cellRangeY(y, h, rows) {
  const r0 = Math.max(0, Math.floor(y / TILE));
  const r1 = Math.min(rows - 1, Math.floor((y + h - 0.001) / TILE));
  return [r0, r1];
}

/**
 * Resolve horizontal movement against terrain tiles.
 * @param {Rect} hitbox
 * @param {Rect} oldRect
 * @param {LevelModel} level
 */
export function resolveH(hitbox, oldRect, level) {
  const terrain = level.layers.terrain;
  const cols = level.cols;
  const [c0, c1] = cellRangeX(hitbox.x, hitbox.w, cols);
  const [r0, r1] = cellRangeY(hitbox.y, hitbox.h, level.rows);

  for (let r = r0; r <= r1; r++) {
    const rowOff = r * cols;
    for (let c = c0; c <= c1; c++) {
      if (terrain[rowOff + c] === 0) continue;

      const tL = c * TILE;
      const tR = tL + TILE;

      if (hitbox.x < tR && oldRect.x >= tR) {
        hitbox.x = tR;
      }
      if (hitbox.x + hitbox.w > tL && oldRect.x + oldRect.w <= tL) {
        hitbox.x = tL - hitbox.w;
      }
    }
  }
}

/**
 * Resolve vertical movement against terrain tiles.
 * @param {Rect} hitbox
 * @param {Rect} oldRect
 * @param {LevelModel} level
 * @returns {boolean} true if a push occurred (caller should zero vy)
 */
export function resolveV(hitbox, oldRect, level) {
  const terrain = level.layers.terrain;
  const cols = level.cols;
  const [c0, c1] = cellRangeX(hitbox.x, hitbox.w, cols);
  const [r0, r1] = cellRangeY(hitbox.y, hitbox.h, level.rows);
  let pushed = false;

  for (let r = r0; r <= r1; r++) {
    const rowOff = r * cols;
    for (let c = c0; c <= c1; c++) {
      if (terrain[rowOff + c] === 0) continue;

      const tT = r * TILE;
      const tB = tT + TILE;

      if (hitbox.y < tB && oldRect.y >= tB) {
        hitbox.y = tB;
        pushed = true;
      }
      if (hitbox.y + hitbox.h > tT && oldRect.y + oldRect.h <= tT) {
        hitbox.y = tT - hitbox.h;
        pushed = true;
      }
    }
  }
  return pushed;
}

/**
 * Resolve vertical movement against semi-solid platform tiles.
 * Only the bottom edge collides, and only when falling from above.
 * @param {Rect} hitbox
 * @param {Rect} oldRect
 * @param {LevelModel} level
 * @param {boolean} dropping true while drop-through timer is active
 * @returns {boolean} true if the player landed
 */
export function resolveSemiSolid(hitbox, oldRect, level, dropping) {
  if (dropping) return false;

  const platform = level.layers.platform;
  const cols = level.cols;
  const [c0, c1] = cellRangeX(hitbox.x, hitbox.w, cols);
  const [r0, r1] = cellRangeY(hitbox.y, hitbox.h, level.rows);
  let landed = false;

  for (let r = r0; r <= r1; r++) {
    const rowOff = r * cols;
    for (let c = c0; c <= c1; c++) {
      if (platform[rowOff + c] === 0) continue;

      const tT = r * TILE;
      if (hitbox.y + hitbox.h >= tT && oldRect.y + oldRect.h <= tT) {
        hitbox.y = tT - hitbox.h;
        landed = true;
      }
    }
  }
  return landed;
}

/**
 * Ask whether any terrain tile overlaps the rect. A query, not a resolver — a
 * projectile only needs to know it has hit something, not be pushed out.
 *
 * Terrain only, never platforms: a semi-solid platform is a thin ledge you jump
 * through from below, so a shot passing under it must read as a miss. Out-of-grid
 * cells count as empty, like every other check in this file.
 * @param {Rect} rect
 * @param {LevelModel} level
 * @returns {boolean} true when any terrain tile overlaps the rect
 */
export function checkSolid(rect, level) {
  const terrain = level.layers.terrain;
  const cols = level.cols;
  const [c0, c1] = cellRangeX(rect.x, rect.w, cols);
  const [r0, r1] = cellRangeY(rect.y, rect.h, level.rows);

  for (let r = r0; r <= r1; r++) {
    const rowOff = r * cols;
    for (let c = c0; c <= c1; c++) {
      if (terrain[rowOff + c] !== 0) return true;
    }
  }
  return false;
}

/**
 * Check whether the hitbox is resting on a floor (terrain or platform).
 * Tests a 1 px sensor band immediately below the bottom edge.
 * @param {Rect} hitbox
 * @param {LevelModel} level
 * @returns {boolean}
 */
export function checkFloor(hitbox, level) {
  const cols = level.cols;
  const sensorY = hitbox.y + hitbox.h;
  const r = Math.floor(sensorY / TILE);
  if (r < 0 || r >= level.rows) return false;

  const [c0, c1] = cellRangeX(hitbox.x, hitbox.w, cols);
  const rowOff = r * cols;
  const terrain = level.layers.terrain;
  const platform = level.layers.platform;

  for (let c = c0; c <= c1; c++) {
    if (terrain[rowOff + c] > 0 || platform[rowOff + c] > 0) return true;
  }
  return false;
}

/**
 * Check whether the hitbox is touching a wall on its left side.
 * Tests a 1 px sensor band to the left of the left edge, over the
 * middle 50% of the hitbox height (matching SPW's wall sensor).
 * @param {Rect} hitbox
 * @param {LevelModel} level
 * @returns {boolean}
 */
export function checkWallLeft(hitbox, level) {
  const cols = level.cols;
  const sensorX = hitbox.x - 1;
  const c = Math.floor(sensorX / TILE);
  if (c < 0 || c >= cols) return false;

  const quarterH = hitbox.h / 4;
  const [r0, r1] = cellRangeY(hitbox.y + quarterH, hitbox.h / 2, level.rows);
  const terrain = level.layers.terrain;

  for (let r = r0; r <= r1; r++) {
    if (terrain[r * cols + c] > 0) return true;
  }
  return false;
}

/**
 * Check whether the hitbox is touching a wall on its right side.
 * @param {Rect} hitbox
 * @param {LevelModel} level
 * @returns {boolean}
 */
export function checkWallRight(hitbox, level) {
  const cols = level.cols;
  const sensorX = hitbox.x + hitbox.w;
  const c = Math.floor(sensorX / TILE);
  if (c < 0 || c >= cols) return false;

  const quarterH = hitbox.h / 4;
  const [r0, r1] = cellRangeY(hitbox.y + quarterH, hitbox.h / 2, level.rows);
  const terrain = level.layers.terrain;

  for (let r = r0; r <= r1; r++) {
    if (terrain[r * cols + c] > 0) return true;
  }
  return false;
}
