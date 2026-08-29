// DungeonManager — orchestrates dungeon room state, navigation, rendering.
// Analogous to OverworldManager but for underworld levels 1-9.

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../core/constants.js';
import { Direction } from '../core/types.js';
import type {
  DungeonData,
  DungeonInfo,
  DungeonLevelBlock,
  DungeonRoom,
  UniqueRoom,
} from '../data/dungeon-types.js';
import type { OverworldScreen } from '../data/overworld-types.js';
import type { Renderer } from '../render/renderer.js';
import { DungeonRenderer } from '../render/dungeon-renderer.js';
import { DungeonCollisionMap } from './dungeon-collision.js';
import { RoomFlags, DOOR_BIT_N, DOOR_BIT_S, DOOR_BIT_W, DOOR_BIT_E } from './room-flags.js';
import type { Link } from '../objects/player/link.js';

// Door type constants (from TouchDoor_JumpTable at Z_05.asm:3912)
const DOOR_OPEN = 0;
const DOOR_WALL = 1;
const DOOR_FALSE_WALL = 2;
const DOOR_FALSE_WALL_2 = 3;
const DOOR_BOMBABLE = 4;
const DOOR_KEY = 5;
const DOOR_KEY_2 = 6;
const DOOR_SHUTTER = 7;

// Push block tile index in NES room data
const PUSH_BLOCK_TILE = 0xB0;

// Next-room offset by direction (NES: N=-16, S=+16, W=-1, E=+1)
const NEXT_ROOM_OFFSETS: Record<number, number> = {
  [Direction.Up]: -16,
  [Direction.Down]: 16,
  [Direction.Left]: -1,
  [Direction.Right]: 1,
};

// Link entry positions when entering a room from a given direction
const ENTRY_X_CENTER = 120;
const ENTRY_Y_TOP = 0;
const ENTRY_Y_BOTTOM = SCREEN_EDGE_BOTTOM;
const ENTRY_X_LEFT = 0;
const ENTRY_X_RIGHT = SCREEN_WIDTH - TILE_SIZE;
const ENTRY_Y_CENTER = 80;

export class DungeonManager {
  private readonly _dungeonData: DungeonData;
  private readonly _dungeonInfo: DungeonInfo;
  private readonly _levelBlock: DungeonLevelBlock;
  private readonly _renderer: DungeonRenderer;
  private readonly _level: number;
  private _currentRoomId: number;
  private _currentRoom: DungeonRoom;
  private _collision: DungeonCollisionMap;
  private readonly _visitedRooms = new Set<number>();
  private readonly _roomFlags: RoomFlags;
  private _openedDoors = 0;
  private _shuttersTriggered = false;
  private _isDark = false;
  private _secretTriggered = false;

  constructor(
    level: number,
    dungeonData: DungeonData,
    dungeonRenderer: DungeonRenderer,
    roomFlags?: RoomFlags,
  ) {
    this._level = level;
    this._dungeonData = dungeonData;
    this._dungeonInfo = dungeonData.dungeons[level - 1]!;
    this._levelBlock =
      dungeonData.levelBlocks[
        this._dungeonInfo.levelBlock as keyof typeof dungeonData.levelBlocks
      ];
    this._renderer = dungeonRenderer;
    this._roomFlags = roomFlags ?? new RoomFlags();

    this._currentRoomId = this._dungeonInfo.startRoomId;
    this._currentRoom = this.getRoom(this._currentRoomId);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(this._currentRoomId);
    this._roomFlags.setVisited(this._currentRoomId);
    this.initRoomState();
  }

  get level(): number {
    return this._level;
  }

  get currentRoomId(): number {
    return this._currentRoomId;
  }

  get currentRoom(): DungeonRoom {
    return this._currentRoom;
  }

  get collision(): DungeonCollisionMap {
    return this._collision;
  }

  get startRoomId(): number {
    return this._dungeonInfo.startRoomId;
  }

  get dungeonInfo(): DungeonInfo {
    return this._dungeonInfo;
  }

  get visitedRooms(): ReadonlySet<number> {
    return this._visitedRooms;
  }

  get roomFlags(): RoomFlags {
    return this._roomFlags;
  }

