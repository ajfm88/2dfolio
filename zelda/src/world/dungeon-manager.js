// DungeonManager — orchestrates dungeon room state, navigation, rendering.
// Analogous to OverworldManager but for underworld levels 1-9.

import {
  SCREEN_EDGE_BOTTOM,
  SCREEN_WIDTH,
  TILE_SIZE
} from '../core/constants.js';
import { Direction } from '../core/types.js';

import { DungeonCollisionMap } from './dungeon-collision.js';
import { RoomFlags, DOOR_BIT_N, DOOR_BIT_S, DOOR_BIT_W, DOOR_BIT_E } from './room-flags.js';

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
const NEXT_ROOM_OFFSETS = {
  [Direction.Up]: -16,
  [Direction.Down]: 16,
  [Direction.Left]: -1,
  [Direction.Right]: 1
};

// Link entry positions when entering a room from a given direction
const ENTRY_X_CENTER = 120;
const ENTRY_Y_TOP = 0;
const ENTRY_Y_BOTTOM = SCREEN_EDGE_BOTTOM;
const ENTRY_X_LEFT = 0;
const ENTRY_X_RIGHT = SCREEN_WIDTH - TILE_SIZE;
const ENTRY_Y_CENTER = 80;

export class DungeonManager {
    _dungeonData;
    _dungeonInfo;
    _levelBlock;
    _renderer;
    _level;
   _currentRoomId;
   _currentRoom;
   _collision;
    _visitedRooms = new Set();
    _roomFlags;
   _openedDoors = 0;
   _shuttersTriggered = false;
   _isDark = false;
   _secretTriggered = false;
   _inCellar = false;
   _cellarConnection = null;
   _cellarLeftSide = true;
   _openDoorDonors = {};
   _dungeonRoomIds = null;

  constructor(
    level,
    dungeonData,
    dungeonRenderer,
    roomFlags,
  ) {
    this._level = level;
    this._dungeonData = dungeonData;
    this._dungeonInfo = dungeonData.dungeons[level - 1];
    this._levelBlock =
      dungeonData.levelBlocks[
        this._dungeonInfo.levelBlock
      ];
    this._renderer = dungeonRenderer;
    this._roomFlags = roomFlags ?? new RoomFlags();

    this._currentRoomId = this._dungeonInfo.startRoomId;
    this._currentRoom = this.getRoom(this._currentRoomId);
    this._collision = this.buildCollision(this._currentRoom);
    // Seed from the persisted VISITED bit so the minimap survives leaving and
    // re-entering the dungeon (and a save/load round-trip) — the flags carry it,
    // but this Set is rebuilt on every construction.
    for (const roomId of this.validRoomIds) {
      if (this._roomFlags.isVisited(roomId)) this._visitedRooms.add(roomId);
    }
    this._visitedRooms.add(this._currentRoomId);
    this._roomFlags.setVisited(this._currentRoomId);
    this.initRoomState();
  }

  get level() {
    return this._level;
  }

  get currentRoomId() {
    return this._currentRoomId;
  }

  get currentRoom() {
    return this._currentRoom;
  }

  get collision() {
    return this._collision;
  }

  get startRoomId() {
    return this._dungeonInfo.startRoomId;
  }

  get dungeonInfo() {
    return this._dungeonInfo;
  }

  get visitedRooms() {
    return this._visitedRooms;
  }

  get roomFlags() {
    return this._roomFlags;
  }

  get openedDoors() {
    return this._openedDoors;
  }

  get shuttersTriggered() {
    return this._shuttersTriggered;
  }

  get isDark() {
    return this._isDark;
  }

  get secretTriggered() {
    return this._secretTriggered;
  }

  get triforceRoomId() {
    return this._dungeonInfo.triforceRoomId;
  }

  brightenRoom() {
    this._isDark = false;
  }

  // Dummy OverworldScreen to satisfy Link.update() / EnemyUpdateContext signatures.
  // DungeonCollisionMap ignores the screen parameter, so this is safe.
  get dummyScreen() {
    return {
      id: this._currentRoomId,
      row: Math.floor(this._currentRoomId / 16),
      col: this._currentRoomId % 16,
      uniqueRoomId: this._currentRoom.uniqueRoomId,
      tiles: []
    };
  }

