// Z_04.asm:11512 Directions8 — NES direction bits: R=1, L=2, D=4, U=8.
export const DIRECTIONS8 = [0x08, 0x09, 0x01, 0x05, 0x04, 0x06, 0x02, 0x0a] as const;

/** GetObjDir8Index: index of an 8-way direction; 0 when not found. */
export function dir8Index(dir: number): number {
  const i = DIRECTIONS8.indexOf(dir as (typeof DIRECTIONS8)[number]);
  return i < 0 ? 0 : i;
}

export function dir8At(index: number): number {
  return DIRECTIONS8[((index % 8) + 8) % 8]!;
}

/**
 * Z_04.asm:11693 TurnTowardsPlayer8 — at most one 45° step per call. Keeps the current
 * direction if the target is within one step of it; otherwise turns toward a
 * shared component, but only when (candidate | target) < 7 — so any target with
 * an Up component never pulls the flyer around, and it turns right instead. That
 * quirk is the NES's; don't "fix" it.
 */
export function turnTowardsTarget8(dir: number, target: number): number {
  const idx = dir8Index(dir);
  for (const i of [idx + 1, idx, idx - 1]) {
    if (dir8At(i) === target) return dir;
  }
  for (const i of [idx - 1, idx, idx + 1]) {
    const candidate = dir8At(i);
    if ((candidate & target) !== 0 && (candidate | target) < 7) return candidate;
  }
  return dir8At(idx + 1);
}

/** Z_04.asm:11828 TurnRandomlyDir8 — r >= $A0 keep, >= $50 turn right, else turn left. */
export function turnRandomly8(dir: number, r: number): number {
  const idx = dir8Index(dir);
  if (r >= 0xa0) return dir8At(idx);
  if (r >= 0x50) return dir8At(idx + 1);
  return dir8At(idx - 1);
}
