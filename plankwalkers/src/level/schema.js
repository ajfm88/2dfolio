/** @typedef {import('../types.js').LevelData} LevelData */
/** @typedef {import('../types.js').Cell} Cell */
/** @typedef {import('../types.js').EntityRecord} EntityRecord */
/** @typedef {import('../types.js').DecorRecord} DecorRecord */

export const FORMAT = 1;
export const COLS_MIN = 40;
export const COLS_MAX = 400;
export const ROWS_MIN = 12;
export const ROWS_MAX = 48;
export const COLS_DEFAULT = 160;
export const ROWS_DEFAULT = 24;
export const ENTITIES_MAX = 400;
export const DECOR_MAX = 2000;

const LAYER_NAMES = /** @type {const} */ (['terrain', 'platform', 'water']);

export class LevelError extends Error {
  /**
   * @param {string} field
   * @param {string} message
   */
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = 'LevelError';
    /** @type {string} */
    this.field = field;
  }
}

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {string}
 */
function reqString(field, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LevelError(field, 'expected a non-empty string');
  }
  return value;
}

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {string}
 */
function optString(field, value) {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new LevelError(field, 'expected a string');
  }
  return value;
}

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {number}
 */
function reqInt(field, value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new LevelError(field, 'expected an integer');
  }
  return value;
}

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {number}
 */
function reqNumber(field, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LevelError(field, 'expected a finite number');
  }
  return value;
}

/**
 * @param {string} field
 * @param {unknown} raw
 * @param {number} cols
 * @param {number} rows
 * @returns {Cell}
 */
function reqCell(field, raw, cols, rows) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new LevelError(field, 'expected { c, r }');
  }
  const obj = /** @type {{ c?: unknown, r?: unknown }} */ (raw);
  const c = reqInt(`${field}.c`, obj.c);
  const r = reqInt(`${field}.r`, obj.r);
  if (c < 0 || c >= cols) {
    throw new LevelError(`${field}.c`, `out of range 0..${cols - 1}`);
  }
  if (r < 0 || r >= rows) {
    throw new LevelError(`${field}.r`, `out of range 0..${rows - 1}`);
  }
  return { c, r };
}

/**
 * @param {string} encoded
 * @param {string} field
 * @returns {number}
 */
export function rleSum(encoded, field) {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new LevelError(field, 'expected an RLE string');
  }
  let sum = 0;
  const parts = encoded.split(',');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = /^(\d+):(\d+)$/.exec(part);
    if (!m) throw new LevelError(field, `malformed run "${part}"`);
    const value = Number(m[1]);
    const count = Number(m[2]);
    if (value > 255) throw new LevelError(field, `value ${value} exceeds 255`);
    if (count < 1) throw new LevelError(field, 'run count must be ≥ 1');
    sum += count;
  }
  return sum;
}

/**
 * @returns {string}
 */
