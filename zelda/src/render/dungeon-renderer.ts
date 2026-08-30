// Dungeon room renderer — samples room tiles from dungeons-map.png
// Layout: 16 columns × 16 rows, each room 256×176px.
// Top 8 rows = uw1q1 (rooms 0-127), bottom 8 rows = uw2q1 (rooms 0-127).

import { PLAY_AREA_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../core/constants.js';
import type { UniqueRoom } from '../data/dungeon-types.js';
import type { Renderer } from './renderer.js';

const MAP_COLS = 16;
const ROOM_WIDTH = 256;
const ROOM_HEIGHT = 176;

const CELLAR_BORDER_ROWS = 2;

const CELLAR_TILE_COLORS: Record<number, string> = {
  0: '', // stairs — rendered specially
  1: '#383838', // floor
  2: '#b86820', // wall (passage header)
  3: '#b86820', // wall
};

export class DungeonRenderer {
  private readonly _mapImage: HTMLImageElement;

  constructor(mapImage: HTMLImageElement) {
    this._mapImage = mapImage;
  }

  renderRoom(
    renderer: Renderer,
    roomId: number,
    levelBlock: string,
  ): void {
    const blockRowOffset = levelBlock === 'uw2q1' ? 8 : 0;
    const mapCol = roomId % MAP_COLS;
    const mapRow = Math.floor(roomId / MAP_COLS) + blockRowOffset;

    const srcX = mapCol * ROOM_WIDTH;
    const srcY = mapRow * ROOM_HEIGHT;

    renderer.drawImage(
      this._mapImage,
      srcX, srcY, ROOM_WIDTH, ROOM_HEIGHT,
      0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT,
    );
  }

  renderCellarRoom(
    renderer: Renderer,
    cellarRoom: UniqueRoom,
    _squareTable: readonly number[],
  ): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);

    ctx.fillStyle = '#b86820';
    for (let c = 0; c < 16; c++) {
      ctx.fillRect(c * TILE_SIZE, 0, TILE_SIZE, CELLAR_BORDER_ROWS * TILE_SIZE);
      ctx.fillRect(c * TILE_SIZE, (CELLAR_BORDER_ROWS + cellarRoom.tiles.length) * TILE_SIZE, TILE_SIZE, CELLAR_BORDER_ROWS * TILE_SIZE);
    }

    for (let r = 0; r < cellarRoom.tiles.length; r++) {
      const row = cellarRoom.tiles[r];
      if (!row) continue;
      const dy = (r + CELLAR_BORDER_ROWS) * TILE_SIZE;
      for (let c = 0; c < row.length; c++) {
        const tileIdx = row[c]!;
        const dx = c * TILE_SIZE;
        if (tileIdx === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#b86820';
          for (let sy = 0; sy < TILE_SIZE; sy += 4) {
            ctx.fillRect(dx, dy + sy, TILE_SIZE, 2);
          }
        } else {
          ctx.fillStyle = CELLAR_TILE_COLORS[tileIdx] ?? '#b86820';
          ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }
}
