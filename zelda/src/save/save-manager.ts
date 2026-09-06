// Save-slot model + persistence seam.
//
// J1 introduced the front-end concept of three save files, persisting only the
// *metadata* needed to draw the file-select screen. **L1** widens each slot with
// the full game state (inventory, heart containers, world flags) so a file can be
// put down and picked up.
//
// Backing store is `localStorage`, not IndexedDB as DECISIONS #8 originally
// planned: a full slot serializes to roughly 6KB, so all three fit in ~18KB of a
// 5MB budget, and staying synchronous keeps `SaveManager` constructible at module
// scope the way the front end already assumes. See DECISIONS #10.
//
// The NES writes the file only when the player picks SAVE on the Mode $08
// screen — reachable from death, or mid-game via Start then Up+A
// (Z_05.asm:362 UpdateMenuActive). We do the same: no autosave.

import { Inventory } from '../objects/player/inventory.js';
import type { LinkStats } from '../objects/player/link.js';

export const SAVE_SLOT_COUNT = 3;
export const MAX_NAME_LENGTH = 8; // NES name field is 8 characters (Z_02.asm)

const STORAGE_KEY = 'zelda-nes:saves:v2';
const LEGACY_STORAGE_KEY = 'zelda-nes:saves:v1'; // J1a metadata-only files

/**
 * The three 128-byte room-flag blocks, matching the NES WorldFlags region
 * $067F-$07FE ($180 bytes = 3 x 128), mirrored to SRAM as
 * SaveFileAWorldFlags0/1/2 (Variables.inc:308-310). Levels choose a block via
 * LevelInfo_WorldFlagsAddr; dungeons.json carries the same grouping in each
 * dungeon's `levelBlock` (levels 1-6 = uw1q1, levels 7-9 = uw2q1).
 */
export const WORLD_FLAG_BLOCKS = ['overworld', 'uw1q1', 'uw2q1'] as const;
export type WorldFlagBlock = (typeof WORLD_FLAG_BLOCKS)[number];

export const ROOM_FLAG_BLOCK_SIZE = 128;

/** Every mutable Inventory field, as persisted. Mirrors the class one-for-one. */
export type SavedInventory = Pick<
  Inventory,
  | 'selectedBSlot' | 'sword' | 'arrow' | 'candle' | 'ring' | 'potion' | 'letter'
  | 'woodBoomerang' | 'magicBoomerang' | 'bow' | 'flute' | 'food' | 'wand'
  | 'raft' | 'book' | 'ladder' | 'magicKey' | 'bracelet' | 'magicShield'
  | 'hasBombs' | 'compass' | 'map' | 'compass9' | 'map9' | 'triforce'
>;

/**
 * The persisted game state. Link's position, current level and current room are
 * deliberately absent: loading a file always restarts him on the overworld start
 * screen with 3 hearts (Z_07.asm:1442 InitMode3_Sub1), exactly like the NES.
 */
export interface SavedGameState {
  stats: LinkStats;
  inventory: SavedInventory;
  /** Per-block room flags, 128 bytes each. */
  worldFlags: Record<WorldFlagBlock, number[]>;
  /** Overworld screen IDs already seen, for the HUD minimap. */
  visitedScreens: number[];
}

/** One save file: the file-select metadata plus the game itself. */
export interface SaveSlot {
  /** Registered name, up to 8 chars. Empty string when the slot is unused. */
  name: string;
  /** 1 = first quest, 2 = second quest. */
  quest: number;
  /** True once a name has been registered into this slot. */
  registered: boolean;
  /** Death count shown on the file-select screen (NES "-DEATHS-"). */
  deaths: number;
  /** Persisted game state, or null for a registered-but-never-saved file. */
  state: SavedGameState | null;
}

/** Minimal subset of the Web Storage API we depend on — lets tests inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createEmptySlot(): SaveSlot {
  return { name: '', quest: 1, registered: false, deaths: 0, state: null };
}

function createEmptySlots(): SaveSlot[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, createEmptySlot);
}

/**
 * Attempts to resolve the browser's `localStorage`. Private-mode windows and
 * blocked-storage settings can throw on access, so this is always guarded.
 */
function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!ls) return null;
    // Probe once — some browsers expose the object but throw on use.
    ls.getItem(STORAGE_KEY);
    return ls;
  } catch {
    return null;
  }
}

