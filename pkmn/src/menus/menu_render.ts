// Shared menu rendering helpers
import { TILE_SIZE } from '../core';
import { fillRect, getCtx, getScale, paletteToHex, getActivePalette } from '../renderer';
import { getFontCanvas, charToTile, drawTileBorder } from '../text';

export function drawChar(ch: string, x: number, y: number): void {
  const fontCanvas = getFontCanvas();
  if (!fontCanvas) return;
  const tileId = charToTile(ch);
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
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * TILE_SIZE, y);
  }
}

export function drawBox(x: number, y: number, w: number, h: number): void {
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
