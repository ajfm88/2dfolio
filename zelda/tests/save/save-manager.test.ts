import { describe, it, expect } from 'vitest';
import {
  SaveManager,
  SAVE_SLOT_COUNT,
  MAX_NAME_LENGTH,
  ROOM_FLAG_BLOCK_SIZE,
  WORLD_FLAG_BLOCKS,
  type SavedGameState,
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

  it('switchToSecondQuest sets quest to 2 for registered slots', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(0, 'LINK');
    expect(mgr.getSlot(0)?.quest).toBe(1);
    mgr.switchToSecondQuest(0);
    expect(mgr.getSlot(0)?.quest).toBe(2);
    // Persisted
    const reload = new SaveManager(store);
    expect(reload.getSlot(0)?.quest).toBe(2);
  });

  it('switchToSecondQuest is a no-op for unregistered slots', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.switchToSecondQuest(0);
    expect(mgr.getSlot(0)?.quest).toBe(1);
  });

  it('ignores out-of-range slot indices', () => {
    const mgr = new SaveManager(fakeStorage());
    expect(mgr.getSlot(-1)).toBeNull();
    expect(mgr.getSlot(SAVE_SLOT_COUNT)).toBeNull();
    expect(() => mgr.register(99, 'X')).not.toThrow();
    expect(() => mgr.eliminate(99)).not.toThrow();
  });

  it('falls back to empty slots on corrupt storage', () => {
    const mgr = new SaveManager(fakeStorage({ 'zelda-nes:saves:v2': '{not valid json' }));
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

describe('SaveManager — game state (L1)', () => {
  function sampleState(): SavedGameState {
    const worldFlags = {} as SavedGameState['worldFlags'];
    for (const block of WORLD_FLAG_BLOCKS) {
      worldFlags[block] = new Array<number>(ROOM_FLAG_BLOCK_SIZE).fill(0);
    }
    // Distinct marks per block, so a cross-block leak would be visible.
    worldFlags.overworld[5] = 0x80;
    worldFlags.uw1q1[60] = 0x9f;
    worldFlags.uw2q1[60] = 0x40;
    return {
      stats: { maxHealth: 10, rupees: 137, keys: 4, bombs: 6, maxBombs: 12 },
      inventory: {
        selectedBSlot: 4, sword: 2, arrow: 1, candle: 2, ring: 1, potion: 2, letter: 2,
        woodBoomerang: true, magicBoomerang: false, bow: true, flute: true, food: false,
        wand: true, raft: false, book: true, ladder: true, magicKey: false,
        bracelet: true, magicShield: false, hasBombs: true,
        compass: 0b0000_0011, map: 0b0000_0101, compass9: false, map9: true,
        triforce: 0b0001_1111,
      },
      worldFlags,
      visitedScreens: [119, 118, 103],
    };
  }

  it('round-trips a full game state through storage', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(0, 'LINK');
    mgr.saveState(0, sampleState());

    const reloaded = new SaveManager(store);
    const state = reloaded.getState(0);
    expect(state).not.toBeNull();
    expect(state!.stats).toEqual({ maxHealth: 10, rupees: 137, keys: 4, bombs: 6, maxBombs: 12 });
    expect(state!.inventory.sword).toBe(2);
    expect(state!.inventory.triforce).toBe(0b0001_1111);
    expect(state!.inventory.magicBoomerang).toBe(false);
    expect(state!.inventory.map9).toBe(true);
    expect(state!.visitedScreens).toEqual([119, 118, 103]);
  });

  it('keeps the three world-flag blocks separate', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(0, 'LINK');
    mgr.saveState(0, sampleState());

    const flags = new SaveManager(store).getState(0)!.worldFlags;
    // Room 60 is a different room in each underworld block; the bytes must not merge.
    expect(flags.uw1q1[60]).toBe(0x9f);
    expect(flags.uw2q1[60]).toBe(0x40);
    expect(flags.overworld[60]).toBe(0);
    expect(flags.overworld[5]).toBe(0x80);
    for (const block of WORLD_FLAG_BLOCKS) {
      expect(flags[block]).toHaveLength(ROOM_FLAG_BLOCK_SIZE);
    }
  });

  it('refuses to save into an unregistered slot', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.saveState(1, sampleState());
    expect(mgr.getState(1)).toBeNull();
  });

  it('registering over a slot clears any previous save', () => {
    const mgr = new SaveManager(fakeStorage());
    mgr.register(0, 'LINK');
    mgr.saveState(0, sampleState());
    expect(mgr.getState(0)).not.toBeNull();
    mgr.register(0, 'ZELDA');
    expect(mgr.getState(0)).toBeNull();
  });

  it('eliminating a slot drops its saved game', () => {
    const store = fakeStorage();
    const mgr = new SaveManager(store);
    mgr.register(0, 'LINK');
    mgr.saveState(0, sampleState());
    mgr.eliminate(0);
    expect(new SaveManager(store).getState(0)).toBeNull();
  });

  it('migrates J1a v1 metadata files as playable, state-less slots', () => {
    const v1 = JSON.stringify([
      { name: 'LINK', quest: 1, registered: true, deaths: 3 },
      { name: '', quest: 1, registered: false, deaths: 0 },
      { name: '', quest: 1, registered: false, deaths: 0 },
    ]);
    const mgr = new SaveManager(fakeStorage({ 'zelda-nes:saves:v1': v1 }));
    expect(mgr.getSlot(0)?.name).toBe('LINK');
    expect(mgr.getSlot(0)?.deaths).toBe(3);
    expect(mgr.getSlot(0)?.registered).toBe(true);
    // No game state in a v1 file — choosing it starts fresh rather than vanishing.
    expect(mgr.getState(0)).toBeNull();
  });

  it('prefers v2 over a stale v1 payload', () => {
    const store = fakeStorage({
      'zelda-nes:saves:v1': JSON.stringify([{ name: 'OLD', quest: 1, registered: true, deaths: 9 }]),
    });
    const mgr = new SaveManager(store);
    mgr.register(0, 'NEW');
    expect(new SaveManager(store).getSlot(0)?.name).toBe('NEW');
  });

  it('repairs a truncated or garbage state instead of dropping the file', () => {
    const store = fakeStorage({
      'zelda-nes:saves:v2': JSON.stringify([
        {
          name: 'LINK', quest: 1, registered: true, deaths: 0,
          state: {
            stats: { rupees: 'lots' },
            inventory: { sword: 3, bow: 'yes' },
            worldFlags: { uw1q1: [0x80] },
            visitedScreens: [119, 'nope'],
          },
        },
      ]),
    });
    const state = new SaveManager(store).getState(0)!;
    expect(state.stats.rupees).toBe(0);        // non-numeric falls back
    expect(state.stats.maxHealth).toBe(6);     // missing falls back to 3 hearts
    expect(state.inventory.sword).toBe(3);     // valid value survives
    expect(state.inventory.bow).toBe(false);   // non-boolean is not truthy-coerced
    expect(state.worldFlags.uw1q1[0]).toBe(0x80);
    expect(state.worldFlags.uw1q1).toHaveLength(ROOM_FLAG_BLOCK_SIZE); // tail zero-filled
    expect(state.worldFlags.overworld).toHaveLength(ROOM_FLAG_BLOCK_SIZE); // missing block
    expect(state.visitedScreens).toEqual([119]);
  });
});
