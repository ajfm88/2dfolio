// Logical wTileMap glyphs whose pictures come from non-font sheets.
import { loadFont, loadTileset } from '../renderer';
import { loadPartyTiles, partyTileSheets } from './party_tile_sheets';
import type { HpBarColor } from './hp_bar';

export * from './menu_glyph_ids';
import { LEVEL_GLYPH, POKEBALL_GLYPH, BOLD_P_GLYPH, HP_GLYPH, HP_LEFT_GLYPH, TO_GLYPH,
  ID_GLYPH, NUMBER_GLYPH, HP_FILL_GLYPHS, HP_END_GLYPH, HALF_ARROW_GLYPH, LINE_V_GLYPH,
  LINE_H_GLYPH, LINE_CORNER_GLYPH } from './menu_glyph_ids';

let levelSheet: HTMLCanvasElement | null = null;
let ballSheet: HTMLCanvasElement | null = null;
let boldPSheet: HTMLCanvasElement | null = null;

export async function loadStatusGlyphs(): Promise<void> {
  await Promise.all([loadPartyTiles(), (async () => { boldPSheet = await loadFont('/gfx/font/P.png'); })()]);
}

/** Reload with the text border after a map-palette change. The ball is 2bpp,
 * including both middle shades, so it must not go through the 1bpp font loader. */
export async function loadMenuGlyphs(): Promise<void> {
  [levelSheet, ballSheet] = await Promise.all([
    levelSheet ?? loadFont('/gfx/battle/battle_hud_1.png'),
    loadTileset('/gfx/battle/balls.png'),
  ]);
}

export function menuGlyph(glyph: string, color: HpBarColor = 'green'): { sheet: HTMLCanvasElement; tile: number } | null {
  if (glyph === LEVEL_GLYPH && levelSheet) return { sheet: levelSheet, tile: 1 };
  if (glyph === POKEBALL_GLYPH && ballSheet) return { sheet: ballSheet, tile: 0 };
  if (glyph === BOLD_P_GLYPH && boldPSheet) return { sheet: boldPSheet, tile: 0 };
  const sheets = partyTileSheets(color);
  const hp = glyph === HP_GLYPH ? 15 : glyph === HP_LEFT_GLYPH ? 0 : glyph === TO_GLYPH ? 14
    : glyph === ID_GLYPH ? 17 : glyph === NUMBER_GLYPH ? 18
    : HP_FILL_GLYPHS.includes(glyph) ? HP_FILL_GLYPHS.indexOf(glyph) + 1 : -1;
  if (hp >= 0 && sheets.hp) return { sheet: sheets.hp, tile: hp };
  if (glyph === HP_END_GLYPH && sheets.hud1) return { sheet: sheets.hud1, tile: 0 };
  if (glyph === HALF_ARROW_GLYPH && sheets.hud1) return { sheet: sheets.hud1, tile: 2 };
  if (glyph === LINE_V_GLYPH && sheets.hud2) return { sheet: sheets.hud2, tile: 0 };
  if (glyph === LINE_H_GLYPH && sheets.hud3) return { sheet: sheets.hud3, tile: 0 };
  if (glyph === LINE_CORNER_GLYPH && sheets.hud3) return { sheet: sheets.hud3, tile: 1 };
  return null;
}
