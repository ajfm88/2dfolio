// Boss sprite coordinates for bosses.png (Mister Mike / Spriters Resource)
// Sheet is 494×296 with green (#008000) transparency key.
// NPC sprite coordinates for npcs.png — 280×256 with cyan (#00FFFF) background.
// Coordinates measured from pixel-level analysis.

import type { Renderer } from './renderer.js';
import { applyTransparency, keyColor, SPRITE_BOX_GREY } from './transparency.js';

export interface SpriteRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

let bossSource: CanvasImageSource | null = null;
let npcSource: CanvasImageSource | null = null;
let linkEndingSource: CanvasImageSource | null = null;

// Both sheets carry a grey backing box behind each sprite on top of the outer
// green/cyan field; see src/render/transparency.ts for why the secondary colour
// needs a flood fill rather than a plain colour match.
const GREY_BOX = keyColor(...SPRITE_BOX_GREY);

export function initBossSprites(image: HTMLImageElement): void {
  bossSource = applyTransparency(image, {
    primary: (r, g, b) => r < 3 && Math.abs(g - 128) < 3 && b < 3,
    secondary: GREY_BOX,
  });
}

export function initNpcSprites(image: HTMLImageElement): void {
  npcSource = applyTransparency(image, {
    primary: (r, g, b) => r < 3 && g > 252 && b > 252,
    secondary: GREY_BOX,
  });
}

export function drawBossSprite(
  renderer: Renderer, rect: SpriteRect, dx: number, dy: number,
): void {
  if (!bossSource) return;
  renderer.drawImage(
    bossSource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, rect.sw, rect.sh,
  );
}

export function drawBossSpriteScaled(
  renderer: Renderer, rect: SpriteRect,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (!bossSource) return;
  renderer.drawImage(
    bossSource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, dw, dh,
  );
}

export function initLinkEndingSprite(image: HTMLImageElement): void {
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
  linkEndingSource = canvas;
}

// link.png: 15 cols, 1px spacing, 16×16 cells. Frame 0 = facing down standing.
const LINK_CELL = 17; // 16px + 1px spacing
export function drawLinkEndingSprite(renderer: Renderer, dx: number, dy: number): void {
  if (!linkEndingSource) return;
  renderer.drawImage(linkEndingSource, 0, 0, 16, 16, dx, dy, 16, 16);
}

// Link facing up for triforce hold pose (row 0, col 2 = up direction)
export function drawLinkEndingSpriteUp(renderer: Renderer, dx: number, dy: number): void {
  if (!linkEndingSource) return;
  renderer.drawImage(linkEndingSource, LINK_CELL * 2, 0, 16, 16, dx, dy, 16, 16);
}

/** True once initNpcSprites has run — lets callers keep a procedural fallback. */
export function hasNpcSprites(): boolean {
  return npcSource !== null;
}

export function drawNpcSprite(
  renderer: Renderer, rect: SpriteRect, dx: number, dy: number,
): void {
  if (!npcSource) return;
  renderer.drawImage(
    npcSource,
    rect.sx, rect.sy, rect.sw, rect.sh,
    dx, dy, rect.sw, rect.sh,
  );
}

// ═══════════════════════════════════════════════════════════════════
// AQUAMENTUS — 4 frames at y=11, each 24×32
// Frames: mouth-closed walk1, mouth-closed walk2, mouth-open walk1, mouth-open walk2
// ═══════════════════════════════════════════════════════════════════