export function newLevelId() {
  return `lvl_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {unknown} raw
 * @returns {LevelData}
 */
export function validateLevel(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new LevelError('level', 'expected an object');
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);

  const format = reqInt('format', obj.format);
  if (format !== FORMAT) {
    throw new LevelError('format', `unsupported version ${format}`);
  }

  const id = reqString('id', obj.id);
  if (typeof obj.name !== 'string') {
    throw new LevelError('name', 'expected a string');
  }
  const name = obj.name;
  const author = optString('author', obj.author);
  const theme = reqString('theme', obj.theme);
  const cols = reqInt('cols', obj.cols);
  const rows = reqInt('rows', obj.rows);

  if (cols < COLS_MIN || cols > COLS_MAX) {
    throw new LevelError('cols', `must be ${COLS_MIN}–${COLS_MAX}`);
  }
  if (rows < ROWS_MIN || rows > ROWS_MAX) {
    throw new LevelError('rows', `must be ${ROWS_MIN}–${ROWS_MAX}`);
  }

  const created = reqNumber('created', obj.created);
  const modified = reqNumber('modified', obj.modified);
  const spawn = reqCell('spawn', obj.spawn, cols, rows);
  const goal = reqCell('goal', obj.goal, cols, rows);

  if (obj.layers === null || typeof obj.layers !== 'object' || Array.isArray(obj.layers)) {
    throw new LevelError('layers', 'expected an object');
  }
  const layersIn = /** @type {Record<string, unknown>} */ (obj.layers);
  const cells = cols * rows;
  /** @type {LevelData['layers']} */
  const layers = { terrain: '', platform: '', water: '' };
  for (let i = 0; i < LAYER_NAMES.length; i++) {
    const layer = LAYER_NAMES[i];
    const field = `layers.${layer}`;
    const encoded = layersIn[layer];
    const sum = rleSum(/** @type {string} */ (encoded), field);
    if (sum !== cells) {
      throw new LevelError(field, `run counts sum to ${sum}, expected ${cells} (cols × rows)`);
    }
    layers[layer] = /** @type {string} */ (encoded);
  }

  if (!Array.isArray(obj.entities)) {
    throw new LevelError('entities', 'expected an array');
  }
  if (obj.entities.length > ENTITIES_MAX) {
    throw new LevelError('entities', `too many (${obj.entities.length} > ${ENTITIES_MAX})`);
  }
  /** @type {EntityRecord[]} */
  const entities = [];
  for (let i = 0; i < obj.entities.length; i++) {
    entities.push(reqPlaced(`entities[${i}]`, obj.entities[i], cols, rows, true));
  }

  if (!Array.isArray(obj.decor)) {
    throw new LevelError('decor', 'expected an array');
  }
  if (obj.decor.length > DECOR_MAX) {
    throw new LevelError('decor', `too many (${obj.decor.length} > ${DECOR_MAX})`);
  }
  /** @type {DecorRecord[]} */
  const decor = [];
  for (let i = 0; i < obj.decor.length; i++) {
    const rec = reqPlaced(`decor[${i}]`, obj.decor[i], cols, rows, false);
    decor.push({ k: rec.k, c: rec.c, r: rec.r });
  }

  return {
    format: FORMAT,
    id,
    name,
    author,
    theme,
    cols,
    rows,
    created,
    modified,
    spawn,
    goal,
    layers,
    decor,
    entities,
  };
}

/**
 * @param {string} field
 * @param {unknown} raw
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} allowProps
 * @returns {EntityRecord}
 */
function reqPlaced(field, raw, cols, rows, allowProps) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new LevelError(field, 'expected an object');
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const k = reqString(`${field}.k`, obj.k);
  const c = reqInt(`${field}.c`, obj.c);
  const r = reqInt(`${field}.r`, obj.r);
  if (c < 0 || c >= cols) {
    throw new LevelError(`${field}.c`, `out of range 0..${cols - 1}`);
  }
  if (r < 0 || r >= rows) {
    throw new LevelError(`${field}.r`, `out of range 0..${rows - 1}`);
  }
  /** @type {EntityRecord} */
  const rec = { k, c, r };
  if (allowProps && obj.p !== undefined) {
    if (obj.p === null || typeof obj.p !== 'object' || Array.isArray(obj.p)) {
      throw new LevelError(`${field}.p`, 'expected a plain object');
    }
    rec.p = { .../** @type {Record<string, unknown>} */ (obj.p) };
  }
  return rec;
}

/**
 * @param {{ cols?: number, rows?: number, name?: string, id?: string }} [opts]
 * @returns {LevelData}
 */
export function createBlankLevel(opts = {}) {
  const cols = opts.cols ?? COLS_DEFAULT;
  const rows = opts.rows ?? ROWS_DEFAULT;
  const cells = cols * rows;
  const now = Date.now();
  const spawnC = Math.min(4, cols - 1);
  const spawnR = Math.min(Math.max(0, rows - 6), rows - 1);
  const goalC = Math.min(Math.max(0, cols - 8), cols - 1);
  const goalR = Math.min(Math.max(0, rows - 8), rows - 1);
  return validateLevel({
    format: FORMAT,
    id: opts.id ?? newLevelId(),
    name: opts.name ?? 'Untitled',
    author: '',
    theme: 'island',
    cols,
    rows,
    created: now,
    modified: now,
    spawn: { c: spawnC, r: spawnR },
    goal: { c: goalC, r: goalR },
    layers: {
      terrain: `0:${cells}`,
      platform: `0:${cells}`,
      water: `0:${cells}`,
    },
    decor: [],
    entities: [],
  });
}
