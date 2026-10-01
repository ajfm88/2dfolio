// Pikachu happiness/mood system, emotion face selection, and animation scripts
// Assembly ref: engine/pikachu/pikachu_emotions.asm, data/pikachu/pikachu_pic_animation.asm

import type { BattlePokemon } from '../battle';

// --- State ---
let pikachuHappiness = 90;   // assembly init_player_data default
let pikachuMood = 0x80;       // 128 = neutral

export function getPikachuHappiness(): number { return pikachuHappiness; }
export function getPikachuMood(): number { return pikachuMood; }

export function resetPikachuHappiness(): void {
  pikachuHappiness = 90;
  pikachuMood = 0x80;
}

export function restorePikachuHappiness(h: number, m: number): void {
  pikachuHappiness = h;
  pikachuMood = m;
}

// --- Face selection matrix ---
function getMoodColumn(mood: number): number {
  if (mood <= 40) return 0;
  if (mood <= 127) return 1;
  if (mood === 128) return 2;
  if (mood <= 210) return 3;
  return 4;
}

const HAPPINESS_MATRIX: [number, number[]][] = [
  [50,  [14, 14,  6, 13, 13]],
  [100, [ 9,  9,  5, 12, 12]],
  [130, [ 3,  3,  1,  8,  8]],
  [160, [ 3,  3,  4, 15, 15]],
  [200, [17, 17,  7,  2,  2]],
  [250, [17, 17, 16, 10, 10]],
  [255, [17, 17, 19, 20, 20]],
];

function getScriptFromMatrix(happiness: number, mood: number): number {
  const col = getMoodColumn(mood);
  for (const [threshold, scripts] of HAPPINESS_MATRIX) {
    if (happiness <= threshold) return scripts[col];
  }
  return HAPPINESS_MATRIX[HAPPINESS_MATRIX.length - 1][1][col];
}

// --- Animation script data ---
// Each assembly tick = ~50ms (3 vblanks). Frame sequences loop when they reach the end.

export interface OverlayInfo {
  path: string;
  x: number;  // pixel offset within 40x40 face
  y: number;
}

/** A single frame in the animation sequence. null overlay = show base only (delay). */
export interface AnimFrame {
  overlay: number | null; // overlay index, or null for delay
  ticks: number;          // duration in assembly ticks
}

export interface PikachuAnimScript {
  baseFace: string;
  overlays: OverlayInfo[];
  frames: AnimFrame[];
  duration: number; // total ticks before auto-close
}

const P = '/gfx/pikachu';

// d = delay frame, o = overlay frame
function d(ticks: number): AnimFrame { return { overlay: null, ticks }; }
function o(ticks: number, idx = 0): AnimFrame { return { overlay: idx, ticks }; }

