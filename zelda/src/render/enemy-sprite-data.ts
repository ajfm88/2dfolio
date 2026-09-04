// Sprite coordinates for dungeon-enemies.png (Mister Mike / Spriters Resource)
// Sheet is 457×228 with green (#008000) transparency key.
// Sprites are grouped in labeled sections with irregular spacing.
// Coordinates measured from pixel-level analysis.

import type { Renderer } from './renderer.js';

export interface SpriteRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

// Processed (transparency-applied) dungeon enemy sprite source
let dungeonEnemySource: CanvasImageSource | null = null;

export function initDungeonEnemySprites(image: HTMLImageElement): void {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  // Green background: R=0, G=128, B=0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! < 3 && Math.abs(d[i + 1]! - 128) < 3 && d[i + 2]! < 3) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  dungeonEnemySource = canvas;
}

export function drawDungeonEnemySprite(
  renderer: Renderer, rect: SpriteRect, dx: number, dy: number,
): void {
  if (!dungeonEnemySource) return;
  renderer.drawImage(
    dungeonEnemySource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, rect.sw, rect.sh,
  );
}

export function drawDungeonEnemySpriteScaled(
  renderer: Renderer, rect: SpriteRect,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (!dungeonEnemySource) return;
  renderer.drawImage(
    dungeonEnemySource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, dw, dh,
  );
}

// ─── Section 1: y=11 (row 1), y=28 (row 2) ───
// Gel, Zol, Keese, Goriya, Bubble, Wallmaster

export const GEL_SPRITES = {
  green: [
    { sx: 1, sy: 11, sw: 8, sh: 16 },
    { sx: 10, sy: 11, sw: 8, sh: 16 },
  ],
  greenAlt: [
    { sx: 1, sy: 28, sw: 8, sh: 16 },
    { sx: 10, sy: 28, sw: 8, sh: 16 },
  ],
  blue: [
    { sx: 37, sy: 11, sw: 8, sh: 16 },
    { sx: 46, sy: 11, sw: 8, sh: 16 },
  ],
  blueAlt: [
    { sx: 37, sy: 28, sw: 8, sh: 16 },
    { sx: 46, sy: 28, sw: 8, sh: 16 },
  ],
} as const;

export const ZOL_SPRITES = {
  green: [
    { sx: 77, sy: 11, sw: 16, sh: 16 },
    { sx: 94, sy: 11, sw: 16, sh: 16 },
  ],
  greenAlt: [
    { sx: 77, sy: 28, sw: 16, sh: 16 },
    { sx: 94, sy: 28, sw: 16, sh: 16 },
  ],
  blue: [
    { sx: 111, sy: 11, sw: 16, sh: 16 },
    { sx: 128, sy: 11, sw: 16, sh: 16 },
  ],
  blueAlt: [
    { sx: 111, sy: 28, sw: 16, sh: 16 },
    { sx: 128, sy: 28, sw: 16, sh: 16 },
  ],
} as const;

// Keese: 3 colors × 2 frames per row
export const KEESE_SPRITES = {
  blue: [
    { sx: 183, sy: 11, sw: 16, sh: 16 },
    { sx: 200, sy: 11, sw: 16, sh: 16 },
  ],
  blueAlt: [
    { sx: 183, sy: 28, sw: 16, sh: 16 },
    { sx: 200, sy: 28, sw: 16, sh: 16 },
  ],
  red: [
    { sx: 222, sy: 11, sw: 16, sh: 16 },
    { sx: 239, sy: 11, sw: 16, sh: 16 },
  ],
  redAlt: [
    { sx: 222, sy: 28, sw: 16, sh: 16 },
    { sx: 239, sy: 28, sw: 16, sh: 16 },
  ],
  dark: [
    { sx: 256, sy: 11, sw: 16, sh: 16 },
    { sx: 273, sy: 11, sw: 16, sh: 16 },
  ],
  darkAlt: [
    { sx: 256, sy: 28, sw: 16, sh: 16 },
    { sx: 273, sy: 28, sw: 16, sh: 16 },
  ],
} as const;

// Bubble: 3 types, small sprites (8×16 with transparency padding)
export const BUBBLE_SPRITES = {
  flash: { sx: 290, sy: 11, sw: 8, sh: 16 },
  blue: { sx: 299, sy: 11, sw: 8, sh: 16 },
  red: { sx: 308, sy: 11, sw: 8, sh: 16 },
} as const;