  // Rooms reachable from the start room of THIS dungeon (BFS).
  // The level block is shared across multiple dungeons (e.g. L1-6 share uw1q1),
  // so we cannot just filter by "has a non-wall door" — that returns rooms from
  // every dungeon in the block and fills the minimap with a solid grid.
  get validRoomIds() {
    return [...this.roomsInThisDungeon()];
  }

  getRoom(roomId) {
    const room = this._levelBlock.rooms[roomId];
    if (!room) {
      throw new Error(`Dungeon room ${roomId} not found in level ${this._level}`);
    }
    return room;
  }

  getUniqueRoom(uniqueRoomId) {
    const ur = this._dungeonData.uniqueRooms[uniqueRoomId];
    if (!ur) {
      throw new Error(`Unique room ${uniqueRoomId} not found`);
    }
    return ur;
  }

   buildCollision(room) {
    const uniqueRoom = this.getUniqueRoom(room.uniqueRoomId);
    return new DungeonCollisionMap(
      uniqueRoom,
      room,
      this._dungeonData.squareTable,
    );
  }

  getDoorType(direction) {
    switch (direction) {
      case Direction.Up: return this._currentRoom.doors.north;
      case Direction.Down: return this._currentRoom.doors.south;
      case Direction.Left: return this._currentRoom.doors.west;
      case Direction.Right: return this._currentRoom.doors.east;
    }
  }