  get openedDoors(): number {
    return this._openedDoors;
  }

  get shuttersTriggered(): boolean {
    return this._shuttersTriggered;
  }

  get isDark(): boolean {
    return this._isDark;
  }

  get secretTriggered(): boolean {
    return this._secretTriggered;
  }

  get triforceRoomId(): number {
    return this._dungeonInfo.triforceRoomId;
  }

  brightenRoom(): void {
    this._isDark = false;
  }

  // Dummy OverworldScreen to satisfy Link.update() / EnemyUpdateContext signatures.
  // DungeonCollisionMap ignores the screen parameter, so this is safe.
  get dummyScreen(): OverworldScreen {
    return {
      id: this._currentRoomId,
      row: Math.floor(this._currentRoomId / 16),
      col: this._currentRoomId % 16,
      uniqueRoomId: this._currentRoom.uniqueRoomId,
      tiles: [],
    };
  }

  // All rooms in this level block that have at least one passable door
  get validRoomIds(): readonly number[] {
    const ids: number[] = [];
    for (const room of this._levelBlock.rooms) {
      const d = room.doors;
      if (d.north !== 1 || d.south !== 1 || d.east !== 1 || d.west !== 1) {
        ids.push(room.id);
      }
    }
    return ids;
  }

  getRoom(roomId: number): DungeonRoom {
    const room = this._levelBlock.rooms[roomId];
    if (!room) {
      throw new Error(`Dungeon room ${roomId} not found in level ${this._level}`);
    }
    return room;
  }

  getUniqueRoom(uniqueRoomId: number): UniqueRoom {
    const ur = this._dungeonData.uniqueRooms[uniqueRoomId];
    if (!ur) {
      throw new Error(`Unique room ${uniqueRoomId} not found`);
    }
    return ur;
  }

  private buildCollision(room: DungeonRoom): DungeonCollisionMap {
    const uniqueRoom = this.getUniqueRoom(room.uniqueRoomId);
    return new DungeonCollisionMap(
      uniqueRoom,
      room,
      this._dungeonData.squareTable,
    );
  }

  getDoorType(direction: Direction): number {
    switch (direction) {
      case Direction.Up: return this._currentRoom.doors.north;
      case Direction.Down: return this._currentRoom.doors.south;
      case Direction.Left: return this._currentRoom.doors.west;
      case Direction.Right: return this._currentRoom.doors.east;
    }
  }

  canPassDoor(direction: Direction): boolean {
    const doorType = this.getDoorType(direction);
    const dirBit = directionToDoorBit(direction);

    switch (doorType) {
      case DOOR_OPEN:
        return true;
      case DOOR_WALL:
        return false;
      case DOOR_FALSE_WALL:
      case DOOR_FALSE_WALL_2:
        return true;
      case DOOR_BOMBABLE:
        return (this._openedDoors & dirBit) !== 0;
      case DOOR_KEY:
      case DOOR_KEY_2:
        return (this._openedDoors & dirBit) !== 0;
      case DOOR_SHUTTER:
        return (this._openedDoors & dirBit) !== 0;
      default:
        return false;
    }
  }

  touchDoor(direction: Direction, link: Link): boolean {
    const doorType = this.getDoorType(direction);
    const dirBit = directionToDoorBit(direction);

    switch (doorType) {
      case DOOR_KEY:
      case DOOR_KEY_2: {
        if ((this._openedDoors & dirBit) !== 0) return true;
        if (!link.inventory.magicKey && link.keys <= 0) return false;
        if (!link.inventory.magicKey) link.addKeys(-1);
        this.openDoorDirection(dirBit);
        return true;
      }
      case DOOR_BOMBABLE:
        return (this._openedDoors & dirBit) !== 0;
      case DOOR_SHUTTER:
        return (this._openedDoors & dirBit) !== 0;
      default:
        return this.canPassDoor(direction);
    }
  }

  openDoorDirection(dirBit: number): void {
    this._openedDoors |= dirBit;
    this._roomFlags.setDoorOpened(this._currentRoomId, dirBit);

    // Also open the collision map for the opened door
    if (dirBit & DOOR_BIT_N) this._collision.openDoor('north');
    if (dirBit & DOOR_BIT_S) this._collision.openDoor('south');
    if (dirBit & DOOR_BIT_W) this._collision.openDoor('west');
    if (dirBit & DOOR_BIT_E) this._collision.openDoor('east');
  }

