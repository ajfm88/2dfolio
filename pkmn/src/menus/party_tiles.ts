// Shared party/status graphic tiles; established drawing behavior is unchanged.
import { TILE_SIZE } from '../core';
import { drawTile } from '../renderer';
import { partyTileSheets } from './party_tile_sheets';
export { loadPartyTiles } from './party_tile_sheets';
import { drawText } from './menu_render';
import { hpBarColor, staticHpBarPixels } from './hp_bar';

// Tile indices in font_battle_extra.png
const HP_LEFT_BRACKET = 0;  // VRAM $62
const HP_EMPTY = 1;          // VRAM $63
const HP_FULL = 9;           // VRAM $6B (8 pixels filled)
const HP_RIGHT_BRACKET = 10; // VRAM $6C (right bracket for party menu)
const HP_LABEL = 15;         // VRAM $71 ("HP:" label)
// Tile indices in battle_hud_1.png
const HUD1_LEVEL = 1;         // VRAM $6E (":L" combined glyph)
function getHpBarTileset(pixels: number): HTMLCanvasElement | null {
  return partyTileSheets(hpBarColor(pixels)).hp;
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

/** Draw the :L level indicator using the special combined tile + digits. */
export function drawLevel(level: number, x: number, y: number): void {
  const hudTiles1 = partyTileSheets('green').hud1;
  if (hudTiles1) {
    drawTile(hudTiles1, HUD1_LEVEL, x, y);
  }
  drawText(String(level), x + TILE_SIZE, y);
}