const ANIM_SCRIPTS: Record<number, PikachuAnimScript> = {
  // Script 1 — Neutral (blink)
  1: {
    baseFace: `${P}/unknown_e4000.png`,
    overlays: [{ path: `${P}/unknown_e40cc.png`, x: 0, y: 16 }], // 40x8 eye blink strip at row 2
    frames: [d(2), o(4), d(8), o(4), d(64), o(4), d(64)],
    duration: 40,
  },
  // Script 2 — Happy (eye squint)
  2: {
    baseFace: `${P}/unknown_e411c.png`,
    overlays: [{ path: `${P}/unknown_e41d2.png`, x: 0, y: 24 }], // 40x16 squint at rows 3-4
    frames: [d(4), o(4), d(4), o(4), d(8), o(4), d(8), o(4)],
    duration: 44,
  },
  // Script 3 — Slightly unhappy (tear)
  3: {
    baseFace: `${P}/unknown_e4272.png`,
    overlays: [{ path: `${P}/unknown_e4323.png`, x: 0, y: 0 }], // 16x24 tear at top-left
    frames: [o(1), d(1), o(1), d(64), o(1), d(64)],
    duration: 80,
  },
  // Script 4 — Excited (bounce)
  4: {
    baseFace: `${P}/unknown_e4383.png`,
    overlays: [{ path: `${P}/unknown_e444b.png`, x: 0, y: 8 }], // 40x32 body bounce at rows 1-4
    frames: [d(8), o(8), d(20), o(8)],
    duration: 70,
  },
  // Script 5 — Annoyed (anger mark)
  5: {
    baseFace: `${P}/unknown_e458b.png`,
    overlays: [{ path: `${P}/unknown_e463b.png`, x: 24, y: 8 }], // 16x16 anger mark at top-right
    frames: [d(2), o(2), d(2), o(64), d(3), o(64)],
    duration: 32,
  },
  // Script 6 — Angry (anger vein)
  6: {
    baseFace: `${P}/unknown_e467b.png`,
    overlays: [{ path: `${P}/unknown_e472e.png`, x: 0, y: 16 }], // 16x16 anger vein at bottom-left
    frames: [d(8), o(64), d(4), o(64)],
    duration: 50,
  },
  // Script 7 — Determined (expression swap)
  7: {
    baseFace: `${P}/unknown_e476e.png`,
    overlays: [{ path: `${P}/unknown_e4841.png`, x: 0, y: 0 }], // 40x40 full face swap
    frames: [o(8), d(2), o(8), d(2), o(8)],
    duration: 58,
  },
  // Script 8 — Curious (ear twitch)
  8: {
    baseFace: `${P}/unknown_e49d1.png`,
    overlays: [{ path: `${P}/unknown_e4a99.png`, x: 0, y: 16 }], // 40x16 ear twitch at rows 2-3
    frames: [o(4), d(8), o(4), d(64), o(4), d(64)],
    duration: 44,
  },
  // Script 9 — Worried (sweat)
  9: {
    baseFace: `${P}/unknown_e4b39.png`,
    overlays: [{ path: `${P}/unknown_e4bde.png`, x: 0, y: 16 }], // 16x24 sweat at left rows 2-4
    frames: [d(2), o(2), d(2), o(2), d(20), o(2)],
    duration: 56,
  },
  // Script 10 — Love (2 overlay cycle)
  10: {
    baseFace: `${P}/unknown_e4c3e.png`,
    overlays: [
      { path: `${P}/unknown_e4ce0.png`, x: 0, y: 0 }, // 40x40 alternate heart
      { path: `${P}/unknown_e4e70.png`, x: 0, y: 0 }, // 40x40 heart arms up
    ],
    frames: [d(8), o(3, 0), o(5, 1), o(3, 0), d(5)],
    duration: 56,
  },
  // Script 11 — Sleeping
  11: {
    baseFace: `${P}/unknown_e5000.png`,
    overlays: [{ path: `${P}/unknown_e50af.png`, x: 0, y: 0 }], // 40x40 sleeping face
    frames: [d(20), o(8), d(20), o(8)],
    duration: 100,
  },
  // Script 12 — Singing (music note)
  12: {
    baseFace: `${P}/unknown_e523f.png`,
    overlays: [{ path: `${P}/unknown_e52fe.png`, x: 0, y: 0 }], // 40x40 singing overlay
    frames: [d(13), o(12), d(100), o(8)],
    duration: 50,
  },
  // Script 13 — Grumpy/pouting
  13: {
    baseFace: `${P}/unknown_e548e.png`,
    overlays: [{ path: `${P}/unknown_e5541.png`, x: 0, y: 0 }], // 40x40 pout overlay
    frames: [d(5), o(5), d(5), o(5), d(100)],
    duration: 50,
  },
  // Script 14 — Very angry (electric flash)
  14: {
    baseFace: `${P}/unknown_e56d1.png`,
    overlays: [{ path: `${P}/unknown_e5794.png`, x: 0, y: 0 }], // 40x40 thunderbolt anger
    frames: [d(2), o(2), d(2), o(2)],
    duration: 40,
  },
  // Script 15 — Pleased
  15: {
    baseFace: `${P}/unknown_e5924.png`,
    overlays: [{ path: `${P}/unknown_e59ed.png`, x: 0, y: 0 }], // 40x40 pleased alternate
    frames: [d(5), o(5), d(5), o(5)],
    duration: 50,
  },
  // Script 16 — Delighted (heart)
  16: {
    baseFace: `${P}/unknown_e5b7d.png`,
    overlays: [{ path: `${P}/unknown_e5c4d.png`, x: 0, y: 0 }], // 40x40 delighted overlay
    frames: [o(8), d(100)],
    duration: 32,
  },
  // Script 17 — Very unhappy (slow pulse)
  17: {
    baseFace: `${P}/unknown_e5ddd.png`,
    overlays: [{ path: `${P}/unknown_e5e90.png`, x: 0, y: 0 }], // 40x40 ecstatic overlay
    frames: [d(10), o(3), d(3), o(3), d(100)],
    duration: 100,
  },
  // Script 19 — Happy hearts (pulse)
  19: {
    baseFace: `${P}/unknown_e6340.png`,
    overlays: [{ path: `${P}/unknown_e63f7.png`, x: 0, y: 0 }], // 40x40 hearts bigger
    frames: [o(6), d(6), o(6), d(6)],
    duration: 44,
  },
  // Script 20 — Overjoyed (sparkle)
  20: {
    baseFace: `${P}/unknown_e6587.png`,
    overlays: [{ path: `${P}/unknown_e6646.png`, x: 0, y: 0 }], // 40x40 sparkle overlay
    frames: [d(8), o(12), d(8), o(12)],
    duration: 50,
  },
  // Script 28 — Sick (oscillation)
  28: {
    baseFace: `${P}/unknown_f0cf4.png`,
    overlays: [{ path: `${P}/unknown_f0d82.png`, x: 0, y: 0 }], // 40x40 sick overlay
    frames: [d(12), o(12), d(12), o(100)],
    duration: 64,
  },
};

