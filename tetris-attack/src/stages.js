// Stage-clear backgrounds ripped by spriterlicious (original art (c) Nintendo).
// See the workspace README "Credits & Attribution": credit BOTH spriterlicious
// and Nintendo wherever these backgrounds are shown.
//
// The source sheet (`assets/stageBackgrounds.png`, 529x782) is a 2-col x 3-row grid of
// 256x224 SNES screens separated by 8px white gutters. Each screen frames a
// playfield "well" at the SAME fixed rectangle (measured from the art), so a
// board canvas can be positioned to sit exactly inside the well of any stage.

const SHEET_URL = 'assets/stageBackgrounds.png';
const SHEET_W = 529;
const SHEET_H = 782;

const CELL_W = 256;
const CELL_H = 224;
const GUTTER = 8; // white space between cells

// The playfield opening, in cell-local pixels (same for every cell).
const WELL = { x: 86, y: 20, w: 100, h: 197 };

// The art keeps both of the HUD boxes the original game draws into, sitting
// empty either side of the well: a short one upper-left and a tall one down the
// right. The SNES puts TIME in the left one and the SCORE / SPEED LV. / LEVEL
// column in the right one, and these fill them the same way.
//
// Both rects are the box interiors in cell-local pixels, measured off all six
// cells -- every stage frames its boxes identically, just with different art
// behind them -- so neither needs per-stage tuning. A stage can still override
// them via `timeBox` / `hudBox` if one ever disagrees.
const DEFAULT_TIME_BOX = { x: 16, y: 23, w: 64, h: 24 };
const DEFAULT_HUD_BOX = { x: 192, y: 31, w: 48, h: 104 };

// These are the *stage-clear* backgrounds, which differ from the SNES gameplay
// screens: the gameplay art puts a second, small character on the ground in the
// bottom right, below the HUD box, and these cells leave that corner as scenery.
// `decor` re-adds it as a separate foreground sprite, in cell-local pixels, so
// only the stages we have art for pay for it. See the reference screenshot
// `Tetris-Attack-SNES-04.webp` at the workspace root.
// Cut from the Zeek Tetris Attack Yoshi rip rather than shipped as its own file.
// `frame` is the source rect on that sheet: the first of three idle
// frames, which happens to be exactly 36x51 and already faces left, in towards
// the well, the way the SNES gameplay screens have it. The other two idle
// frames are at x=701 and x=741 if this is ever animated.
// The three idle frames are a blink: eyes open, half-lidded, shut. His body is
// pixel-identical in all three and they all end at sheet y=639, so they share a
// bottom edge -- anchoring bottom-left is what keeps him from twitching.
//
// `hold` is in ticks (60/s). Weighting the open frame heavily and running the
// other three fast is what makes it read as an occasional blink rather than a
// loop; the cycle comes to 217 ticks, a blink every ~3.6s.
// The box is GROUND-ANCHORED: its bottom edge is the ground line and every frame
// is centred on the same x, so frames of different sizes don't slide around. It
// is sized for the tallest jump frame; the idle frame still lands at exactly
// (206,166) as it did when the box was 36x51, so his resting position is
// unchanged.
//
// `lift` is how far off the ground a frame sits. That is not guesswork: the jump
// frames each ship with a shadow bar beneath them on the sheet, and the gap
// between a frame's feet and its shadow encodes the height. Measured gaps were
// 22 / 14 / 12 px, i.e. 10 / 2 / 0 above the lowest.
//
// ⚠️ Two of the jump frames were previously recorded as (802,575,35,38) and
// (849,575,40,45). Both were CLIPPED -- 575 was the edge of the crop box used to
// measure them, not the sprite. The real frames are 62px tall. If a sprite rect
// starts exactly on a measuring region's boundary, suspect it.
const BABY_YOSHI = {
  sheet: 'assets/yoshi_little_yoshi.png',
  x: 202, y: 145, w: 44, h: 72,

  // Blink: eyes open / half-lidded / shut, all sharing a bottom edge.
  idle: [
    { x: 658, y: 588, w: 36, h: 51, hold: 200 }, // eyes open (resting pose)
    { x: 701, y: 588, w: 36, h: 51, hold: 5 },   // half-lidded, closing
    { x: 741, y: 590, w: 36, h: 49, hold: 7 },   // shut
    { x: 701, y: 588, w: 36, h: 51, hold: 5 },   // half-lidded, opening
  ],

  // A hop, played once when a combo or chain lands: crouch, up, hang at the
  // apex, down, squash on landing.
  react: [
    { x: 908, y: 586, w: 43, h: 36, hold: 4,  lift: 0 },  // crouch
    { x: 849, y: 558, w: 40, h: 62, hold: 4,  lift: 2 },  // springing up
    { x: 802, y: 551, w: 35, h: 62, hold: 10, lift: 10 }, // apex
    { x: 849, y: 558, w: 40, h: 62, hold: 4,  lift: 2 },  // coming down
    { x: 908, y: 586, w: 43, h: 36, hold: 6,  lift: 0 },  // landing squash
  ],
};

