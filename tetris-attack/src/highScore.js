// Persists a single high score across matches/sessions via localStorage.
// Cached in memory after the first load so per-frame HUD draws don't hit
// storage on every read -- only a genuine new record writes back.

const KEY = 'tetrisattack.highScore';

let cached = null;

function load() {
  if (cached !== null) return cached;
  if (typeof localStorage === 'undefined') {
    cached = 0;
    return cached;
  }
  const raw = localStorage.getItem(KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  cached = Number.isFinite(n) ? n : 0;
  return cached;
}

function getHighScore() {
  return load();
}

// Reports `score` as a candidate; returns the resulting high score (updated
// or unchanged). Persists only when it's actually a new record.
function recordScore(score) {
  const current = load();
  if (score > current) {
    cached = score;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, String(score));
    }
  }
  return cached;
}

export { getHighScore, recordScore };
