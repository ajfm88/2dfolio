// Per-room persistent flags — Z_07.asm GetRoomFlags / WorldFlags ($67F)
// Bit $80 = secret found/taken in this room.
// In-memory only for now; save/load deferred to L1.

const SECRET_FOUND_BIT = 0x80;

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

  getFlags(roomId: number): number {
    return this.flags[roomId]!;
  }
}