  triggerShutters(): void {
    if (this._shuttersTriggered) return;
    this._shuttersTriggered = true;

    const room = this._currentRoom;
    const dirs = [
      { type: room.doors.north, bit: DOOR_BIT_N },
      { type: room.doors.south, bit: DOOR_BIT_S },
      { type: room.doors.west, bit: DOOR_BIT_W },
      { type: room.doors.east, bit: DOOR_BIT_E },
    ];
    for (const d of dirs) {
      if (d.type === DOOR_SHUTTER && !(this._openedDoors & d.bit)) {
        this.openDoorDirection(d.bit);
      }
    }
  }

  markSecretTriggered(): void {
    this._secretTriggered = true;
  }

  bombDoor(direction: Direction): boolean {
    const doorType = this.getDoorType(direction);
    if (doorType !== DOOR_BOMBABLE) return false;
    const dirBit = directionToDoorBit(direction);
    if (this._openedDoors & dirBit) return false;
    this.openDoorDirection(dirBit);
    return true;
  }

  // Check if Link is at a door edge and should transition to the next room
  checkRoomTransition(link: Link): Direction | null {
    const lx = link.posX;
    const ly = link.posY;

    // North door: Link at top edge, centered on door (cols 7-8 = x 96-143)
    if (ly <= 0 && lx >= 96 && lx <= 143) {
      if (this.canPassDoor(Direction.Up)) return Direction.Up;
    }
    // South door: Link at bottom edge
    if (ly >= SCREEN_EDGE_BOTTOM && lx >= 96 && lx <= 143) {
      if (this.canPassDoor(Direction.Down)) return Direction.Down;
    }
    // West door: Link at left edge, centered on door (rows 4-6 = y 48-111)
    if (lx <= 0 && ly >= 48 && ly <= 111) {
      if (this.canPassDoor(Direction.Left)) return Direction.Left;
    }
    // East door: Link at right edge
    if (lx >= SCREEN_WIDTH - TILE_SIZE && ly >= 48 && ly <= 111) {
      if (this.canPassDoor(Direction.Right)) return Direction.Right;
    }

    return null;
  }

  // Check if Link should exit the dungeon (walking south from the start room)
  checkDungeonExit(link: Link): boolean {
    if (this._currentRoomId !== this._dungeonInfo.startRoomId) return false;
    if (link.facing !== Direction.Down) return false;
    return link.posY >= SCREEN_EDGE_BOTTOM;
  }

  transitionToRoom(direction: Direction): void {
    const offset = NEXT_ROOM_OFFSETS[direction];
    if (offset === undefined) return;

    const nextRoomId = this._currentRoomId + offset;
    if (nextRoomId < 0 || nextRoomId >= 128) return;

    this._currentRoomId = nextRoomId;
    this._currentRoom = this.getRoom(nextRoomId);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(nextRoomId);
    this._roomFlags.setVisited(nextRoomId);
    this.initRoomState();

    // On the NES, shutters/locked doors close AFTER Link enters the room — they
    // never block the entry itself. Without this, Link's entry position sits in
    // a closed-shutter door channel he can't walk out of (soft-lock). Always open
    // the entry door's collision so he can step into the room; shutter re-closes
    // implicitly (the collision is only opened, never re-closed during the visit;
    // canPassDoor() still blocks passage out until the trigger fires).
    const entryDoorDir = this.getOppositeDoorKey(direction);
    if (entryDoorDir) {
      this._collision.openDoor(entryDoorDir);
    }
  }

  // Map a movement direction to the door key on the side Link enters FROM.
  // Going Up enters through the new room's South door, etc.
  private getOppositeDoorKey(direction: Direction): string | null {
    switch (direction) {
      case Direction.Up: return 'south';
      case Direction.Down: return 'north';
      case Direction.Left: return 'east';
      case Direction.Right: return 'west';
      default: return null;
    }
  }

