// Tetris Attack pixel fonts.
//
// `src/assets/font.png` was ripped by Parakarry (aka toastypk) from MFGG; the original
// art is (c) Nintendo. The rip's own note: "No credit is needed, but it would be
// nice if you did. :) Just please don't take these for yourself."
//
// The sheet carries three unrelated fonts. Two of them are exposed here, and the
// SNES uses both at once in its HUD -- a narrow caption over a chunky value:
//
//   PixelFont         the chunky one, used for VALUES. Five recolored bands
//                     across the top of the sheet.
//                       band tops   y = 3, 11, 19, 27, 35, each 6px tall
//                       first cell  x = 2, every cell 8px wide
//                       cell order  0-9 then A-Z; punctuation past 'Z' is
//                                   packed proportionally, off the grid
//
//   ProportionalFont  the narrow one, used for CAPTIONS. Eleven recolored bands
//                     down the middle of the sheet, each 14px tall, holding a
//                     full text face: a-z, A-Z, 0-9 and " ! - , . ' ?
//                       band tops   y = 46, 62, 79, 95, 112, 128, 144, 161,
//                                   178, 196, 213
//
// Wiring the narrow font up is what lets the HUD spell its captions out. The
// stage art's right-hand box is 48px wide, so at 8px per cell the chunky font
// fits five characters -- "SCORE" exactly, but not "HI-SCORE" (64px, and still
// 59px even packed proportionally, since its ink fills 7 of every 8px). The
// narrow font draws "HI-SCORE" in 38px and "SPEED LV." in 41px, inside the 44px
// the box leaves past its left pad.
//
// Everything here was measured off the sheet by pure-Python decode; see CLAUDE.md.

const SHEET_URL = 'assets/font.png';

// ---------------------------------------------------------------- chunky font

const CHAR_W = 8;
const CHAR_H = 6;
const CELL_X0 = 2;
const BAND_Y = 3; // any band works; the atlas gets recolored regardless
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:'";

// Source x of each glyph's ink on the sheet, with its ink width. 0-9 and A-Z sit
// on the strict 8px grid. The punctuation past 'Z' does not -- it is packed
// proportionally -- so those glyphs carry an explicit position and get centred
// into a fixed 8px cell when the atlas is built, keeping every readout
// monospaced.
//
// A glyph may also pin down the *rows* it occupies. The apostrophe needs this:
// it is packed so tightly against the comma that the comma's bottom-left pixel
// sits inside the apostrophe's own column range, and a full-height slice would
// drag that stray pixel along with it.
const GLYPH_SRC = new Map();
for (let i = 0; i < 36; i++) {
  GLYPH_SRC.set(CHARS[i], { sx: CELL_X0 + i * CHAR_W, w: CHAR_W });
}
GLYPH_SRC.set(':', { sx: 340, w: 2 });
GLYPH_SRC.set("'", { sx: 310, w: 2, sy: 1, h: 3 });

// ---------------------------------------------------------------- narrow font

const THIN_BAND_Y = 46;
const THIN_BAND_H = 14;
// Within the band: capitals and digits sit on rows 1..11, lowercase x-height
// starts at row 4, and descenders (g j p q y ,) run to row 13. `draw` takes the
// cap top as its y, so an all-caps caption occupies exactly THIN_CAP_H rows.
const THIN_CAP_TOP = 1;
const THIN_CAP_H = 11;
// Glyphs are packed with a 1px gap on the sheet, which is also the gap they are
// drawn with. A space has no ink, so it needs its own advance.
const THIN_GAP = 1;
const THIN_SPACE_W = 3;

