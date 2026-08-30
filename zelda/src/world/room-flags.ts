// Per-room persistent flags — Z_07.asm GetRoomFlags / WorldFlags ($67F)
// In-memory only for now; save/load deferred to L1.
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
  private readonly flags: Uint8Array;

  constructor(roomCount: number = 128) {
    this.flags = new Uint8Array(roomCount);
  }

  isSecretFound(roomId: number): boolean {
    return (this.flags[roomId]! & SECRET_FOUND_BIT) !== 0;
  }

  setSecretFound(roomId: number): void {
    this.flags[roomId] = this.flags[roomId]! | SECRET_FOUND_BIT;
  }

  isRoomCleared(roomId: number): boolean {
    return (this.flags[roomId]! & ROOM_CLEARED_BIT) !== 0;
  }

  setRoomCleared(roomId: number): void {
    this.flags[roomId] = this.flags[roomId]! | ROOM_CLEARED_BIT;
  }

  isVisited(roomId: number): boolean {
    return (this.flags[roomId]! & VISITED_BIT) !== 0;
  }

  setVisited(roomId: number): void {
    this.flags[roomId] = this.flags[roomId]! | VISITED_BIT;
  }

  isItemTaken(roomId: number): boolean {
    return (this.flags[roomId]! & ITEM_TAKEN_BIT) !== 0;
  }

  setItemTaken(roomId: number): void {
    this.flags[roomId] = this.flags[roomId]! | ITEM_TAKEN_BIT;
  }

  getOpenedDoors(roomId: number): number {
    return this.flags[roomId]! & DOOR_MASK;
  }

  setDoorOpened(roomId: number, doorBit: number): void {
    this.flags[roomId] = this.flags[roomId]! | (doorBit & DOOR_MASK);
  }

  getFlags(roomId: number): number {
    return this.flags[roomId]!;
  }
}
