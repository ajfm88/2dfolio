import { TILE_SIZE, TILES_X, TILES_Y } from '../core/constants.js';
import {
  SQUARE_INDEX_CAVE_ENTRANCE,
  SQUARE_INDEX_STAIRS,
} from '../data/secret-types.js';
import type { OverworldData, OverworldScreen } from '../data/overworld-types.js';
import type { Renderer } from './renderer.js';

const MAP_SCREEN_WIDTH = 256;
const MAP_SCREEN_HEIGHT = 176;
const MAP_COLS = 16;
const MAP_ROWS = 8;

// Reference screen for sampling replacement tiles from the map image.
// Screen (7,7) = id 119 has a visible cave entrance.
const CAVE_REF_SCREEN_ROW = 7;
const CAVE_REF_SCREEN_COL = 7;
const CAVE_REF_TILE_ROW = 3;
const CAVE_REF_TILE_COL = 7;

export class TileRenderer {
  private mapImage: HTMLImageElement | null = null;

  init(mapImage: HTMLImageElement): void {
    this.mapImage = mapImage;
  }

  renderScreen(
    renderer: Renderer,
    screen: OverworldScreen,
    tileOverrides?: ReadonlyMap<number, number>,
  ): void {
    if (!this.mapImage) return;

    const baseX = screen.col * MAP_SCREEN_WIDTH;
    const baseY = screen.row * MAP_SCREEN_HEIGHT;

    for (let row = 0; row < TILES_Y; row++) {
      const rowData = screen.tiles[row];
      if (!rowData) continue;
      const srcY = baseY + row * TILE_SIZE;
      for (let col = 0; col < TILES_X; col++) {
        if (rowData[col] === undefined) continue;

        const gridIdx = row * TILES_X + col;
        const override = tileOverrides?.get(gridIdx);

        if (override !== undefined) {
          this.renderOverrideTile(renderer, col, row, override, screen);
        } else {
          const srcX = baseX + col * TILE_SIZE;
          renderer.drawImage(
            this.mapImage,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
          );
        }
      }
    }
  }

  private renderOverrideTile(
    renderer: Renderer,
    col: number,
    row: number,
    squareIndex: number,
    screen: OverworldScreen,
  ): void {
    const dx = col * TILE_SIZE;
    const dy = row * TILE_SIZE;

    if (squareIndex === SQUARE_INDEX_CAVE_ENTRANCE) {
      // Cave entrance — sample from reference screen's cave tile
      if (this.mapImage) {
        const refSrcX = CAVE_REF_SCREEN_COL * MAP_SCREEN_WIDTH + CAVE_REF_TILE_COL * TILE_SIZE;
        const refSrcY = CAVE_REF_SCREEN_ROW * MAP_SCREEN_HEIGHT + CAVE_REF_TILE_ROW * TILE_SIZE;
        renderer.drawImage(
          this.mapImage,
          refSrcX, refSrcY, TILE_SIZE, TILE_SIZE,
          dx, dy, TILE_SIZE, TILE_SIZE,
        );
      }
    } else if (squareIndex === SQUARE_INDEX_STAIRS) {
      this.renderStairsTile(renderer, dx, dy);
    } else {
      // Generic override — re-render original tile from the map
      const srcX = screen.col * MAP_SCREEN_WIDTH + col * TILE_SIZE;
      const srcY = screen.row * MAP_SCREEN_HEIGHT + row * TILE_SIZE;
      if (this.mapImage) {
        renderer.drawImage(
          this.mapImage,
          srcX, srcY, TILE_SIZE, TILE_SIZE,
          dx, dy, TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }

  private renderStairsTile(renderer: Renderer, dx: number, dy: number): void {
    const ctx = renderer.ctx;
    // NES stairs: alternating dark/light horizontal stripes
    ctx.fillStyle = '#000000';
    ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#b86820';
    for (let sy = 0; sy < TILE_SIZE; sy += 4) {
      ctx.fillRect(dx, dy + sy, TILE_SIZE, 2);
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
