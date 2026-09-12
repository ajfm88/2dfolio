import { describe, expect, it } from 'vitest';
import {
  MASK_TABLE,
  autotileAt,
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
 * Build a 3×3 layer with the centre present and neighbours from a mask.
 * @param {number} mask
 */
function layerFromMask(mask) {
  const cols = 3;
  const rows = 3;
  const layer = new Uint8Array(9);
  layer[1 * cols + 1] = 1;
  if (mask & 1) layer[0 * cols + 1] = 1;
  if (mask & 2) layer[1 * cols + 2] = 1;
  if (mask & 4) layer[2 * cols + 1] = 1;
  if (mask & 8) layer[1 * cols + 0] = 1;
  return { layer, cols, rows };
}

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
    expect(autotileAt(layer, cols, rows, c, r, scratch)).toBe(true);
    const n = true;
    const e = false;
    const s = false;
    const w = true;
    expect([scratch.col, scratch.row]).toEqual([sheetCol(e, w), sheetRow(n, s)]);
    expect(neighborMask(n, e, s, w)).toBe(1 | 8);
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
