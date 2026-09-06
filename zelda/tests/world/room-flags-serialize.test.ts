import { describe, it, expect } from 'vitest';
import { RoomFlags, DOOR_BIT_N, DOOR_BIT_W } from '../../src/world/room-flags.js';

describe('RoomFlags serialization (L1)', () => {
  it('round-trips every flag bit through toBytes/fromBytes', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(5);
    flags.setRoomCleared(17);
    flags.setVisited(17);
    flags.setItemTaken(60);
    flags.setDoorOpened(60, DOOR_BIT_N);
    flags.setDoorOpened(60, DOOR_BIT_W);

    const restored = RoomFlags.fromBytes(flags.toBytes());
    expect(restored.isSecretFound(5)).toBe(true);
    expect(restored.isRoomCleared(17)).toBe(true);
    expect(restored.isVisited(17)).toBe(true);
    expect(restored.isItemTaken(60)).toBe(true);
    expect(restored.getOpenedDoors(60)).toBe(DOOR_BIT_N | DOOR_BIT_W);
    // Untouched rooms stay clear.
    expect(restored.getFlags(1)).toBe(0);
  });

  it('emits one plain number per room, so JSON survives the trip', () => {
    const bytes = new RoomFlags().toBytes();
    expect(bytes).toHaveLength(128);
    expect(Array.isArray(bytes)).toBe(true);
    expect(JSON.parse(JSON.stringify(bytes))).toEqual(bytes);
  });

  it('loadBytes overwrites in place, clearing flags absent from the save', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(3);
    flags.loadBytes(new Array<number>(128).fill(0));
    expect(flags.isSecretFound(3)).toBe(false);
  });

  it('tolerates a short, long or garbage byte array', () => {
    const short = RoomFlags.fromBytes([0x80]);
    expect(short.isSecretFound(0)).toBe(true);
    expect(short.getFlags(127)).toBe(0); // tail zero-filled, no throw

    const long = RoomFlags.fromBytes(new Array<number>(200).fill(0xff));
    expect(long.size).toBe(128); // truncated to the block size
    expect(long.getFlags(127)).toBe(0xff);

    const garbage = RoomFlags.fromBytes([Number.NaN, -1, 0x1ff] as number[]);
    expect(garbage.getFlags(0)).toBe(0);
    expect(garbage.getFlags(1)).toBe(0);
    expect(garbage.getFlags(2)).toBe(0xff); // masked to one byte
  });
});
