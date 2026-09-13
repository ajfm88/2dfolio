// Per-room persistent flags — Z_07.asm GetRoomFlags / WorldFlags ($67F)
//
// The NES WorldFlags region is $067F-$07FE = $180 bytes = three 128-byte blocks,
// mirrored into SRAM as SaveFileAWorldFlags0/1/2 (Variables.inc:308-310). Each
// level picks its block via LevelInfo_WorldFlagsAddr; our dungeons.json carries
// the same grouping (levels 1-6 = uw1q1, 7-9 = uw2q1), so one RoomFlags instance
// exists per block, not per dungeon. See WORLD_FLAG_BLOCKS in save-manager.ts.
//
// Bit layout (matches NES):
//   $80 = secret found/taken
//   $20 = visited
//   $10 = item taken
//   $0F = opened doors (N=8, S=4, W=2, E=1)

const SECRET_FOUND_BIT = 0x80;
const ROOM_CLEARED_BIT = 0x40;
const VISITED_BIT = 0x20;
const ITEM_TAKEN_BIT = 0x10;
const DOOR_MASK = 0x0F;

// Door direction bits (NES: E=1, W=2, S=4, N=8)
export const DOOR_BIT_E = 0x01;
export const DOOR_BIT_W = 0x02;
export const DOOR_BIT_S = 0x04;
export const DOOR_BIT_N = 0x08;

export class RoomFlags {
    flags;

  constructor(roomCount = 128) {
    this.flags = new Uint8Array(roomCount);
  }

  isSecretFound(roomId) {
    return (this.flags[roomId] & SECRET_FOUND_BIT) !== 0;
  }

  setSecretFound(roomId) {
    this.flags[roomId] = this.flags[roomId] | SECRET_FOUND_BIT;
  }

  isRoomCleared(roomId) {
    return (this.flags[roomId] & ROOM_CLEARED_BIT) !== 0;
  }

  setRoomCleared(roomId) {
    this.flags[roomId] = this.flags[roomId] | ROOM_CLEARED_BIT;
  }

  isVisited(roomId) {
    return (this.flags[roomId] & VISITED_BIT) !== 0;
  }

  setVisited(roomId) {
    this.flags[roomId] = this.flags[roomId] | VISITED_BIT;
  }

  isItemTaken(roomId) {
    return (this.flags[roomId] & ITEM_TAKEN_BIT) !== 0;
  }

  setItemTaken(roomId) {
    this.flags[roomId] = this.flags[roomId] | ITEM_TAKEN_BIT;
  }

  getOpenedDoors(roomId) {
    return this.flags[roomId] & DOOR_MASK;
  }

  setDoorOpened(roomId, doorBit) {
    this.flags[roomId] = this.flags[roomId] | (doorBit & DOOR_MASK);
  }

  getFlags(roomId) {
    return this.flags[roomId];
  }

  /** Room count this block covers (128 on the NES). */
  get size() {
    return this.flags.length;
  }

  /** Serialize for the save file. Plain numbers so it survives JSON round-trips. */
  toBytes() {
    return Array.from(this.flags);
  }

  /**
   * Overwrite in place from a saved byte array. Mutating rather than replacing
   * matters because OverworldManager holds its RoomFlags as a readonly field.
   * Shorter input zeroes the tail and longer input is truncated, so a save from a
   * different room count still loads instead of throwing.
   */
  loadBytes(bytes) {
    for (let i = 0; i < this.flags.length; i++) {
      const b = bytes[i];
      this.flags[i] = typeof b === 'number' && b >= 0 ? b & 0xff : 0;
    }
  }

  /** Convenience constructor around loadBytes. */
  static fromBytes(bytes, roomCount = 128) {
    const rf = new RoomFlags(roomCount);
    rf.loadBytes(bytes);
    return rf;
  }
}