  // Wallmaster grab — warp Link back to the level's entrance/start room.
  // Returns the entry position (bottom-center, as when first entering the dungeon).
  returnToEntranceRoom(): { x: number; y: number } {
    this._currentRoomId = this._dungeonInfo.startRoomId;
    this._currentRoom = this.getRoom(this._currentRoomId);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(this._currentRoomId);
    this._roomFlags.setVisited(this._currentRoomId);
    this.initRoomState();
    return this.getEntryPosition(Direction.Up);
  }

  private initRoomState(): void {
    this._openedDoors = this._roomFlags.getOpenedDoors(this._currentRoomId);
    this._shuttersTriggered = false;
    this._secretTriggered = false;
    this._isDark = this._currentRoom.isDark;

    // Re-open previously opened doors in collision map
    if (this._openedDoors & DOOR_BIT_N) this._collision.openDoor('north');
    if (this._openedDoors & DOOR_BIT_S) this._collision.openDoor('south');
    if (this._openedDoors & DOOR_BIT_W) this._collision.openDoor('west');
    if (this._openedDoors & DOOR_BIT_E) this._collision.openDoor('east');
  }

  findPushBlockPosition(): { x: number; y: number } | null {
    if (!this._currentRoom.hasPushBlock) return null;
    const uniqueRoom = this.getUniqueRoom(this._currentRoom.uniqueRoomId);
    // NES: scan row $A (inner row 8, which is uniqueRoom row 6) for tile $B0
    // Actually NES scans PlayAreaTiles row $A starting at column 4.
    // In our 12×7 inner grid, we scan for the block tile.
    for (let r = 0; r < uniqueRoom.tiles.length; r++) {
      const row = uniqueRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === PUSH_BLOCK_TILE) {
          // Inner grid offset: +2 cols, +2 rows for border
          const x = (c + 2) * TILE_SIZE;
          const y = (r + 2) * TILE_SIZE;
          return { x, y };
        }
      }
    }
    return null;
  }

  getRoomItemPosition(): { x: number; y: number } | null {
    const itemId = this._currentRoom.itemId;
    if (itemId === 3) return null; // 3 = no item (NES convention)

    const posIndex = this._currentRoom.itemPositionIndex;
    const positions = this._dungeonInfo.shortcutOrItemPositions;
    const packed = positions[posIndex];
    if (packed === undefined) return null;

    // NES GetShortcutOrItemXY: high nibble = X/16, low nibble = Y/16
    let x = packed & 0xF0;
    const y = (packed & 0x0F) << 4;
    // Triforce pieces are drawn 8px left of their slot (Z_05.asm:8255).
    if (itemId === 0x1B) x -= 8;
    return { x, y };
  }

  isItemTaken(): boolean {
    return this._roomFlags.isItemTaken(this._currentRoomId);
  }

  setItemTaken(): void {
    this._roomFlags.setItemTaken(this._currentRoomId);
  }

  isItemSecretGated(): boolean {
    const trigger = this._currentRoom.secretTrigger;
    return trigger === 3 || trigger === 7;
  }

  // Get Link's entry position when entering from a given direction
  getEntryPosition(fromDirection: Direction): { x: number; y: number } {
    switch (fromDirection) {
      case Direction.Up:
        return { x: ENTRY_X_CENTER, y: ENTRY_Y_BOTTOM };
      case Direction.Down:
        return { x: ENTRY_X_CENTER, y: ENTRY_Y_TOP };
      case Direction.Left:
        return { x: ENTRY_X_RIGHT, y: ENTRY_Y_CENTER };
      case Direction.Right:
        return { x: ENTRY_X_LEFT, y: ENTRY_Y_CENTER };
    }
  }

  renderRoom(renderer: Renderer): void {
    this._renderer.renderRoom(
      renderer,
      this._currentRoomId,
      this._dungeonInfo.levelBlock,
    );
  }
}

function directionToDoorBit(direction: Direction): number {
  switch (direction) {
    case Direction.Up: return DOOR_BIT_N;
    case Direction.Down: return DOOR_BIT_S;
    case Direction.Left: return DOOR_BIT_W;
    case Direction.Right: return DOOR_BIT_E;
  }
}
