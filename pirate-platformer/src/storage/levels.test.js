import { describe, expect, it } from 'vitest';

import { deserialise, encodeShare, toJsonString } from '../level/codec.js';
import { LevelError, createBlankLevel } from '../level/schema.js';
import { createLevelStore } from './levels.js';
import { createSafeStorage } from './safe-storage.js';

function memoryStorage() {
  return createSafeStorage(() => { throw new Error('no storage in tests'); });
}

/**
 * @param {string} name
 * @param {number} [modified]
 */
function level(name, modified = 1000) {
  const model = deserialise(createBlankLevel({ name }));
  model.modified = modified;
  return model;
}

/** A backing store whose writes can be made to hit the quota. */
function quotaBacking() {
  /** @type {Map<string, string>} */
  const map = new Map();
  const state = { full: false };
  const backing = {
    get length() { return map.size; },
    /** @param {number} i */
    key(i) { return [...map.keys()][i] ?? null; },
    /** @param {string} k */
    getItem(k) { return map.get(k) ?? null; },
    /** @param {string} k @param {string} v */
    setItem(k, v) {
      if (state.full) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      map.set(k, v);
    },
    /** @param {string} k */
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
  return { backing: /** @type {Storage} */ (/** @type {unknown} */ (backing)), state };
}

describe('createLevelStore', () => {
  it('round-trips a level through a share code', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Cove');
    expect(await store.save(model)).toEqual({ ok: true });
    const loaded = await store.load(model.id);
    expect(toJsonString(loaded)).toBe(toJsonString(model));
    expect(store.has(model.id)).toBe(true);
    expect(store.getCode(model.id)?.[0]).toMatch(/[zu]/);
  });

  it('lists summaries newest first', async () => {
    const store = createLevelStore(memoryStorage());
    const a = level('A', 1000);
    const b = level('B', 3000);
    const c = level('C', 2000);
    await Promise.all([store.save(a), store.save(b), store.save(c)]);
    const list = await store.list();
    expect(list.map((e) => e.name)).toEqual(['B', 'C', 'A']);
    expect(list[0]).toEqual({
      id: b.id, name: 'B', theme: 'island', cols: 160, rows: 24, modified: 3000,
    });
  });

  it('copies the model at call time', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Before');
    const p = store.save(model);
    model.name = 'After';
    model.set('terrain', 0, 0, 1);
    await p;
    const loaded = await store.load(model.id);
    expect(loaded.name).toBe('Before');
    expect(loaded.get('terrain', 0, 0)).toBe(0);
  });

  it('lets a newer save win over an older one that finishes later', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('One');
    const first = store.save(model);
    model.name = 'Two';
    const second = store.save(model, { compress: false });
    await Promise.all([first, second]);
    expect((await store.load(model.id)).name).toBe('Two');
    expect(store.getCode(model.id)?.[0]).toBe('u');
  });

  it('lands an uncompressed save within the same task', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Now');
    store.save(model, { compress: false });
    // One microtask turn, no macrotask: a page frozen after this task keeps the write.
    await Promise.resolve();
    expect(store.has(model.id)).toBe(true);
  });

  it('does not bring back a level deleted while its save was in flight', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Gone');
    const p = store.save(model);
    store.remove(model.id);
    await p;
    expect(store.has(model.id)).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('list waits for writes still in flight', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Fresh');
    store.save(model);
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual([model.id]);
  });

  it('renames and duplicates', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Orig');
    await store.save(model);
    expect(await store.rename(model.id, 'Renamed')).toEqual({ ok: true });
    const dup = await store.duplicate(model.id, 'Renamed (copy)');
    expect(dup.ok).toBe(true);
    expect(dup.id).not.toBe(model.id);
    const names = (await store.list()).map((e) => e.name).sort();
    expect(names).toEqual(['Renamed', 'Renamed (copy)']);
    const copy = await store.load(dup.id);
    expect(copy.id).toBe(dup.id);
  });

  it('add always assigns a fresh id', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('Import');
    const oldId = model.id;
    const r1 = await store.add(model);
    const r2 = await store.add(level('Import'));
    expect(r1.id).not.toBe(oldId);
    expect(r1.id).not.toBe(r2.id);
    expect((await store.list()).length).toBe(2);
  });

  it('removes the level, its index entry and a resume point that names it', async () => {
    const store = createLevelStore(memoryStorage());
    const a = level('A');
    const b = level('B');
    await store.save(a);
    await store.save(b);
    store.saveResume({ levelId: a.id, camX: 1, camY: 2, zoom: 1, tool: null });
    store.remove(b.id);
    expect(store.loadResume()?.levelId).toBe(a.id);
    store.remove(a.id);
    expect(store.loadResume()).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('drops dangling index entries and recovers levels the index lost', async () => {
    const storage = memoryStorage();
    const store = createLevelStore(storage);
    const kept = level('Kept', 2000);
    await store.save(kept);
    const orphan = level('Orphan', 1000);
    storage.set(`cc:v1:level:${orphan.id}`, await encodeShare(orphan));
    const index = JSON.parse(/** @type {string} */ (storage.get('cc:v1:levels:index')));
    index.push({ id: 'lvl_ghost', name: 'Ghost', theme: 'island', cols: 40, rows: 12, modified: 5 });
    index.push({ nonsense: true });
    storage.set('cc:v1:levels:index', JSON.stringify(index));
    const list = await store.list();
    expect(list.map((e) => e.name)).toEqual(['Kept', 'Orphan']);
    // The repaired index is written back.
    const repaired = JSON.parse(/** @type {string} */ (storage.get('cc:v1:levels:index')));
    expect(repaired.map((/** @type {{ name: string }} */ e) => e.name)).toEqual(['Kept', 'Orphan']);
  });

  it('rebuilds a corrupt index and skips undecodable levels', async () => {
    const storage = memoryStorage();
    const store = createLevelStore(storage);
    const a = level('A');
    await store.save(a);
    storage.set('cc:v1:levels:index', '{not json');
    storage.set('cc:v1:level:lvl_broken', 'zgarbage!!');
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual([a.id]);
    expect(storage.get('cc:v1:level:lvl_broken')).toBe('zgarbage!!');
  });

  it('reports a full quota', async () => {
    const { backing, state } = quotaBacking();
    const store = createLevelStore(createSafeStorage(() => backing));
    state.full = true;
    expect(await store.save(level('Big'))).toEqual({ ok: false, reason: 'quota' });
    state.full = false;
    expect(await store.save(level('Small'))).toEqual({ ok: true });
  });

  it('reports a level that cannot be encoded', async () => {
    const store = createLevelStore(memoryStorage());
    const model = level('No goal');
    model.goal = null;
    expect(await store.save(model)).toEqual({ ok: false, reason: 'invalid' });
    expect(store.has(model.id)).toBe(false);
  });

  it('throws a LevelError for a level that is not there', async () => {
    const store = createLevelStore(memoryStorage());
    await expect(store.load('lvl_missing')).rejects.toBeInstanceOf(LevelError);
  });

  it('validates the resume point shape', () => {
    const storage = memoryStorage();
    const store = createLevelStore(storage);
    expect(store.loadResume()).toBeNull();
    storage.set('cc:v1:maker:last', '{oops');
    expect(store.loadResume()).toBeNull();
    storage.set('cc:v1:maker:last', JSON.stringify({ levelId: 'x', camX: 'a', camY: 0, zoom: 1, tool: null }));
    expect(store.loadResume()).toBeNull();
    storage.set('cc:v1:maker:last', JSON.stringify({ levelId: 'x', camX: 0, camY: 0, zoom: 1, tool: 5 }));
    expect(store.loadResume()).toBeNull();
    const good = { levelId: 'x', camX: 10, camY: 20, zoom: 2, tool: 'crabby' };
    store.saveResume(good);
    expect(store.loadResume()).toEqual(good);
  });
});
