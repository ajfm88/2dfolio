import { describe, it, expect } from 'vitest';
import { RoomFlags, DOOR_BIT_N, DOOR_BIT_S, DOOR_BIT_W, DOOR_BIT_E } from '../../src/world/room-flags.js';

describe('RoomFlags H1b extensions', () => {
  it('tracks item taken state', () => {
    const flags = new RoomFlags();
    expect(flags.isItemTaken(5)).toBe(false);
    flags.setItemTaken(5);
    expect(flags.isItemTaken(5)).toBe(true);
    expect(flags.isItemTaken(6)).toBe(false);
  });

  it('tracks opened doors as bitmask', () => {
    const flags = new RoomFlags();
    expect(flags.getOpenedDoors(10)).toBe(0);
    flags.setDoorOpened(10, DOOR_BIT_N);
    expect(flags.getOpenedDoors(10)).toBe(DOOR_BIT_N);
    flags.setDoorOpened(10, DOOR_BIT_S);
    expect(flags.getOpenedDoors(10)).toBe(DOOR_BIT_N | DOOR_BIT_S);
  });

  it('door bits are independent per room', () => {
    const flags = new RoomFlags();
    flags.setDoorOpened(0, DOOR_BIT_E);
    flags.setDoorOpened(1, DOOR_BIT_W);
    expect(flags.getOpenedDoors(0)).toBe(DOOR_BIT_E);
    expect(flags.getOpenedDoors(1)).toBe(DOOR_BIT_W);
  });

  it('item taken and doors do not interfere', () => {
    const flags = new RoomFlags();
    flags.setItemTaken(3);
    flags.setDoorOpened(3, DOOR_BIT_N | DOOR_BIT_S);
    expect(flags.isItemTaken(3)).toBe(true);
    expect(flags.getOpenedDoors(3)).toBe(DOOR_BIT_N | DOOR_BIT_S);
  });

  it('visited uses bit $20 (not $01)', () => {
    const flags = new RoomFlags();
    flags.setVisited(7);
    expect(flags.isVisited(7)).toBe(true);
    // Should not interfere with door bits
    expect(flags.getOpenedDoors(7)).toBe(0);
  });

  it('door bit constants match NES layout', () => {
    expect(DOOR_BIT_E).toBe(0x01);
    expect(DOOR_BIT_W).toBe(0x02);
    expect(DOOR_BIT_S).toBe(0x04);
    expect(DOOR_BIT_N).toBe(0x08);
  });
});
