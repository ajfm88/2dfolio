/**
 * 4-neighbour autotile. Cells outside the grid count as absent.
 * N=1, E=2, S=4, W=8.
 */

/**
 * @param {boolean} e
 * @param {boolean} w
 */
export function sheetCol(e, w) {
  return e && w ? 1 : e ? 0 : w ? 2 : 4;
}

/**
 * @param {boolean} n
 * @param {boolean} s
 */
export function sheetRow(n, s) {
  return n && s ? 1 : s ? 0 : n ? 2 : 4;
}

/**
 * @param {boolean} n
 * @param {boolean} e
 * @param {boolean} s
 * @param {boolean} w
 */
export function neighborMask(n, e, s, w) {
  return (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
}

/**
 * Architecture table: mask → (col, row). Tests assert closed form equals this.
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const MASK_TABLE = [
  [4, 4],
  [4, 2],
  [0, 4],
  [0, 2],
  [4, 0],
  [4, 1],
  [0, 0],
  [0, 1],
  [2, 4],
  [2, 2],
  [1, 4],
  [1, 2],
  [2, 0],
  [2, 1],
  [1, 0],
  [1, 1],
];

/**
 * @param {Uint8Array} layer
 * @param {number} cols
 * @param {number} rows
 * @param {number} c
 * @param {number} r
 */
export function isPresent(layer, cols, rows, c, r) {
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
  return layer[r * cols + c] !== 0;
}

/**
 * Writes sheet column/row into `out`. Returns false if the cell is empty.
 * @param {Uint8Array} layer
 * @param {number} cols
 * @param {number} rows
 * @param {number} c
 * @param {number} r
 * @param {{ col: number, row: number }} out
 */
export function autotileAt(layer, cols, rows, c, r, out) {
  if (!isPresent(layer, cols, rows, c, r)) return false;
  const n = isPresent(layer, cols, rows, c, r - 1);
  const e = isPresent(layer, cols, rows, c + 1, r);
  const s = isPresent(layer, cols, rows, c, r + 1);
  const w = isPresent(layer, cols, rows, c - 1, r);
  out.col = sheetCol(e, w);
  out.row = sheetRow(n, s);
  return true;
}
