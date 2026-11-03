// Battle screen rendering using actual game tile assets
// Layout (160x144):
//   Enemy HUD (top-left) | Enemy sprite (top-right)
//   Player sprite (bottom-left) | Player HUD (bottom-right)
//   Text/Menu box (bottom 6 tiles)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from '../core';
import { getCtx, getScale, fillRect, loadBattleSprite, loadTileset, loadFont, drawTile, getMonsterPalette } from '../renderer';
import { charToTile, drawTileBorder } from '../text';
import type { BattlePokemon } from './types';
import { type ItemStack, getItemName } from '../items';

let fontCanvas: HTMLCanvasElement | null = null;

// Battle HUD tilesets
let hpBarGreen: HTMLCanvasElement | null = null;
let hpBarYellow: HTMLCanvasElement | null = null;
let hpBarRed: HTMLCanvasElement | null = null;
let hudTiles1: HTMLCanvasElement | null = null;  // battle_hud_1.png (1bpp → black on transparent)
let hudTiles2: HTMLCanvasElement | null = null;  // battle_hud_2.png
let hudTiles3: HTMLCanvasElement | null = null;  // balls.png (4 tiles: healthy, status, fainted, empty)

// Tile indices in font_battle_extra.png (loaded at VRAM $62)
// PNG is 15 tiles/row × 2 rows = 30 tiles
const HP_LEFT_BRACKET = 0;  // VRAM $62
const HP_EMPTY = 1;         // VRAM $63
// Partial fill: HP_EMPTY + pixels (1-7) → tiles 2-8 ($64-$6A)
const HP_FULL = 9;          // VRAM $6B (8 pixels filled)
const HP_LABEL = 15;        // VRAM $71 ("HP:" label, row 1 col 0)

// Tile indices in battle_hud_1.png (3 tiles)
const HUD1_RIGHT_BRACKET = 0; // VRAM $6D
const HUD1_LEVEL = 1;    // VRAM $6F

// Tile indices in battle_hud_2.png (3 tiles)
const HUD2_CORNER = 0;        // VRAM $73
const HUD2_ENEMY_CORNER = 1;  // VRAM $74

// Tile indices in battle_hud_3.png (3 tiles)
const HUD3_SEPARATOR = 0; // VRAM $77
const HUD3_ENEMY_TRI = 2;    // Empty slot (no mon in party slot)

// Sprite caches
const frontSpriteCache = new Map<string, HTMLCanvasElement>();
const backSpriteCache = new Map<string, HTMLCanvasElement>();

