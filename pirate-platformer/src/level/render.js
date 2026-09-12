import { TILE } from '../settings.js';
import { autotileAt, isPresent } from './autotile.js';

/** @typedef {import('./model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */

const scratch = { col: 0, row: 0 };

/**
 * Draw terrain, platform, then water for cells that intersect the camera.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 */
export function drawTiles(ctx, cam, viewW, viewH, level, theme, atlas) {
  const sheet = atlas.get(theme.sheet);
  const water = atlas.get(theme.waterClip);
  const originX = theme.originCol * TILE;
  const originY = theme.originRow * TILE;

  const c0 = Math.max(0, Math.floor(cam.x / TILE));
  const r0 = Math.max(0, Math.floor(cam.y / TILE));
  const c1 = Math.min(level.cols, Math.ceil((cam.x + viewW) / TILE));
  const r1 = Math.min(level.rows, Math.ceil((cam.y + viewH) / TILE));

  const terrain = level.layers.terrain;
  const platform = level.layers.platform;
  const waterLayer = level.layers.water;
  const cols = level.cols;
  const rows = level.rows;

  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!autotileAt(terrain, cols, rows, c, r, scratch)) continue;
      const dx = Math.round(c * TILE - cam.x);
      const dy = Math.round(r * TILE - cam.y);
      ctx.drawImage(
        sheet.image,
        originX + scratch.col * TILE,
        originY + scratch.row * TILE,
        TILE,
        TILE,
        dx,
        dy,
        TILE,
        TILE,
      );
    }
  }

  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!autotileAt(platform, cols, rows, c, r, scratch)) continue;
      const dx = Math.round(c * TILE - cam.x);
      const dy = Math.round(r * TILE - cam.y);
      ctx.drawImage(
        sheet.image,
        originX + scratch.col * TILE,
        originY + scratch.row * TILE,
        TILE,
        TILE,
        dx,
        dy,
        TILE,
        TILE,
      );
    }
  }

  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!isPresent(waterLayer, cols, rows, c, r)) continue;
      const dx = Math.round(c * TILE - cam.x);
      const dy = Math.round(r * TILE - cam.y);
      ctx.drawImage(water.image, 0, 0, TILE, TILE, dx, dy, TILE, TILE);
    }
  }
}
