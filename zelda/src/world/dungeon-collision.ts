// Dungeon room collision — builds a 16×11 walkability grid from the
// unique room's 12×7 inner tiles + border walls + door openings.
// API matches TileCollisionMap so Link/enemies can use it directly
// (the screen parameter is accepted but ignored — collision is per-room).

import {
  DEFAULT_WALKABILITY_THRESHOLD,
  PLAY_AREA_HEIGHT,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../core/constants.js';
import type { DungeonRoom, UniqueRoom } from '../data/dungeon-types.js';
import type { OverworldScreen } from '../data/overworld-types.js';
import { noclip } from './collision.js';

const ROOM_COLS = 16;
const ROOM_ROWS = 11;
const INNER_COLS = 12;
const INNER_ROWS = 7;
const INNER_OFFSET_COL = 2;
const INNER_OFFSET_ROW = 2;

// Door types that allow passage
const OPEN_DOOR_TYPES = new Set([0, 2]);

export class DungeonCollisionMap {
  private readonly _walkable: boolean[][];
  private readonly _walkableOverrides = new Set<string>();

  constructor(
    uniqueRoom: UniqueRoom,
    room: DungeonRoom,
    squareTable: readonly number[],
  ) {
    this._walkable = Array.from({ length: ROOM_ROWS }, () =>
      Array.from({ length: ROOM_COLS }, () => false),
    );
    this.buildWalkability(uniqueRoom, room, squareTable);
  }

  private buildWalkability(
    uniqueRoom: UniqueRoom,
    room: DungeonRoom,
    squareTable: readonly number[],
  ): void {
    for (let r = 0; r < INNER_ROWS; r++) {
      const row = uniqueRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < INNER_COLS; c++) {
        const tileIdx = row[c];
        if (tileIdx === undefined) continue;
        const value = squareTable[tileIdx];
        if (value !== undefined && value < DEFAULT_WALKABILITY_THRESHOLD) {
          this._walkable[r + INNER_OFFSET_ROW]![c + INNER_OFFSET_COL] = true;
        }
      }
    }

    if (OPEN_DOOR_TYPES.has(room.doors.north)) {
      this.setDoorOpen('north');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.south)) {
      this.setDoorOpen('south');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.west)) {
      this.setDoorOpen('west');
    }
    if (OPEN_DOOR_TYPES.has(room.doors.east)) {
      this.setDoorOpen('east');
    }
  }

  private setDoorOpen(direction: string): void {
    switch (direction) {
      case 'north':
        this._walkable[0]![7] = true; this._walkable[0]![8] = true;
        this._walkable[1]![7] = true; this._walkable[1]![8] = true;
        break;
      case 'south':
        this._walkable[9]![7] = true; this._walkable[9]![8] = true;
        this._walkable[10]![7] = true; this._walkable[10]![8] = true;
        break;
      case 'west':
        this._walkable[4]![0] = true; this._walkable[4]![1] = true;
        this._walkable[5]![0] = true; this._walkable[5]![1] = true;
        this._walkable[6]![0] = true; this._walkable[6]![1] = true;
        break;
      case 'east':
        this._walkable[4]![14] = true; this._walkable[4]![15] = true;
        this._walkable[5]![14] = true; this._walkable[5]![15] = true;
        this._walkable[6]![14] = true; this._walkable[6]![15] = true;
        break;
    }
  }

  openDoor(direction: string): void {
    this.setDoorOpen(direction);
  }

  // TileCollisionMap-compatible API (screen param ignored)
  isPositionWalkable(_screen: OverworldScreen, px: number, py: number): boolean {
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
    _screen: OverworldScreen,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const s = _screen; // pass through
    return (
      this.isPositionWalkable(s, x, y) &&
      this.isPositionWalkable(s, x + w - 1, y) &&
      this.isPositionWalkable(s, x, y + h - 1) &&
      this.isPositionWalkable(s, x + w - 1, y + h - 1)
    );
  }

  isWaterTileAt(_screen: OverworldScreen, _px: number, _py: number): boolean {
    return false;
  }

  getTileValueAtPosition(_screen: OverworldScreen, _px: number, _py: number): number | undefined {
    return undefined;
  }

  setWalkableOverride(row: number, col: number): void {
    this._walkableOverrides.add(`${row},${col}`);
  }

  clearWalkableOverrides(): void {
    this._walkableOverrides.clear();
  }

  static forCellar(
    cellarRoom: UniqueRoom,
    squareTable: readonly number[],
  ): DungeonCollisionMap {
    const map = Object.create(DungeonCollisionMap.prototype) as DungeonCollisionMap;
    (map as any)._walkableOverrides = new Set<string>();
    const walkable: boolean[][] = Array.from({ length: ROOM_ROWS }, () =>
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
          walkable[r + INNER_OFFSET_ROW]![c] = true;
        }
      }
    }
    (map as any)._walkable = walkable;
    return map;
  }
}
