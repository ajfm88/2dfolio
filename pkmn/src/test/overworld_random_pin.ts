// Test seam (DECISIONS #91): pin the overworld's Random to one byte, the way the old tests pinned Math.random.
// setup.ts unpins after every test.
import { currentOverworldRandom, installOverworldRandom, type OverworldRandomOwner } from '../overworld/overworld_random';

let saved: OverworldRandomOwner | undefined;

/** Every Random returns `byte`, and hRandomAdd = hRandomSub = `byte` (so the encounter reads it for both). */
export function pinOverworldRandom(byte: number): void {
  saved ??= currentOverworldRandom();
  const value = byte & 0xff;
  installOverworldRandom({ hRandomAdd: value, hRandomSub: value, carry: 0, random: () => value });
}

export function unpinOverworldRandom(): void {
  if (saved) installOverworldRandom(saved);
  saved = undefined;
}
