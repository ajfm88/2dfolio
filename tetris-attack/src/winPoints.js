// The VS win-point stars: one lamp per point needed to take the set.
//
// Cut from `src/assets/vs-mode.png` (thewolfbunny, "credit not necessary, but if
// you want, you can"; original art (c) Nintendo / Intelligent Systems), from the
// block the sheet itself captions WIN POINTS. Two rows of six 16x15 cells:
//
//   y = 180  blue   x = 787 + 18*n
//   y = 197  red    x = 787 + 18*n
//
// The six cells are not six different counts -- they are one lamp lighting up,
// frame 0 dark (navy panel, black star) through frame 5 lit (bright panel,
// yellow star). So frame 0 is an unwon point, frame 5 is a won one, and the
// four in between are the animation played when a point is awarded.
//
// Blue is Player 1 and red Player 2: blue is the row the sheet lists first, and
// it matches the left/right board colours in the VS HUD frames above it.
//
// Only the four corner pixels of a cell are sheet-white (the panel has rounded
// corners and no white anywhere inside it), so keying exact white is safe here
// and the inward flood that spriteSheet.js needs for the Yoshi rip is not.

const SHEET_URL = 'assets/vs-mode.png';

const CELL_W = 16;
const CELL_H = 15;
// Cells sit on an 18px pitch, i.e. 2px of air between lamps.
const CELL_PITCH = 18;
const FIRST_X = 787;
const FRAME_COUNT = 6;
const ROW_Y = { p1: 180, p2: 197 };

const SIDES = ['p1', 'p2'];

// Frames per animation step when a newly won point lights up. Six frames at
// three ticks each is 18 frames (~0.3s), quick enough not to hold up the screen.
const ANIM_TICKS_PER_FRAME = 3;
const ANIM_TICKS = FRAME_COUNT * ANIM_TICKS_PER_FRAME;

const sheet = new Image();
sheet.src = SHEET_URL;

let atlas = null;
let failed = false;

// One canvas holding both rows, keyed. Built once and shared: every overlay
// draws the same twelve cells.
function buildAtlas() {
  if (atlas || failed) return atlas;
  if (!sheet.complete || sheet.naturalWidth === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_COUNT * CELL_W;
    canvas.height = SIDES.length * CELL_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    SIDES.forEach((side, row) => {
      for (let f = 0; f < FRAME_COUNT; f++) {
        ctx.drawImage(sheet, FIRST_X + f * CELL_PITCH, ROW_Y[side], CELL_W, CELL_H,
                      f * CELL_W, row * CELL_H, CELL_W, CELL_H);
      }
    });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) d[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
    atlas = canvas;
  } catch (e) {
    // Sheet could not be read back (tainted canvas, e.g. served from file://).
    failed = true;
  }
  return atlas;
}

function ready() {
  return buildAtlas() != null;
}

// Kick off decoding without drawing, so the first screen that wants stars is
// not the one waiting for the sheet.
function preloadWinPoints() {
  buildAtlas();
}

// How wide a row of `total` lamps is. The trailing 2px of pitch is not part of
// the row, so a right-aligned row sits flush.
function rowWidth(total) {
  return total <= 0 ? 0 : total * CELL_PITCH - (CELL_PITCH - CELL_W);
}

function rowHeight() {
  return CELL_H;
}

// Draw `total` lamps left to right at (x, y), the first `won` of them lit.
//
// `anim` (0..ANIM_TICKS) plays the most recently won lamp lighting up: while it
// is below ANIM_TICKS that one lamp steps through the frames instead of showing
// as lit. Pass nothing for a static row.
function drawWinPoints(ctx, x, y, { side = 'p1', won = 0, total = 0, anim = null } = {}) {
  const sheetCanvas = buildAtlas();
  if (!sheetCanvas) return false;
  const row = Math.max(0, SIDES.indexOf(side));
  const animating = anim !== null && anim < ANIM_TICKS && won > 0;
  const animIndex = animating ? won - 1 : -1;
  const animFrame = animating
    ? Math.min(FRAME_COUNT - 1, Math.floor(anim / ANIM_TICKS_PER_FRAME))
    : 0;

  for (let i = 0; i < total; i++) {
    let frame;
    if (i === animIndex) frame = animFrame;
    else if (i < won) frame = FRAME_COUNT - 1;
    else frame = 0;
    ctx.drawImage(sheetCanvas, frame * CELL_W, row * CELL_H, CELL_W, CELL_H,
                  x + i * CELL_PITCH, y, CELL_W, CELL_H);
  }
  return true;
}

export {
  drawWinPoints, rowWidth, rowHeight, ready, preloadWinPoints,
  ANIM_TICKS, CELL_W, CELL_H, CELL_PITCH, FRAME_COUNT,
};
