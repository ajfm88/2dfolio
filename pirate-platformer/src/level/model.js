/** @typedef {import('../types.js').LevelData} LevelData */
/** @typedef {import('../types.js').LayerName} LayerName */
/** @typedef {import('../types.js').EntityRecord} EntityRecord */
/** @typedef {import('../types.js').DecorRecord} DecorRecord */
/** @typedef {import('../types.js').Cell} Cell */

import {
  COLS_MAX,
  COLS_MIN,
  LevelError,
  ROWS_MAX,
  ROWS_MIN,
} from './schema.js';

/**
 * Mutable in-memory level. Serialisation lives in codec.js.
 */
export class LevelModel {
  /**
   * @param {LevelData} data
   * @param {{ terrain: Uint8Array, platform: Uint8Array, water: Uint8Array }} layers
   */
  constructor(data, layers) {
    this.format = data.format;
    this.id = data.id;
    this.name = data.name;
    this.author = data.author;
    this.theme = data.theme;
    this.cols = data.cols;
    this.rows = data.rows;
    this.created = data.created;
    this.modified = data.modified;
    /** @type {Cell} */
    this.spawn = { c: data.spawn.c, r: data.spawn.r };
    /** @type {Cell} */
    this.goal = { c: data.goal.c, r: data.goal.r };
    this.layers = layers;
    /** @type {EntityRecord[]} */
    this.entities = data.entities.map((e) => ({
      k: e.k,
      c: e.c,
      r: e.r,
      ...(e.p ? { p: { ...e.p } } : {}),
    }));
    /** @type {DecorRecord[]} */
    this.decor = data.decor.map((d) => ({ k: d.k, c: d.c, r: d.r }));
  }

  /**
   * @param {number} c
   * @param {number} r
   */
  tileIndex(c, r) {
    return r * this.cols + c;
  }

  /**
   * @param {number} c
   * @param {number} r
   */
  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  /**
   * @param {LayerName} layer
   * @param {number} c
   * @param {number} r
   */
  get(layer, c, r) {
    return this.layers[layer][this.tileIndex(c, r)];
  }

  /**
   * @param {LayerName} layer
   * @param {number} c
   * @param {number} r
   * @param {number} value
   */
  set(layer, c, r, value) {
    this.layers[layer][this.tileIndex(c, r)] = value;
    this.modified = Date.now();
  }

  /**
   * @param {number} cols
   * @param {number} rows
   */
  resize(cols, rows) {
    if (!Number.isInteger(cols) || cols < COLS_MIN || cols > COLS_MAX) {
      throw new LevelError('cols', `must be ${COLS_MIN}–${COLS_MAX}`);
    }
    if (!Number.isInteger(rows) || rows < ROWS_MIN || rows > ROWS_MAX) {
      throw new LevelError('rows', `must be ${ROWS_MIN}–${ROWS_MAX}`);
    }

    const oldCols = this.cols;
    const oldRows = this.rows;
    const copyCols = Math.min(oldCols, cols);
    const copyRows = Math.min(oldRows, rows);

    /**
     * @param {Uint8Array} src
     */
    const copyLayer = (src) => {
      const dest = new Uint8Array(cols * rows);
      for (let r = 0; r < copyRows; r++) {
        dest.set(src.subarray(r * oldCols, r * oldCols + copyCols), r * cols);
      }
      return dest;
    };

    this.layers.terrain = copyLayer(this.layers.terrain);
    this.layers.platform = copyLayer(this.layers.platform);
    this.layers.water = copyLayer(this.layers.water);
    this.cols = cols;
    this.rows = rows;
    this.entities = this.entities.filter((e) => e.c < cols && e.r < rows);
    this.decor = this.decor.filter((d) => d.c < cols && d.r < rows);
    this.spawn.c = Math.min(this.spawn.c, cols - 1);
    this.spawn.r = Math.min(this.spawn.r, rows - 1);
    this.goal.c = Math.min(this.goal.c, cols - 1);
    this.goal.r = Math.min(this.goal.r, rows - 1);
    this.modified = Date.now();
  }
}
