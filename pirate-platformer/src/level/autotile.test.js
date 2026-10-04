import { describe, expect, it } from 'vitest';
import {
  BAR_TABLE,
  INNER_TABLE,
  MASK_TABLE,
  autotileAt,
  barCell,
  barTileAt,
  blobCell,
  isPresent,
  neighborMask,
  sheetCol,
  sheetRow,
} from './autotile.js';

describe('closed form vs architecture table', () => {
  it('matches all 16 masks', () => {
    for (let mask = 0; mask < 16; mask++) {
      const n = (mask & 1) !== 0;
      const e = (mask & 2) !== 0;
      const s = (mask & 4) !== 0;
      const w = (mask & 8) !== 0;
      expect(neighborMask(n, e, s, w)).toBe(mask);
      expect([sheetCol(e, w), sheetRow(n, s)]).toEqual([...MASK_TABLE[mask]]);
    }
  });
});

/**
 * Build a 3×3 layer with the centre present, edge neighbours from a mask, and every
 * diagonal present unless named in `missing` — so with no corners missing, the
 * centre is a base tile, exactly as it was before inner corners.
 * @param {number} mask
 * @param {string[]} [missing] of 'NE' | 'SE' | 'SW' | 'NW'
 */
function layerFromMask(mask, missing = []) {
  const cols = 3;
  const rows = 3;
  const layer = new Uint8Array(9);
  layer[1 * cols + 1] = 1;
  if (mask & 1) layer[0 * cols + 1] = 1;
  if (mask & 2) layer[1 * cols + 2] = 1;
  if (mask & 4) layer[2 * cols + 1] = 1;
  if (mask & 8) layer[1 * cols + 0] = 1;
  if (!missing.includes('NE')) layer[0 * cols + 2] = 1;
  if (!missing.includes('SE')) layer[2 * cols + 2] = 1;
  if (!missing.includes('SW')) layer[2 * cols + 0] = 1;
  if (!missing.includes('NW')) layer[0 * cols + 0] = 1;
  return { layer, cols, rows };
}

/** Corners that count for a mask: both edges beside them present. */
const RELEVANT = { NE: 1 | 2, NW: 1 | 8, SE: 2 | 4, SW: 4 | 8 };

describe('autotileAt', () => {
  const scratch = { col: 0, row: 0 };

  it('returns false for empty cells', () => {
    const layer = new Uint8Array(9);
    expect(autotileAt(layer, 3, 3, 1, 1, scratch)).toBe(false);
  });

  it('maps each neighbour mask on a 3×3 to the table', () => {
    for (let mask = 0; mask < 16; mask++) {
      const { layer, cols, rows } = layerFromMask(mask);
      expect(autotileAt(layer, cols, rows, 1, 1, scratch)).toBe(true);
      expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[mask]]);
    }
  });

  it('treats out-of-bounds neighbours as absent (top-left corner)', () => {
    const cols = 4;
    const rows = 3;
    const layer = new Uint8Array(cols * rows);
    layer[0] = 1;
    expect(isPresent(layer, cols, rows, -1, 0)).toBe(false);
    expect(isPresent(layer, cols, rows, 0, -1)).toBe(false);
    expect(autotileAt(layer, cols, rows, 0, 0, scratch)).toBe(true);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[0]]);
  });

  it('treats out-of-bounds neighbours as absent (bottom-right with west+north)', () => {
    const cols = 4;
    const rows = 3;
    const layer = new Uint8Array(cols * rows);
    const c = cols - 1;
    const r = rows - 1;
    layer[r * cols + c] = 1;
    layer[r * cols + (c - 1)] = 1;
    layer[(r - 1) * cols + c] = 1;
    // The north-west diagonal too, so the corner between the two edges is filled.
    layer[(r - 1) * cols + (c - 1)] = 1;
    expect(autotileAt(layer, cols, rows, c, r, scratch)).toBe(true);
    const n = true;
    const e = false;
    const s = false;
    const w = true;
    expect([scratch.col, scratch.row]).toEqual([sheetCol(e, w), sheetRow(n, s)]);
    expect(neighborMask(n, e, s, w)).toBe(1 | 8);
  });

  it('gives the inner corner when the diagonal between two edges is empty', () => {
    // The same bottom-right cell without its north-west diagonal.
    const cols = 4;
    const rows = 3;
    const layer = new Uint8Array(cols * rows);
    const c = cols - 1;
    const r = rows - 1;
    layer[r * cols + c] = 1;
    layer[r * cols + (c - 1)] = 1;
    layer[(r - 1) * cols + c] = 1;
    expect(autotileAt(layer, cols, rows, c, r, scratch)).toBe(true);
    expect([scratch.col, scratch.row]).toEqual([...INNER_TABLE['9:NW']]);
  });

  it('updates neighbours when a cell is erased', () => {
    const cols = 3;
    const rows = 3;
    const layer = new Uint8Array(9).fill(1);
    expect(autotileAt(layer, cols, rows, 1, 1, scratch)).toBe(true);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[15]]);
    layer[1 * cols + 1] = 0;
    expect(autotileAt(layer, cols, rows, 1, 0, scratch)).toBe(true);
    expect(autotileAt(layer, cols, rows, 1, 1, scratch)).toBe(false);
    expect(autotileAt(layer, cols, rows, 1, 0, scratch)).toBe(true);
    expect([scratch.col, scratch.row]).toEqual([
      sheetCol(true, true),
      sheetRow(false, false),
    ]);
  });
});