// Where the board's own character stands, as {cx, ground} in cell-local pixels:
// bottom-CENTRED on cx, feet on `ground`. The sprites vary a lot in size (14x16
// up to 46x56) and carry their own drop shadows, so they are placed by their feet
// rather than fitted into a box.
//
// Every stage leaves the corner below the right-hand HUD box empty, and for four
// of them the ground there is the same line the well sits on, so one default
// suits them all. Two need their own:
//   forest -- the baby Yoshi already owns that corner, so its character stands
//             in the bushes just above him instead;
//   sky    -- there is no ground at all, just a cloud floating in the corner.
//             Its top edge was measured off the art at y=188 (the cell is open
//             sky above that), so the character rides the cloud rather than
//             sinking through it.
const DEFAULT_CHAR_SLOT = { cx: 224, ground: 217 };
const FOREST_CHAR_SLOT = { cx: 218, ground: 163 };
const SKY_CHAR_SLOT = { cx: 224, ground: 188 };

// Left-to-right, top-to-bottom order on the sheet.
const STAGES = [
  { id: 'forest',  name: 'Forest',   col: 0, row: 0, decor: BABY_YOSHI, charSlot: FOREST_CHAR_SLOT },
  { id: 'sky',     name: 'Sky',      col: 1, row: 0, charSlot: SKY_CHAR_SLOT },
  { id: 'jungle',  name: 'Jungle',   col: 0, row: 1 },
  { id: 'lilypad', name: 'Lily Pad', col: 1, row: 1 },
  { id: 'cave',    name: 'Cave',     col: 0, row: 2 },
  { id: 'moon',    name: 'Moon',     col: 1, row: 2 },
];

function cellOrigin(stage) {
  return {
    ox: stage.col * (CELL_W + GUTTER),
    oy: stage.row * (CELL_H + GUTTER),
  };
}

// Compute the CSS geometry needed to render `stage` so that its well maps exactly
// onto a `wellPxW` x `wellPxH` board canvas. The whole cell is scaled (very
// slightly non-uniformly, ~1.5%, imperceptible on pixel art) so the well lines up.
function stageLayout(stage, wellPxW, wellPxH) {
  const sx = wellPxW / WELL.w;
  const sy = wellPxH / WELL.h;
  const { ox, oy } = cellOrigin(stage);
  // A HUD overlay is drawn at native SNES resolution and stretched up, rather
  // than drawing a pixel font at a fractional scale, so each box reports its
  // native size alongside its scaled placement.
  const panel = (box) => ({
    left: box.x * sx,
    top: box.y * sy,
    width: box.w * sx,
    height: box.h * sy,
    nativeW: box.w,
    nativeH: box.h,
  });
  const slot = stage.charSlot || DEFAULT_CHAR_SLOT;
  return {
    frameW: CELL_W * sx,
    frameH: CELL_H * sy,
    // Kept as scale + cell coords, because the sprite's size is not known until
    // its image decodes (each pose is a differently-sized file).
    scaleX: sx,
    scaleY: sy,
    charSlot: { cx: slot.cx, ground: slot.ground },
    // The board canvas sits here, inside the frame:
    canvasLeft: WELL.x * sx,
    canvasTop: WELL.y * sy,
    // Background sizing/offset to show just this cell from the shared sheet:
    sheetUrl: SHEET_URL,
    bgSizeW: SHEET_W * sx,
    bgSizeH: SHEET_H * sy,
    bgPosX: -(ox * sx),
    bgPosY: -(oy * sy),
    // The two HUD overlays, placed inside the frame.
    timePanel: panel(stage.timeBox || DEFAULT_TIME_BOX),
    hudPanel: panel(stage.hudBox || DEFAULT_HUD_BOX),
    // Optional foreground sprite (see `decor` above), scaled with the cell.
    decor: stage.decor
      ? {
        sheet: stage.decor.sheet,
        idle: stage.decor.idle,
        react: stage.decor.react,
        nativeW: stage.decor.w,
        nativeH: stage.decor.h,
        left: stage.decor.x * sx,
        top: stage.decor.y * sy,
        width: stage.decor.w * sx,
        height: stage.decor.h * sy,
      }
      : null,
  };
}

// Pick `count` distinct stages at random (falls back to repeats if count > 6).
function randomStages(count) {
  const pool = STAGES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

function stageById(id) {
  return STAGES.find((s) => s.id === id) || null;
}

export { STAGES, WELL, CELL_W, CELL_H, stageLayout, randomStages, stageById };
