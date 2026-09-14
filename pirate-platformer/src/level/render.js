import { TILE } from '../settings.js';
import { autotileAt, isPresent } from './autotile.js';
import { wrap } from './parallax.js';

/** @typedef {import('./model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {ReturnType<import('./parallax.js').createParallax>} Parallax */

const scratch = { col: 0, row: 0 };

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} image
 * @param {number} fw
 * @param {number} fh
 * @param {number} offsetX
 * @param {number} dy
 * @param {number} viewW
 * @param {number} viewH
 */
function drawTiledX(ctx, image, fw, fh, offsetX, dy, viewW, viewH) {
  if (dy >= viewH || dy + fh <= 0 || fw <= 0) return;
  let x = wrap(offsetX, fw) - fw;
  while (x < viewW) {
    ctx.drawImage(image, 0, 0, fw, fh, Math.round(x), dy, fw, fh);
    x += fw;
  }
}

/**
 * Sky, sea, horizon, BG Image, big clouds, small clouds.
 * Does not mutate parallax.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 * @param {Parallax} parallax
 */
export function drawBackground(ctx, cam, viewW, viewH, theme, atlas, parallax) {
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, viewW, viewH);

  const hy = Math.round(parallax.horizonY - cam.y);

  if (hy <= 0) {
    ctx.fillStyle = theme.sea;
    ctx.fillRect(0, 0, viewW, viewH);
  } else if (hy < viewH) {
    ctx.fillStyle = theme.sea;
    ctx.fillRect(0, hy, viewW, viewH - hy);
    ctx.fillStyle = theme.horizonBand;
    const bands = theme.horizonBands;
    for (let i = 0; i < bands.length; i++) {
      const offset = bands[i][0];
      const height = bands[i][1];
      ctx.fillRect(0, hy - offset, viewW, height);
    }
    ctx.fillStyle = theme.horizon;
    ctx.fillRect(0, hy, viewW, theme.horizonLine);
  }

  const bg = atlas.get(theme.bgImage);
  drawTiledX(
    ctx,
    bg.image,
    bg.fw,
    bg.fh,
    -cam.x * theme.bgParallax,
    Math.round(parallax.horizonY - bg.fh - cam.y),
    viewW,
    viewH,
  );

  const big = atlas.get(theme.bigClouds);
  drawTiledX(
    ctx,
    big.image,
    big.fw,
    big.fh,
    -cam.x * theme.bigCloudParallax + parallax.bigCloudX,
    Math.round(parallax.horizonY - big.fh - cam.y),
    viewW,
    viewH,
  );

  const clouds = parallax.small;
  const period = parallax.period;
  const factor = theme.smallCloudParallax;
  for (let i = 0; i < clouds.length; i++) {
    const cloud = clouds[i];
    let sx = wrap(cloud.x - cam.x * factor, period);
    if (sx >= viewW) sx -= period;
    const dy = Math.round(parallax.horizonY - cloud.above - cam.y);
    if (dy + cloud.h <= 0 || dy >= viewH) continue;
    let dx = Math.round(sx);
    if (dx + cloud.w > 0 && dx < viewW) {
      ctx.drawImage(
        cloud.clip.image, 0, 0, cloud.w, cloud.h, dx, dy, cloud.w, cloud.h,
      );
    }
    dx += period;
    if (dx + cloud.w > 0 && dx < viewW) {
      ctx.drawImage(
        cloud.clip.image, 0, 0, cloud.w, cloud.h, dx, dy, cloud.w, cloud.h,
      );
    }
  }
}

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

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {Theme} theme
 * @param {Parallax} parallax
 */
function drawReflections(ctx, cam, viewW, viewH, theme, parallax) {
  const y = parallax.horizonY + theme.reflectGap;
  const sy = Math.round(y - cam.y);
  const worldW = parallax.worldW;
  const list = parallax.reflects;
  for (let i = 0; i < list.length; i++) {
    const refl = list[i];
    if (sy + refl.h < 0 || sy > viewH) continue;
    const x0 = refl.x;
    const x1 = refl.x - worldW;
    const x2 = refl.x + worldW;
    const dx0 = x0 - cam.x;
    const dx1 = x1 - cam.x;
    const dx2 = x2 - cam.x;
    if (dx0 + refl.w > 0 && dx0 < viewW) refl.sprite.draw(ctx, cam, x0, y);
    if (dx1 + refl.w > 0 && dx1 < viewW) refl.sprite.draw(ctx, cam, x1, y);
    if (dx2 + refl.w > 0 && dx2 < viewW) refl.sprite.draw(ctx, cam, x2, y);
  }
}

/**
 * Background, tiles, then water reflections.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 * @param {Parallax} parallax
 */
export function drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax) {
  drawBackground(ctx, cam, viewW, viewH, theme, atlas, parallax);
  drawTiles(ctx, cam, viewW, viewH, level, theme, atlas);
  drawReflections(ctx, cam, viewW, viewH, theme, parallax);
}