export const AQUAMENTUS_SPRITES = {
  mouthClosed: [
    { sx: 1, sy: 11, sw: 24, sh: 32 },
    { sx: 26, sy: 11, sw: 24, sh: 32 },
  ],
  mouthOpen: [
    { sx: 51, sy: 11, sw: 24, sh: 32 },
    { sx: 76, sy: 11, sw: 24, sh: 32 },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════
// DODONGO — y=58, mixed sizes
// Left half: 4 individual 16×16 "head" tiles at y=58
// Right: 3 full-body 32×16 composites (facing right walk1, walk2, facing left)
// The 16×16 tiles are body parts; the 32×16 are pre-composed sprites
// ═══════════════════════════════════════════════════════════════════

export const DODONGO_SPRITES = {
  // Full 32-wide body composites — these show facing directions
  // The NES Dodongo is 32×16: 2 tiles wide × 1 tall
  right: [
    { sx: 69, sy: 58, sw: 32, sh: 16 },
    { sx: 102, sy: 58, sw: 32, sh: 16 },
  ],
  left: [
    { sx: 135, sy: 58, sw: 32, sh: 16 },
    { sx: 69, sy: 75, sw: 32, sh: 16 },
  ],
  // Vertical — up/down use single 16×16 tiles (head + tail)
  headUp: { sx: 1, sy: 58, sw: 16, sh: 16 },
  headDown: { sx: 18, sy: 58, sw: 16, sh: 16 },
  headRight: { sx: 35, sy: 58, sw: 16, sh: 16 },
  headLeft: { sx: 52, sy: 58, sw: 16, sh: 16 },
} as const;

// ═══════════════════════════════════════════════════════════════════
// MANHANDLA — center body 16×16 + directional hand 16×16
// Center at x=52-67 and x=69-84 (2 anim frames), y=92
// Hands: at x=105-120, x=158-173 rows with various y offsets
// ═══════════════════════════════════════════════════════════════════

export const MANHANDLA_SPRITES = {
  center: [
    { sx: 52, sy: 85, sw: 16, sh: 16 },
    { sx: 69, sy: 85, sw: 16, sh: 16 },
  ],
  hand: [
    { sx: 105, sy: 85, sw: 16, sh: 16 },
    { sx: 158, sy: 85, sw: 16, sh: 16 },
  ],
  // Extra hand variants (different open/close states) at y=92+
  handOpen: [
    { sx: 105, sy: 92, sw: 16, sh: 16 },
    { sx: 158, sy: 92, sw: 16, sh: 16 },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════
// DIGDOGGER — big 32×32 (5 frames for pulsing), little 16×16
// Big at y=58, little at y=58 (right side)
// ═══════════════════════════════════════════════════════════════════

export const DIGDOGGER_SPRITES = {
  big: [
    { sx: 196, sy: 58, sw: 32, sh: 32 },
    { sx: 229, sy: 58, sw: 32, sh: 32 },
    { sx: 262, sy: 58, sw: 32, sh: 32 },
    { sx: 295, sy: 58, sw: 32, sh: 32 },
    { sx: 328, sy: 58, sw: 32, sh: 32 },
  ],
  little: [
    { sx: 361, sy: 58, sw: 16, sh: 16 },
    { sx: 378, sy: 58, sw: 16, sh: 16 },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════
// GOHMA — crab body 48×32 (with eye states)
// Full assembled sprites at y=105 (bottom portion of the Gohma section)
// 4 full bodies at x=298, 347, 396, 445 — each 48×32
// Eye-only tiles: 16×16 at x=247, 264, 281
// Individual body row at x=196-245 (50px wide, composite)
// ═══════════════════════════════════════════════════════════════════

export const GOHMA_SPRITES = {
  // Full assembled body+legs+eye (48×32 each)
  eyeClosedLeft: { sx: 298, sy: 105, sw: 48, sh: 32 },
  eyeClosedRight: { sx: 347, sy: 105, sw: 48, sh: 32 },
  eyeFullyOpen: { sx: 396, sy: 105, sw: 48, sh: 32 },
  eyeHalfOpen: { sx: 445, sy: 105, sw: 48, sh: 32 },
} as const;

// ═══════════════════════════════════════════════════════════════════
// GLEEOK — body 24×32, neck head 8×16 (or 16×16), flying head 16×16
// Body frames at y=11 right side (x=196+)
// ═══════════════════════════════════════════════════════════════════

export const GLEEOK_SPRITES = {
  body: [
    { sx: 196, sy: 11, sw: 24, sh: 32 },
    { sx: 221, sy: 11, sw: 24, sh: 32 },
    { sx: 246, sy: 11, sw: 24, sh: 32 },
  ],
  neckHead: [
    { sx: 271, sy: 11, sw: 8, sh: 16 },
    { sx: 280, sy: 11, sw: 8, sh: 16 },
  ],
  neckSegment: { sx: 271, sy: 27, sw: 8, sh: 8 },
  flyingHead: { sx: 289, sy: 11, sw: 16, sh: 16 },
} as const;

// ═══════════════════════════════════════════════════════════════════
// PATRA — center 16×16, child 8×16
// ═══════════════════════════════════════════════════════════════════

export const PATRA_SPRITES = {
  center: { sx: 1, sy: 154, sw: 16, sh: 16 },
  child: [
    { sx: 18, sy: 154, sw: 8, sh: 16 },
    { sx: 27, sy: 154, sw: 8, sh: 16 },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════
// GANON — 32×32 body frames
// 6 body frames at y=154
// ═══════════════════════════════════════════════════════════════════

export const GANON_SPRITES = {
  body: [
    { sx: 40, sy: 154, sw: 32, sh: 32 },
    { sx: 73, sy: 154, sw: 32, sh: 32 },
    { sx: 106, sy: 154, sw: 32, sh: 32 },
    { sx: 139, sy: 154, sw: 32, sh: 32 },
  ],
  // Ganon visible (after sword hit) — blue/visible frames
  visible: [
    { sx: 40, sy: 154, sw: 32, sh: 32 },
    { sx: 73, sy: 154, sw: 32, sh: 32 },
  ],
  // Ash/dying: Triforce tiles are not here (those are in-code drawn)
} as const;

// ═══════════════════════════════════════════════════════════════════
// FIRE — npcs.png, two 16×16 frames at (52,11) and (69,11).
//
// The pair is a mirrored flicker: same flame, tips leaning opposite ways, with
// a white-hot core over red. Alternating them is what makes a flame look alive,
// so every fire in the game — candle, book fire, dungeon standing fires — runs
// both frames rather than picking one.
//
// Two earlier guesses lived here. L0b had (1,11)/(18,11) 16×16, which is the
// Old Man in his red robe: the candle threw an old man. A later pass moved them
// to (186,11)/(195,11), which is the fairy. Frames identified by the user
// against a contact sheet of the whole file (2026-09-04); see
// sprite-pickers/sprite-picker.png at the repo root.
// ═══════════════════════════════════════════════════════════════════

export const FIRE_SPRITES = {
  frames: [
    { sx: 52, sy: 11, sw: 16, sh: 16 },
    { sx: 69, sy: 11, sw: 16, sh: 16 },
  ],
} as const;

/** Draw flicker frame `frameIdx` (0 or 1) on the 16×16 tile at (dx, dy). */
export function drawFireSprite(
  renderer: Renderer, frameIdx: number, dx: number, dy: number,
): void {
  const frame = FIRE_SPRITES.frames[frameIdx % FIRE_SPRITES.frames.length]
    ?? FIRE_SPRITES.frames[0];
  drawNpcSprite(renderer, frame, dx, dy);
}

// ═══════════════════════════════════════════════════════════════════
// ZELDA NPC — from npcs.png
// 14×16 sprites at y=42
// ═══════════════════════════════════════════════════════════════════

export const ZELDA_NPC_SPRITES = {
  standing: { sx: 2, sy: 42, sw: 14, sh: 16 },
  rescued: { sx: 19, sy: 42, sw: 14, sh: 16 },
} as const;
