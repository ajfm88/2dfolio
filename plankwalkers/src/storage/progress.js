/**
 * Campaign progress: which levels are finished, and the best run on each. Keyed by
 * the campaign's own ids (`data/campaign.js`), never by a level file's id, so a
 * re-exported level keeps its progress.
 */

/** @typedef {ReturnType<typeof import('./safe-storage.js').createSafeStorage>} SafeStorage */
/** @typedef {import('./safe-storage.js').SetResult} SetResult */

const KEY = 'cc:v1:progress';

/**
 * @typedef {{ done: boolean, bestTreasure: number, bestTimeMs: number }} LevelProgress
 */

/**
 * @param {unknown} n
 * @returns {n is number}
 */
function isCount(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * @param {unknown} x
 * @returns {LevelProgress | null}
 */
function asProgress(x) {
  if (x === null || typeof x !== 'object') return null;
  const p = /** @type {Record<string, unknown>} */ (x);
  if (typeof p.done !== 'boolean' || !isCount(p.bestTreasure) || !isCount(p.bestTimeMs)) {
    return null;
  }
  return { done: p.done, bestTreasure: p.bestTreasure, bestTimeMs: p.bestTimeMs };
}

/**
 * @param {SafeStorage} storage
 */
export function createProgressStore(storage) {
  /**
   * Entries are unchecked here: `get` validates the one it reads, and `record`
   * keeps the others exactly as they were.
   * @returns {Record<string, unknown>}
   */
  function readCampaign() {
    const raw = storage.get(KEY);
    if (raw === null) return {};
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
    if (parsed === null || typeof parsed !== 'object') return {};
    const campaign = parsed.campaign;
    if (campaign === null || typeof campaign !== 'object' || Array.isArray(campaign)) return {};
    return campaign;
  }

  return {
    /**
     * @param {string} id
     * @returns {LevelProgress | null} null when never finished, or when the entry is malformed
     */
    get(id) {
      const campaign = readCampaign();
      return Object.hasOwn(campaign, id) ? asProgress(campaign[id]) : null;
    },

    /**
     * A finished run. Best treasure and best time are each the best of any finished
     * run, not necessarily the same one.
     *
     * @param {string} id
     * @param {{ treasure: number, timeMs: number }} run
     * @returns {SetResult}
     */
    record(id, run) {
      const campaign = readCampaign();
      const before = Object.hasOwn(campaign, id) ? asProgress(campaign[id]) : null;
      campaign[id] = {
        done: true,
        bestTreasure: before ? Math.max(before.bestTreasure, run.treasure) : run.treasure,
        bestTimeMs: before ? Math.min(before.bestTimeMs, run.timeMs) : run.timeMs,
      };
      return storage.set(KEY, JSON.stringify({ campaign }));
    },
  };
}
