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
// dungeons-map.png often paints the item one tile off the NES slot
// (L1 boss heart is at tile 13,5 while GetShortcutOrItemXY is 12,5).
const ITEM_MASK_PAD = TILE_SIZE;

/** Play-area tile range covered when masking a baked-in room item. */
export function itemMaskTileRange(
  itemX: number,
  itemY: number,
): { startCol: number; endCol: number; startRow: number; endRow: number } {
  return {
    startCol: Math.floor((itemX - ITEM_MASK_PAD) / TILE_SIZE),
    endCol: Math.floor((itemX + 15 + ITEM_MASK_PAD) / TILE_SIZE),
    startRow: Math.floor((itemY - ITEM_MASK_PAD) / TILE_SIZE),
    endRow: Math.floor((itemY + 15 + ITEM_MASK_PAD) / TILE_SIZE),
  };
}

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

// Door type → sprite column on dungeon-doors.png.
// Closed: cover the map's explored-state blit. Open: dungeons-map.png paints
// some shutters already closed (L1 room 82 east), so skipping the overlay
// leaves a closed door — draw the open/hole column instead.
export function doorOverlaySpriteCol(doorType: number, opened: boolean): number {
  switch (doorType) {
    case DOOR_BOMBABLE:
      return opened ? 4 : 0; // hole / wall
    case DOOR_KEY:
    case DOOR_KEY_2:
    case DOOR_SHUTTER:
      // Map already paints these closed (L1 room 82 east shutter, 66 west
      // shutter, 115 north key, …). Overlaying the 32×32 sheet cell on that
      // doorway looks like a second, misaligned door. Only blit the open
      // graphic after the door is actually opened.
      return opened ? 1 : -1;
    default:
      return -1;
  }
}

export type DoorDir = 'north' | 'south' | 'west' | 'east';

// Play-area rectangle covering a doorway (E/W are 2×3 tiles, N/S 2×2).
export const DOOR_SLOTS: Record<DoorDir, { x: number; y: number; w: number; h: number }> = {
  north: { x: 112, y: 0, w: DOOR_CELL_SIZE, h: DOOR_CELL_SIZE },
  south: { x: 112, y: 144, w: DOOR_CELL_SIZE, h: DOOR_CELL_SIZE },
  west:  { x: 0,   y: 64, w: DOOR_CELL_SIZE, h: 48 },
  east:  { x: 224, y: 64, w: DOOR_CELL_SIZE, h: 48 },
};

// Direction → sprite row on dungeon-doors.png (bombable wall overlay only)
const DOOR_DIR_INFO: Record<DoorDir, { row: number; x: number; y: number; h: number }> = {
  north: { row: 0, x: 112, y: 0, h: DOOR_CELL_SIZE },
  south: { row: 3, x: 112, y: 144, h: DOOR_CELL_SIZE },
  west:  { row: 1, x: 0,   y: 64,  h: 48 },
  east:  { row: 2, x: 224,  y: 64,  h: 48 },
};

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

    // NES slot plus one tile of padding — the map artist often paints the
    // item one tile off (L1 boss heart at 210,84 vs slot 192,80).
    const { startCol: startTileCol, endCol: endTileCol, startRow: startTileRow, endRow: endTileRow } =
      itemMaskTileRange(itemX, itemY);

    for (let tr = startTileRow; tr <= endTileRow; tr++) {
      for (let tc = startTileCol; tc <= endTileCol; tc++) {
        const innerR = tr - INNER_OFFSET_ROW;
        const innerC = tc - INNER_OFFSET_COL;
        if (innerR < 0 || innerR >= INNER_ROWS || innerC < 0 || innerC >= INNER_COLS) continue;

        const tileIdx = uniqueRoom.tiles[innerR]?.[innerC];
        if (tileIdx === undefined) continue;

        // Find a matching floor tile as far away as possible (never the
        // painted tile itself — copying it would leave the baked item).
        const donor = findDonorTile(uniqueRoom, tileIdx, innerR, innerC);
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

  /**
   * Copy an already-open doorway from another room on dungeons-map.png.
   * dungeon-doors.png "open" cells have a transparent hole, so blitting them
   * over a painted-closed shutter leaves the diamond showing through.
   */
  blitOpenDoorFromRoom(
    renderer: Renderer,
    srcRoomId: number,
    levelBlock: string,
    dir: DoorDir,
  ): void {
    const slot = DOOR_SLOTS[dir];
    const blockRowOffset = levelBlock === 'uw2q1' ? 8 : 0;
    const srcX = (srcRoomId % MAP_COLS) * ROOM_WIDTH + slot.x;
    const srcY = (Math.floor(srcRoomId / MAP_COLS) + blockRowOffset) * ROOM_HEIGHT + slot.y;
    renderer.drawImage(
      this._mapImage,
      srcX, srcY, slot.w, slot.h,
      slot.x, slot.y, slot.w, slot.h,
    );
  }

  renderDoorOverlays(
    renderer: Renderer,
    _roomId: number,
    levelBlock: string,
    doors: DungeonRoomDoors,
    openedDoors: number,
    openDonors?: Partial<Record<DoorDir, number>>,
  ): void {
    const entries: [DoorDir, number, number][] = [
      ['north', doors.north, 8],
      ['south', doors.south, 4],
      ['west',  doors.west,  2],
      ['east',  doors.east,  1],
    ];

    for (const [dir, doorType, dirBit] of entries) {
      const opened = (openedDoors & dirBit) !== 0;

      if (
        opened &&
        (doorType === DOOR_KEY || doorType === DOOR_KEY_2 || doorType === DOOR_SHUTTER)
      ) {
        const donor = openDonors?.[dir];
        if (donor !== undefined) {
          this.blitOpenDoorFromRoom(renderer, donor, levelBlock, dir);
        } else {
          // Never fall back to dungeon-doors.png "open" — those cells are
          // transparent in the opening, so the painted shutter shows through.
          const slot = DOOR_SLOTS[dir];
          renderer.fillRect(slot.x, slot.y, slot.w, slot.h, '#000000');
        }
        continue;
      }

      const spriteCol = doorOverlaySpriteCol(doorType, opened);
      if (spriteCol < 0) continue;

      const info = DOOR_DIR_INFO[dir];

      if (this._doorImage) {
        const sx = spriteCol * DOOR_CELL_SIZE;
        const sy = info.row * DOOR_CELL_SIZE;
        renderer.drawImage(
          this._doorImage,
          sx, sy, DOOR_CELL_SIZE, DOOR_CELL_SIZE,
          info.x, info.y, DOOR_CELL_SIZE, info.h,
        );
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

/** Same-index tile farthest from the painted cell. Dist 0 (self) is rejected. */
export function findDonorTile(
  uniqueRoom: UniqueRoom,
  targetIdx: number,
  avoidRow: number,
  avoidCol: number,
): { row: number; col: number } | null {
  let best: { row: number; col: number } | null = null;
  let bestDist = 0;
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