// Goriya red: 4 directions (single frame per direction in this sheet)
// Down=0, Left=1, Up=2, Right=3
export const GORIYA_SPRITES = {
  red: [
    { sx: 321, sy: 11, sw: 16, sh: 16 }, // Down
    { sx: 338, sy: 11, sw: 16, sh: 16 }, // Left
    { sx: 355, sy: 11, sw: 16, sh: 16 }, // Up
    { sx: 372, sy: 11, sw: 16, sh: 16 }, // Right
  ],
  // Blue goriya uses same positions in row 2 if available, else tinted
  blue: [
    { sx: 321, sy: 28, sw: 16, sh: 16 },
    { sx: 338, sy: 28, sw: 16, sh: 16 },
    { sx: 355, sy: 28, sw: 16, sh: 16 },
    { sx: 372, sy: 28, sw: 16, sh: 16 },
  ],
} as const;

// Wallmaster: 2 animation frames
export const WALLMASTER_SPRITES = [
  { sx: 393, sy: 11, sw: 16, sh: 16 },
  { sx: 410, sy: 11, sw: 16, sh: 16 },
] as const;

// ─── Section 2: y=59 ───
// Stalfos, Rope, Blade Trap, Projectile/Moldorm, Lanmola

export const STALFOS_SPRITES = [
  { sx: 1, sy: 59, sw: 16, sh: 16 },
] as const;

// Rope: Left and Right directions (2 frames each)
export const ROPE_SPRITES = {
  frames: [
    { sx: 54, sy: 59, sw: 16, sh: 16 },
    { sx: 71, sy: 59, sw: 16, sh: 16 },
    { sx: 88, sy: 59, sw: 16, sh: 16 },
    { sx: 105, sy: 59, sw: 16, sh: 16 },
  ],
} as const;

// Spike/Blade Trap
export const SPIKE_TRAP_SPRITES = [
  { sx: 126, sy: 59, sw: 16, sh: 16 },
] as const;

// Lanmola body segments (8×8 or 8×16)
export const LANMOLA_SPRITES = {
  head: [
    { sx: 351, sy: 59, sw: 8, sh: 16 },
    { sx: 360, sy: 59, sw: 8, sh: 16 },
  ],
  body: [
    { sx: 369, sy: 59, sw: 8, sh: 16 },
    { sx: 378, sy: 59, sw: 8, sh: 16 },
  ],
} as const;

// ─── Section 3: y=90 (row 1), y=107 (row 2) ───
// Darknut, Gibdo, Wizzrobe, Vire, Pols Voice, Like Like

// Darknut: 4 directions × 2 colors, row1=frame1, row2=frame2
// Down=0, Left=1, Up=2, Right=3
export const DARKNUT_SPRITES = {
  red: {
    row1: [
      { sx: 1, sy: 90, sw: 16, sh: 16 },
      { sx: 18, sy: 90, sw: 16, sh: 16 },
      { sx: 35, sy: 90, sw: 16, sh: 16 },
      { sx: 52, sy: 90, sw: 16, sh: 16 },
    ],
    row2: [
      { sx: 1, sy: 107, sw: 16, sh: 16 },
      { sx: 18, sy: 107, sw: 16, sh: 16 },
      { sx: 35, sy: 107, sw: 16, sh: 16 },
      { sx: 52, sy: 107, sw: 16, sh: 16 },
    ],
  },
  blue: {
    row1: [
      { sx: 69, sy: 90, sw: 16, sh: 16 },
      { sx: 90, sy: 90, sw: 16, sh: 16 },
      { sx: 69, sy: 90, sw: 16, sh: 16 }, // reuse — only 2 blue shown
      { sx: 90, sy: 90, sw: 16, sh: 16 },
    ],
    row2: [
      { sx: 69, sy: 107, sw: 16, sh: 16 },
      { sx: 90, sy: 107, sw: 16, sh: 16 },
      { sx: 69, sy: 107, sw: 16, sh: 16 },
      { sx: 90, sy: 107, sw: 16, sh: 16 },
    ],
  },
} as const;

// Gibdo: 2 frames (row1, row2)
export const GIBDO_SPRITES = [
  { sx: 126, sy: 90, sw: 16, sh: 16 },
  { sx: 126, sy: 107, sw: 16, sh: 16 },
] as const;

// Wizzrobe: blue and red variants, 2 frames each
export const WIZZROBE_SPRITES = {
  blue: [
    { sx: 160, sy: 90, sw: 16, sh: 16 },
    { sx: 160, sy: 107, sw: 16, sh: 16 },
  ],
  red: [
    { sx: 198, sy: 90, sw: 16, sh: 16 },
    { sx: 198, sy: 107, sw: 16, sh: 16 },
  ],
} as const;

// Vire: 2 frames
export const VIRE_SPRITES = [
  { sx: 270, sy: 90, sw: 16, sh: 16 },
  { sx: 287, sy: 90, sw: 16, sh: 16 },
] as const;