export async function initBattleUI(font: HTMLCanvasElement): Promise<void> {
  fontCanvas = font;
  // Load HP bar tilesets with 3 color palettes
  [hpBarGreen, hpBarYellow, hpBarRed] = await Promise.all([
    loadTileset('/gfx/font/font_battle_extra.png', 'GREENBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'YELLOWBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'REDBAR'),
  ]);
  // Load 1bpp HUD border tiles as font (black on transparent).
  [hudTiles1, hudTiles2, hudTiles3] = await Promise.all([
    loadFont('/gfx/battle/battle_hud_1.png'),
    loadFont('/gfx/battle/battle_hud_2.png'),
    loadFont('/gfx/battle/battle_hud_3.png'),
  ]);
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

// ──────── HP bar (tile-based, matching assembly DrawHPBar) ────────

function getHpBarTileset(ratio: number): HTMLCanvasElement {
  if (ratio > 0.5) return hpBarGreen!;
  if (ratio > 0.25) return hpBarYellow!;
  return hpBarRed!;
}

/**
 * Draw a tile-based HP bar matching the original Game Boy rendering.
 * x, y = pixel position of the HP: label tile.
 * barTiles = number of fill segments (6 for battle HUD).
 *
 * Layout: [HP: label] [left bracket] [fill × barTiles] [right bracket]
 * Assembly: tile $71, $62, d×(fill), $6D
 */
function drawHpBar(x: number, y: number, currentHp: number, maxHp: number, barTiles: number = 6, isEnemy: boolean = false): void {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  const pixels = maxHp > 0 ? Math.ceil(currentHp * (barTiles * 8) / maxHp) : 0;
  const tileset = getHpBarTileset(ratio);
  if (!tileset) return;

  // HP: label tile (font_battle_extra tile 15 = VRAM $71)
  drawTile(tileset, HP_LABEL, x, y);

  // Left bracket (font_battle_extra tile 0 = VRAM $62)
  drawTile(tileset, HP_LEFT_BRACKET, x + TILE_SIZE, y);

  // Bar fill segments
  let remaining = pixels;
  for (let i = 0; i < barTiles; i++) {
    let tileIdx: number;
    if (remaining >= 8) {
      tileIdx = HP_FULL;
      remaining -= 8;
    } else if (remaining > 0) {
      tileIdx = HP_EMPTY + remaining; // partial: $63 + pixels = tiles 2-8
      remaining = 0;
    } else {
      tileIdx = HP_EMPTY;
    }
    drawTile(tileset, tileIdx, x + (2 + i) * TILE_SIZE, y);
  }

  // Right bracket: enemy uses font_battle_extra tile 10 ($6C, colored),
  // player uses battle_hud_1 tile 0 ($6D, 1bpp black on transparent)
  if (isEnemy) {
    drawTile(tileset, 10, x + (2 + barTiles) * TILE_SIZE, y);
  } else if (hudTiles1) {
    drawTile(hudTiles1, HUD1_RIGHT_BRACKET, x + (2 + barTiles) * TILE_SIZE, y);
  }
}

// ──────── Main render functions ────────

/** Render the full battle screen background (clear to white). */
export function renderBattleBg(): void {
  fillRect(0, 0, GB_WIDTH, GB_HEIGHT, 0);
}

/** Render the enemy Pokemon's front sprite. */
export function renderEnemySprite(sprite: HTMLCanvasElement, xOffset = 0): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const x = GB_WIDTH - spriteW - 8 + xOffset;
  // Bottom-aligned to the 7×7 tile block (rows 0-6, bottom at y=56)
  const y = 56 - spriteH;
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, spriteW * s, spriteH * s);
}

/** Render the player's Pokemon back sprite (scaled 2x since back sprites are 32x32). */
export function renderPlayerSprite(sprite: HTMLCanvasElement, xOffset = 0): void {
  const ctx = getCtx();
  const s = getScale();
  const spriteW = sprite.width;
  const spriteH = sprite.height;
  const displayW = spriteW * 2;
  const displayH = spriteH * 2;
  const x = 8 + xOffset;
  // Match original: 32×32 sprite sits at bottom of 7×7 block (row 5-11, y=40-96).
  // At 2x scale (64px), offset down 8px so visual center matches original.
  const y = BOX_Y - displayH + 8;
  ctx.drawImage(sprite, 0, 0, spriteW, spriteH, x * s, y * s, displayW * s, displayH * s);
}

/**
 * Render the enemy HUD using actual game tile assets.
 * Matches assembly DrawEnemyHUDAndHPBar + PlaceEnemyHUDTiles layout:
 *   Row 0 (y=0):  Name at col 1
 *   Row 1 (y=8):  Status or :L+level at col 4
 *   Row 2 (y=16): Corner at col 1, HP bar at col 2
 *   Row 3 (y=24): Corner at col 1, separator ×8, triangle at col 10
 */
