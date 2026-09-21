import { TILE } from '../settings.js';

/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../data/palette.js').PaletteEntry} PaletteEntry */

export const CURSOR_PAINT = 'rgba(99, 157, 109, 0.3)';
export const CURSOR_ERASE = 'rgba(220, 73, 73, 0.3)';
export const CURSOR_HOVER = 'rgba(51, 50, 61, 0.15)';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} cols
 * @param {number} rows
 * @param {number} [pixelScale]
 */
export function drawGrid(ctx, cam, viewW, viewH, cols, rows, pixelScale = 1) {
  const c0 = Math.max(0, Math.floor(cam.x / TILE));
  const r0 = Math.max(0, Math.floor(cam.y / TILE));
  const c1 = Math.min(cols, Math.ceil((cam.x + viewW) / TILE));
  const r1 = Math.min(rows, Math.ceil((cam.y + viewH) / TILE));

  const x0 = Math.round(c0 * TILE - cam.x);
  const y0 = Math.round(r0 * TILE - cam.y);
  const x1 = Math.round(c1 * TILE - cam.x);
  const y1 = Math.round(r1 * TILE - cam.y);

  const prevStroke = ctx.strokeStyle;
  const prevWidth = ctx.lineWidth;
  ctx.strokeStyle = 'rgba(51, 50, 61, 0.15)';
  ctx.lineWidth = 1 / pixelScale;
  ctx.beginPath();
  for (let c = c0; c <= c1; c++) {
    const x = Math.round(c * TILE - cam.x);
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let r = r0; r <= r1; r++) {
    const y = Math.round(r * TILE - cam.y);
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth = prevWidth;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} c
 * @param {number} r
 * @param {string} color
 */
export function drawCursor(ctx, cam, c, r, color) {
  const dx = Math.round(c * TILE - cam.x);
  const dy = Math.round(r * TILE - cam.y);
  ctx.fillStyle = color;
  ctx.fillRect(dx, dy, TILE, TILE);
}

/**
 * Centre horizontally. Bottom-align for entities and markers; centre vertically
 * for decor.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} c
 * @param {number} r
 * @param {AtlasClip} clip
 * @param {PaletteEntry['placement']} placement
 */
export function drawPreviewIcon(ctx, cam, c, r, clip, placement) {
  const dx = Math.round(c * TILE - cam.x + (TILE - clip.fw) / 2);
  const dy = placement === 'decor'
    ? Math.round(r * TILE - cam.y + (TILE - clip.fh) / 2)
    : Math.round((r + 1) * TILE - cam.y - clip.fh);
  ctx.drawImage(clip.image, 0, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 * @param {number} c
 * @param {number} r
 * @param {{ get: (id: string) => AtlasClip }} atlas
 * @param {PaletteEntry} entry
 */
export function drawGhost(ctx, cam, c, r, atlas, entry) {
  const clip = atlas.get(entry.icon);
  ctx.globalAlpha = 0.5;
  drawPreviewIcon(ctx, cam, c, r, clip, entry.placement);
  ctx.globalAlpha = 1;
}
