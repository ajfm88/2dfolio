// Player preferences, persisted across sessions in localStorage.
//
// One JSON blob under a single key, cached in memory after the first load --
// same shape as highScore.js, and for the same reason: these are read on menu
// draws and match starts, not once at boot.
//
// This module is import-safe in Node (audio.js imports it, and audio.js is
// reachable from board.js, which is tested headlessly). `localStorage` is
// guarded on every touch rather than at load, since a browser can also throw on
// access in private-mode or third-party-cookie-blocked contexts.

const KEY = 'tetrisattack.settings';

// Master output level, 0..1, in the steps the settings screen offers.
const VOLUME_STEP = 0.1;

// How many games a VS or 2P set runs to. 1 is the old behaviour (one board
// death ends everything); 3 is the default because that is what the SNES VS
// mode plays, and it is short enough that a set does not outstay its welcome.
const MATCH_LENGTHS = [1, 3, 5, 7];

const DEFAULTS = {
  volume: 0.7,       // matches the master gain audio.js used to hardcode
  muted: false,
  matchLength: 3,
};

let cached = null;

function read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function write(values) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(values));
  } catch (e) {
    // Storage unavailable or full. The in-memory copy still holds for this
    // session, so the game plays correctly -- it just won't remember.
  }
}

// Coerce whatever came out of storage into something the game can use, so a
// hand-edited or half-written blob can't put the audio engine into a bad state.
function sanitize(raw) {
  const out = { ...DEFAULTS };
  if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) {
    out.volume = Math.min(1, Math.max(0, raw.volume));
  }
  if (typeof raw.muted === 'boolean') {
    out.muted = raw.muted;
  }
  if (MATCH_LENGTHS.includes(raw.matchLength)) {
    out.matchLength = raw.matchLength;
  }
  return out;
}

function load() {
  if (cached) return cached;
  cached = sanitize(read());
  return cached;
}

function getSettings() {
  return { ...load() };
}

function get(name) {
  return load()[name];
}

// Merge `changes` in and persist. Returns the full settings object.
function update(changes) {
  cached = sanitize({ ...load(), ...changes });
  write(cached);
  return { ...cached };
}

// Test seam: drop the memory cache so the next read comes from storage again.
function resetCache() {
  cached = null;
}

export {
  getSettings, get, update, resetCache,
  DEFAULTS, MATCH_LENGTHS, VOLUME_STEP,
};
