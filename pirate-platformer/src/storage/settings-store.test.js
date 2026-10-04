import { describe, expect, it } from 'vitest';

import { createSafeStorage } from './safe-storage.js';
import { createSettingsStore } from './settings-store.js';

function memoryStorage() {
  return createSafeStorage(() => { throw new Error('no storage in tests'); });
}

describe('createSettingsStore', () => {
  it('loads nothing when nothing is saved', () => {
    expect(createSettingsStore(memoryStorage()).load()).toEqual({});
  });

  it('round-trips both volumes and the controls mode', () => {
    const settings = createSettingsStore(memoryStorage());
    expect(settings.save({ music: 0.25, sfx: 0.9, controls: 'on' })).toBe('ok');
    expect(settings.load()).toEqual({ music: 0.25, sfx: 0.9, controls: 'on' });
  });

  it('keeps every controls mode', () => {
    const settings = createSettingsStore(memoryStorage());
    for (const controls of /** @type {const} */ (['auto', 'on', 'off'])) {
      settings.save({ music: 1, sfx: 1, controls });
      expect(settings.load().controls).toBe(controls);
    }
  });

  it('leaves controls out when a save has none (saved before Unit 19) or a bad one', () => {
    const storage = memoryStorage();
    const settings = createSettingsStore(storage);
    storage.set('cc:v1:settings', JSON.stringify({ music: 0.4, sfx: 0.7 }));
    expect(settings.load()).toEqual({ music: 0.4, sfx: 0.7 });
    storage.set('cc:v1:settings', JSON.stringify({ music: 0.4, sfx: 0.7, controls: 'touch' }));
    expect(settings.load()).toEqual({ music: 0.4, sfx: 0.7 });
    storage.set('cc:v1:settings', JSON.stringify({ controls: 1 }));
    expect(settings.load()).toEqual({});
  });

  it('clamps out-of-range values', () => {
    const storage = memoryStorage();
    storage.set('cc:v1:settings', JSON.stringify({ music: 3, sfx: -1 }));
    expect(createSettingsStore(storage).load()).toEqual({ music: 1, sfx: 0 });
  });

  it('keeps only valid fields from malformed data', () => {
    const storage = memoryStorage();
    const settings = createSettingsStore(storage);
    storage.set('cc:v1:settings', '{broken');
    expect(settings.load()).toEqual({});
    storage.set('cc:v1:settings', JSON.stringify({ music: 'loud', sfx: 0.5 }));
    expect(settings.load()).toEqual({ sfx: 0.5 });
    storage.set('cc:v1:settings', 'null');
    expect(settings.load()).toEqual({});
  });
});
