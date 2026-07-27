// Sound. One Web Audio context, one master gain, everything preloaded once the
// browser lets us start.
//
// Two asset sets, both supplied by the user:
//   assets/char_sfx/  13 SNES character voice clips, 22kHz, 0.3-0.8s
//   assets/sfx/       general one-shots, 8kHz, 0.13-1.07s, descriptively named
//
// The pack originally held 51 one-shots plus 19 unidentified clips; the ones no
// mapping below used have been deleted, so sfx/ is now exactly what SOUNDS names.
// Restoring a candidate to remap onto means pulling it back out of git history.
//
// ⚠️ Some sfx filenames contain "!" ("Aha!_sound.wav", "Yeah!_sound.wav"), and
// deleted ones also had spaces and apostrophes, so every path is URL-encoded per
// path segment before fetching. Do not "tidy" that away -- restoring any of those
// files would need it again.
//
// This module is import-safe in Node (board.js imports it, and board.js is
// tested headlessly): nothing touches AudioContext until the first play/unlock.

const BASE = 'assets/';

// ---------------------------------------------------------------------------
// The mapping. This is the table to edit when a sound feels wrong -- every
// choice below is a guess from the filename, since the sheet came unlabelled.
// ---------------------------------------------------------------------------
const SOUNDS = {
  // --- gameplay ---
  swap:      { file: 'sfx/thwip_sound.wav',            volume: 0.35 },
  pop:       { file: 'sfx/xylophonehit_sound.wav',     volume: 0.55 },
  combo:     { file: 'sfx/DingBell_sound.wav',         volume: 0.60 },
  chain:     { file: 'sfx/Aha!_sound.wav',             volume: 0.65 },
  chainBig:  { file: 'sfx/Yeah!_sound.wav',            volume: 0.70 },
  danger:    { file: 'sfx/ominoussynth_sound_high.wav', volume: 0.55 },

  // --- match outcome ---
  win:       { file: 'sfx/Giggle_sound.wav',           volume: 0.75 },
  lose:      { file: 'sfx/Groandown_sound.wav',        volume: 0.75 },

  // --- menus ---
  move:      { file: 'sfx/Electronicbeep_sound.wav',   volume: 0.30 },
  confirm:   { file: 'sfx/Bong_sound.wav',             volume: 0.50 },
  cancel:    { file: 'sfx/Buzz_sound.wav',             volume: 0.40 },
  pause:     { file: 'sfx/Stop_sound.wav',             volume: 0.55 },
};

// Character voice clips, keyed by the ids in characters.js.
const CHARACTER_SOUNDS = {
  yoshi:     'char_sfx/ta-snes_yoshi.wav',
  lakitu:    'char_sfx/ta-snes_lakitu.wav',
  bumpty:    'char_sfx/ta-snes_bumpty.wav',
  poochy:    'char_sfx/ta-snes_poochy.wav',
  wiggler:   'char_sfx/ta-snes_flying_wiggler.wav',
  froggy:    'char_sfx/ta-snes_froggy.wav',
  blargg:    'char_sfx/ta-snes_gargantua_blargg.wav',
  lungefish: 'char_sfx/ta-snes_lunge_fish.wav',
  raven:     'char_sfx/ta-snes_raphael_the_raven.wav',
  hookbill:  'char_sfx/ta-snes_hookbill_the_koopa.wav',
  piranha:   'char_sfx/ta-snes_naval_piranha.wav',
  kamek:     'char_sfx/ta-snes_kamek.wav',
  bowser:    'char_sfx/ta-snes_bowser.wav',
};

const CHARACTER_VOLUME = 0.85;

// Encode each path segment, leaving the separators alone.
function encodePath(file) {
  return BASE + file.split('/').map(encodeURIComponent).join('/');
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();  // path -> AudioBuffer
    this.muted = false;
    this.failed = false;
    this._preloaded = false;
  }

  _context() {
    if (this.ctx || this.failed) return this.ctx;
    const Ctx = typeof window !== 'undefined'
      && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) { this.failed = true; return null; }
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.failed = true;
    }
    return this.ctx;
  }

  // Browsers start the context suspended until a user gesture, so this is
  // called from the first keydown/pointerdown and again whenever a menu acts.
  unlock() {
    const ctx = this._context();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.preload();
  }

  // Everything is small (~800KB total), so load it all up front rather than
  // missing the first play of each sound while it decodes.
  preload() {
    if (this._preloaded || !this._context()) return;
    this._preloaded = true;
    const files = [
      ...Object.values(SOUNDS).map((s) => s.file),
      ...Object.values(CHARACTER_SOUNDS),
    ];
    for (const file of files) this._load(file);
  }

  _load(file) {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file));
    const ctx = this._context();
    if (!ctx) return Promise.resolve(null);
    const promise = fetch(encodePath(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${file}`))))
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => { this.buffers.set(file, decoded); return decoded; })
      .catch((e) => { console.warn('[TA] sound failed:', file, e.message); return null; });
    this.buffers.set(file, null); // reserve, so we only fetch once
    promise.then((decoded) => { if (decoded) this.buffers.set(file, decoded); });
    return promise;
  }

  _playFile(file, { volume = 1, rate = 1 } = {}) {
    if (this.muted || this.failed) return;
    const ctx = this._context();
    if (!ctx || ctx.state === 'suspended') return;
    const buffer = this.buffers.get(file);
    if (!buffer) { this._load(file); return; } // not decoded yet: skip, don't queue
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.master);
    source.start(0);
  }

  // play('pop', { rate: 1.2 })
  play(name, opts = {}) {
    const spec = SOUNDS[name];
    if (!spec) return;
    this._playFile(spec.file, { volume: spec.volume, ...opts });
  }

  playCharacter(id) {
    const file = CHARACTER_SOUNDS[id];
    if (!file) return;
    this._playFile(file, { volume: CHARACTER_VOLUME });
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

export const audio = new AudioEngine();
export { SOUNDS, CHARACTER_SOUNDS };
