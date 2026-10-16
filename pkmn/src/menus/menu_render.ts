// Shared menu rendering helpers
import { TILE_SIZE } from '../core';
import { fillRect, getCtx, getScale, paletteToHex, getActivePalette } from '../renderer';
import { getFontCanvas, getBorderCanvas, charToTile, drawTileBorder } from '../text';
import { extraCharToTile, tokenizeGlyphs } from '../text/charmap';
import { uiTiles } from '../renderer/ui_tiles';

export function drawChar(ch: string, x: number, y: number): void {
  const extra = extraCharToTile(ch);
  const fontCanvas = extra >= 0 ? getBorderCanvas() : getFontCanvas();
  if (!fontCanvas) return;
  const tileId = extra >= 0 ? extra : charToTile(ch);
  if (tileId < 0) return;
  const s = getScale();
  const tilesPerRow = Math.floor(fontCanvas.width / TILE_SIZE);
  const srcX = (tileId % tilesPerRow) * TILE_SIZE;
  const srcY = Math.floor(tileId / tilesPerRow) * TILE_SIZE;
  const ctx = getCtx();
  ctx.drawImage(
    fontCanvas,
    srcX, srcY, TILE_SIZE, TILE_SIZE,
    x * s, y * s, TILE_SIZE * s, TILE_SIZE * s,
  );
}

export function drawText(text: string, x: number, y: number): void {
  const glyphs = tokenizeGlyphs(text);
  for (let i = 0; i < glyphs.length; i++) {
    drawChar(glyphs[i], x + i * TILE_SIZE, y);
  }
}

/** Width in unscaled game pixels; labels use the same glyphs as drawText. */
export function textWidth(text: string): number { return tokenizeGlyphs(text).length * TILE_SIZE; }

export function drawBox(x: number, y: number, w: number, h: number): void {
  uiTiles.cover(x, y, w, h);
  fillRect(x, y, w, h, 0);
  const wTiles = Math.round(w / TILE_SIZE);
  const hTiles = Math.round(h / TILE_SIZE);
  drawTileBorder(x, y, wTiles, hTiles);
}

export function drawHpBar(
  x: number, y: number,
  currentHp: number, maxHp: number,
  barWidth: number,
): void {
  const ctx = getCtx();
  const s = getScale();
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  const filledWidth = Math.ceil(ratio * barWidth);

  // Background (dark)
  ctx.fillStyle = paletteToHex(getActivePalette())[3];
  ctx.fillRect(x * s, y * s, barWidth * s, 2 * s);

  // Filled portion
  if (filledWidth > 0) {
    const color = ratio > 0.5 ? '#88c070' : ratio > 0.25 ? '#c8a030' : '#c03028';
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, filledWidth * s, 2 * s);
  }
}
