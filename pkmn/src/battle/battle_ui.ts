// Upstream's canvas battle drawing, what is left of it: the evolution screen's sprites, silhouettes and text box,
// and the Pokedex's sprites. The catch demos' drawing retired in A5f checkpoint-05 (note 87 §24).

import { GB_HEIGHT, TILE_SIZE } from '../core';
import { getCtx, getScale, fillRect, loadBattleSprite, getMonsterPalette } from '../renderer';
import { charToTile, drawTileBorder } from '../text';

let fontCanvas: HTMLCanvasElement | null = null;

// Sprite caches
const frontSpriteCache = new Map<string, HTMLCanvasElement>();
const backSpriteCache = new Map<string, HTMLCanvasElement>();

export async function initBattleUI(font: HTMLCanvasElement): Promise<void> {
  fontCanvas = font;
}

export async function loadPokemonSprites(speciesName: string, dexNumber?: number): Promise<{
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
}> {
  const dex = dexNumber ?? 0;

  // Use per-Pokemon CGB battle palette by dex number
  const palette = getMonsterPalette(dex);

  const front = `/gfx/sprites/front/${dex}.png`;
  const back = `/gfx/sprites/back/${dex}.png`;

  if (!frontSpriteCache.has(speciesName)) {
    frontSpriteCache.set(speciesName, await loadBattleSprite(front, palette));
  }
  if (!backSpriteCache.has(speciesName)) {
    backSpriteCache.set(speciesName, await loadBattleSprite(back, palette));
  }

  return {
    front: frontSpriteCache.get(speciesName)!,
    back: backSpriteCache.get(speciesName)!,
  };
}

// ──────── Text helpers (using font charmap) ────────

function drawChar(ch: string, x: number, y: number): void {
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

function drawText(text: string, x: number, y: number): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * TILE_SIZE, y);
  }
}

// Bottom text box: 6 tiles tall (48px), matching original Gen 1
const BOX_H = 6 * TILE_SIZE; // 48px
const BOX_Y = GB_HEIGHT - BOX_H; // 96

/** Word-wrap a line to fit within maxChars, splitting at spaces. */
function wordWrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const result: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(' ', maxChars);
    if (splitAt <= 0) splitAt = maxChars;
    result.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt + (remaining[splitAt] === ' ' ? 1 : 0));
  }
  if (remaining.length > 0) result.push(remaining);
  return result;
}

/** Draw a bordered box (background + tile border). */
function drawBox(x: number, y: number, wTiles: number, hTiles: number): void {
  fillRect(x, y, wTiles * TILE_SIZE, hTiles * TILE_SIZE, 0);
  drawTileBorder(x, y, wTiles, hTiles);
}

/** Render the text message box at the bottom of the screen. */
export function renderBattleText(lines: string[]): void {
  drawBox(0, BOX_Y, 20, 6);

  const wrapped: string[] = [];
  for (const line of lines) {
    wrapped.push(...wordWrap(line, 18));
  }

  // Text at rows 2 and 4 (matching assembly coord hl, 1, 14 / 1, 16)
  const lineY0 = BOX_Y + TILE_SIZE * 2;
  const lineY1 = BOX_Y + TILE_SIZE * 4;
  if (wrapped[0]) drawText(wrapped[0], TILE_SIZE, lineY0);
  if (wrapped[1]) drawText(wrapped[1], TILE_SIZE, lineY1);
}

/** Create a solid black silhouette of a sprite (non-transparent pixels → black). */
export function createSilhouette(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  const ctx2 = c.getContext('2d')!;
  ctx2.drawImage(sprite, 0, 0);
  ctx2.globalCompositeOperation = 'source-atop';
  ctx2.fillStyle = '#000';
  ctx2.fillRect(0, 0, c.width, c.height);
  return c;
}
