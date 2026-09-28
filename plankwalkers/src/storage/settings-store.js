/**
 * Player settings. Only the fields a built feature uses are stored: music and
 * effects volume today. Missing fields are left out of `load`, so `core/audio.js`
 * keeps its own defaults and they are written down in one place.
 */

/** @typedef {ReturnType<typeof import('./safe-storage.js').createSafeStorage>} SafeStorage */

const KEY = 'cc:v1:settings';

/**
 * @param {unknown} v
 * @returns {number | undefined}
 */
function volume(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(1, v));
}

/**
 * @param {SafeStorage} storage
 */
export function createSettingsStore(storage) {
  return {
    /**
     * @returns {{ music?: number, sfx?: number }} only the valid fields, clamped to 0..1
     */
    load() {
      const raw = storage.get(KEY);
      if (raw === null) return {};
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {};
      }
      if (parsed === null || typeof parsed !== 'object') return {};
      /** @type {{ music?: number, sfx?: number }} */
      const out = {};
      const music = volume(parsed.music);
      const sfx = volume(parsed.sfx);
      if (music !== undefined) out.music = music;
      if (sfx !== undefined) out.sfx = sfx;
      return out;
    },

    /**
     * @param {{ music: number, sfx: number }} s
     * @returns {import('./safe-storage.js').SetResult}
     */
    save(s) {
      return storage.set(KEY, JSON.stringify({
        music: volume(s.music) ?? 0,
        sfx: volume(s.sfx) ?? 0,
      }));
    },
  };
}
