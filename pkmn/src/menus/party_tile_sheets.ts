// Palette-aware HP/status sheets shared by party drawing and retained cells.
import { loadTileset, loadFont } from '../renderer';

// Loaded tilesets (shared across instances, loaded once)
let hpBarGreen: HTMLCanvasElement | null = null;
let hpBarYellow: HTMLCanvasElement | null = null;
let hpBarRed: HTMLCanvasElement | null = null;
let hudTiles1: HTMLCanvasElement | null = null;
let hudTiles2: HTMLCanvasElement | null = null; // battle_hud_2: │ vertical line
let hudTiles3: HTMLCanvasElement | null = null; // battle_hud_3: ─ horizontal + ┘ corner
let tilesLoading: Promise<void> | null = null;

export function loadPartyTiles(): Promise<void> {
  if (tilesLoading) return tilesLoading;
  tilesLoading = (async () => {
    [hpBarGreen, hpBarYellow, hpBarRed, hudTiles1, hudTiles2, hudTiles3] = await Promise.all([
      loadTileset('/gfx/font/font_battle_extra.png', 'GREENBAR'),
      loadTileset('/gfx/font/font_battle_extra.png', 'YELLOWBAR'),
      loadTileset('/gfx/font/font_battle_extra.png', 'REDBAR'),
      loadFont('/gfx/battle/battle_hud_1.png'),
      loadFont('/gfx/battle/battle_hud_2.png'), // 1bpp: │
      loadFont('/gfx/battle/battle_hud_3.png'), // 1bpp: ─ ┘
    ]);
  })();
  return tilesLoading;
}

/** Shared sheets for retained StatusScreen cells; no free drawing or extra loads. */
export function partyTileSheets(color: 'green' | 'yellow' | 'red') {
  return { hp: color === 'green' ? hpBarGreen : color === 'yellow' ? hpBarYellow : hpBarRed,
    hud1: hudTiles1, hud2: hudTiles2, hud3: hudTiles3 };
}
