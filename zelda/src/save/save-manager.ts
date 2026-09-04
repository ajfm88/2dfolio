// Save-slot model + persistence seam.
//
// J1 introduces the front-end concept of three save files. The NES stores each
// file's name, quest number, life/heart totals, and death count in cartridge
// SRAM (Z_02.asm save-slot info). For now we persist only the *metadata* needed
// to draw the file-select screen and start a game; slice **L1** replaces the
// backing store with IndexedDB and widens `SaveSlot` to the full game state
// (inventory, hearts, dungeon progress, Triforce count). Keep this shape
// minimal and additive so L1 is an extension, not a rewrite.

export const SAVE_SLOT_COUNT = 3;
export const MAX_NAME_LENGTH = 8; // NES name field is 8 characters (Z_02.asm)

const STORAGE_KEY = 'zelda-nes:saves:v1';

/** One save file's metadata. L1 will add the persisted game-state fields. */
export interface SaveSlot {
  /** Registered name, up to 8 chars. Empty string when the slot is unused. */
  name: string;
  /** 1 = first quest, 2 = second quest. */
  quest: number;
  /** True once a name has been registered into this slot. */
  registered: boolean;
  /** Death count shown on the file-select screen (NES "-DEATHS-"). */
  deaths: number;
}

/** Minimal subset of the Web Storage API we depend on — lets tests inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createEmptySlot(): SaveSlot {
  return { name: '', quest: 1, registered: false, deaths: 0 };
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

function coerceSlot(raw: unknown): SaveSlot {
  const slot = createEmptySlot();
  if (typeof raw !== 'object' || raw === null) return slot;
  const r = raw as Record<string, unknown>;
  if (typeof r.name === 'string') slot.name = r.name.slice(0, MAX_NAME_LENGTH);
  if (typeof r.quest === 'number' && (r.quest === 1 || r.quest === 2)) slot.quest = r.quest;
  if (typeof r.registered === 'boolean') slot.registered = r.registered;
  if (typeof r.deaths === 'number' && r.deaths >= 0) slot.deaths = Math.floor(r.deaths);
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

  /** Register a name into a slot, marking it active. `quest` defaults to 1. */
  register(index: number, name: string, quest = 1): void {
    const slot = this.slots[index];
    if (!slot) return;
    slot.name = name.slice(0, MAX_NAME_LENGTH);
    slot.quest = quest === 2 ? 2 : 1;
    slot.registered = true;
    slot.deaths = 0;
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
