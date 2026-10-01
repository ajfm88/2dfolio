// Pokedex seen/owned state — tracks which Pokemon the player has seen and caught
// Same singleton pattern as events.ts

const seen = new Set<number>();
const owned = new Set<number>();

export function markSeen(dexNum: number): void {
  seen.add(dexNum);
}

export function markOwned(dexNum: number): void {
  seen.add(dexNum);
  owned.add(dexNum);
}

export function isSeen(dexNum: number): boolean {
  return seen.has(dexNum);
}

export function isOwned(dexNum: number): boolean {
  return owned.has(dexNum);
}

export function getSeenCount(): number {
  return seen.size;
}

export function getOwnedCount(): number {
  return owned.size;
}

export function getSeenList(): number[] {
  return [...seen];
}

export function getOwnedList(): number[] {
  return [...owned];
}

/** Highest dex number the player has seen (0 if none). */
export function getMaxSeen(): number {
  return seen.size ? Math.max(...seen) : 0;
}

/** Restore from save data. */
export function restorePokedex(seenList: number[], ownedList: number[]): void {
  seen.clear();
  owned.clear();
  for (const n of seenList) seen.add(n);
  for (const n of ownedList) {
    seen.add(n);
    owned.add(n);
  }
}