// Pols Voice: 2 frames
export const POLS_VOICE_SPRITES = [
  { sx: 321, sy: 90, sw: 16, sh: 16 },
  { sx: 338, sy: 90, sw: 16, sh: 16 },
] as const;

// Like Like: 2 frames
export const LIKE_LIKE_SPRITES = [
  { sx: 393, sy: 90, sw: 16, sh: 16 },
  { sx: 410, sy: 90, sw: 16, sh: 16 },
] as const;

// ─── Overworld enemies from overworld-enemies-alt.png ───
// Sheet is 302×201 with green (#008000) background.
// Processed at init time alongside dungeon enemies.

let overworldEnemySource: CanvasImageSource | null = null;

export function initOverworldEnemySprites(image: HTMLImageElement): void {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! < 3 && Math.abs(d[i + 1]! - 128) < 3 && d[i + 2]! < 3) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  overworldEnemySource = canvas;
}

export function drawOverworldEnemySprite(
  renderer: Renderer, rect: SpriteRect, dx: number, dy: number,
): void {
  if (!overworldEnemySource) return;
  renderer.drawImage(
    overworldEnemySource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, rect.sw, rect.sh,
  );
}

// Zora: surface sprite + emerging/submerging partial
export const ZORA_SPRITES = [
  { sx: 189, sy: 11, sw: 16, sh: 16 },
  { sx: 206, sy: 11, sw: 16, sh: 16 },
] as const;

// Leever: 5 sprites — underground, emerging, surface×2 (blue), submerging
export const LEEVER_SPRITES = {
  blue: {
    underground: { sx: 1, sy: 59, sw: 16, sh: 16 },
    emerging: { sx: 18, sy: 59, sw: 16, sh: 16 },
    surface: [
      { sx: 35, sy: 59, sw: 16, sh: 16 },
      { sx: 52, sy: 59, sw: 16, sh: 16 },
    ],
    submerging: { sx: 69, sy: 59, sw: 16, sh: 16 },
  },
  red: {
    underground: { sx: 35, sy: 76, sw: 16, sh: 16 },
    emerging: { sx: 52, sy: 76, sw: 16, sh: 16 },
    surface: [
      { sx: 69, sy: 76, sw: 16, sh: 16 },
      { sx: 69, sy: 76, sw: 16, sh: 16 },
    ],
    submerging: { sx: 52, sy: 76, sw: 16, sh: 16 },
  },
} as const;

// Peahat: 2 animation frames
export const PEAHAT_SPRITES = [
  { sx: 162, sy: 59, sw: 16, sh: 16 },
  { sx: 179, sy: 59, sw: 16, sh: 16 },
] as const;

// Ghini: 2 frames
export const GHINI_SPRITES = [
  { sx: 248, sy: 59, sw: 16, sh: 16 },
  { sx: 265, sy: 59, sw: 16, sh: 16 },
] as const;

// Armos: sprite from Section 2 row 2
export const ARMOS_SPRITES = [
  { sx: 285, sy: 76, sw: 16, sh: 16 },
] as const;

// ─── Death animation (from enemy-dies.png) ───
// enemy-dies.png is 16×96: 6 vertical frames (16×16 each)
let deathSource: CanvasImageSource | null = null;

export function initDeathSprites(image: HTMLImageElement): void {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  // Transparency: detect from pixel (0,0)
  const keyR = d[0]!, keyG = d[1]!, keyB = d[2]!;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i]! - keyR) < 3 && Math.abs(d[i + 1]! - keyG) < 3 && Math.abs(d[i + 2]! - keyB) < 3) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  deathSource = canvas;
}

export function drawDeathFrame(renderer: Renderer, frameIndex: number, dx: number, dy: number): void {
  if (!deathSource) return;
  const sy = Math.min(frameIndex, 5) * 16;
  renderer.drawImage(deathSource, 0, sy, 16, 16, dx, dy, 16, 16);
}

// ─── Spawn cloud (from enemy-spawn.png) ───
// enemy-spawn.png is 16×64: 4 vertical frames (16×16 each)
let spawnSource: CanvasImageSource | null = null;

export function initSpawnSprites(image: HTMLImageElement): void {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const keyR = d[0]!, keyG = d[1]!, keyB = d[2]!;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i]! - keyR) < 3 && Math.abs(d[i + 1]! - keyG) < 3 && Math.abs(d[i + 2]! - keyB) < 3) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  spawnSource = canvas;
}

export function drawSpawnFrame(renderer: Renderer, frameIndex: number, dx: number, dy: number): void {
  if (!spawnSource) return;
  const sy = Math.min(frameIndex, 3) * 16;
  renderer.drawImage(spawnSource, 0, sy, 16, 16, dx, dy, 16, 16);
}