// [character, source x, ink width]. Generated from a column-run scan of the band
// and checked against an ASCII dump of every glyph, rather than typed by hand.
// The only manual step is the double quote: its two 1px strokes scan as separate
// runs, and are merged here into the one 3px glyph they actually are.
const THIN_GLYPHS = [
  ['a', 4, 4], ['b', 9, 4], ['c', 14, 4], ['d', 19, 4], ['e', 24, 4], ['f', 29, 4],
  ['g', 34, 4], ['h', 39, 4], ['i', 44, 1], ['j', 46, 3], ['k', 50, 4], ['l', 55, 1],
  ['m', 57, 5], ['n', 63, 4], ['o', 68, 4], ['p', 73, 4], ['q', 78, 4], ['r', 83, 3],
  ['s', 87, 4], ['t', 92, 3], ['u', 96, 4], ['v', 101, 5], ['w', 107, 5], ['x', 113, 4],
  ['y', 118, 4], ['z', 123, 4],
  ['A', 131, 4], ['B', 136, 4], ['C', 141, 4], ['D', 146, 4], ['E', 151, 4], ['F', 156, 4],
  ['G', 161, 4], ['H', 166, 4], ['I', 171, 3], ['J', 175, 4], ['K', 180, 4], ['L', 185, 4],
  ['M', 190, 5], ['N', 196, 4], ['O', 201, 4], ['P', 206, 4], ['Q', 211, 5], ['R', 217, 4],
  ['S', 222, 4], ['T', 227, 5], ['U', 233, 4], ['V', 238, 5], ['W', 244, 5], ['X', 250, 4],
  ['Y', 255, 5], ['Z', 261, 4],
  ['"', 267, 3], ['!', 272, 1], ['-', 275, 4], [',', 280, 2], ['.', 283, 1], ["'", 285, 2],
  ['?', 289, 4],
  ['0', 299, 4], ['1', 304, 3], ['2', 308, 4], ['3', 313, 4], ['4', 318, 4], ['5', 323, 4],
  ['6', 328, 4], ['7', 333, 4], ['8', 338, 4], ['9', 343, 4],
];

// Character -> ink width, built once. `width()` and `draw()` walk this per
// character per readout per frame, so it must not be a scan of the table.
const THIN_INK_W = new Map(THIN_GLYPHS.map(([ch, , w]) => [ch, w]));

// ---------------------------------------------------------------------- shared

// The atlas pads every cell by 1px so a hard outline can be baked around the
// glyphs. Without it the text disappears into busy stage art (the cave panel's
// orange rock and magenta squiggle in particular); the sheet's own large font
// carries a baked outline for exactly this reason. Glyph ink never reaches its
// cell's edge, so neighbouring outlines meet in the gap without either one
// touching the other's ink -- which is what lets the padded cells overlap when
// drawn.
const PAD = 1;
const OUTLINE = [0, 0, 0];

// Each chunky glyph is a three-tone bevel (shadow / body / highlight). Palettes
// are listed in that same order so a band can be remapped onto any of them.
//
// The stage-clear panels the readouts are drawn over are dark in all six stages
// (maroon, navy, black, purple, brown, black), and every band on the sheet is a
// dark saturated hue, so these are all light ramps rather than any of them.
// `cyan` and `white` reproduce the SNES HUD's own pairing: a cyan caption over
// a white value.
const PALETTES = {
  cyan: ['#1c7c9c', '#3cd4f0', '#c4f4ff'],
  white: ['#8890a8', '#e4e8f4', '#ffffff'],
  gold: ['#a05c00', '#ffc422', '#fff4b4'],
};

const sheet = new Image();
sheet.src = SHEET_URL;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// The sheet's own background is white. Anything still transparent is canvas we
// laid out but never drew into -- the slack around a proportional glyph centred
// in a wider cell. Both must count as background: a fresh canvas pixel is
// transparent *black*, so testing colour alone hands the remapper a phantom
// black "tone", which it then ranks darkest and paints in solid. That showed up
// on screen as a dark block around the clock's colon, and it also cost the
// chunky font a bevel step, since the phantom crowded the real shadow and body
// tones onto the same palette slot.
function isBackground(d, i) {
  return d[i + 3] === 0 || (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240);
}

