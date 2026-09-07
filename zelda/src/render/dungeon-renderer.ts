// Dungeon room renderer — samples room tiles from dungeons-map.png
// Layout: 16 columns × 16 rows, each room 256×176px.
// Top 8 rows = uw1q1 (rooms 0-127), bottom 8 rows = uw2q1 (rooms 0-127).

import { PLAY_AREA_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../core/constants.js';
import type { DungeonRoomDoors, UniqueRoom } from '../data/dungeon-types.js';
import type { Renderer } from './renderer.js';

const MAP_COLS = 16;
const ROOM_WIDTH = 256;
const ROOM_HEIGHT = 176;
const INNER_COLS = 12;
const INNER_ROWS = 7;
const INNER_OFFSET_COL = 2;
const INNER_OFFSET_ROW = 2;

const CELLAR_BORDER_ROWS = 2;

const CELLAR_TILE_COLORS: Record<number, string> = {
  0: '', // stairs — rendered specially
  1: '#383838', // floor
  2: '#b86820', // wall (passage header)
  3: '#b86820', // wall
};

// Door sprite sheet: 5 cols × 4 rows, each cell 32×32
// Cols: 0=Wall, 1=Open, 2=Locked, 3=Shutter, 4=Hole
// Rows: 0=North, 1=West, 2=East, 3=South
const DOOR_CELL_SIZE = 32;

// Door type constants (matching dungeon-manager.ts)
const DOOR_BOMBABLE = 4;
const DOOR_KEY = 5;
const DOOR_KEY_2 = 6;
const DOOR_SHUTTER = 7;

// Door type → sprite column
function doorTypeToSpriteCol(doorType: number): number {
  switch (doorType) {
    case DOOR_BOMBABLE: return 0; // wall (looks like solid wall)
    case DOOR_KEY:
    case DOOR_KEY_2: return 2;    // locked (keyhole)
    case DOOR_SHUTTER: return 3;  // shutter (bars)
    default: return -1;
  }
}

// Direction → sprite row + play-area position
const DOOR_DIR_INFO = {
  north: { row: 0, x: 112, y: 0, h: DOOR_CELL_SIZE },
  south: { row: 3, x: 112, y: 144, h: DOOR_CELL_SIZE },
  west:  { row: 1, x: 0,   y: 64,  h: 48 },
  east:  { row: 2, x: 224,  y: 64,  h: 48 },
} as const;

export class DungeonRenderer {
  private readonly _mapImage: HTMLImageElement;
  private _doorImage: HTMLImageElement | null = null;

  constructor(mapImage: HTMLImageElement) {
    this._mapImage = mapImage;
  }

  setDoorImage(doorImage: HTMLImageElement): void {
    this._doorImage = doorImage;
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

  maskBakedRoomItem(
    renderer: Renderer,
    roomId: number,
    levelBlock: string,
    uniqueRoom: UniqueRoom,
    itemX: number,
    itemY: number,
  ): void {
    const blockRowOffset = levelBlock === 'uw2q1' ? 8 : 0;
    const mapCol = roomId % MAP_COLS;
    const mapRow = Math.floor(roomId / MAP_COLS) + blockRowOffset;
    const roomSrcX = mapCol * ROOM_WIDTH;
    const roomSrcY = mapRow * ROOM_HEIGHT;

    // The item sprite is 16×16 but may straddle tile boundaries (triforce -8px)
    const startTileCol = Math.floor(itemX / TILE_SIZE);
    const endTileCol = Math.floor((itemX + 15) / TILE_SIZE);
    const startTileRow = Math.floor(itemY / TILE_SIZE);
    const endTileRow = Math.floor((itemY + 15) / TILE_SIZE);

    for (let tr = startTileRow; tr <= endTileRow; tr++) {
      for (let tc = startTileCol; tc <= endTileCol; tc++) {
        const innerR = tr - INNER_OFFSET_ROW;
        const innerC = tc - INNER_OFFSET_COL;
        if (innerR < 0 || innerR >= INNER_ROWS || innerC < 0 || innerC >= INNER_COLS) continue;

        const tileIdx = uniqueRoom.tiles[innerR]?.[innerC];
        if (tileIdx === undefined) continue;

        // Find a matching floor tile as far away as possible
        const donor = this.findDonorTile(uniqueRoom, tileIdx, innerR, innerC);
        if (!donor) continue;

        const donorPixelX = roomSrcX + (donor.col + INNER_OFFSET_COL) * TILE_SIZE;
        const donorPixelY = roomSrcY + (donor.row + INNER_OFFSET_ROW) * TILE_SIZE;

        renderer.drawImage(
          this._mapImage,
          donorPixelX, donorPixelY, TILE_SIZE, TILE_SIZE,
          tc * TILE_SIZE, tr * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }

  private findDonorTile(
    uniqueRoom: UniqueRoom,
    targetIdx: number,
    avoidRow: number,
    avoidCol: number,
  ): { row: number; col: number } | null {
    let best: { row: number; col: number } | null = null;
    let bestDist = -1;
    for (let r = 0; r < INNER_ROWS; r++) {
      const row = uniqueRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < INNER_COLS; c++) {
        if (row[c] !== targetIdx) continue;
        const dist = Math.abs(r - avoidRow) + Math.abs(c - avoidCol);
        if (dist > bestDist) {
          bestDist = dist;
          best = { row: r, col: c };
        }
      }
    }
    return best;
  }

  renderDoorOverlays(
    renderer: Renderer,
    roomId: number,
    levelBlock: string,
    doors: DungeonRoomDoors,
    openedDoors: number,
  ): void {
    const entries: [string, number, number][] = [
      ['north', doors.north, 8],
      ['south', doors.south, 4],
      ['west',  doors.west,  2],
      ['east',  doors.east,  1],
    ];

    for (const [dir, doorType, dirBit] of entries) {
      if (openedDoors & dirBit) continue;
      const spriteCol = doorTypeToSpriteCol(doorType);
      if (spriteCol < 0) continue;

      const info = DOOR_DIR_INFO[dir as keyof typeof DOOR_DIR_INFO];

      if (this._doorImage) {
        const sx = spriteCol * DOOR_CELL_SIZE;
        const sy = info.row * DOOR_CELL_SIZE;
        renderer.drawImage(
          this._doorImage,
          sx, sy, DOOR_CELL_SIZE, DOOR_CELL_SIZE,
          info.x, info.y, DOOR_CELL_SIZE, DOOR_CELL_SIZE,
        );
      }

      // E/W doors span 3 tile rows (48px) but sprite cell is 32px.
      // Cover the remaining tile row by sampling wall from the room border.
      if (info.h > DOOR_CELL_SIZE) {
        const blockRowOffset = levelBlock === 'uw2q1' ? 8 : 0;
        const mapCol = roomId % MAP_COLS;
        const mapRow = Math.floor(roomId / MAP_COLS) + blockRowOffset;
        const roomSrcX = mapCol * ROOM_WIDTH;
        const roomSrcY = mapRow * ROOM_HEIGHT;

        // Sample a wall tile from the corner of the same border
        const wallSrcX = roomSrcX + (dir === 'west' ? 0 : 14 * TILE_SIZE);
        const wallSrcY = roomSrcY; // top row is always wall
        const extraY = info.y + DOOR_CELL_SIZE;
        for (let c = 0; c < 2; c++) {
          renderer.drawImage(
            this._mapImage,
            wallSrcX + c * TILE_SIZE, wallSrcY, TILE_SIZE, TILE_SIZE,
            info.x + c * TILE_SIZE, extraY, TILE_SIZE, TILE_SIZE,
          );
        }
      }
    }
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