/** Get the animation script for Pikachu's current emotion. */
export function getPikachuAnimScript(party: BattlePokemon[]): PikachuAnimScript {
  // Check Pikachu status
  const pikachu = party.find(p => p.species.id === 25);
  if (pikachu) {
    if (pikachu.status === 'SLP') return ANIM_SCRIPTS[11];
    if (pikachu.status !== null) return ANIM_SCRIPTS[28];
  }

  const scriptNum = getScriptFromMatrix(pikachuHappiness, pikachuMood);
  return ANIM_SCRIPTS[scriptNum] ?? ANIM_SCRIPTS[1];
}

// Keep for backward compat (used nowhere now but exports say so)
export function getPikachuFacePath(party: BattlePokemon[]): string {
  return getPikachuAnimScript(party).baseFace;
}

// --- Happiness modifiers ---
type HappinessEvent = 'LEVELUP' | 'FAINTED' | 'WALKING' | 'GYMLEADER' | 'USEDITEM' | 'USEDXITEM' | 'CARELESSTRAINER';

interface HappinessMod {
  tiers: [number, number, number];
  moodTarget: number;
}

const HAPPINESS_MODS: Record<HappinessEvent, HappinessMod> = {
  LEVELUP:  { tiers: [5, 3, 2],    moodTarget: 0x8A },
  FAINTED:  { tiers: [-1, -1, -1], moodTarget: 0x6C },
  WALKING:  { tiers: [2, 1, 1],    moodTarget: 0x80 },
  GYMLEADER:       { tiers: [3, 2, 1],       moodTarget: 0x80 },
  USEDITEM:        { tiers: [5, 3, 2],       moodTarget: 0x83 },
  USEDXITEM:       { tiers: [1, 1, 0],       moodTarget: 0x80 },
  CARELESSTRAINER: { tiers: [-5, -5, -10],   moodTarget: 0x6C },
};

export function modifyPikachuHappiness(event: HappinessEvent): void {
  const mod = HAPPINESS_MODS[event];
  if (!mod) return;

  const tier = pikachuHappiness < 100 ? 0 : pikachuHappiness < 200 ? 1 : 2;
  const delta = mod.tiers[tier];

  pikachuHappiness = Math.max(0, Math.min(255, pikachuHappiness + delta));

  if (pikachuMood < mod.moodTarget) {
    pikachuMood = Math.min(255, pikachuMood + 1);
  } else if (pikachuMood > mod.moodTarget) {
    pikachuMood = Math.max(0, pikachuMood - 1);
  }
}