describe('inner corners (47-tile blob)', () => {
  const scratch = { col: 0, row: 0 };

  it('gives all 47 tiles: 16 bases and the 31 of INNER_TABLE', () => {
    let cases = 0;
    for (let mask = 0; mask < 16; mask++) {
      const corners = Object.keys(RELEVANT).filter((k) => (mask & RELEVANT[k]) === RELEVANT[k]);
      for (let subset = 0; subset < 1 << corners.length; subset++) {
        const missing = corners.filter((_, i) => subset & (1 << i));
        const { layer, cols, rows } = layerFromMask(mask, missing);
        autotileAt(layer, cols, rows, 1, 1, scratch);
        const expected = missing.length === 0
          ? MASK_TABLE[mask]
          : INNER_TABLE[`${mask}:${[...missing].sort().join('+')}`];
        expect([scratch.col, scratch.row], `mask ${mask} missing ${missing}`)
          .toEqual([...expected]);
        cases++;
      }
    }
    expect(cases).toBe(47);
  });

  it('has 31 distinct inner tiles inside the 17 × 5 sheet, none a base tile', () => {
    const inner = Object.values(INNER_TABLE).map(([c, r]) => `${c},${r}`);
    const base = MASK_TABLE.map(([c, r]) => `${c},${r}`);
    expect(inner).toHaveLength(31);
    expect(new Set(inner).size).toBe(31);
    for (const t of inner) expect(base).not.toContain(t);
    for (const [c, r] of Object.values(INNER_TABLE)) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(17);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(5);
    }
  });

  it('maps every one of the 256 neighbour combinations to one of the 47 tiles', () => {
    const all = new Set([...MASK_TABLE, ...Object.values(INNER_TABLE)].map(([c, r]) => `${c},${r}`));
    const seen = new Set();
    for (let bits = 0; bits < 256; bits++) {
      const b = (i) => (bits & (1 << i)) !== 0;
      blobCell(b(0), b(1), b(2), b(3), b(4), b(5), b(6), b(7), scratch);
      const t = `${scratch.col},${scratch.row}`;
      expect(all.has(t), `bits ${bits}`).toBe(true);
      seen.add(t);
    }
    expect(seen.size).toBe(47);
  });

  it('ignores a diagonal unless both edges beside it are present', () => {
    // No edges: whatever the diagonals, the single tile.
    blobCell(false, false, false, false, false, false, false, false, scratch);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[0]]);
    blobCell(false, false, false, false, true, true, true, true, scratch);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[0]]);
    // N, E and S (mask 7): the west diagonals cannot matter.
    blobCell(true, true, true, false, true, true, false, false, scratch);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[7]]);
    blobCell(true, true, true, false, true, true, true, true, scratch);
    expect([scratch.col, scratch.row]).toEqual([...MASK_TABLE[7]]);
  });

  it('fills a 1-tile hole with notched diagonals and plain edges around it', () => {
    // A 5×5 solid block with its centre removed.
    const cols = 5;
    const rows = 5;
    const layer = new Uint8Array(cols * rows).fill(1);
    layer[2 * cols + 2] = 0;
    const at = (c, r) => {
      autotileAt(layer, cols, rows, c, r, scratch);
      return [scratch.col, scratch.row];
    };
    // The floor under the hole is a top edge (grass), as before inner corners.
    expect(at(2, 3)).toEqual([...MASK_TABLE[14]]);
    // Its diagonal neighbours each gain the notch facing the hole.
    expect(at(1, 1)).toEqual([...INNER_TABLE['15:SE']]);
    expect(at(3, 1)).toEqual([...INNER_TABLE['15:SW']]);
    expect(at(1, 3)).toEqual([...INNER_TABLE['15:NE']]);
    expect(at(3, 3)).toEqual([...INNER_TABLE['15:NW']]);
  });
});

describe('horizontal bar tiling', () => {
  it.each([
    [false, false, 3], [true, false, 0], [false, true, 2], [true, true, 1],
  ])('maps east=%s west=%s to column %s', (e, w, col) => {
    const out = { col: -1, row: -1 };
    barCell(e, w, out);
    expect(out).toEqual({ col, row: 0 });
    expect(BAR_TABLE[(e ? 1 : 0) | (w ? 2 : 0)]).toEqual([col, 0]);
  });

  it('does not write an empty or out-of-bounds cell', () => {
    const out = { col: -1, row: -1 };
    expect(barTileAt(new Uint8Array(9), 3, 3, 1, 1, out)).toBe(false);
    expect(barTileAt(new Uint8Array(9), 3, 3, -1, 1, out)).toBe(false);
    expect(out).toEqual({ col: -1, row: -1 });
  });

  it('caps a three-wide strip at the grid edges', () => {
    const layer = new Uint8Array([1, 1, 1]);
    const out = { col: 0, row: 0 };
    for (const [c, col] of [[0, 0], [1, 1], [2, 2]]) {
      expect(barTileAt(layer, 3, 1, c, 0, out)).toBe(true);
      expect(out).toEqual({ col, row: 0 });
    }
  });

  it('draws a lone cell and ignores north and south neighbours', () => {
    const out = { col: 0, row: 0 };
    expect(barTileAt(new Uint8Array([1]), 1, 1, 0, 0, out)).toBe(true);
    expect(out).toEqual({ col: 3, row: 0 });
    const plus = new Uint8Array([0, 1, 0, 1, 1, 1, 0, 1, 0]);
    barTileAt(plus, 3, 3, 1, 1, out);
    expect(out).toEqual({ col: 1, row: 0 });
    barTileAt(plus, 3, 3, 1, 0, out);
    expect(out).toEqual({ col: 3, row: 0 });
  });
});
