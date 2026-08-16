// Z_01.asm line 5574: ObjTypeToDamagePoints
// Byte encoding: high nibble = partial heart ($80 ≈ 1 half-heart), low nibble = full hearts
// Types $00–$5C (93 entries). Missing indices default to 0 (no damage).
export const DAMAGE_TABLE: Readonly<Record<number, number>> = {
  0x01: 0x02, // Blue Lynel — 4 half-hearts
  0x02: 0x01, // Red Lynel — 2 half-hearts
  0x03: 0x80, // Blue Moblin — 1 half-heart
  0x04: 0x80, // Red Moblin — 1 half-heart
  0x05: 0x01, // Blue Goriya — 2 half-hearts
  0x06: 0x80, // Red Goriya — 1 half-heart
  0x07: 0x80, // Red Slow Octorok
  0x08: 0x80, // Red Fast Octorok
  0x09: 0x80, // Blue Slow Octorok
  0x0a: 0x80, // Blue Fast Octorok
  0x0b: 0x01, // Red Darknut — 2 half-hearts
  0x0c: 0x02, // Blue Darknut — 4 half-hearts
  0x0d: 0x80, // Blue Tektite
  0x0e: 0x80, // Red Tektite
  0x0f: 0x01, // Blue Leever — 2 half-hearts
  0x10: 0x80, // Red Leever
  0x11: 0x80, // Zora
  0x12: 0x01, // Vire — 2 half-hearts
  0x13: 0x01, // Zol — 2 half-hearts
  0x14: 0x80, // Gel
  0x15: 0x80, // Gel (child)
  0x16: 0x02, // Pols Voice — 4 half-hearts
  0x17: 0x01, // Like-Like — 2 half-hearts
  0x18: 0x02, // Little Digdogger — 4 half-hearts
  0x1a: 0x80, // Peahat
  0x1b: 0x80, // Blue Keese
  0x1c: 0x80, // Red Keese
  0x1d: 0x80, // Black Keese
  0x1e: 0x01, // Armos — 2 half-hearts
  0x1f: 0x80, // Boulder Set
  0x20: 0x80, // Boulder
  0x21: 0x01, // Ghini — 2 half-hearts
  0x22: 0x01, // Flying Ghini — 2 half-hearts
  0x23: 0x02, // Blue Wizzrobe — 4 half-hearts
  0x24: 0x01, // Red Wizzrobe — 2 half-hearts
  0x25: 0x02, // Patra Child — 4 half-hearts
  0x26: 0x02, // Patra Child — 4 half-hearts
  0x27: 0x80, // Wallmaster
  0x28: 0x80, // Rope
  0x2a: 0x80, // Stalfos
  0x2b: 0x00, // Bubble (no damage, sword block)
  0x2c: 0x00, // Bubble
  0x2d: 0x00, // Bubble
  0x2e: 0x00, // Whirlwind (teleports, no damage)
  0x30: 0x02, // Gibdo — 4 half-hearts
  0x31: 0x01, // Blue Dodongo — 2 half-hearts
  0x32: 0x01, // Red Dodongo — 2 half-hearts
  0x33: 0x02, // Blue Gohma — 4 half-hearts
  0x34: 0x02, // Red Gohma — 4 half-hearts
  0x38: 0x02, // Digdogger 1 — 4 half-hearts
  0x39: 0x02, // Digdogger 2 — 4 half-hearts
  0x3a: 0x02, // Lanmola — 4 half-hearts
  0x3b: 0x02, // Lanmola — 4 half-hearts
  0x3c: 0x01, // Manhandla — 2 half-hearts
  0x3d: 0x01, // Aquamentus — 2 half-hearts
  0x3e: 0x04, // Ganon — 8 half-hearts
  0x3f: 0x80, // Guard Fire
  0x40: 0x80, // Standing Fire
  0x41: 0x80, // Moldorm
  0x42: 0x01, // Gleeok (1 head) — 2 half-hearts
  0x43: 0x01, // Gleeok (2 heads)
  0x44: 0x01, // Gleeok (3 heads)
  0x45: 0x01, // Gleeok (4 heads)
  0x46: 0x01, // Gleeok Head (detached) — 2 half-hearts
  0x47: 0x02, // Patra — 4 half-hearts
  0x48: 0x02, // Patra — 4 half-hearts
  0x49: 0x01, // Trap — 2 half-hearts
  0x4a: 0x01, // Trap — 2 half-hearts
  0x53: 0x80, // Flying Rock (Octorok shot) — 1 half-heart
  0x54: 0x80, // Monster Shot — 1 half-heart
  0x55: 0x80, // Fireball 1 — 1 half-heart
  0x56: 0x01, // Fireball 2 (unblockable) — 2 half-hearts
  0x57: 0x02, // Monster Shot — 4 half-hearts
  0x58: 0x02, // Monster Shot — 4 half-hearts
  0x59: 0x04, // Monster Shot — 8 half-hearts
  0x5a: 0x04, // Monster Shot (unblockable) — 8 half-hearts
  0x5b: 0x80, // Monster Arrow — 1 half-heart
  0x5c: 0x01, // Monster Boomerang — 2 half-hearts
};

export interface DecodedDamage {
  readonly fullHearts: number;
  readonly partialHeart: number;
}

// Z_01.asm HarmLink: low nibble = full hearts, high nibble = partial heart value
export function decodeDamage(rawByte: number): DecodedDamage {
  return {
    fullHearts: rawByte & 0x0f,
    partialHeart: rawByte & 0xf0,
  };
}

// Z_01.asm Link_BeHarmed: ring reduction via 16-bit right shift
// Returns damage in half-heart units.
export function calculateDamage(rawByte: number, ringLevel: number): number {
  const decoded = decodeDamage(rawByte);
  // Build 16-bit value: [fullHearts (high byte) : partialHeart (low byte)]
  let high = decoded.fullHearts;
  let low = decoded.partialHeart;

  // Ring reduction: shift right once per ring level
  for (let i = 0; i < ringLevel; i++) {
    const carry = high & 1;
    high >>>= 1;
    low = ((carry << 7) | (low >>> 1)) & 0xff;
  }

  // Convert to half-hearts: each fullHeart = 2 half-hearts, partialHeart >= $80 = 1 half-heart
  let halfHearts = high * 2;
  if (low >= 0x80) halfHearts++;

  return Math.max(halfHearts, rawByte > 0 ? 1 : 0);
}
