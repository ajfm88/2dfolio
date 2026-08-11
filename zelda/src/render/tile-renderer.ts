import { TILE_SIZE, TILES_X, TILES_Y } from '../core/constants.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';
import type { Renderer } from './renderer.js';

const MAP_SCREEN_WIDTH = 256;
const MAP_SCREEN_HEIGHT = 176;
const MAP_COLS = 16;
const MAP_ROWS = 8;

export class TileRenderer {
  private mapImage: HTMLImageElement | null = null;

  init(mapImage: HTMLImageElement): void {
    this.mapImage = mapImage;
  }

  renderScreen(renderer: Renderer, screen: OverworldScreen): void {
    if (!this.mapImage) return;

    const baseX = screen.col * MAP_SCREEN_WIDTH;
    const baseY = screen.row * MAP_SCREEN_HEIGHT;

    for (let row = 0; row < TILES_Y; row++) {
      const rowData = screen.tiles[row];
      if (!rowData) continue;
      const srcY = baseY + row * TILE_SIZE;
      for (let col = 0; col < TILES_X; col++) {
        if (rowData[col] === undefined) continue;
        const srcX = baseX + col * TILE_SIZE;
        renderer.drawImage(
          this.mapImage,
          srcX, srcY, TILE_SIZE, TILE_SIZE,
          col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }

  get isReady(): boolean {
    return this.mapImage !== null;
  }
}

export function getScreenByCoord(
  data: OverworldData,
  row: number,
  col: number,
): OverworldScreen | undefined {
  const wrappedRow = ((row % MAP_ROWS) + MAP_ROWS) % MAP_ROWS;
  const wrappedCol = ((col % MAP_COLS) + MAP_COLS) % MAP_COLS;
  const id = wrappedRow * MAP_COLS + wrappedCol;
  return data.screens.find((s) => s.id === id);
}
