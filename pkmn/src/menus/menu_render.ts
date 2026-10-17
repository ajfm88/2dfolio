// Shared menu rendering helpers
import { TILE_SIZE } from '../core';
import { fillRect, drawTile, getCtx, getScale, paletteToHex, getActivePalette } from '../renderer';
import { getFontCanvas, getBorderCanvas, charToTile, drawTileBorder } from '../text';
import { extraCharToTile, tokenizeGlyphs } from '../text/charmap';
import { uiTiles } from '../renderer/ui_tiles';
import { menuGlyph, TIME_COLON_GLYPH } from './menu_glyphs';

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

// A wTileMap cell replaces the background, including spaces. Static drawText's
// transparent glyphs are unsuitable here (the map could otherwise show through).
const BORDER_TILES: Record<string, number> = { '┌': 25, '─': 26, '┐': 27, '│': 28, '└': 29, '┘': 30 };
export function drawScreenTile(glyph: string, x: number, y: number): void {
  fillRect(x, y, TILE_SIZE, TILE_SIZE, 0);
  if (glyph === TIME_COLON_GLYPH) {
    const sheet = getBorderCanvas();
    if (sheet) drawTile(sheet, 13, x, y);
    return;
  }
  const special = menuGlyph(glyph);
  if (special) { drawTile(special.sheet, special.tile, x, y); return; }
  const border = BORDER_TILES[glyph];
  if (border !== undefined) {
    const sheet = getBorderCanvas();
    if (sheet) drawTile(sheet, border, x, y);
  } else drawChar(glyph, x, y);
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
