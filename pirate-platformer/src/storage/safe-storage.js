/**
 * The only module that touches `localStorage` (invariant 6). Every access is
 * wrapped, so private browsing, blocked site data and a full quota degrade instead
 * of throwing.
 *
 * Two failure kinds are kept apart on purpose. A full quota is reported and the
 * store stays on disk: falling back to memory there would report a save that a
 * reload loses. Any other failure means storage is unusable, so the store copies
 * what it can read into memory and carries on there for the life of the page.
 */

const NAMESPACE = 'cc:v1:';
const PROBE_KEY = 'cc:v1:probe';

/**
 * @typedef {'local' | 'memory'} StorageMode
 * @typedef {'ok' | 'quota'} SetResult
 */

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isQuotaError(err) {
  if (err === null || typeof err !== 'object') return false;
  const e = /** @type {{ name?: unknown, code?: unknown }} */ (err);
  // 22 is the legacy code in most browsers, 1014 is old Firefox.
  return e.name === 'QuotaExceededError'
    || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || e.code === 22
    || e.code === 1014;
}

/**
 * @param {() => Storage} getBacking  e.g. `() => window.localStorage`; may throw
 */
export function createSafeStorage(getBacking) {
  /** @type {Storage | null} */
  let backing = null;
  /** @type {Map<string, string> | null} */
  let memory = null;

  /**
   * Switch to memory for good, keeping every namespaced value that can still be
   * read, so levels saved earlier stay visible.
   */
  function toMemory() {
    if (memory) return;
    memory = new Map();
    if (backing) {
      try {
        for (let i = 0; i < backing.length; i++) {
          const key = backing.key(i);
          if (key === null || !key.startsWith(NAMESPACE) || key === PROBE_KEY) continue;
          const value = backing.getItem(key);
          if (value !== null) memory.set(key, value);
        }
      } catch {
        // Unreadable as well: start empty.
      }
    }
    backing = null;
  }

  try {
    backing = getBacking();
    backing.setItem(PROBE_KEY, '1');
    if (backing.getItem(PROBE_KEY) !== '1') throw new Error('storage probe mismatch');
    backing.removeItem(PROBE_KEY);
  } catch {
    toMemory();
  }

  return {
    /** @returns {StorageMode} */
    get mode() {
      return memory ? 'memory' : 'local';
    },

    /**
     * @param {string} key
     * @returns {string | null}
     */
    get(key) {
      if (memory) return memory.get(key) ?? null;
      try {
        return /** @type {Storage} */ (backing).getItem(key);
      } catch {
        return null;
      }
    },

    /**
     * @param {string} key
     * @param {string} value
     * @returns {SetResult}
     */
    set(key, value) {
      if (!memory) {
        try {
          /** @type {Storage} */ (backing).setItem(key, value);
          return 'ok';
        } catch (err) {
          if (isQuotaError(err)) return 'quota';
          toMemory();
        }
      }
      /** @type {Map<string, string>} */ (memory).set(key, value);
      return 'ok';
    },

    /**
     * @param {string} key
     */
    remove(key) {
      if (memory) {
        memory.delete(key);
        return;
      }
      try {
        /** @type {Storage} */ (backing).removeItem(key);
      } catch {
        // Nothing to report: a key that cannot be removed cannot be read either.
      }
    },

    /**
     * @param {string} prefix
     * @returns {string[]}
     */
    keys(prefix) {
      /** @type {string[]} */
      const out = [];
      if (memory) {
        for (const key of memory.keys()) if (key.startsWith(prefix)) out.push(key);
        return out;
      }
      try {
        const b = /** @type {Storage} */ (backing);
        for (let i = 0; i < b.length; i++) {
          const key = b.key(i);
          if (key !== null && key.startsWith(prefix)) out.push(key);
        }
      } catch {
        return [];
      }
      return out;
    },
  };
}
