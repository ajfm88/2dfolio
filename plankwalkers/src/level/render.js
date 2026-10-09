import { TILE, Z } from '../settings.js';
import { autotileAt, barTileAt, isPresent } from './autotile.js';
import { wrap } from './parallax.js';

/** @typedef {import('./model.js').LevelModel} LevelModel */
/** @typedef {import('../data/themes.js').Theme} Theme */
/** @typedef {ReturnType<import('./parallax.js').createParallax>} Parallax */

const scratch = { col: 0, row: 0 };

/**
 * Every `settings.Z` value, ascending. Built once. `drawLevel` walks this list
 * and never sorts objects per frame.
 * @type {number[]}
 */
export const DRAW_LAYER_ORDER = Object.values(Z).sort((a, b) => a - b);

/** @type {(z: number) => void} */
function noopLayer(_z) {}

/**
 * Clip against the same rounded column edges as the tile passes. Reading the
 * live layers here lets a maker edit hide or reveal shimmer on the next draw.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {Parallax['reflects'][number]} refl
 * @param {number} x
 * @param {number} y
 * @param {LevelModel} level
 */
function drawReflectionClipped(ctx, cam, refl, x, y, level) {
  const w = refl.w;
  const h = refl.h;
  const dx = Math.round(x - cam.x);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 1) / TILE);
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + w - 1) / TILE);
  const cols = level.cols;
  const rows = level.rows;
  let spanStart = -1;
  let spanEnd = 0;
  for (let c = c0; c <= c1; c++) {
    const left = Math.min(w, Math.max(0, Math.round(c * TILE - cam.x) - dx));
    const right = Math.min(w, Math.max(0, Math.round((c + 1) * TILE - cam.x) - dx));
    let blocked = false;
    for (let r = r0; r <= r1; r++) {
      if (isPresent(level.layers.terrain, cols, rows, c, r)
        || isPresent(level.layers.platform, cols, rows, c, r)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      if (spanStart < 0) spanStart = left;
      spanEnd = right;
    } else if (spanStart >= 0) {
      refl.sprite.drawSpan(ctx, cam, x, y, spanStart, spanEnd);
      spanStart = -1;
    }
  }
  if (spanStart >= 0) refl.sprite.drawSpan(ctx, cam, x, y, spanStart, spanEnd);
}

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
 * Sky, sea, horizon and BG Image, whose painted horizon row sits on `horizonY`.
 * A below-decks theme (one with a `wallTile`) draws only its back wall instead:
 * that sheet cell, on the world grid, over the whole view including the maker's
 * margins past the level edge. Does not mutate parallax. Clouds are
 * `drawClouds`, so a layer callback can sit between them.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 * @param {Parallax} parallax
 */
function drawBackdrop(ctx, cam, viewW, viewH, theme, atlas, parallax) {
  if (theme.wallTile) {
    const wall = atlas.get(theme.sheet);
    const sx = theme.wallTile[0] * TILE;
    const sy = theme.wallTile[1] * TILE;
    const c0 = Math.floor(cam.x / TILE);
    const r0 = Math.floor(cam.y / TILE);
    const c1 = Math.ceil((cam.x + viewW) / TILE);
    const r1 = Math.ceil((cam.y + viewH) / TILE);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        ctx.drawImage(wall.image, sx, sy, TILE, TILE,
          Math.round(c * TILE - cam.x), Math.round(r * TILE - cam.y), TILE, TILE);
      }
    }
    return;
  }
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
    Math.round(parallax.horizonY - theme.bgImageHorizonRow - cam.y),
    viewW,
    viewH,
  );
}

/**
 * Big clouds, then small clouds. A below-decks wall replaces the sky, so it
 * replaces the clouds too. Does not mutate parallax.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 * @param {Parallax} parallax
 */
