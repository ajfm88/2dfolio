// Logical wTileMap glyphs whose pictures come from non-font sheets.
import { loadFont, loadTileset } from '../renderer';

export const LEVEL_GLYPH = '\uE003';    // <LV>, VRAM $6e
export const POKEBALL_GLYPH = '\uE004'; // VRAM $78 in Bill's PC
export const TIME_COLON_GLYPH = '\uE005'; // <COLON>, VRAM $6d (font_extra tile 13)

let levelSheet: HTMLCanvasElement | null = null;
let ballSheet: HTMLCanvasElement | null = null;

/** Reload with the text border after a map-palette change. The ball is 2bpp,
 * including both middle shades, so it must not go through the 1bpp font loader. */
export async function loadMenuGlyphs(): Promise<void> {
  [levelSheet, ballSheet] = await Promise.all([
    levelSheet ?? loadFont('/gfx/battle/battle_hud_1.png'),
    loadTileset('/gfx/battle/balls.png'),
  ]);
}

export function menuGlyph(glyph: string): { sheet: HTMLCanvasElement; tile: number } | null {
  if (glyph === LEVEL_GLYPH && levelSheet) return { sheet: levelSheet, tile: 1 };
  if (glyph === POKEBALL_GLYPH && ballSheet) return { sheet: ballSheet, tile: 0 };
  return null;
}
