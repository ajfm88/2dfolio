// Compact VS dual-board chrome from vs-mode.png (thewolfbunny; original art
// © Nintendo / Intelligent Systems). Rects measured 2026-07-29 — do not re-measure.
// See docs/LAYOUT.md and docs/context/specs/04-compact-vs-chrome.md.

const SHEET_URL = 'assets/vs-mode.png';
const SHEET_W = 909;
const SHEET_H = 480;

// Every well opening is 96×192 = 6×12 tiles at 16 px. Maps onto 288×576 at 3.0.
export const WELL_NATIVE_W = 96;
export const WELL_NATIVE_H = 192;
export const CANVAS_TO_WELL = 3; // 288/96 === 576/192

// Dual frames. Unit rects exclude the sheet caption band (y 6..12).
export const VS_FRAMES = {
  vsCpu: {
    unit: { x: 4, y: 18, w: 248, h: 204 },
    left: { x: 8, y: 22, w: 96, h: 192 },
    right: { x: 152, y: 22, w: 96, h: 192 },
  },
  vs2p: {
    unit: { x: 263, y: 18, w: 248, h: 204 },
    left: { x: 267, y: 22, w: 96, h: 192 },
    right: { x: 411, y: 22, w: 96, h: 192 },
  },
  // Unused (no timed mode). Recorded so it is never re-measured.
  timeTrial: {
    unit: { x: 520, y: 17, w: 248, h: 204 },
    left: { x: 524, y: 21, w: 96, h: 192 },
    right: { x: 668, y: 21, w: 96, h: 192 },
  },
};

// Centre strip is 40 native px between the well borders (unit-relative x 104..143).
export const STRIP_NATIVE_W = 40;
export const STRIP_NATIVE_H = 204; // = unit.h

// Strip slots relative to unit top-left / strip left edge (LAYOUT.md).
export const VS_STRIP_SLOTS = {
  blankTop: { y: 0, h: 76 },
  stageCover: { y: 82, h: 20, x: 0, w: 40 },
  levelCaption: { y: 110, h: 5 },
  // Per-player level digits: vs2p sub-slots (also used for vsCpu).
  levelP1: { x: 5, y: 119, w: 14, h: 12 },
  levelP2: { x: 21, y: 119, w: 14, h: 12 },
  timeCaption: { y: 141, h: 12 },
  timeValue: { x: 4, y: 153, w: 32, h: 10 },
};

// Lamp rows: one lamp per player per row (P1 blue left x=2, P2 red x=22).
// Art holds winsNeeded ≤ 2 (best-of-3). Best-of-5/7 omits in-frame lamps.
export const VS_LAMP_SLOTS = {
  // Bottom row y (unit-relative). Rows stack upward at 16 px pitch.
  bottomY: { vsCpu: 172, vs2p: 180 },
  pitch: 16,
  p1x: 2,
  p2x: 22,
  cellW: 16,
  cellH: 15,
  maxRows: 2,
};

export function vsVariantFor(mode) {
  if (mode === 'vsai') return 'vsCpu';
  if (mode === '2p') return 'vs2p';
  return null;
}

/**
 * Layout for compact dual chrome.
 * `scale` is the board canvas display scale (same meaning as stage chrome).
 * Sheet is drawn at k = 3 * scale.
 */
export function vsCompactLayout(variant, scale = 1) {
  const frame = VS_FRAMES[variant] || VS_FRAMES.vsCpu;
  const { unit, left, right } = frame;
  const k = CANVAS_TO_WELL * scale;

  const wellCss = (well) => ({
    left: (well.x - unit.x) * k,
    top: (well.y - unit.y) * k,
    width: well.w * k,
    height: well.h * k,
  });

  // Strip sits between well borders: after left well + 4 px gutter.
  // Relative to unit: (left.x + left.w + 4 - unit.x) = 104 for both variants.
  const stripRelX = left.x + left.w + 4 - unit.x;

  return {
    sheetUrl: SHEET_URL,
    variant,
    frameW: unit.w * k,
    frameH: unit.h * k,
    bgSizeW: SHEET_W * k,
    bgSizeH: SHEET_H * k,
    bgPosX: -unit.x * k,
    bgPosY: -unit.y * k,
    wells: {
      left: wellCss(left),
      right: wellCss(right),
    },
    strip: {
      left: stripRelX * k,
      top: 0,
      width: STRIP_NATIVE_W * k,
      height: unit.h * k,
      nativeW: STRIP_NATIVE_W,
      nativeH: unit.h,
      // unit-relative x of strip origin (asserted as 104 for both variants)
      relX: stripRelX,
    },
    scale,
    sheetScale: k,
  };
}

export { SHEET_URL, SHEET_W, SHEET_H };
