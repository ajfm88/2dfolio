/**
 * Saved levels: an index for the list screen, and each level as a share code.
 * Levels are stored already compressed so the ~5 MB quota holds hundreds of them.
 *
 * Writes are asynchronous because compression is, while the game loop is not.
 * `save` copies the model before it returns, and a newer save for the same id
 * always wins over an older one that finishes later.
 */

import { decodeShare, encodeShare } from '../level/codec.js';
import { LevelError, newLevelId } from '../level/schema.js';

/** @typedef {import('../level/model.js').LevelModel} LevelModel */
/** @typedef {ReturnType<typeof import('./safe-storage.js').createSafeStorage>} SafeStorage */

const INDEX_KEY = 'cc:v1:levels:index';
const LEVEL_PREFIX = 'cc:v1:level:';
const RESUME_KEY = 'cc:v1:maker:last';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   theme: string,
 *   cols: number,
 *   rows: number,
 *   modified: number,
 * }} LevelSummary
 *
 * `invalid` means the level could not be encoded. The maker only saves levels that
 * pass the schema, so it marks a bug rather than a user error.
 * @typedef {{ ok: true } | { ok: false, reason: 'quota' | 'invalid' }} SaveResult
 *
 * Where the maker was left, for reopening the same level where it was.
 * @typedef {{
 *   levelId: string,
 *   camX: number,
 *   camY: number,
 *   zoom: number,
 *   tool: string | null,
 * }} ResumePoint
 */

/** @type {SaveResult} */
const OK = { ok: true };
/** @type {SaveResult} */
const QUOTA = { ok: false, reason: 'quota' };
/** @type {SaveResult} */
const INVALID = { ok: false, reason: 'invalid' };

/**
 * @param {unknown} x
 * @returns {x is LevelSummary}
 */
function isSummary(x) {
  if (x === null || typeof x !== 'object') return false;
  const s = /** @type {Record<string, unknown>} */ (x);
  return typeof s.id === 'string' && s.id.length > 0
    && typeof s.name === 'string'
    && typeof s.theme === 'string'
    && Number.isInteger(s.cols)
    && Number.isInteger(s.rows)
    && typeof s.modified === 'number' && Number.isFinite(s.modified);
}

/**
 * @param {LevelModel} model
 * @param {string} [id]
 * @returns {LevelSummary}
 */
function summaryOf(model, id = model.id) {
  return {
    id,
    name: model.name,
    theme: model.theme,
    cols: model.cols,
    rows: model.rows,
    modified: model.modified,
  };
}

/**
 * @param {unknown} n
 * @returns {n is number}
 */
function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * @param {SafeStorage} storage
 */
