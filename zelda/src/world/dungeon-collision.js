// Dungeon room collision — builds a 16×11 walkability grid from the
// unique room's 12×7 inner tiles + border walls + door openings.
// API matches TileCollisionMap so Link/enemies can use it directly
// (the screen parameter is accepted but ignored — collision is per-room).

import {
  DEFAULT_WALKABILITY_THRESHOLD,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  TILE_SIZE
} from '../core/constants.js';

import { noclip } from './collision.js';

const ROOM_COLS = 16;
const ROOM_ROWS = 11;
const INNER_COLS = 12;
const INNER_ROWS = 7;
const INNER_OFFSET_COL = 2;
const INNER_OFFSET_ROW = 2;

// Door types that allow full passage (both doorway tiles walkable)
const OPEN_DOOR_TYPES = new Set([0, 2, 3]);

// Door types where only the inner alcove tile is walkable, so Link can
// stand in the recess and touch the door (Z_05.asm CheckDoorway)
const ALCOVE_DOOR_TYPES = new Set([4, 5, 6, 7]);

export class DungeonCollisionMap {
    _walkable;
    _walkableOverrides = new Set();

  constructor(
    uniqueRoom,
    room,
    squareTable,
  ) {
    this._walkable = Array.from({ length: ROOM_ROWS }, () =>
      Array.from({ length: ROOM_COLS }, () => false),
    );
    this.buildWalkability(uniqueRoom, room, squareTable);
  }

   buildWalkability(
    uniqueRoom,
    room,
    squareTable,
  ) {
    for (let r = 0; r < INNER_ROWS; r++) {
      const row = uniqueRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < INNER_COLS; c++) {
        const tileIdx = row[c];
        if (tileIdx === undefined) continue;
        const value = squareTable[tileIdx];
        if (value !== undefined && value < DEFAULT_WALKABILITY_THRESHOLD) {
          this._walkable[r + INNER_OFFSET_ROW][c + INNER_OFFSET_COL] = true;
        }
      }
    }

    if (OPEN_DOOR_TYPES.has(room.doors.north)) {
      this.setDoorOpen('north');
    } else if (ALCOVE_DOOR_TYPES.has(room.doors.north)) {
      this.setDoorAlcoveOpen('north');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.south)) {
      this.setDoorOpen('south');
    } else if (ALCOVE_DOOR_TYPES.has(room.doors.south)) {
      this.setDoorAlcoveOpen('south');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.west)) {
      this.setDoorOpen('west');
    } else if (ALCOVE_DOOR_TYPES.has(room.doors.west)) {
      this.setDoorAlcoveOpen('west');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.east)) {
      this.setDoorOpen('east');
    } else if (ALCOVE_DOOR_TYPES.has(room.doors.east)) {
      this.setDoorAlcoveOpen('east');
    }
  }

   setDoorOpen(direction) {
    switch (direction) {
      case 'north':
        this._walkable[0][7] = true; this._walkable[0][8] = true;
        this._walkable[1][7] = true; this._walkable[1][8] = true;
        break;
      case 'south':
        this._walkable[9][7] = true; this._walkable[9][8] = true;
        this._walkable[10][7] = true; this._walkable[10][8] = true;
        break;
      case 'west':
        this._walkable[4][0] = true; this._walkable[4][1] = true;
        this._walkable[5][0] = true; this._walkable[5][1] = true;
        this._walkable[6][0] = true; this._walkable[6][1] = true;
        break;
      case 'east':
        this._walkable[4][14] = true; this._walkable[4][15] = true;
        this._walkable[5][14] = true; this._walkable[5][15] = true;
        this._walkable[6][14] = true; this._walkable[6][15] = true;
        break;
    }
  }

   setDoorAlcoveOpen(direction) {
    switch (direction) {
      case 'north':
        // Only row 1 (inner); row 0 (outer) stays solid
        this._walkable[1][7] = true; this._walkable[1][8] = true;
        break;
      case 'south':
        // Only row 9 (inner); row 10 (outer) stays solid
        this._walkable[9][7] = true; this._walkable[9][8] = true;
        break;
      case 'west':
        // Only col 1 (inner); col 0 (outer) stays solid
        this._walkable[4][1] = true;
        this._walkable[5][1] = true;
        this._walkable[6][1] = true;
        break;
      case 'east':
        // Only col 14 (inner); col 15 (outer) stays solid
        this._walkable[4][14] = true;
        this._walkable[5][14] = true;
        this._walkable[6][14] = true;
        break;
    }
  }

  openDoor(direction) {
    this.setDoorOpen(direction);
  }

  // TileCollisionMap-compatible API (screen param ignored)
  isPositionWalkable(_screen, px, py) {
    if (noclip.enabled) return true;
    if (px < 0 || px >= SCREEN_WIDTH || py < 0 || py >= PLAY_AREA_HEIGHT) {
      return true;
    }
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (this._walkableOverrides.has(`${row},${col}`)) return true;
    return this._walkable[row]?.[col] ?? false;
  }

  isRectWalkable(
    _screen,
    x,
    y,
    w,
    h,
  ) {
    const s = _screen; // pass through
    return (
      this.isPositionWalkable(s, x, y) &&
      this.isPositionWalkable(s, x + w - 1, y) &&
      this.isPositionWalkable(s, x, y + h - 1) &&
      this.isPositionWalkable(s, x + w - 1, y + h - 1)
    );
  }

  isWaterTileAt(_screen, _px, _py) {
    return false;
  }

  getTileValueAtPosition(_screen, _px, _py) {
    return undefined;
  }

  setWalkableOverride(row, col) {
    this._walkableOverrides.add(`${row},${col}`);
  }

  clearWalkableOverrides() {
    this._walkableOverrides.clear();
  }

  static forCellar(
    cellarRoom,
    squareTable,
  ) {
    const map = Object.create(DungeonCollisionMap.prototype);
    map._walkableOverrides = new Set();
    const walkable = Array.from({ length: ROOM_ROWS }, () =>
      Array.from({ length: ROOM_COLS }, () => false),
    );
    for (let r = 0; r < cellarRoom.tiles.length; r++) {
      const row = cellarRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < row.length && c < ROOM_COLS; c++) {
        const tileIdx = row[c];
        if (tileIdx === undefined) continue;
        const value = squareTable[tileIdx];
        if (tileIdx === 0 || (value !== undefined && value < DEFAULT_WALKABILITY_THRESHOLD)) {
          walkable[r + INNER_OFFSET_ROW][c] = true;
        }
      }
    }
    map._walkable = walkable;
    return map;
  }
}
