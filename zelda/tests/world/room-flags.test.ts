import { describe, it, expect } from 'vitest';
import { RoomFlags } from '../../src/world/room-flags.js';

describe('RoomFlags', () => {
  it('defaults all flags to 0', () => {
    const flags = new RoomFlags();
    for (let i = 0; i < 128; i++) {
      expect(flags.isSecretFound(i)).toBe(false);
      expect(flags.getFlags(i)).toBe(0);
    }
  });

  it('sets and reads the secret-found bit', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(42);
    expect(flags.isSecretFound(42)).toBe(true);
    expect(flags.getFlags(42)).toBe(0x80);
  });

  it('does not affect other rooms', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(10);
    expect(flags.isSecretFound(9)).toBe(false);
    expect(flags.isSecretFound(11)).toBe(false);
  });

  it('is idempotent — setting twice does not change value', () => {
    const flags = new RoomFlags();
    flags.setSecretFound(5);
    flags.setSecretFound(5);
    expect(flags.getFlags(5)).toBe(0x80);
  });
});