export function createLevelStore(storage) {
  let seq = 0;
  /** Newest save request per level id. @type {Map<string, number>} */
  const latest = new Map();
  /** Ids deleted this session: an in-flight save must not bring one back. @type {Set<string>} */
  const deleted = new Set();
  /** @type {Set<Promise<unknown>>} */
  const inFlight = new Set();

  /**
   * Entries are unchecked: `list` validates them, and writers keep what they do not
   * touch.
   * @returns {unknown[] | null} null when the index is missing or not an array
   */
  function readIndex() {
    const raw = storage.get(INDEX_KEY);
    if (raw === null) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) return null;
    return parsed;
  }

  /**
   * @param {unknown[]} entries
   */
  function writeIndex(entries) {
    return storage.set(INDEX_KEY, JSON.stringify(entries));
  }

  /**
   * @param {LevelSummary} summary
   * @param {string} code
   * @returns {SaveResult}
   */
  function write(summary, code) {
    // The level first: an index entry must never point at a level that is not there.
    if (storage.set(LEVEL_PREFIX + summary.id, code) === 'quota') return QUOTA;
    const entries = (readIndex() ?? []).filter((e) => !isSummary(e) || e.id !== summary.id);
    entries.push(summary);
    return writeIndex(entries) === 'quota' ? QUOTA : OK;
  }

  /**
   * @template T
   * @param {Promise<T>} p
   * @returns {Promise<T>}
   */
  function track(p) {
    inFlight.add(p);
    p.then(() => inFlight.delete(p), () => inFlight.delete(p));
    return p;
  }

  async function idle() {
    while (inFlight.size > 0) await Promise.all([...inFlight]);
  }

  /**
   * @param {LevelModel} model
   * @param {{ compress?: boolean }} [opts]
   * @returns {Promise<SaveResult>}
   */
  function save(model, opts = {}) {
    const summary = summaryOf(model);
    const id = summary.id;
    const mine = ++seq;
    latest.set(id, mine);
    // encodeShare serialises before its first await, so the model is copied here,
    // at call time. Edits made after this returns cannot leak into this write.
    const encoding = encodeShare(model, { compress: opts.compress !== false });
    return track(encoding.then(
      (code) => {
        if (deleted.has(id) || latest.get(id) !== mine) return OK;
        return write(summary, code);
      },
      () => INVALID,
    ));
  }

  /**
   * @param {string} id
   * @returns {Promise<LevelModel>}
   */
  async function load(id) {
    await idle();
    const code = storage.get(LEVEL_PREFIX + id);
    if (code === null) throw new LevelError('level', `no saved level "${id}"`);
    const model = await decodeShare(code);
    // The key is the source of truth, so a later save lands in the same place.
    model.id = id;
    return model;
  }

  /**
   * @param {LevelModel} model
   * @returns {Promise<SaveResult & { id: string }>}
   */
  async function add(model) {
    model.id = newLevelId();
    const result = await save(model);
    return { ...result, id: model.id };
  }

  /**
   * Shape only. Whether the zoom and tool are real is the maker's call.
   *
   * @returns {ResumePoint | null}
   */
  function loadResume() {
    const raw = storage.get(RESUME_KEY);
    if (raw === null) return null;
    let r;
    try {
      r = JSON.parse(raw);
    } catch {
      return null;
    }
    if (r === null || typeof r !== 'object') return null;
    if (typeof r.levelId !== 'string' || r.levelId.length === 0) return null;
    if (!isFiniteNumber(r.camX) || !isFiniteNumber(r.camY) || !isFiniteNumber(r.zoom)) {
      return null;
    }
    if (r.tool !== null && typeof r.tool !== 'string') return null;
    return { levelId: r.levelId, camX: r.camX, camY: r.camY, zoom: r.zoom, tool: r.tool };
  }

  return {
    save,
    load,
    add,

    /**
     * Newest first. Waits for in-flight writes, drops index entries that are
     * malformed or point at nothing, and recovers level keys the index lost.
     *
     * @returns {Promise<LevelSummary[]>}
     */
    async list() {
      await idle();
      const stored = readIndex();
      let changed = stored === null;
      /** @type {LevelSummary[]} */
      const entries = [];
      /** @type {Set<string>} */
      const seen = new Set();
      const raw = stored ?? [];
      for (let i = 0; i < raw.length; i++) {
        const e = raw[i];
        if (!isSummary(e) || seen.has(e.id) || storage.get(LEVEL_PREFIX + e.id) === null) {
          changed = true;
          continue;
        }
        entries.push({ ...e });
        seen.add(e.id);
      }
      const keys = storage.keys(LEVEL_PREFIX);
      for (let i = 0; i < keys.length; i++) {
        const id = keys[i].slice(LEVEL_PREFIX.length);
        if (seen.has(id)) continue;
        const code = storage.get(keys[i]);
        if (code === null) continue;
        try {
          entries.push(summaryOf(await decodeShare(code), id));
          seen.add(id);
          changed = true;
        } catch {
          // Undecodable: left in place, not listed.
        }
      }
      entries.sort((a, b) => b.modified - a.modified);
      if (changed) writeIndex(entries);
      return entries;
    },

    /**
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
      return storage.get(LEVEL_PREFIX + id) !== null;
    },

    /**
     * @param {string} id
     * @returns {string | null} the stored share code
     */
    getCode(id) {
      return storage.get(LEVEL_PREFIX + id);
    },

    /**
     * @param {string} id
     * @param {string} name
     * @returns {Promise<SaveResult>} rejects with a LevelError when the level cannot be read
     */
    async rename(id, name) {
      const model = await load(id);
      model.name = name;
      return save(model);
    },

    /**
     * @param {string} id
     * @param {string} name  the copy's name, chosen by the caller
     * @returns {Promise<SaveResult & { id: string }>}
     */
    async duplicate(id, name) {
      const model = await load(id);
      const now = Date.now();
      model.name = name;
      model.created = now;
      model.modified = now;
      return add(model);
    },

    /**
     * @param {string} id
     */
    remove(id) {
      deleted.add(id);
      storage.remove(LEVEL_PREFIX + id);
      const entries = readIndex();
      if (entries) writeIndex(entries.filter((e) => !isSummary(e) || e.id !== id));
      const resume = loadResume();
      if (resume && resume.levelId === id) storage.remove(RESUME_KEY);
    },

    loadResume,

    /**
     * @param {ResumePoint} r
     */
    saveResume(r) {
      return storage.set(RESUME_KEY, JSON.stringify({
        levelId: r.levelId,
        camX: r.camX,
        camY: r.camY,
        zoom: r.zoom,
        tool: r.tool,
      }));
    },
  };
}
