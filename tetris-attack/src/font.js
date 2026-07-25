// Tetris Attack pixel font.
//
// `src/assets/font.png` was ripped by Parakarry (aka toastypk) from MFGG; the original
// art is (c) Nintendo. The rip's own note: "No credit is needed, but it would be
// nice if you did. :) Just please don't take these for yourself."
//
// The sheet carries three unrelated fonts. This module exposes the small HUD
// font -- the chunky one the SNES uses for score/time readouts -- which sits in
// five recolored bands across the top of the sheet.
//
// Measured off the sheet (pure-Python PNG decode, see the notes in CLAUDE.md):
//   band tops    y = 3, 11, 19, 27, 35, each band 6px tall
//   first cell   x = 2, every cell 8px wide
//   cell order   0-9 then A-Z (the punctuation past 'Z' is proportional, so it
//                is deliberately left out of the grid)
// Glyph ink sits inside its own cell, so slicing on the 8px grid gives correct
// advance widths for free -- no per-glyph width table needed.

const SHEET_URL = 'assets/font.png';

const CHAR_W = 8;
const CHAR_H = 6;
const CELL_X0 = 2;
const BAND_Y = 3; // any band works; the atlas gets recolored regardless
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:';

// Source x of each glyph's ink on the sheet, with its ink width. 0-9 and A-Z
// sit on the strict 8px grid. The punctuation past 'Z' does not -- it is packed
// proportionally -- so those glyphs carry an explicit position and get centred
// into a fixed 8px cell when the atlas is built, keeping every readout
// monospaced. (The sheet has no apostrophe, so the SNES timer's 0'01 is
// rendered 0:01 here.)
const GLYPH_SRC = new Map();
for (let i = 0; i < 36; i++) {
  GLYPH_SRC.set(CHARS[i], { sx: CELL_X0 + i * CHAR_W, w: CHAR_W });
}
GLYPH_SRC.set(':', { sx: 340, w: 2 });

// The atlas pads every cell by 1px so a hard outline can be baked around the
// glyphs. Without it the text disappears into busy stage art (the cave panel's
// orange rock and magenta squiggle in particular); the sheet's own large font
// carries a baked outline for exactly this reason. Glyph ink is 7px inside its
// 8px cell, so neighbouring outlines meet in the 1px gap without ever touching
// each other's ink -- which is what lets the padded cells overlap when drawn.
const PAD = 1;
const PAD_W = CHAR_W + PAD * 2;
const PAD_H = CHAR_H + PAD * 2;
const OUTLINE = [0, 0, 0];

// Each glyph is a three-tone bevel (shadow / body / highlight). Palettes are
// listed in that same order so a band can be remapped onto any of them.
//
// The stage-clear panels the score is drawn over are dark in all six stages
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

// A single recolored, background-keyed copy of the HUD font, built once the
// sheet has decoded. Cheap enough that each renderer can own one.
class PixelFont {
  constructor(palette = 'gold') {
    this.palette = PALETTES[palette] ? palette : 'gold';
    this.atlas = null;
    this.failed = false;
  }

  // True once glyphs can actually be drawn. Callers should have a fallback for
  // the first few frames (and for `failed`, which means the sheet could not be
  // read back -- e.g. a tainted canvas when served from file://).
  ready() {
    return this._atlas() != null;
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
    let dx = x;
    for (const ch of text.toUpperCase()) {
      const i = CHARS.indexOf(ch);
      if (i >= 0) {
        // Drawn a pixel up and left of the pen, so the padded cell's outline
        // sits outside the glyph box and the ink lands exactly on (dx, y).
        ctx.drawImage(atlas, i * PAD_W, 0, PAD_W, PAD_H, dx - PAD, y - PAD, PAD_W, PAD_H);
      }
      dx += CHAR_W;
    }
    return true;
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

  _build() {
    // Repack the band into uniform 8px cells, one per entry in CHARS, so the
    // grid glyphs and the proportional punctuation end up on the same footing.
    const w = CHARS.length * CHAR_W;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = CHAR_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < CHARS.length; i++) {
      const g = GLYPH_SRC.get(CHARS[i]);
      const dx = i * CHAR_W + Math.floor((CHAR_W - g.w) / 2);
      ctx.drawImage(sheet, g.sx, BAND_Y, g.w, CHAR_H, dx, 0, g.w, CHAR_H);
    }

    const image = ctx.getImageData(0, 0, w, CHAR_H);
    const d = image.data;
    const isBackground = (i) => d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240;

    // Collect the band's tones straight from the decoded pixels rather than
    // hardcoding them, so this survives any color management the browser
    // applies on decode (and works for whichever band BAND_Y points at).
    const tones = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (isBackground(i)) continue;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (!tones.has(key)) {
        tones.set(key, 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      }
    }

    const ramp = PALETTES[this.palette];
    const ranked = [...tones.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key);
    const remap = new Map();
    ranked.forEach((key, i) => {
      const slot = ranked.length < 2
        ? ramp.length - 1
        : Math.round((i * (ramp.length - 1)) / (ranked.length - 1));
      remap.set(key, hexToRgb(ramp[slot]));
    });

    for (let i = 0; i < d.length; i += 4) {
      if (isBackground(i)) {
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
    return this._outline(canvas);
  }

  // Re-lay the recolored strip into padded cells and flood a 1px outline into
  // every transparent pixel touching ink (8-connected, so diagonals close up).
  _outline(strip) {
    const canvas = document.createElement('canvas');
    canvas.width = CHARS.length * PAD_W;
    canvas.height = PAD_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < CHARS.length; i++) {
      ctx.drawImage(strip, i * CHAR_W, 0, CHAR_W, CHAR_H, i * PAD_W + PAD, PAD, CHAR_W, CHAR_H);
    }

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
}

export { PixelFont, CHAR_W, CHAR_H };