// Key out the background and remap the band's own tones onto `palette`, darkest
// to lightest. Tones are collected from the decoded pixels rather than
// hardcoded, so this survives any colour management the browser applies on
// decode -- and works for whichever band the font points at.
//
// `flatSlot` picks the palette entry for a face that turns out to have only one
// tone. The narrow font is flat, and its single tone is a body colour rather
// than a highlight, so it asks for the middle of the ramp.
function recolor(ctx, w, h, palette, flatSlot) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  const tones = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (isBackground(d, i)) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    if (!tones.has(key)) {
      tones.set(key, 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
  }

  const ramp = PALETTES[palette];
  const ranked = [...tones.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key);
  const remap = new Map();
  ranked.forEach((key, i) => {
    const slot = ranked.length < 2
      ? flatSlot
      : Math.round((i * (ramp.length - 1)) / (ranked.length - 1));
    remap.set(key, hexToRgb(ramp[slot]));
  });

  for (let i = 0; i < d.length; i += 4) {
    if (isBackground(d, i)) {
      d[i + 3] = 0;
      continue;
    }
    const rgb = remap.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (rgb) {
      d[i] = rgb[0];
      d[i + 1] = rgb[1];
      d[i + 2] = rgb[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// Flood a 1px outline into every transparent pixel touching ink (8-connected, so
// diagonals close up). Runs on a canvas already laid out into padded cells.
function bakeOutline(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  // Snapshot the ink mask first, so outline pixels can't seed more outline.
  const ink = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    ink[p] = d[p * 4 + 3] > 0 ? 1 : 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (ink[p]) continue;
      let touching = false;
      for (let dy = -1; dy <= 1 && !touching; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (ink[ny * w + nx]) { touching = true; break; }
        }
      }
      if (touching) {
        d[p * 4] = OUTLINE[0];
        d[p * 4 + 1] = OUTLINE[1];
        d[p * 4 + 2] = OUTLINE[2];
        d[p * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// Shared atlas lifecycle: build once the sheet has decoded, and give up
// permanently if it can never be read back.
class SheetFont {
  constructor(palette, fallback) {
    this.palette = PALETTES[palette] ? palette : fallback;
    this.atlas = null;
    this.failed = false;
  }

  // True once glyphs can actually be drawn. Callers should have a fallback for
  // the first few frames (and for `failed`, which means the sheet could not be
  // read back -- e.g. a tainted canvas when served from file://).
  ready() {
    return this._atlas() != null;
  }

  _atlas() {
    if (this.atlas || this.failed) {
      return this.atlas;
    }
    if (!sheet.complete || sheet.naturalWidth === 0) {
      return null;
    }
    try {
      this.atlas = this._build();
    } catch (e) {
      // Reading the sheet back failed (tainted canvas). Give up permanently
      // rather than retrying every frame; callers fall back to a CSS font.
      this.failed = true;
    }
    return this.atlas;
  }
}

// ------------------------------------------------------------------ the fonts

// A single recolored, background-keyed copy of the chunky HUD font, built once
// the sheet has decoded. Cheap enough that each renderer can own one.
class PixelFont extends SheetFont {
  constructor(palette = 'gold') {
    super(palette, 'gold');
  }

  width(text) {
    return text.length * CHAR_W;
  }

  height() {
    return CHAR_H;
  }

  // Draw `text` with its top-left at (x, y), at 1:1 scale. Unknown characters
  // (including spaces) advance without drawing. Returns false if the font is
  // not usable yet, so the caller can fall back.
  draw(ctx, text, x, y) {
    const atlas = this._atlas();
    if (!atlas) {
      return false;
    }
    const cellW = CHAR_W + PAD * 2;
    let dx = x;
    for (const ch of text.toUpperCase()) {
      const i = CHARS.indexOf(ch);
      if (i >= 0) {
        // Drawn a pixel up and left of the pen, so the padded cell's outline
        // sits outside the glyph box and the ink lands exactly on (dx, y).
        ctx.drawImage(atlas, i * cellW, 0, cellW, CHAR_H + PAD * 2,
                      dx - PAD, y - PAD, cellW, CHAR_H + PAD * 2);
      }
      dx += CHAR_W;
    }
    return true;
  }

  _build() {
    // Repack the band into uniform 8px cells, one per entry in CHARS, so the
    // grid glyphs and the proportional punctuation end up on the same footing.
    const cellW = CHAR_W + PAD * 2;
    const canvas = document.createElement('canvas');
    canvas.width = CHARS.length * cellW;
    canvas.height = CHAR_H + PAD * 2;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < CHARS.length; i++) {
      const g = GLYPH_SRC.get(CHARS[i]);
      const sy = BAND_Y + (g.sy || 0);
      const gh = g.h || CHAR_H;
      const dx = i * cellW + PAD + Math.floor((CHAR_W - g.w) / 2);
      ctx.drawImage(sheet, g.sx, sy, g.w, gh, dx, PAD + (g.sy || 0), g.w, gh);
    }
    recolor(ctx, canvas.width, canvas.height, this.palette, PALETTES[this.palette].length - 1);
    return bakeOutline(canvas);
  }
}

// The narrow caption font. Proportional, so it carries a per-glyph width table
// and its atlas cells are not uniform; `cells` maps a character to where its
// padded cell starts and how wide the ink is.
class ProportionalFont extends SheetFont {
  constructor(palette = 'cyan') {
    super(palette, 'cyan');
    this.cells = new Map();
  }

  // Ink width of `text`: every glyph's advance, less the trailing gap, so a
  // right-aligned readout sits flush against its margin.
  width(text) {
    let total = 0;
    for (const ch of text) {
      total += this._advance(ch);
    }
    return Math.max(0, total - THIN_GAP);
  }

  // An all-caps caption is exactly this tall; lowercase descenders reach lower.
  height() {
    return THIN_CAP_H;
  }

  // Draw `text` with the top of its capitals at `y` and its left edge at `x`.
  // Unknown characters advance as a space without drawing.
  draw(ctx, text, x, y) {
    const atlas = this._atlas();
    if (!atlas) {
      return false;
    }
    const cellH = THIN_BAND_H + PAD * 2;
    let dx = x;
    for (const ch of text) {
      const cell = this.cells.get(ch);
      if (cell) {
        const cellW = cell.w + PAD * 2;
        // Drawn a pixel up and left of the pen so the outline falls outside the
        // glyph box, and lifted by the cap top so row 1 of the band -- where
        // capitals start -- lands exactly on `y`.
        ctx.drawImage(atlas, cell.dx, 0, cellW, cellH,
                      dx - PAD, y - THIN_CAP_TOP - PAD, cellW, cellH);
      }
      dx += this._advance(ch);
    }
    return true;
  }

  _advance(ch) {
    const w = THIN_INK_W.get(ch);
    return (w === undefined ? THIN_SPACE_W : w) + THIN_GAP;
  }

  _build() {
    // One padded cell per glyph, laid left to right at its own width. Cells are
    // 2px apart at their ink, so no glyph's outline can reach another's.
    const cellH = THIN_BAND_H + PAD * 2;
    const canvas = document.createElement('canvas');
    canvas.width = THIN_GLYPHS.reduce((sum, [, , w]) => sum + w + PAD * 2, 0);
    canvas.height = cellH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let dx = 0;
    for (const [ch, sx, w] of THIN_GLYPHS) {
      ctx.drawImage(sheet, sx, THIN_BAND_Y, w, THIN_BAND_H, dx + PAD, PAD, w, THIN_BAND_H);
      this.cells.set(ch, { dx, w });
      dx += w + PAD * 2;
    }

    // The band is a single flat tone, which is the face's body colour rather
    // than a highlight -- so it maps to the middle of the ramp, not the top.
    recolor(ctx, canvas.width, canvas.height, this.palette,
            Math.floor(PALETTES[this.palette].length / 2));
    return bakeOutline(canvas);
  }
}

export { PixelFont, ProportionalFont, CHAR_W, CHAR_H, THIN_CAP_H };