function drawClouds(ctx, cam, viewW, viewH, theme, atlas, parallax) {
  if (theme.wallTile) return;

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
 * Backdrop then clouds, with nothing between them.
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
  drawBackdrop(ctx, cam, viewW, viewH, theme, atlas, parallax);
  drawClouds(ctx, cam, viewW, viewH, theme, atlas, parallax);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 */
function drawTerrainAndPlatforms(ctx, cam, viewW, viewH, level, theme, atlas) {
  const sheet = atlas.get(theme.sheet);
  const originX = theme.originCol * TILE;
  const originY = theme.originRow * TILE;

  const c0 = Math.max(0, Math.floor(cam.x / TILE));
  const r0 = Math.max(0, Math.floor(cam.y / TILE));
  const c1 = Math.min(level.cols, Math.ceil((cam.x + viewW) / TILE));
  const r1 = Math.min(level.rows, Math.ceil((cam.y + viewH) / TILE));

  const terrain = level.layers.terrain;
  const platform = level.layers.platform;
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

  const platformSheet = atlas.get(theme.platformSheet);
  const platformOriginX = theme.platformOriginCol * TILE;
  const platformOriginY = theme.platformOriginRow * TILE;
  const platformTiler = theme.platformTiling === 'bar' ? barTileAt : autotileAt;
  const platformOffsetY = theme.platformOffsetY;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!platformTiler(platform, cols, rows, c, r, scratch)) continue;
      const dx = Math.round(c * TILE - cam.x);
      const dy = Math.round(r * TILE - cam.y + platformOffsetY);
      ctx.drawImage(
        platformSheet.image,
        platformOriginX + scratch.col * TILE,
        platformOriginY + scratch.row * TILE,
        TILE,
        TILE,
        dx,
        dy,
        TILE,
        TILE,
      );
    }
  }
}

/**
 * Water cells that intersect the camera. Reflections are drawn with this layer
 * by `drawLevel`, after the actors.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 */
function drawWaterCells(ctx, cam, viewW, viewH, level, theme, atlas) {
  const water = atlas.get(theme.waterClip);
  const c0 = Math.max(0, Math.floor(cam.x / TILE));
  const r0 = Math.max(0, Math.floor(cam.y / TILE));
  const c1 = Math.min(level.cols, Math.ceil((cam.x + viewW) / TILE));
  const r1 = Math.min(level.rows, Math.ceil((cam.y + viewH) / TILE));
  const waterLayer = level.layers.water;
  const cols = level.cols;
  const rows = level.rows;

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
 * Terrain, platforms, then water. `drawLevel` calls the two passes separately
 * so actors can sit between them.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 */
export function drawTiles(ctx, cam, viewW, viewH, level, theme, atlas) {
  drawTerrainAndPlatforms(ctx, cam, viewW, viewH, level, theme, atlas);
  drawWaterCells(ctx, cam, viewW, viewH, level, theme, atlas);
}

/**
 * Reflections are drawn only over horizon-row cells with no terrain or platform,
 * clipped per cell.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {Theme} theme
 * @param {Parallax} parallax
 * @param {LevelModel} level
 */
function drawReflections(ctx, cam, viewW, viewH, theme, parallax, level) {
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
    if (dx0 + refl.w > 0 && dx0 < viewW) drawReflectionClipped(ctx, cam, refl, x0, y, level);
    if (dx1 + refl.w > 0 && dx1 < viewW) drawReflectionClipped(ctx, cam, refl, x1, y, level);
    if (dx2 + refl.w > 0 && dx2 < viewW) drawReflectionClipped(ctx, cam, refl, x2, y, level);
  }
}

/**
 * One frame of the level. Walks `DRAW_LAYER_ORDER` and, after each layer's own
 * backdrop or tiles, calls `onLayer` so the world or maker can draw the objects
 * at that `z`. The callback is the caller's; this function allocates nothing.
 * Actors (`Z.main`) are drawn before water and reflections, which is the
 * documented order.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {LevelModel} level
 * @param {Theme} theme
 * @param {{ get: (id: string) => { image: CanvasImageSource, fw: number, fh: number } }} atlas
 * @param {Parallax} parallax
 * @param {(z: number) => void} [onLayer]
 */
export function drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax, onLayer = noopLayer) {
  for (let i = 0; i < DRAW_LAYER_ORDER.length; i++) {
    const z = DRAW_LAYER_ORDER[i];
    if (z === Z.bg) drawBackdrop(ctx, cam, viewW, viewH, theme, atlas, parallax);
    else if (z === Z.clouds) drawClouds(ctx, cam, viewW, viewH, theme, atlas, parallax);
    else if (z === Z.bgTiles) drawTerrainAndPlatforms(ctx, cam, viewW, viewH, level, theme, atlas);
    else if (z === Z.water) {
      drawWaterCells(ctx, cam, viewW, viewH, level, theme, atlas);
      drawReflections(ctx, cam, viewW, viewH, theme, parallax, level);
    }
    onLayer(z);
  }
}
