import { SFX_ASSETS, MUSIC_ASSETS } from '../data/asset-manifest.js';

export class AudioManager {
   ctx = null;
   buffers = new Map();
   activeLoops = new Map();
   _muted = false;

  // Music state
   musicBuffers = new Map();
   musicSource = null;
   musicGain = null;
   _currentMusic = null;
   _musicPaused = false;
   _musicPausedKey = null;

  get muted() { return this._muted; }

  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) {
      this.stopAllLoops();
      this.stopMusicImmediate();
      this._musicPaused = false;
      this._musicPausedKey = null;
    }
  }

  async init() {
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }

    // Resume on first user gesture (browser autoplay policy)
    const ac = new AbortController();
    const resume = () => {
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      ac.abort();
    };
    const opts = { signal: ac.signal };
    document.addEventListener('keydown', resume, opts);
    document.addEventListener('click', resume, opts);
    document.addEventListener('touchstart', resume, opts);

    const entries = Object.entries(SFX_ASSETS);
    await Promise.all(entries.map(async ([key, path]) => {
      try {
        const resp = await fetch(path);
        const raw = await resp.arrayBuffer();
        this.buffers.set(key, await this.ctx.decodeAudioData(raw));
      } catch {
        // Audio is non-critical — skip failed loads
      }
    }));
  }

  play(key) {
    if (this._muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start();
  }

  playLoop(key) {
    if (this._muted || !this.ctx) return;
    if (this.activeLoops.has(key)) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.ctx.destination);
    source.start();
    source.onended = () => this.activeLoops.delete(key);
    this.activeLoops.set(key, source);
  }

  stopLoop(key) {
    const source = this.activeLoops.get(key);
    if (source) {
      source.stop();
      this.activeLoops.delete(key);
    }
  }

  stopAllLoops() {
    for (const source of this.activeLoops.values()) source.stop();
    this.activeLoops.clear();
  }

  // --- Music ---

   async loadMusicBuffer(key) {
    if (this.musicBuffers.has(key)) return this.musicBuffers.get(key);
    if (!this.ctx) return null;
    const path = MUSIC_ASSETS[key];
    if (!path) return null;
    try {
      const resp = await fetch(path);
      const raw = await resp.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.musicBuffers.set(key, buf);
      return buf;
    } catch {
      return null;
    }
  }

  async playMusic(key) {
    if (this._muted || !this.ctx) return;
    if (this._currentMusic === key && this.musicSource) return;
    this.stopMusicImmediate();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const buffer = await this.loadMusicBuffer(key);
    if (!buffer || !this.ctx) return;

    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.ctx.destination);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.onended = () => {
      if (this.musicSource === source) {
        this.musicSource = null;
        this.musicGain = null;
        this._currentMusic = null;
      }
    };
    source.start();

    this.musicSource = source;
    this.musicGain = gain;
    this._currentMusic = key;
    this._musicPaused = false;
    this._musicPausedKey = null;
  }

  stopMusic(fadeMs = 500) {
    if (!this.musicSource || !this.musicGain || !this.ctx) {
      this.stopMusicImmediate();
      return;
    }
    if (fadeMs <= 0) {
      this.stopMusicImmediate();
      return;
    }
    const gain = this.musicGain;
    const source = this.musicSource;
    gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeMs / 1000);
    setTimeout(() => {
      try { source.stop(); } catch { /* already stopped */ }
    }, fadeMs);
    this.musicSource = null;
    this.musicGain = null;
    this._currentMusic = null;
    this._musicPaused = false;
    this._musicPausedKey = null;
  }

   stopMusicImmediate() {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
    }
    this.musicGain = null;
    this._currentMusic = null;
  }

  pauseMusic() {
    if (!this.musicSource || !this._currentMusic) return;
    this._musicPausedKey = this._currentMusic;
    this._musicPaused = true;
    this.stopMusicImmediate();
  }

  resumeMusic() {
    if (!this._musicPaused || !this._musicPausedKey) return;
    const key = this._musicPausedKey;
    this._musicPaused = false;
    this._musicPausedKey = null;
    void this.playMusic(key);
  }
}
