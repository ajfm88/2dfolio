import { describe, expect, it } from 'vitest';

import { createSafeStorage } from './safe-storage.js';

/**
 * A minimal `Storage` stand-in. `failSet` decides how `setItem` fails, if at all.
 *
 * @param {{ failSet?: (key: string) => Error | null, failGet?: boolean }} [opts]
 */
function fakeStorage(opts = {}) {
  /** @type {Map<string, string>} */
  const map = new Map();
  const store = {
    get length() { return map.size; },
    /** @param {number} i */
    key(i) { return [...map.keys()][i] ?? null; },
    /** @param {string} k */
    getItem(k) {
      if (opts.failGet) throw new Error('SecurityError');
      return map.get(k) ?? null;
    },
    /** @param {string} k @param {string} v */
    setItem(k, v) {
      const err = opts.failSet ? opts.failSet(k) : null;
      if (err) throw err;
      map.set(k, v);
    },
    /** @param {string} k */
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    map,
  };
  return store;
}

function quotaError() {
  const err = new Error('full');
  err.name = 'QuotaExceededError';
  return err;
}

describe('createSafeStorage', () => {
  it('uses the backing store when it works', () => {
    const b = fakeStorage();
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    expect(s.mode).toBe('local');
    expect(s.set('cc:v1:a', '1')).toBe('ok');
    expect(b.map.get('cc:v1:a')).toBe('1');
    expect(s.get('cc:v1:a')).toBe('1');
    expect(s.get('cc:v1:missing')).toBeNull();
    s.remove('cc:v1:a');
    expect(b.map.has('cc:v1:a')).toBe(false);
    // The probe leaves nothing behind.
    expect(b.map.size).toBe(0);
  });

  it('falls back to memory when the getter throws', () => {
    const s = createSafeStorage(() => { throw new Error('SecurityError'); });
    expect(s.mode).toBe('memory');
    expect(s.set('cc:v1:a', 'x')).toBe('ok');
    expect(s.get('cc:v1:a')).toBe('x');
    expect(s.keys('cc:v1:')).toEqual(['cc:v1:a']);
  });

  it('keeps readable levels when the probe write fails', () => {
    const b = fakeStorage();
    b.map.set('cc:v1:level:old', 'code');
    b.map.set('other:key', 'not ours');
    b.setItem = () => { throw quotaError(); };
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    expect(s.mode).toBe('memory');
    expect(s.get('cc:v1:level:old')).toBe('code');
    expect(s.get('other:key')).toBeNull();
  });

  it('reports quota without switching to memory', () => {
    let full = false;
    const b = fakeStorage({ failSet: () => (full ? quotaError() : null) });
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    full = true;
    expect(s.set('cc:v1:a', '1')).toBe('quota');
    expect(s.mode).toBe('local');
    expect(s.get('cc:v1:a')).toBeNull();
  });

  it('recognises legacy quota codes', () => {
    let full = false;
    const b = fakeStorage({
      failSet: () => (full ? Object.assign(new Error('x'), { code: 22 }) : null),
    });
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    full = true;
    expect(s.set('cc:v1:a', '1')).toBe('quota');
  });

  it('moves to memory on any other write failure, keeping what it had', () => {
    let broken = false;
    const b = fakeStorage({ failSet: () => (broken ? new Error('InvalidStateError') : null) });
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    expect(s.set('cc:v1:a', '1')).toBe('ok');
    broken = true;
    expect(s.set('cc:v1:b', '2')).toBe('ok');
    expect(s.mode).toBe('memory');
    expect(s.get('cc:v1:a')).toBe('1');
    expect(s.get('cc:v1:b')).toBe('2');
    expect(b.map.has('cc:v1:b')).toBe(false);
  });

  it('never throws on a failing read', () => {
    const b = fakeStorage();
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    b.getItem = () => { throw new Error('gone'); };
    expect(s.get('cc:v1:a')).toBeNull();
  });

  it('lists keys by prefix', () => {
    const b = fakeStorage();
    const s = createSafeStorage(() => /** @type {Storage} */ (/** @type {unknown} */ (b)));
    s.set('cc:v1:level:a', '1');
    s.set('cc:v1:level:b', '2');
    s.set('cc:v1:settings', '{}');
    expect(s.keys('cc:v1:level:').sort()).toEqual(['cc:v1:level:a', 'cc:v1:level:b']);
  });
});
