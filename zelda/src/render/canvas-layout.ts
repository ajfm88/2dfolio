// Canvas placement maths, kept free of DOM access so it can be unit tested —
// the vitest environment is `node` (same reason transparency.ts is split from its
// canvas plumbing).

import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../core/constants.js';

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface CanvasLayoutInput {
  readonly viewportW: number;
  readonly viewportH: number;
  readonly dpr: number;
  /** Height of the touch-pad band at the bottom that the canvas must clear. */
  readonly reservedBottom: number;
  readonly insets?: SafeAreaInsets;
}

export interface CanvasLayout {
  /** Device pixels per NES pixel. Always a whole number >= 1. */
  readonly scale: number;
  readonly cssW: number;
  readonly cssH: number;
  readonly left: number;
  readonly top: number;
}

export const NO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Scale in whole *device* pixels rather than whole CSS pixels. Integer CSS scaling
 * collapses to 1x on any viewport under 512px wide, which is every phone in
 * portrait; going through devicePixelRatio recovers the full panel resolution
 * (a Note 10+ at dpr 2.625 lands on a clean 4x) while keeping every NES pixel
 * exactly the same size.
 */
export function computeCanvasLayout(input: CanvasLayoutInput): CanvasLayout {
  const { viewportW, viewportH, reservedBottom } = input;
  const insets = input.insets ?? NO_INSETS;
  const dpr = input.dpr > 0 ? input.dpr : 1;

  const availW = viewportW - insets.left - insets.right;
  const availH = viewportH - insets.top - insets.bottom - reservedBottom;

  const scale = Math.max(
    1,
    Math.floor(Math.min((availW * dpr) / SCREEN_WIDTH, (availH * dpr) / SCREEN_HEIGHT)),
  );

  // Deliberately fractional: `256 * scale / dpr` CSS px is exactly `256 * scale`
  // device px. Rounding to whole CSS px would reintroduce the uneven pixel widths
  // this whole approach exists to avoid.
  const cssW = (SCREEN_WIDTH * scale) / dpr;
  const cssH = (SCREEN_HEIGHT * scale) / dpr;

  return {
    scale,
    cssW,
    cssH,
    left: insets.left + (availW - cssW) / 2,
    top: insets.top + (availH - cssH) / 2,
  };
}

/**
 * The pads sit bottom-left and bottom-right. In portrait they stack below the game,
 * so the canvas must clear them. In landscape the canvas is height-limited and the
 * pads fall naturally into the left/right letterbox margins — reserving there would
 * crush the game into a thin strip.
 */
export function reservedBottomFor(
  viewportW: number,
  viewportH: number,
  padReserve: number,
): number {
  return viewportH > viewportW ? padReserve : 0;
}
