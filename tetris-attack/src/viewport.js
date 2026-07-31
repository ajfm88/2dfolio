// Fit-to-viewport: pick chrome, layout and a discrete CSS scale for the board.
// Canvas backing store stays 288×576; only display size changes.
//
// Scale ladder keeps tile sizes as clean divisors of 48 so pixel art stays crisp.
// See docs/LAYOUT.md and docs/context/specs/02-viewport-scale.md.

import { stageLayout } from './stages.js';
import { STAGES } from './stages.js';
import { vsCompactLayout } from './vsFrames.js';

// Must match #ta-stage gap in index.html (CSS uses the same value).
export const STAGE_GAP = 20;

// Page padding used when computing the available box. Kept at 8 so a 390 px
// phone has 374 px of width — enough for stage/compact at scale 1/2 (369 / 372).
// CSS uses max(8px, safe-area) so notches still clear; see index.html.
export const STAGE_PAD = 8;

// Display scales that keep 48px tiles on whole pixels.
export const SCALE_STEPS = [1, 1 / 2, 1 / 3, 1 / 4];

// Keep in sync with renderer.js Constants.TILE_SIZE.
export const TILE_SIZE = 48;

// Below this, tiles are unreadable on a phone.
export const MIN_PLAYABLE_TILE = 24;

// Stage frame size is identical for every stage — take it from stageLayout once.
const _refStage = STAGES[0];
const _refLayout = stageLayout(_refStage, 6 * TILE_SIZE, 12 * TILE_SIZE);
export const STAGE_FRAME_W = _refLayout.frameW;
export const STAGE_FRAME_H = _refLayout.frameH;

// Compact dual unit at scale 1 (sheet scale 3): 248*3 × 204*3.
const COMPACT_AT_1 = vsCompactLayout('vsCpu', 1);
export const COMPACT_FRAME_W = COMPACT_AT_1.frameW;
export const COMPACT_FRAME_H = COMPACT_AT_1.frameH;

