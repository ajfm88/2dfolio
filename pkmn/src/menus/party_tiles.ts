// Shared party/status graphic tiles; established drawing behavior is unchanged.
import { TILE_SIZE } from '../core';
import { loadTileset, loadFont, drawTile } from '../renderer';
import { drawText } from './menu_render';
import { hpBarColor, staticHpBarPixels } from './hp_bar';

// Tile indices in font_battle_extra.png
const HP_LEFT_BRACKET = 0;  // VRAM $62
const HP_EMPTY = 1;          // VRAM $63
const HP_FULL = 9;           // VRAM $6B (8 pixels filled)
const HP_RIGHT_BRACKET = 10; // VRAM $6C (right bracket for party menu)
const HP_LABEL = 15;         // VRAM $71 ("HP:" label)
const NARROW_TO = 14;        // VRAM $70 — narrow "to" character (single tile)
// Tile indices in battle_hud_1.png
const HUD1_LEVEL = 1;         // VRAM $6E (":L" combined glyph)
// DrawLineBox tiles — loaded from separate 1bpp assets (NOT font_battle_extra)
// Status screen loads: battle_hud_2 tile 0 → $78 (│), battle_hud_3 tiles 0-1 → $76-$77 (─ ┘)
const LINE_V_IDX = 0;         // │ tile 0 in battle_hud_2.png
const LINE_H_IDX = 0;         // ─ tile 0 in battle_hud_3.png
const LINE_BR_IDX = 1;        // ┘ tile 1 in battle_hud_3.png
const LINE_HALFARROW_IDX = 2; // ← tile 2 in battle_hud_1.png

// Loaded tilesets (shared across instances, loaded once)
let hpBarGreen: HTMLCanvasElement | null = null;
let hpBarYellow: HTMLCanvasElement | null = null;
let hpBarRed: HTMLCanvasElement | null = null;
let hudTiles1: HTMLCanvasElement | null = null;
let hudTiles2: HTMLCanvasElement | null = null; // battle_hud_2: │ vertical line
let hudTiles3: HTMLCanvasElement | null = null; // battle_hud_3: ─ horizontal + ┘ corner
let fontBattleExtra: HTMLCanvasElement | null = null; // font_battle_extra as font (for narrow "to" etc.)
let tilesLoading = false;

export async function loadPartyTiles(): Promise<void> {
  if (tilesLoading || hpBarGreen) return;
  tilesLoading = true;
  [hpBarGreen, hpBarYellow, hpBarRed, hudTiles1, hudTiles2, hudTiles3, fontBattleExtra] = await Promise.all([
    loadTileset('/gfx/font/font_battle_extra.png', 'GREENBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'YELLOWBAR'),
    loadTileset('/gfx/font/font_battle_extra.png', 'REDBAR'),
    loadFont('/gfx/battle/battle_hud_1.png'),
    loadFont('/gfx/battle/battle_hud_2.png'), // 1bpp: │
    loadFont('/gfx/battle/battle_hud_3.png'), // 1bpp: ─ ┘
    loadFont('/gfx/font/font_battle_extra.png'), // for text tiles: narrow "to", etc.
  ]);
}

function getHpBarTileset(pixels: number): HTMLCanvasElement | null {
  const color = hpBarColor(pixels);
  if (color === 'green') return hpBarGreen;
  if (color === 'yellow') return hpBarYellow;
  return hpBarRed;
}

/** Draw tile-based HP bar: [HP: label] [bracket] [6 fills] [bracket] */
export function drawTileHpBar(
  x: number, y: number, currentHp: number, maxHp: number,
  pixels = staticHpBarPixels(currentHp, maxHp),
  colorPixels = pixels,
): void {
  const barTiles = 6;
  // The color is a palette set when the menu is drawn (SetPartyMenuHPBarColor), so an
  // animated bar keeps the color of its last static draw.
  const tileset = getHpBarTileset(colorPixels);
  if (!tileset) return;

  // HP: label tile
  drawTile(tileset, HP_LABEL, x, y);
  // Left bracket
  drawTile(tileset, HP_LEFT_BRACKET, x + TILE_SIZE, y);
  // Fill segments
  let remaining = pixels;
  for (let i = 0; i < barTiles; i++) {
    let tileIdx: number;
    if (remaining >= 8) {
      tileIdx = HP_FULL;
      remaining -= 8;
    } else if (remaining > 0) {
      tileIdx = HP_EMPTY + remaining; // partial fill tiles 2-8
      remaining = 0;
    } else {
      tileIdx = HP_EMPTY;
    }
    drawTile(tileset, tileIdx, x + (2 + i) * TILE_SIZE, y);
  }
  // Right bracket (font_battle_extra tile 10 = VRAM $6C, party menu variant)
  drawTile(tileset, HP_RIGHT_BRACKET, x + (2 + barTiles) * TILE_SIZE, y);
}

/** Assembly DrawLineBox: vertical │ down from (col, row) for height tiles,
 *  then ┘ corner, then horizontal ─ going left for width tiles, then ← halfarrow. */
export function drawLineBox(col: number, row: number, height: number, width: number): void {
  if (!hudTiles2 || !hudTiles3) return;
  const T = TILE_SIZE;
  // Vertical line going down (│ from battle_hud_2)
  for (let r = 0; r < height; r++) {
    drawTile(hudTiles2, LINE_V_IDX, col * T, (row + r) * T);
  }
  // Bottom-right corner (┘ from battle_hud_3)
  drawTile(hudTiles3, LINE_BR_IDX, col * T, (row + height) * T);
  // Horizontal line going left (─ from battle_hud_3)
  for (let c = 1; c <= width; c++) {
    drawTile(hudTiles3, LINE_H_IDX, (col - c) * T, (row + height) * T);
  }
  // Halfarrow ending (← from battle_hud_1)
  if (hudTiles1) {
    drawTile(hudTiles1, LINE_HALFARROW_IDX, (col - width - 1) * T, (row + height) * T);
  }
}

/** Draw the :L level indicator using the special combined tile + digits. */
export function drawLevel(level: number, x: number, y: number): void {
  if (hudTiles1) {
    drawTile(hudTiles1, HUD1_LEVEL, x, y);
  }
  drawText(String(level), x + TILE_SIZE, y);
}


export function drawNarrowTo(x: number, y: number): void {
  if (fontBattleExtra) drawTile(fontBattleExtra, NARROW_TO, x, y);
}
