// Battle transition animations — spiral (trainer) and flash+stripes (wild)
//
// Assembly references:
//   BattleTransition_Spiral (engine/battle/battle_transition.asm)
//   BattleTransition_HorizontalStripes (engine/battle/battle_transition.asm)
//   FlashScreen (engine/battle/battle_transition.asm)

import { getCtx, getScale } from '../renderer';

// --- Constants ---
const SPIRAL_TILES_PER_FRAME = 8; // tiles blacked out per frame (~45 frames total)
const WILD_FLASH_HALF_CYCLE = 8;  // frames per flash half-cycle
const WILD_FLASH_TOTAL = 6;       // total half-cycles (3 full blink cycles)
const WILD_STRIPE_DELAY = 3;      // frames between each stripe row

// --- Module state ---
let transitionTiles: [number, number][] | null = null;
let transitionProgress = 0;
let transitionCallback: (() => void) | null = null;
let transitionType: 'spiral' | 'wild' = 'spiral';

let wildPhase: 'flash' | 'stripes' = 'flash';
let wildFlashTimer = 0;
let wildFlashCount = 0;
let wildStripeRow = 0;
let wildStripeTimer = 0;

// Pre-computed horizontal stripe data (9 row-pairs for 18-tile-high screen)
const wildStripeData = computeHorizontalStripes(20, 18);

/** Compute clockwise inward spiral order for a w×h tile grid. */
function computeSpiralOrder(w: number, h: number): [number, number][] {
  const result: [number, number][] = [];
  let top = 0,
    bottom = h - 1,
    left = 0,
    right = w - 1;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x++) result.push([x, top]);
    top++;
    for (let y = top; y <= bottom; y++) result.push([right, y]);
    right--;
    if (top <= bottom) {
      for (let x = right; x >= left; x--) result.push([x, bottom]);
      bottom--;
    }
    if (left <= right) {
      for (let y = bottom; y >= top; y--) result.push([left, y]);
      left++;
    }
  }
  return result;
}

/** Compute horizontal stripe fill order (assembly BattleTransition_HorizontalStripes).
 *  Even rows fill left→right, odd rows fill right→left. */
function computeHorizontalStripes(w: number, h: number): [number, number][][] {
  const rows: [number, number][][] = [];
  for (let y = 0; y < h; y += 2) {
    const pair: [number, number][] = [];
    for (let x = 0; x < w; x++) pair.push([x, y]);
    if (y + 1 < h) {
      for (let x = w - 1; x >= 0; x--) pair.push([x, y + 1]);
    }
    rows.push(pair);
  }
  return rows;
}

/** Start a spiral battle transition (trainer battles). Does NOT set game state. */
export function startSpiralTransition(cb: () => void): void {
  transitionTiles = computeSpiralOrder(20, 18);
  transitionProgress = 0;
  transitionCallback = cb;
  transitionType = 'spiral';
}

/** Start a wild battle transition (flash + horizontal stripes). Does NOT set game state. */
export function startWildTransition(cb: () => void): void {
  transitionCallback = cb;
  transitionType = 'wild';
  transitionTiles = null;
  wildPhase = 'flash';
  wildFlashTimer = 0;
  wildFlashCount = 0;
  wildStripeRow = 0;
  wildStripeTimer = 0;
}

/** Advance the battle transition animation one frame. Calls callback when complete. */
export function updateBattleTransition(): void {
  if (transitionType === 'spiral') {
    if (transitionTiles) {
      transitionProgress += SPIRAL_TILES_PER_FRAME;
      if (transitionProgress >= transitionTiles.length) {
        const cb = transitionCallback;
        transitionTiles = null;
        transitionCallback = null;
        transitionProgress = 0;
        if (cb) cb();
      }
    }
  } else if (transitionType === 'wild') {
    if (wildPhase === 'flash') {
      wildFlashTimer++;
      if (wildFlashTimer >= WILD_FLASH_HALF_CYCLE) {
        wildFlashTimer = 0;
        wildFlashCount++;
        if (wildFlashCount >= WILD_FLASH_TOTAL) {
          wildPhase = 'stripes';
          wildStripeRow = 0;
          wildStripeTimer = 0;
        }
      }
    } else if (wildPhase === 'stripes') {
      if (wildStripeRow < wildStripeData.length) {
        wildStripeTimer++;
        if (wildStripeTimer >= WILD_STRIPE_DELAY) {
          wildStripeTimer = 0;
          wildStripeRow++;
          if (wildStripeRow >= wildStripeData.length) {
            const cb = transitionCallback;
            transitionCallback = null;
            if (cb) cb();
          }
        }
      }
    }
  }
}

/** Render the battle transition overlay on top of the overworld. */
export function renderBattleTransitionOverlay(): void {
  const ctx = getCtx();
  const s = getScale();

  if (transitionType === 'spiral') {
    if (transitionTiles) {
      ctx.fillStyle = '#000';
      const count = Math.min(transitionProgress, transitionTiles.length);
      for (let i = 0; i < count; i++) {
        const [tx, ty] = transitionTiles[i];
        ctx.fillRect(tx * 8 * s, ty * 8 * s, 8 * s, 8 * s);
      }
    }
  } else if (transitionType === 'wild') {
    if (wildPhase === 'flash') {
      // Flash: alternate white overlay on/off (assembly FlashScreen palette cycling)
      const isFlashOn = wildFlashCount % 2 === 0;
      if (isFlashOn) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(0, 0, 160 * s, 144 * s);
      }
    } else if (wildPhase === 'stripes') {
      // Horizontal stripes: fill completed row-pairs with black
      ctx.fillStyle = '#000';
      for (let r = 0; r < wildStripeRow; r++) {
        for (const [tx, ty] of wildStripeData[r]) {
          ctx.fillRect(tx * 8 * s, ty * 8 * s, 8 * s, 8 * s);
        }
      }
    }
  }
}