  canPassDoor(direction) {
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

  touchDoor(direction, link) {
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

  openDoorDirection(dirBit) {
    this._openedDoors |= dirBit;
    this._roomFlags.setDoorOpened(this._currentRoomId, dirBit);

    // Also open the collision map for the opened door
    if (dirBit & DOOR_BIT_N) this._collision.openDoor('north');
    if (dirBit & DOOR_BIT_S) this._collision.openDoor('south');
    if (dirBit & DOOR_BIT_W) this._collision.openDoor('west');
    if (dirBit & DOOR_BIT_E) this._collision.openDoor('east');
  }

  triggerShutters() {
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

  markSecretTriggered() {
    this._secretTriggered = true;
  }

  tryOpenBlockedDoor(link) {
    const lx = link.posX;
    const ly = link.posY;
    const facing = link.facing;

    // Check if Link is in a door alcove pushing against the door
    // North: row 1, cols 7-8 (y ~16, x 96-143), facing up
    if (facing === Direction.Up && ly <= 24 && lx >= 96 && lx <= 143) {
      return this.tryUnlockKeyDoor(Direction.Up, link);
    }
    // South: row 9, cols 7-8, facing down
    if (facing === Direction.Down && ly >= 128 && lx >= 96 && lx <= 143) {
      return this.tryUnlockKeyDoor(Direction.Down, link);
    }
    // West: col 1, rows 4-6 (x ~16, y 48-111), facing left
    if (facing === Direction.Left && lx <= 24 && ly >= 48 && ly <= 111) {
      return this.tryUnlockKeyDoor(Direction.Left, link);
    }
    // East: col 14, rows 4-6, facing right
    if (facing === Direction.Right && lx >= 208 && ly >= 48 && ly <= 111) {
      return this.tryUnlockKeyDoor(Direction.Right, link);
    }
    return false;
  }

   tryUnlockKeyDoor(direction, link) {
    const doorType = this.getDoorType(direction);
    if (doorType !== DOOR_KEY && doorType !== DOOR_KEY_2) return false;
    const dirBit = directionToDoorBit(direction);
    if (this._openedDoors & dirBit) return false;
    if (!link.inventory.magicKey && link.keys <= 0) return false;
    if (!link.inventory.magicKey) link.addKeys(-1);
    this.openDoorDirection(dirBit);
    return true;
  }

  bombDoor(direction) {
    const doorType = this.getDoorType(direction);
    if (doorType !== DOOR_BOMBABLE) return false;
    const dirBit = directionToDoorBit(direction);
    if (this._openedDoors & dirBit) return false;
    this.openDoorDirection(dirBit);
    return true;
  }

  // Check if Link is at a door edge and should transition to the next room
  checkRoomTransition(link) {
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
  checkDungeonExit(link) {
    if (this._currentRoomId !== this._dungeonInfo.startRoomId) return false;
    if (link.facing !== Direction.Down) return false;
    return link.posY >= SCREEN_EDGE_BOTTOM;
  }

  transitionToRoom(direction) {
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
   getOppositeDoorKey(direction) {
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
  returnToEntranceRoom() {
    this._currentRoomId = this._dungeonInfo.startRoomId;
    this._currentRoom = this.getRoom(this._currentRoomId);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(this._currentRoomId);
    this._roomFlags.setVisited(this._currentRoomId);
    this.initRoomState();
    return this.getEntryPosition(Direction.Up);
  }

  /**
   * Debug-only absolute room jump (__zelda.goToRoom). Normal play only ever moves
   * between adjacent rooms via transitionToRoom, so this bypasses doors entirely.
   * Returns the entry position, or null if the room ID does not exist.
   */
  debugGoToRoom(roomId) {
    if (!this._levelBlock.rooms[roomId]) return null;
    this._currentRoomId = roomId;
    this._currentRoom = this.getRoom(roomId);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(roomId);
    this._roomFlags.setVisited(roomId);
    this._inCellar = false;
    this._cellarConnection = null;
    this.initRoomState();
    return this.getEntryPosition(Direction.Up);
  }

   initRoomState() {
    this._openedDoors = this._roomFlags.getOpenedDoors(this._currentRoomId);
    this._shuttersTriggered = false;
    this._secretTriggered = false;
    this._isDark = this._currentRoom.isDark;
    this._openDoorDonors = {};
    for (const dir of ['north', 'south', 'west', 'east'] ) {
      const donor = this.findOpenDoorDonor(dir);
      if (donor !== null) this._openDoorDonors[dir] = donor;
    }

    // Re-open previously opened doors in collision map
    if (this._openedDoors & DOOR_BIT_N) this._collision.openDoor('north');
    if (this._openedDoors & DOOR_BIT_S) this._collision.openDoor('south');
    if (this._openedDoors & DOOR_BIT_W) this._collision.openDoor('west');
    if (this._openedDoors & DOOR_BIT_E) this._collision.openDoor('east');
  }

  /**
   * Rooms belonging to THIS dungeon (BFS from the start room through any
   * non-wall door). The uw1q1 block holds L1–L6; picking the first type-0
   * east door in the block grabbed L4's gold room 1 for L1 room 82.
   */
  roomsInThisDungeon() {
    if (this._dungeonRoomIds) return this._dungeonRoomIds;
    const start = this._dungeonInfo.startRoomId;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const id = queue.shift();
      const room = this._levelBlock.rooms[id];
      if (!room) continue;
      const next = [
        [room.doors.north, id - 16],
        [room.doors.south, id + 16],
        [room.doors.west, id - 1],
        [room.doors.east, id + 1],
      ];
      for (const [doorType, nid] of next) {
        if (doorType === DOOR_WALL) continue;
        if (nid < 0 || nid >= 128 || seen.has(nid)) continue;
        seen.add(nid);
        queue.push(nid);
      }
    }
    this._dungeonRoomIds = seen;
    return seen;
  }

  /**
   * Room in this dungeon whose door in `dir` is already open (type 0),
   * so we can copy its map pixels over a painted-closed shutter/key.
   */
  findOpenDoorDonor(dir) {
    const here = this._currentRoomId;
    for (const id of this.roomsInThisDungeon()) {
      if (id === here) continue;
      const room = this._levelBlock.rooms[id];
      if (room && room.doors[dir] === 0) return id;
    }
    return null;
  }

  findStairsPosition() {
    const uniqueRoom = this.getUniqueRoom(this._currentRoom.uniqueRoomId);
    for (let r = 0; r < uniqueRoom.tiles.length; r++) {
      const row = uniqueRoom.tiles[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 0) { // square index 0 = stairs
          const x = (c + 2) * TILE_SIZE;
          const y = (r + 2) * TILE_SIZE;
          return { x, y };
        }
      }
    }
    return null;
  }

  findPushBlockPosition() {
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

  getRoomItemPosition() {
    const itemId = this._currentRoom.itemId;
    if (itemId === 3) return null; // 3 = no item (NES convention)

    const posIndex = this._currentRoom.itemPositionIndex;
    const positions = this._dungeonInfo.shortcutOrItemPositions;
    const packed = positions[posIndex];
    if (packed === undefined) return null;

    // NES GetShortcutOrItemXY: high nibble = X/16, low nibble = Y/16
    // Y is in NES screen coords; subtract $40 (status bar) per Z_05.asm:6091
    let x = packed & 0xF0;
    const y = ((packed & 0x0F) << 4) - 0x40;
    // Triforce pieces are drawn 8px left of their slot (Z_05.asm:8255).
    if (itemId === 0x1B) x -= 8;
    return { x, y };
  }

  isItemTaken() {
    return this._roomFlags.isItemTaken(this._currentRoomId);
  }

  setItemTaken() {
    this._roomFlags.setItemTaken(this._currentRoomId);
  }

  isItemSecretGated() {
    const trigger = this._currentRoom.secretTrigger;
    return trigger === 3 || trigger === 7;
  }

  // Get Link's entry position when entering from a given direction
  getEntryPosition(fromDirection) {
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

  get inCellar() {
    return this._inCellar;
  }

  get cellarConnection() {
    return this._cellarConnection;
  }

  get cellarLeftSide() {
    return this._cellarLeftSide;
  }

  getCellarForRoom(roomId) {
    for (const conn of this._dungeonInfo.cellarConnections) {
      if (conn.leftDest === roomId) return { conn, isLeftSide: true };
      if (conn.rightDest === roomId) return { conn, isLeftSide: false };
    }
    return null;
  }

  enterCellar(conn, isLeftSide) {
    this._inCellar = true;
    this._cellarConnection = conn;
    this._cellarLeftSide = isLeftSide;
    const cellarRoom = this._dungeonData.cellarRooms[conn.layoutIndex];
    if (cellarRoom) {
      this._collision = DungeonCollisionMap.forCellar(
        cellarRoom,
        this._dungeonData.squareTable,
      );
    }
  }

  exitCellar(isLeftSide) {
    const conn = this._cellarConnection;
    const destRoom = isLeftSide ? conn.leftDest : conn.rightDest;
    const x = conn.exitPos & 0xF0;
    const y = (conn.exitPos & 0x0F) << 4;
    this._inCellar = false;
    this._cellarConnection = null;

    this._currentRoomId = destRoom;
    this._currentRoom = this.getRoom(destRoom);
    this._collision = this.buildCollision(this._currentRoom);
    this._visitedRooms.add(destRoom);
    this._roomFlags.setVisited(destRoom);
    this.initRoomState();

    return { roomId: destRoom, x, y };
  }

  renderRoom(renderer) {
    if (this._inCellar && this._cellarConnection) {
      const cellarRoom = this._dungeonData.cellarRooms[this._cellarConnection.layoutIndex];
      if (cellarRoom) {
        this._renderer.renderCellarRoom(renderer, cellarRoom, this._dungeonData.squareTable);
        return;
      }
    }
    this._renderer.renderRoom(
      renderer,
      this._currentRoomId,
      this._dungeonInfo.levelBlock,
    );
    this._renderer.renderDoorOverlays(
      renderer,
      this._currentRoomId,
      this._dungeonInfo.levelBlock,
      this._currentRoom.doors,
      this._openedDoors,
      this._openDoorDonors,
    );
  }

  maskBakedRoomItem(renderer, itemX, itemY) {
    const uniqueRoom = this.getUniqueRoom(this._currentRoom.uniqueRoomId);
    this._renderer.maskBakedRoomItem(
      renderer,
      this._currentRoomId,
      this._dungeonInfo.levelBlock,
      uniqueRoom,
      itemX,
      itemY,
    );
  }

  /**
   * Cover the painted-on room item from dungeons-map.png. Must run every frame
   * the room is shown — including after the live pickup is collected, otherwise
   * the baked sprite shows through (L1 room 83 key).
   */
  maskBakedRoomItemIfPresent(renderer) {
    if (this._inCellar) return;
    const pos = this.getRoomItemPosition();
    if (!pos) return;
    this.maskBakedRoomItem(renderer, pos.x, pos.y);
  }
}

function directionToDoorBit(direction) {
  switch (direction) {
    case Direction.Up: return DOOR_BIT_N;
    case Direction.Down: return DOOR_BIT_S;
    case Direction.Left: return DOOR_BIT_W;
    case Direction.Right: return DOOR_BIT_E;
  }
}
