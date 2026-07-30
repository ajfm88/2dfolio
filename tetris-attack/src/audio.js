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
// settings.js is import-safe for the same reason and guards localStorage
// itself, so importing it here does not change that.

import { get as getSetting, update as updateSettings } from './settings.js';

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

// ---------------------------------------------------------------------------
// Music (Step 10 part 2). SNES rips supplied by the user, in src/assets/ost/.
//
// Unlike the one-shots these are *streamed* through <audio> elements rather
// than decoded into buffers: the stage loop is 2.6MB, and decoding it to PCM
// would cost tens of MB of memory for no benefit. Each element is routed into
// the Web Audio graph so the master gain -- and therefore the volume setting --
// applies to music exactly as it does to effects.
//
// `volume` here is per-track and sits under the effects, so a chain still cuts
// through the loop.
// ---------------------------------------------------------------------------
const MUSIC = {
  stage:    { file: 'ost/08_-_Tetris_Attack_-_SNES_-_Yoshi_Stage.ogg',  volume: 0.42 },
  danger:   { file: 'ost/06_-_Tetris_Attack_-_SNES_-_Demo_Danger.ogg',  volume: 0.50 },
  gameOver: { file: 'ost/37_-_Tetris_Attack_-_SNES_-_Game_Over.ogg',    volume: 0.45 },
};

// All three loop. The game-over track is the one that might not want to, but
// its screen waits on the player indefinitely and silence under a menu that is
// still up reads as a bug.
const MUSIC_FADE_MS = 400;

// Encode each path segment, leaving the separators alone.
function encodePath(file) {
  return BASE + file.split('/').map(encodeURIComponent).join('/');
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();  // path -> AudioBuffer
    this.failed = false;
    this._preloaded = false;
    // name -> { el, source, gain }. Built on first play and kept, because a
    // MediaElementSource can only be created once per element.
    this.musicTracks = new Map();
    // What *should* be playing. Kept even while muted, so unmuting resumes the
    // right track instead of silence until the next state change.
    this.currentMusic = null;
    // Volume and mute are player settings, so they survive a reload. Read
    // lazily rather than here: the constructor runs at import time, which in
    // Node is before any test can seed storage.
    this._volume = null;
    this._muted = null;
  }

  _context() {
    if (this.ctx || this.failed) return this.ctx;
    const Ctx = typeof window !== 'undefined'
      && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) { this.failed = true; return null; }
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.failed = true;
    }
    return this.ctx;
  }

  get volume() {
    if (this._volume === null) this._volume = getSetting('volume');
    return this._volume;
  }

  get muted() {
    if (this._muted === null) this._muted = getSetting('muted');
    return this._muted;
  }

  // 0..1. Applied to the live master gain if the context is already up, so a
  // change on the settings screen is audible on the next menu blip.
  setVolume(value) {
    this._volume = Math.min(1, Math.max(0, value));
    if (this.master) this.master.gain.value = this._volume;
    updateSettings({ volume: this._volume });
    return this._volume;
  }

  setMuted(value) {
    this._muted = !!value;
    updateSettings({ muted: this._muted });
    // Effects just stop being triggered, but music is already running -- it has
    // to be stopped and restarted explicitly.
    this._applyMusicState();
    return this._muted;
  }

  // ----------------------------------------------------------------- music

  // Switch to `name` (a key of MUSIC), or pass null for silence. Repeating the
  // current track is a no-op, so this is safe to call every frame -- which is
  // how the danger track gets swapped in and out.
  playMusic(name) {
    if (this.currentMusic === name) return;
    this.currentMusic = name;
    this._applyMusicState();
  }

  stopMusic() {
    this.playMusic(null);
  }

  // Bring what is actually playing into line with `currentMusic` and `muted`.
  _applyMusicState() {
    if (this.failed) return;
    const wanted = this.muted ? null : this.currentMusic;
    for (const [name, track] of this.musicTracks) {
      if (name !== wanted) this._fadeOutTrack(track);
    }
    if (!wanted) return;
    const track = this._musicTrack(wanted);
    if (!track) return;
    // A suspended context (no user gesture yet) rejects play(); the next call
    // after unlock() will pick it up.
    const started = track.el.play();
    if (started && started.catch) started.catch(() => {});
    this._rampTo(track, MUSIC[wanted].volume);
  }

  _musicTrack(name) {
    const existing = this.musicTracks.get(name);
    if (existing) return existing;
    const spec = MUSIC[name];
    const ctx = this._context();
    if (!spec || !ctx) return null;
    try {
      const el = new Audio(encodePath(spec.file));
      el.loop = true;
      el.preload = 'auto';
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.master);
      const track = { el, source, gain };
      this.musicTracks.set(name, track);
      return track;
    } catch (e) {
      console.warn('[TA] music failed:', spec.file, e.message);
      return null;
    }
  }

  _rampTo(track, value) {
    const ctx = this._context();
    if (!ctx) return;
    const g = track.gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(value, now + MUSIC_FADE_MS / 1000);
  }

  // Fade out, then pause once silent. Paused rather than stopped so resuming
  // the stage track after a danger spell picks up where it left off.
  _fadeOutTrack(track) {
    if (track.el.paused) return;
    this._rampTo(track, 0);
    clearTimeout(track.stopTimer);
    track.stopTimer = setTimeout(() => track.el.pause(), MUSIC_FADE_MS);
  }

  // Browsers start the context suspended until a user gesture, so this is
  // called from the first keydown/pointerdown and again whenever a menu acts.
  unlock() {
    const ctx = this._context();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.preload();
    // A track asked for before the first gesture could not start; now it can.
    this._applyMusicState();
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

  // The M key and the settings screen's Muted row are the same state, so both
  // go through setMuted and both persist.
  toggleMute() {
    return this.setMuted(!this.muted);
  }
}

export const audio = new AudioEngine();
export { SOUNDS, CHARACTER_SOUNDS };
