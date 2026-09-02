import { describe, it, expect } from 'vitest';
import {
  SaveManager,
  SAVE_SLOT_COUNT,
  MAX_NAME_LENGTH,
  type StorageLike,
} from '../../src/save/save-manager.js';

/** In-memory StorageLike backing for deterministic tests. */
function fakeStorage(initial?: Record<string, string>): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
  };
}

describe('SaveManager', () => {
  it('starts with three empty, unregistered slots when storage is empty', () => {
    const mgr = new SaveManager(fakeStorage());
    const slots = mgr.getSlots();
    expect(slots).toHaveLength(SAVE_SLOT_COUNT);
    for (const s of slots) {
      expect(s.registered).toBe(false);
      expect(s.name).toBe('');
      expect(s.quest).toBe(1);
      expect(s.deaths).toBe(0);
    }
  });

  it('works with no storage backend (in-memory only)', () => {
    const mgr = new SaveManager(null);
    mgr.register(0, 'ZELDA');
    expect(mgr.getSlot(0)?.registered).toBe(true);
    expect(mgr.getSlot(0)?.name).toBe('ZELDA');
  });

  it('registers a name and persists it', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(1, 'LINK');
    const slot = mgr.getSlot(1)!;
    expect(slot.registered).toBe(true);
    expect(slot.name).toBe('LINK');
    expect(slot.quest).toBe(1);

    // A fresh manager over the same storage sees the registered slot.
    const reload = new SaveManager(store);
    expect(reload.getSlot(1)?.name).toBe('LINK');
    expect(reload.getSlot(0)?.registered).toBe(false);
  });

  it('truncates names to the 8-character NES limit', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.register(0, 'ABCDEFGHIJ');
    expect(mgr.getSlot(0)?.name).toHaveLength(MAX_NAME_LENGTH);
    expect(mgr.getSlot(0)?.name).toBe('ABCDEFGH');
  });

  it('supports second-quest registration', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.register(0, 'LINK', 2);
    expect(mgr.getSlot(0)?.quest).toBe(2);
  });

  it('eliminates a slot back to empty and persists', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(2, 'LINK');
    mgr.eliminate(2);
    expect(mgr.getSlot(2)?.registered).toBe(false);
    expect(mgr.getSlot(2)?.name).toBe('');
    expect(new SaveManager(store).getSlot(2)?.registered).toBe(false);
  });

  it('records deaths only for registered slots', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.recordDeath(0); // unregistered — ignored
    expect(mgr.getSlot(0)?.deaths).toBe(0);
    mgr.register(0, 'LINK');
    mgr.recordDeath(0);
    mgr.recordDeath(0);
    expect(mgr.getSlot(0)?.deaths).toBe(2);
  });

  it('ignores out-of-range slot indices', () => {
    const mgr = new SaveManager(fakeStorage());
    expect(mgr.getSlot(-1)).toBeNull();
    expect(mgr.getSlot(SAVE_SLOT_COUNT)).toBeNull();
    expect(() => mgr.register(99, 'X')).not.toThrow();
    expect(() => mgr.eliminate(99)).not.toThrow();
  });

  it('falls back to empty slots on corrupt storage', () => {
    const mgr = new SaveManager(fakeStorage({ 'zelda-nes:saves:v1': '{not valid json' }));
    expect(mgr.getSlots()).toHaveLength(SAVE_SLOT_COUNT);
    expect(mgr.getSlot(0)?.registered).toBe(false);
  });

  it('survives storage that throws on access', () => {
    const throwing: StorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    const mgr = new SaveManager(throwing);
    expect(mgr.getSlots()).toHaveLength(SAVE_SLOT_COUNT);
    expect(() => mgr.register(0, 'LINK')).not.toThrow();
    // Write failed silently, but the in-memory slot still updated.
    expect(mgr.getSlot(0)?.name).toBe('LINK');
  });
});
