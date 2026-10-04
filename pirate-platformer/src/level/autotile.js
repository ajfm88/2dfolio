/**
 * 47-tile blob autotile: the 4-neighbour mask (N=1, E=2, S=4, W=8) picks one of 16
 * base tiles, and a missing diagonal between two present edges picks one of 31
 * inner-corner variants. Cells outside the grid count as absent.
 *
 * Platform art drawn as a single row of planks (the Pirate Ship) uses the bar rule
 * at the end of this file instead: E and W neighbours only.
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
 * The 31 inner-corner tiles of the 47-tile blob sheet, keyed
 * "<4-neighbour mask>:<missing corners, sorted, joined by +>". A corner is missing
 * when both edges beside it are present and the diagonal cell is not. Measured from
 * the sheet 2026-09-29: each tile is its base tile with only those corner quadrants
 * redrawn (specs/19-polish.md, Measured Facts).
 * @type {Readonly<Record<string, readonly [number, number]>>}
 */
export const INNER_TABLE = {
  '3:NE': [15, 4],
  '6:SE': [15, 3],
  '9:NW': [16, 4],
  '12:SW': [16, 3],
  '7:NE': [6, 4],
  '7:SE': [6, 3],
  '7:NE+SE': [12, 3],
  '11:NE': [9, 4],
  '11:NW': [10, 4],
  '11:NE+NW': [12, 4],
  '13:NW': [7, 4],
  '13:SW': [7, 3],
  '13:NW+SW': [13, 4],
  '14:SE': [9, 3],
  '14:SW': [10, 3],
  '14:SE+SW': [13, 3],
  '15:NE': [6, 1],
  '15:NW': [7, 1],
  '15:SE': [6, 0],
  '15:SW': [7, 0],
  '15:NE+SE': [10, 0],
  '15:NE+SW': [16, 1],
  '15:NE+NW': [9, 0],
  '15:NW+SE': [15, 1],
  '15:NW+SW': [9, 1],
  '15:SE+SW': [10, 1],
  '15:NE+SE+SW': [13, 1],
  '15:NE+NW+SE': [13, 0],
  '15:NE+NW+SW': [12, 0],
  '15:NW+SE+SW': [12, 1],
  '15:NE+NW+SE+SW': [15, 0],
};

// Missing-corner bits, stored above the 4-neighbour mask in the lookup index.
const MISS_NE = 1;
const MISS_SE = 2;
const MISS_SW = 4;
const MISS_NW = 8;
// Alphabetical, the order INNER_TABLE's keys use.
const CORNER_NAMES = /** @type {const} */ ([
  [MISS_NE, 'NE'], [MISS_NW, 'NW'], [MISS_SE, 'SE'], [MISS_SW, 'SW'],
]);

// Built once: index = mask | missing << 4. Only corners whose two edges are present
// are ever set in `missing`, so every reachable index names one of the 47 tiles.
const BLOB_COL = new Uint8Array(256);
const BLOB_ROW = new Uint8Array(256);
for (let mask = 0; mask < 16; mask++) {
  for (let missing = 0; missing < 16; missing++) {
    let key = '';
    for (let i = 0; i < CORNER_NAMES.length; i++) {
      if (missing & CORNER_NAMES[i][0]) key += (key ? '+' : '') + CORNER_NAMES[i][1];
    }
    const tile = key ? INNER_TABLE[`${mask}:${key}`] : MASK_TABLE[mask];
    // An index whose corners cannot be missing for this mask is never looked up.
    if (!tile) continue;
    BLOB_COL[mask | (missing << 4)] = tile[0];
    BLOB_ROW[mask | (missing << 4)] = tile[1];
  }
}

/**
 * Sheet cell for a present cell from its eight neighbours. A diagonal matters only
 * when both edges beside it are present; otherwise the 4-neighbour tile already
 * shows that corner as outside.
 *
 * @param {boolean} n
 * @param {boolean} e
 * @param {boolean} s
 * @param {boolean} w
 * @param {boolean} ne
 * @param {boolean} se
 * @param {boolean} sw
 * @param {boolean} nw
 * @param {{ col: number, row: number }} out
 */
export function blobCell(n, e, s, w, ne, se, sw, nw, out) {
  const missing = (n && e && !ne ? MISS_NE : 0)
    | (s && e && !se ? MISS_SE : 0)
    | (s && w && !sw ? MISS_SW : 0)
    | (n && w && !nw ? MISS_NW : 0);
  const i = neighborMask(n, e, s, w) | (missing << 4);
  out.col = BLOB_COL[i];
  out.row = BLOB_ROW[i];
}

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
  blobCell(
    isPresent(layer, cols, rows, c, r - 1),
    isPresent(layer, cols, rows, c + 1, r),
    isPresent(layer, cols, rows, c, r + 1),
    isPresent(layer, cols, rows, c - 1, r),
    isPresent(layer, cols, rows, c + 1, r - 1),
    isPresent(layer, cols, rows, c + 1, r + 1),
    isPresent(layer, cols, rows, c - 1, r + 1),
    isPresent(layer, cols, rows, c - 1, r - 1),
    out,
  );
  return true;
}

/**
 * Bar rule for platform art drawn as one row of planks (the Pirate Ship platforms):
 * left cap, middle, right cap or single, by the E and W neighbours on the same
 * layer. N and S never matter, so stacked rows each draw planks. Indexed by
 * (e ? 1 : 0) | (w ? 2 : 0). Columns are relative to the sheet's origin, and the
 * row is always 0. Measured from the sheet 2026-10-02 (specs/20-second-theme.md,
 * Measured Facts).
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const BAR_TABLE = [
  [3, 0], // single
  [0, 0], // left cap
  [2, 0], // right cap
  [1, 0], // middle
];

/**
 * Sheet cell for a present plank from its E and W neighbours.
 *
 * @param {boolean} e
 * @param {boolean} w
 * @param {{ col: number, row: number }} out
 */
export function barCell(e, w, out) {
  const cell = BAR_TABLE[(e ? 1 : 0) | (w ? 2 : 0)];
  out.col = cell[0];
  out.row = cell[1];
}

/**
 * Writes the plank cell into `out`. Returns false if the cell is empty.
 * @param {Uint8Array} layer
 * @param {number} cols
 * @param {number} rows
 * @param {number} c
 * @param {number} r
 * @param {{ col: number, row: number }} out
 * @returns {boolean}
 */
export function barTileAt(layer, cols, rows, c, r, out) {
  if (!isPresent(layer, cols, rows, c, r)) return false;
  barCell(isPresent(layer, cols, rows, c + 1, r), isPresent(layer, cols, rows, c - 1, r), out);
  return true;
}
