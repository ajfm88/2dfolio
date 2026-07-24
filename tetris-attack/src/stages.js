// Stage-clear backgrounds ripped by spriterlicious (original art (c) Nintendo).
// See the workspace README "Credits & Attribution": credit BOTH spriterlicious
// and Nintendo wherever these backgrounds are shown.
//
// The source sheet (`stageBackgrounds.png`, 529x782) is a 2-col x 3-row grid of
// 256x224 SNES screens separated by 8px white gutters. Each screen frames a
// playfield "well" at the SAME fixed rectangle (measured from the art), so a
// board canvas can be positioned to sit exactly inside the well of any stage.

const SHEET_URL = 'stageBackgrounds.png';
const SHEET_W = 529;
const SHEET_H = 782;

const CELL_W = 256;
const CELL_H = 224;
const GUTTER = 8; // white space between cells

// The playfield opening, in cell-local pixels (same for every cell).
const WELL = { x: 86, y: 20, w: 100, h: 197 };

// Where the live score is drawn, over the art's baked-in score panel
// (cell-local pixels). Overridable per stage via `scoreBox`.
const DEFAULT_SCORE_BOX = { x: 8, y: 19, w: 70, h: 24 };

// Left-to-right, top-to-bottom order on the sheet.
const STAGES = [
  { id: 'forest',  name: 'Forest',   col: 0, row: 0 },
  { id: 'sky',     name: 'Sky',      col: 1, row: 0 },
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
  const box = stage.scoreBox || DEFAULT_SCORE_BOX;
  return {
    frameW: CELL_W * sx,
    frameH: CELL_H * sy,
    // The board canvas sits here, inside the frame:
    canvasLeft: WELL.x * sx,
    canvasTop: WELL.y * sy,
    // Background sizing/offset to show just this cell from the shared sheet:
    sheetUrl: SHEET_URL,
    bgSizeW: SHEET_W * sx,
    bgSizeH: SHEET_H * sy,
    bgPosX: -(ox * sx),
    bgPosY: -(oy * sy),
    // Live-score overlay placement, inside the frame:
    scoreLeft: box.x * sx,
    scoreTop: box.y * sy,
    scoreWidth: box.w * sx,
    scoreHeight: box.h * sy,
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