function num(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function bool(raw: unknown): boolean {
  return raw === true;
}

/** Rebuild one 128-byte flag block, tolerating a short, long or missing array. */
function coerceFlagBlock(raw: unknown): number[] {
  const out = new Array<number>(ROOM_FLAG_BLOCK_SIZE).fill(0);
  if (!Array.isArray(raw)) return out;
  const n = Math.min(raw.length, ROOM_FLAG_BLOCK_SIZE);
  for (let i = 0; i < n; i++) out[i] = num(raw[i]) & 0xff;
  return out;
}

/**
 * Validate a persisted game state field-by-field. Anything missing or the wrong
 * type falls back to the `new Inventory()` default rather than rejecting the
 * whole file — a partially-readable save still beats a lost one.
 */
function coerceState(raw: unknown): SavedGameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const rawStats = (typeof r.stats === 'object' && r.stats !== null ? r.stats : {}) as Record<string, unknown>;
  const rawInv = (typeof r.inventory === 'object' && r.inventory !== null ? r.inventory : {}) as Record<string, unknown>;
  const rawFlags = (typeof r.worldFlags === 'object' && r.worldFlags !== null ? r.worldFlags : {}) as Record<string, unknown>;
  const defaults = new Inventory();

  const worldFlags = {} as Record<WorldFlagBlock, number[]>;
  for (const block of WORLD_FLAG_BLOCKS) {
    worldFlags[block] = coerceFlagBlock(rawFlags[block]);
  }

  return {
    stats: {
      maxHealth: num(rawStats.maxHealth, 6),
      rupees: num(rawStats.rupees),
      keys: num(rawStats.keys),
      bombs: num(rawStats.bombs),
      maxBombs: num(rawStats.maxBombs, 8),
    },
    inventory: {
      selectedBSlot: num(rawInv.selectedBSlot, defaults.selectedBSlot),
      sword: num(rawInv.sword, defaults.sword),
      arrow: num(rawInv.arrow, defaults.arrow),
      candle: num(rawInv.candle, defaults.candle),
      ring: num(rawInv.ring, defaults.ring),
      potion: num(rawInv.potion, defaults.potion),
      letter: num(rawInv.letter, defaults.letter),
      woodBoomerang: bool(rawInv.woodBoomerang),
      magicBoomerang: bool(rawInv.magicBoomerang),
      bow: bool(rawInv.bow),
      flute: bool(rawInv.flute),
      food: bool(rawInv.food),
      wand: bool(rawInv.wand),
      raft: bool(rawInv.raft),
      book: bool(rawInv.book),
      ladder: bool(rawInv.ladder),
      magicKey: bool(rawInv.magicKey),
      bracelet: bool(rawInv.bracelet),
      magicShield: bool(rawInv.magicShield),
      hasBombs: bool(rawInv.hasBombs),
      compass: num(rawInv.compass),
      map: num(rawInv.map),
      compass9: bool(rawInv.compass9),
      map9: bool(rawInv.map9),
      triforce: num(rawInv.triforce),
    },
    worldFlags,
    visitedScreens: Array.isArray(r.visitedScreens)
      ? r.visitedScreens.filter((v): v is number => typeof v === 'number')
      : [],
  };
}

function coerceSlot(raw: unknown): SaveSlot {
  const slot = createEmptySlot();
  if (typeof raw !== 'object' || raw === null) return slot;
  const r = raw as Record<string, unknown>;
  if (typeof r.name === 'string') slot.name = r.name.slice(0, MAX_NAME_LENGTH);
  if (typeof r.quest === 'number' && (r.quest === 1 || r.quest === 2)) slot.quest = r.quest;
  if (typeof r.registered === 'boolean') slot.registered = r.registered;
  if (typeof r.deaths === 'number' && r.deaths >= 0) slot.deaths = Math.floor(r.deaths);
  slot.state = coerceState(r.state);
  return slot;
}

export class SaveManager {
  private readonly storage: StorageLike | null;
  private slots: SaveSlot[];

  /** Pass a storage backend explicitly (tests); omit to use guarded `localStorage`. */
  constructor(storage: StorageLike | null = defaultStorage()) {
    this.storage = storage;
    this.slots = this.load();
  }

  private load(): SaveSlot[] {
    if (!this.storage) return createEmptySlots();
    let text: string | null = null;
    try {
      text = this.storage.getItem(STORAGE_KEY);
      // J1a files carried metadata only. Read them so an existing file still
      // shows up on file select; coerceSlot leaves `state` null, so choosing it
      // starts a fresh game rather than the slot disappearing.
      if (!text) text = this.storage.getItem(LEGACY_STORAGE_KEY);
    } catch {
      return createEmptySlots();
    }
    if (!text) return createEmptySlots();
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return createEmptySlots();
      const slots = createEmptySlots();
      for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
        slots[i] = coerceSlot(parsed[i]);
      }
      return slots;
    } catch {
      // Corrupt JSON — fall back to blank files rather than crashing the title.
      return createEmptySlots();
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.slots));
    } catch {
      // Storage full or blocked — degrade to in-memory only.
    }
  }

  /** All three slots (live references; treat as read-only outside this class). */
  getSlots(): readonly SaveSlot[] {
    return this.slots;
  }

  getSlot(index: number): SaveSlot | null {
    return this.slots[index] ?? null;
  }

  /**
   * Write the full game state into a slot — the NES SAVE option on Mode $08,
   * reached from death or from Start then Up+A (Z_05.asm:362). This is the only
   * path that persists gameplay; there is no autosave.
   */
  saveState(index: number, state: SavedGameState): void {
    const slot = this.slots[index];
    if (!slot || !slot.registered) return;
    slot.state = state;
    this.persist();
  }

  /** The saved game for a slot, or null if it was registered but never saved. */
  getState(index: number): SavedGameState | null {
    return this.slots[index]?.state ?? null;
  }

  /** Register a name into a slot, marking it active. `quest` defaults to 1. */
  register(index: number, name: string, quest = 1): void {
    const slot = this.slots[index];
    if (!slot) return;
    slot.name = name.slice(0, MAX_NAME_LENGTH);
    slot.quest = quest === 2 ? 2 : 1;
    slot.registered = true;
    slot.deaths = 0;
    slot.state = null; // registering re-uses the slot: a fresh file, not a resume
    this.persist();
  }

  /** Blank a slot back to an unused file (Z_02.asm elimination mode). */
  eliminate(index: number): void {
    if (!this.slots[index]) return;
    this.slots[index] = createEmptySlot();
    this.persist();
  }

  /** Increment a slot's death count (shown on file select). */
  recordDeath(index: number): void {
    const slot = this.slots[index];
    if (!slot || !slot.registered) return;
    slot.deaths++;
    this.persist();
  }

  /** Mark a slot as Second Quest (NES SwitchProfileToSecondQuest). */
  switchToSecondQuest(index: number): void {
    const slot = this.slots[index];
    if (!slot || !slot.registered) return;
    slot.quest = 2;
    this.persist();
  }
}