export function renderEnemyHUD(pokemon: BattlePokemon, displayHp: number): void {
  const hudW = 12 * TILE_SIZE; // 96px, cols 0-11

  // Clear HUD area
  fillRect(0, 0, hudW, TILE_SIZE * 4, 0);

  // Row 0: Name at (col 1, row 0) = (8, 0)
  drawText(pokemon.nickname.toUpperCase(), TILE_SIZE, 0);

  // Row 1: Status or level at (col 4, row 1) = (32, 8)
  if (pokemon.status) {
    // Status condition at col 5 (assembly: inc hl from col 4)
    drawText(pokemon.status, TILE_SIZE * 5, TILE_SIZE);
  } else {
    // :L tile at col 4, level digits at col 5+
    if (hudTiles1) {
      drawTile(hudTiles1, HUD1_LEVEL, TILE_SIZE * 4, TILE_SIZE);
    }
    drawText(String(pokemon.level), TILE_SIZE * 5, TILE_SIZE);
  }

  // Row 2: HUD corner + HP bar
  if (hudTiles2) {
    drawTile(hudTiles2, HUD2_CORNER, TILE_SIZE, TILE_SIZE * 2);
  }
  // HP bar at (col 2, row 2) = (16, 16), 6 fill tiles
  drawHpBar(TILE_SIZE * 2, TILE_SIZE * 2, displayHp, pokemon.maxHp, 6, true);

  // Row 3: Bottom border with separator tiles
  if (hudTiles2 && hudTiles3) {
    drawTile(hudTiles2, HUD2_ENEMY_CORNER, TILE_SIZE, TILE_SIZE * 3);
    for (let i = 0; i < 8; i++) {
      drawTile(hudTiles3, HUD3_SEPARATOR, TILE_SIZE * (2 + i), TILE_SIZE * 3);
    }
    drawTile(hudTiles3, HUD3_ENEMY_TRI, TILE_SIZE * 10, TILE_SIZE * 3);
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

/** Render the action menu (FIGHT / PKMN / ITEM / RUN) with cursor. */
export function renderActionMenu(cursorIndex: number): void {
  // Full-width empty textbox behind the action menu
  drawBox(0, BOX_Y, 20, 6);
  // Smaller action menu box overlaid on the right (tiles 8-19, matching assembly)
  drawBox(TILE_SIZE * 8, BOX_Y, 12, 6);

  const PKMN = '\uE001\uE002'; // <PK><MN> compact glyphs
  const items = ['FIGHT', PKMN, 'ITEM', 'RUN'];
  // Assembly positions: text at (10,14)/(16,14)/(10,16)/(16,16)
  const col0X = TILE_SIZE * 10;
  const col1X = TILE_SIZE * 16;
  const row0Y = BOX_Y + TILE_SIZE * 2;
  const row1Y = BOX_Y + TILE_SIZE * 4;

  // Cursor positions: col 9 (left) and col 15 (right)
  const curCol0X = TILE_SIZE * 9;
  const curCol1X = TILE_SIZE * 15;

  const positions = [
    { x: col0X, y: row0Y, curX: curCol0X },
    { x: col1X, y: row0Y, curX: curCol1X },
    { x: col0X, y: row1Y, curX: curCol0X },
    { x: col1X, y: row1Y, curX: curCol1X },
  ];

  for (let i = 0; i < items.length; i++) {
    drawText(items[i], positions[i].x, positions[i].y);
  }

  const cp = positions[cursorIndex];
  drawText('\u25B6', cp.curX, cp.y);
}

/** Render the item selection menu with cursor.
 *  Assembly layout: item list box at (4,2)→(19,12), textbox at (0,12)→(19,17).
 *  cursorIndex ranges 0..items.length where items.length = CANCEL.
 *  showCursor: false for the catch demo's list before its simulated cursor (V1d). */
export function renderItemMenu(items: ItemStack[], cursorIndex: number, showCursor = true): void {
  // Empty textbox at the bottom
  drawBox(0, BOX_Y, 20, 6);
  // Item list box (assembly: LIST_MENU_BOX 4,2,19,12 → 16 wide × 11 tall)
  const listX = TILE_SIZE * 4;
  const listY = TILE_SIZE * 2;
  drawBox(listX, listY, 16, 11);

  // Total entries = items + CANCEL
  const totalEntries = items.length + 1;
  // Show up to 4 entries at a time (rows 4, 6, 8, 10 in tile coords)
  const maxVisible = 4;
  const scrollOffset = Math.max(0, Math.min(cursorIndex - (maxVisible - 1), totalEntries - maxVisible));

  for (let i = 0; i < maxVisible; i++) {
    const entryIdx = scrollOffset + i;
    if (entryIdx >= totalEntries) break;
    const row = 4 + i * 2; // tile rows: 4, 6, 8, 10
    const my = row * TILE_SIZE;
    const mx = TILE_SIZE * 6; // col 6

    if (entryIdx < items.length) {
      const item = items[entryIdx];
      drawText(getItemName(item.id).substring(0, 12), mx, my);
      // "×count" right-aligned (assembly uses ×)
      const qtyText = '\u00D7' + String(item.count).padStart(2, ' ');
      drawText(qtyText, TILE_SIZE * 16, my);
    } else {
      drawText('CANCEL', mx, my);
    }
  }

  // Cursor at col 5
  if (!showCursor) return;
  const cursorVisIdx = cursorIndex - scrollOffset;
  const cursorRow = 4 + cursorVisIdx * 2;
  drawText('\u25B6', TILE_SIZE * 5, cursorRow * TILE_SIZE);
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
