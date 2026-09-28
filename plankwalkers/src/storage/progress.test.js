import { describe, expect, it } from 'vitest';

import { createProgressStore } from './progress.js';
import { createSafeStorage } from './safe-storage.js';

function memoryStorage() {
  return createSafeStorage(() => { throw new Error('no storage in tests'); });
}

/** A backing store whose writes fail with a full quota. */
function fullBacking() {
  /** @type {Map<string, string>} */
  const map = new Map();
  const backing = {
    get length() { return map.size; },
    /** @param {number} i */
    key(i) { return [...map.keys()][i] ?? null; },
    /** @param {string} k */
    getItem(k) { return map.get(k) ?? null; },
    /** @param {string} k @param {string} v */
    setItem(k, v) {
      // The safe-storage probe must succeed, so only real keys hit the quota.
      if (k !== 'cc:v1:probe') {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      }
      map.set(k, v);
    },
    /** @param {string} k */
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
  return /** @type {Storage} */ (/** @type {unknown} */ (backing));
}

describe('createProgressStore', () => {
  it('has nothing for a level never finished', () => {
    expect(createProgressStore(memoryStorage()).get('campaign_01')).toBeNull();
  });

  it('records a finished run', () => {
    const progress = createProgressStore(memoryStorage());
    expect(progress.record('campaign_01', { treasure: 85, timeMs: 42130 })).toBe('ok');
    expect(progress.get('campaign_01')).toEqual({
      done: true,
      bestTreasure: 85,
      bestTimeMs: 42130,
    });
    expect(progress.get('campaign_02')).toBeNull();
  });

  it('keeps the best of each across runs', () => {
    const progress = createProgressStore(memoryStorage());
    progress.record('campaign_01', { treasure: 85, timeMs: 42130 });
    // Slower, but more treasure.
    progress.record('campaign_01', { treasure: 120, timeMs: 50000 });
    // Faster, but less treasure.
    progress.record('campaign_01', { treasure: 10, timeMs: 30000 });
    expect(progress.get('campaign_01')).toEqual({
      done: true,
      bestTreasure: 120,
      bestTimeMs: 30000,
    });
  });

  it('writes the architecture shape under cc:v1:progress', () => {
    const storage = memoryStorage();
    createProgressStore(storage).record('campaign_02', { treasure: 5, timeMs: 1000 });
    expect(JSON.parse(storage.get('cc:v1:progress') ?? 'null')).toEqual({
      campaign: { campaign_02: { done: true, bestTreasure: 5, bestTimeMs: 1000 } },
    });
  });

  it('keeps other entries, even ones it cannot read, when recording', () => {
    const storage = memoryStorage();
    storage.set('cc:v1:progress', JSON.stringify({
      campaign: {
        campaign_09: { done: true, bestTreasure: 1, bestTimeMs: 2 },
        odd: 'not an entry',
      },
    }));
    createProgressStore(storage).record('campaign_01', { treasure: 3, timeMs: 4 });
    const stored = JSON.parse(storage.get('cc:v1:progress') ?? 'null');
    expect(stored.campaign.campaign_09).toEqual({ done: true, bestTreasure: 1, bestTimeMs: 2 });
    expect(stored.campaign.odd).toBe('not an entry');
    expect(stored.campaign.campaign_01).toEqual({ done: true, bestTreasure: 3, bestTimeMs: 4 });
  });

  it('reads malformed data as nothing, and a record replaces a malformed entry', () => {
    const storage = memoryStorage();
    const progress = createProgressStore(storage);
    for (const raw of ['{broken', 'null', '[]', '{"campaign":[]}', '{"campaign":null}']) {
      storage.set('cc:v1:progress', raw);
      expect(progress.get('campaign_01')).toBeNull();
    }
    storage.set('cc:v1:progress', JSON.stringify({
      campaign: { campaign_01: { done: 'yes', bestTreasure: -1, bestTimeMs: 'fast' } },
    }));
    expect(progress.get('campaign_01')).toBeNull();
    progress.record('campaign_01', { treasure: 7, timeMs: 900 });
    expect(progress.get('campaign_01')).toEqual({ done: true, bestTreasure: 7, bestTimeMs: 900 });
  });

  it('does not treat inherited names as levels', () => {
    const progress = createProgressStore(memoryStorage());
    expect(progress.get('toString')).toBeNull();
    expect(progress.get('__proto__')).toBeNull();
  });

  it('reports a full quota without throwing', () => {
    const storage = createSafeStorage(fullBacking);
    expect(storage.mode).toBe('local');
    const progress = createProgressStore(storage);
    expect(progress.record('campaign_01', { treasure: 1, timeMs: 1 })).toBe('quota');
    expect(progress.get('campaign_01')).toBeNull();
  });
});
