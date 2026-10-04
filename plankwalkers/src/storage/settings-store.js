/**
 * Player settings. Only the fields a built feature uses are stored: music and
 * effects volume, and whether the on-screen controls show. Missing or malformed
 * fields are left out of `load`, so each consumer keeps its own default:
 * `core/audio.js` for the volumes, the App for the controls ('auto').
 */

/** @typedef {ReturnType<typeof import('./safe-storage.js').createSafeStorage>} SafeStorage */

/**
 * On-screen controls: 'auto' shows them once a touch is seen, 'on' always, 'off'
 * never.
 * @typedef {'auto' | 'on' | 'off'} ControlsMode
 */

const KEY = 'cc:v1:settings';

/** @type {ReadonlyArray<ControlsMode>} */
export const CONTROLS_MODES = ['auto', 'on', 'off'];

/**
 * @param {unknown} v
 * @returns {number | undefined}
 */
function volume(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(1, v));
}

/**
 * @param {unknown} v
 * @returns {ControlsMode | undefined}
 */
function controlsMode(v) {
  return CONTROLS_MODES.find((m) => m === v);
}

/**
 * @param {SafeStorage} storage
 */
export function createSettingsStore(storage) {
  return {
    /**
     * @returns {{ music?: number, sfx?: number, controls?: ControlsMode }} only the
     *   valid fields; volumes clamped to 0..1
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
      /** @type {{ music?: number, sfx?: number, controls?: ControlsMode }} */
      const out = {};
      const music = volume(parsed.music);
      const sfx = volume(parsed.sfx);
      const controls = controlsMode(parsed.controls);
      if (music !== undefined) out.music = music;
      if (sfx !== undefined) out.sfx = sfx;
      if (controls !== undefined) out.controls = controls;
      return out;
    },

    /**
     * @param {{ music: number, sfx: number, controls: ControlsMode }} s
     * @returns {import('./safe-storage.js').SetResult}
     */
    save(s) {
      return storage.set(KEY, JSON.stringify({
        music: volume(s.music) ?? 0,
        sfx: volume(s.sfx) ?? 0,
        controls: controlsMode(s.controls) ?? 'auto',
      }));
    },
  };
}