function viewportSize(opts = {}) {
  if (opts.width != null && opts.height != null) {
    return { w: opts.width, h: opts.height };
  }
  if (typeof window === 'undefined') {
    return { w: 1280, h: 800 };
  }
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { w: vv.width, h: vv.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function availableBox(opts = {}) {
  const { w, h } = viewportSize(opts);
  // Fixed page padding only (STAGE_PAD). Safe-area is handled by CSS on
  // overlays / #ta-stage in Unit 06; measuring env() needs a live DOM probe.
  const pad = STAGE_PAD * 2;
  return {
    availW: Math.max(1, w - pad),
    availH: Math.max(1, h - pad),
  };
}

function fits(boxW, boxH, availW, availH) {
  return boxW <= availW + 0.5 && boxH <= availH + 0.5;
}

function tryStageSideBySide(availW, availH) {
  for (const scale of SCALE_STEPS) {
    const tilePx = TILE_SIZE * scale;
    const w = STAGE_FRAME_W * scale * 2 + STAGE_GAP;
    const h = STAGE_FRAME_H * scale;
    if (fits(w, h, availW, availH) && tilePx >= MIN_PLAYABLE_TILE) {
      return { scale, tilePx, layout: 'side-by-side', stageFlex: 'row' };
    }
  }
  return null;
}

function tryCompact(availW, availH) {
  for (const scale of SCALE_STEPS) {
    const tilePx = TILE_SIZE * scale;
    const w = COMPACT_FRAME_W * scale;
    const h = COMPACT_FRAME_H * scale;
    if (fits(w, h, availW, availH) && tilePx >= MIN_PLAYABLE_TILE) {
      return { scale, tilePx, layout: 'side-by-side', stageFlex: 'row' };
    }
  }
  return null;
}

function tryStageStacked(availW, availH) {
  for (const scale of SCALE_STEPS) {
    const tilePx = TILE_SIZE * scale;
    const w = STAGE_FRAME_W * scale;
    const h = STAGE_FRAME_H * scale * 2 + STAGE_GAP;
    if (fits(w, h, availW, availH) && tilePx >= MIN_PLAYABLE_TILE) {
      return { scale, tilePx, layout: 'stacked', stageFlex: 'column' };
    }
  }
  return null;
}

// When nothing holds the floor, pick the option with the largest tile.
function bestFallback(availW, availH) {
  let best = null;
  const candidates = [];

  for (const scale of SCALE_STEPS) {
    const tilePx = TILE_SIZE * scale;
    candidates.push({
      chrome: 'stage',
      scale,
      tilePx,
      layout: 'side-by-side',
      stageFlex: 'row',
      w: STAGE_FRAME_W * scale * 2 + STAGE_GAP,
      h: STAGE_FRAME_H * scale,
    });
    candidates.push({
      chrome: 'vsCompact',
      scale,
      tilePx,
      layout: 'side-by-side',
      stageFlex: 'row',
      w: COMPACT_FRAME_W * scale,
      h: COMPACT_FRAME_H * scale,
    });
    candidates.push({
      chrome: 'stage',
      scale,
      tilePx,
      layout: 'stacked',
      stageFlex: 'column',
      w: STAGE_FRAME_W * scale,
      h: STAGE_FRAME_H * scale * 2 + STAGE_GAP,
    });
  }

  // Prefer larger tile; among equals prefer ones that fit; then compact (least height).
  for (const c of candidates) {
    const doesFit = fits(c.w, c.h, availW, availH);
    const score = c.tilePx * 1000 + (doesFit ? 100 : 0) + (c.chrome === 'vsCompact' ? 1 : 0);
    if (!best || score > best.score) {
      best = { ...c, score };
    }
  }
  return {
    chrome: best.chrome,
    layout: best.layout,
    scale: best.scale,
    tilePx: best.tilePx,
    stageFlex: best.stageFlex,
  };
}

/**
 * Pure measure: how should the match be drawn for this viewport?
 *
 * @param {{ boardCount: number, mode?: string, width?: number, height?: number }} opts
 */
export function measure(opts = {}) {
  const boardCount = opts.boardCount || 1;
  const { availW, availH } = availableBox(opts);

  // 1P: always full stage chrome, single board.
  if (boardCount === 1) {
    let chosen = SCALE_STEPS[SCALE_STEPS.length - 1];
    for (const scale of SCALE_STEPS) {
      if (fits(STAGE_FRAME_W * scale, STAGE_FRAME_H * scale, availW, availH)) {
        chosen = scale;
        break;
      }
    }
    return {
      chrome: 'stage',
      layout: 'single',
      scale: chosen,
      tilePx: TILE_SIZE * chosen,
      stageFlex: 'row',
      vsVariant: null,
      availW,
      availH,
    };
  }

  // Dual-board selection (LAYOUT.md):
  // 1. stage side-by-side if tile ≥ 24
  // 2. vsCompact side-by-side if tile ≥ 24
  // 3. stage stacked if tile ≥ 24
  // 4. largest tile fallback, tie-break compact
  const side = tryStageSideBySide(availW, availH);
  if (side) {
    return {
      chrome: 'stage',
      layout: side.layout,
      scale: side.scale,
      tilePx: side.tilePx,
      stageFlex: side.stageFlex,
      vsVariant: null,
      availW,
      availH,
    };
  }

  const compact = tryCompact(availW, availH);
  if (compact) {
    return {
      chrome: 'vsCompact',
      layout: compact.layout,
      scale: compact.scale,
      tilePx: compact.tilePx,
      stageFlex: compact.stageFlex,
      vsVariant: opts.mode === '2p' ? 'vs2p' : 'vsCpu',
      availW,
      availH,
    };
  }

  const stacked = tryStageStacked(availW, availH);
  if (stacked) {
    return {
      chrome: 'stage',
      layout: stacked.layout,
      scale: stacked.scale,
      tilePx: stacked.tilePx,
      stageFlex: stacked.stageFlex,
      vsVariant: null,
      availW,
      availH,
    };
  }

  const fb = bestFallback(availW, availH);
  return {
    ...fb,
    vsVariant: fb.chrome === 'vsCompact'
      ? (opts.mode === '2p' ? 'vs2p' : 'vsCpu')
      : null,
    availW,
    availH,
  };
}

/** Whether the virtual pad should be shown (device capability, not size). */
export function wantsVirtualPad() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (_) { /* ignore */ }
  return (navigator.maxTouchPoints || 0) > 0;
}
