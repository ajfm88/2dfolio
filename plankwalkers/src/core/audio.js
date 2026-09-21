/**
 * Audio engine. One AudioContext, decoded buffers, fire-and-forget SFX,
 * looping music with fade transitions, and master volume controls.
 *
 * Every public method is safe to call at any time — before load completes,
 * while the context is suspended, or after a failed load. Callers never
 * guard audio availability.
 *
 * Does not touch document (invariant: only input.js and viewport.js do that
 * in core/). Does not import from data/, game/, level/, maker/, ui/ or
 * storage/ (invariant 11).
 */

const FADE_MS = 500;

export function createAudio() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let sfxGain = null;
  /** @type {GainNode | null} */
  let musicGain = null;

  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  /** @type {Map<string, number>} per-sound authored mix level */
  const volumes = new Map();

  let _sfxVolume = 0.7;
  let _musicVolume = 0.4;

  /** @type {AudioBufferSourceNode | null} */
  let musicSource = null;
  /** @type {GainNode | null} */
  let musicTrackGain = null;
  /** @type {string | null} */
  let musicId = null;

  /**
   * @param {Record<string, { src: string, volume?: number }>} manifest
   */
  async function load(manifest) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }

    sfxGain = ctx.createGain();
    sfxGain.gain.value = _sfxVolume;
    sfxGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = _musicVolume;
    musicGain.connect(ctx.destination);

    const ids = Object.keys(manifest);
    await Promise.all(ids.map(async (id) => {
      const entry = manifest[id];
      try {
        const res = await fetch(entry.src);
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        buffers.set(id, audioBuf);
        if (entry.volume !== undefined) volumes.set(id, entry.volume);
      } catch (err) {
        console.warn(`audio: failed to load "${id}":`, err);
      }
    }));
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      return ctx.resume();
    }
    return Promise.resolve();
  }

  /**
   * @param {string} id
   */
  function playSfx(id) {
    if (!ctx || ctx.state !== 'running') return;
    const buf = buffers.get(id);
    if (!buf) return;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = _sfxVolume * (volumes.get(id) ?? 1);
    gain.connect(ctx.destination);
    source.connect(gain);
    source.start();
  }

  /**
   * @param {string} id
   */
  function playMusic(id) {
    if (!ctx) return;
    if (musicId === id && musicSource) return;

    const buf = buffers.get(id);
    if (!buf) return;

    stopMusicInternal(FADE_MS);

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, ctx.currentTime);
    trackGain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_MS / 1000);
    trackGain.connect(musicGain);
    source.connect(trackGain);
    source.start();

    musicSource = source;
    musicTrackGain = trackGain;
    musicId = id;
  }

  /**
   * @param {number} [fadeMs]
   */
  function stopMusic(fadeMs) {
    stopMusicInternal(fadeMs ?? FADE_MS);
    musicId = null;
  }

  /**
   * @param {number} fadeMs
   */
  function stopMusicInternal(fadeMs) {
    if (!ctx || !musicSource || !musicTrackGain) return;

    const src = musicSource;
    const gain = musicTrackGain;
    musicSource = null;
    musicTrackGain = null;

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    try {
      src.stop(now + fadeMs / 1000 + 0.1);
    } catch {
      // already stopped
    }
  }

  return {
    load,
    resume,
    playSfx,
    playMusic,
    stopMusic,
    get sfxVolume() { return _sfxVolume; },
    set sfxVolume(v) {
      _sfxVolume = Math.max(0, Math.min(1, v));
      if (sfxGain) sfxGain.gain.value = _sfxVolume;
    },
    get musicVolume() { return _musicVolume; },
    set musicVolume(v) {
      _musicVolume = Math.max(0, Math.min(1, v));
      if (musicGain) musicGain.gain.value = _musicVolume;
    },
  };
}
