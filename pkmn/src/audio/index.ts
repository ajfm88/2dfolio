/**
 * Audio system public API.
 *
 * Usage:
 *   initAudio()                  — call once at startup
 *   resumeAudio()                — call after first user interaction
 *   playMusic("titlescreen")     — start a music track
 *   stopMusic()                  — stop current music
 *   playSFX("press_ab")          — play a sound effect
 *   tickAudio()                  — call once per game frame
 */

import { GBSynthesizer } from './synthesizer';
import { MusicEngine } from './music_engine';
import { SfxEngine } from './sfx_engine';
import { EXTRACTED_SFX } from './sfx_names';
import { audioUpdate, soundFinished } from './sound_wait';
import type { MusicData, NoiseInstrument } from './music_engine';
import type { SfxData } from './sfx_engine';

let synth: GBSynthesizer | null = null;
let engine: MusicEngine | null = null;
let sfxEngine: SfxEngine | null = null;
let initialized = false;
let audioReady = false;

// Audio runs at Game Boy VBlank rate (~59.7275 Hz), independent of game FPS
const GB_VBLANK_HZ = 59.7275;
const TICK_INTERVAL_MS = 1000 / GB_VBLANK_HZ; // ~16.742ms
let audioAccumulatorMs = 0;
let lastAudioTime = 0;

// Cached data
let waveSamples: number[][] | null = null;
let noiseInstruments: NoiseInstrument[] | null = null;
const musicCache: Map<string, MusicData> = new Map();
const sfxCache: Map<string, SfxData> = new Map();
// The SFX asked for last: CollisionCheckOnLand replays SFX_COLLISION only when it isn't
// already the sound playing (wChannelSoundIDs + CHAN5)
let currentSfx: string | null = null;
// SFX requested but still loading: they count as playing (isSoundFinished)
let pendingSfx = 0;

/**
 * Initialize the audio system. Safe to call before user interaction.
 */
export function initAudio(): void {
  if (initialized) return;
  initialized = true;
  synth = new GBSynthesizer();
  engine = new MusicEngine(synth);
  sfxEngine = new SfxEngine(synth);

  // An SFX ending hands its hardware channel back: the music there stays silent until its
  // next note or rest (Audio1_sound_ret)
  sfxEngine.onChannelDone = (hwChannel: number) => {
    engine?.releaseChannel(hwChannel);
  };
}

/**
 * Resume audio after user interaction (required by browser autoplay policy).
 */
export async function resumeAudio(): Promise<void> {
  if (!synth) initAudio();
  await synth!.resume();

  if (!audioReady) {
    audioReady = true;
    // Load shared audio data
    await loadSharedData();
  }
}

/**
 * Play a music track by name (e.g. "titlescreen", "yellowintro").
 */
export async function playMusic(name: string): Promise<void> {
  if (!engine || !audioReady) return;

  let data = musicCache.get(name);
  if (!data) {
    try {
      const resp = await fetch(`audio/music/${name}.json`);
      data = await resp.json() as MusicData;
      musicCache.set(name, data);
    } catch (e) {
      console.warn(`Failed to load music: ${name}`, e);
      return;
    }
  }

  // Reset audio timing accumulator for fresh playback
  audioAccumulatorMs = 0;
  lastAudioTime = performance.now();
  engine.play(data);
}

/**
 * Stop the currently playing music.
 */
export function stopMusic(): void {
  engine?.stop();
}

/**
 * Play a sound effect by name (e.g. "press_ab", "start_menu").
 * SFX channels override the corresponding music channels while playing.
 */
export async function playSFX(name: string): Promise<void> {
  if (!sfxEngine || !audioReady) return;
  currentSfx = name;

  // Preloaded (loadSharedData), so this normally starts the sound synchronously, in the
  // frame it's asked for
  let data = sfxCache.get(name);
  if (!data) {
    pendingSfx++;
    try {
      data = await loadSfx(name);
    } finally {
      pendingSfx--;
    }
    if (!data) return;
  }

  // A real SFX on channel 8 replaces a drum hit there (Audio1_PlaySound 1433–1436)
  if (data.channels.some(ch => ch.id === 8)) engine?.cancelDrum();
  sfxEngine.play(data);
}

async function loadSfx(name: string): Promise<SfxData | undefined> {
  try {
    const resp = await fetch(`audio/sfx/${name}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as SfxData;
    sfxCache.set(name, data);
    return data;
  } catch (e) {
    console.warn(`Failed to load SFX: ${name}`, e);
    return undefined;
  }
}

/**
 * WaitForSoundToFinish's condition (home/delay.asm): software channels 5, 6 and 8 are
 * idle. Channel 7 is skipped, as the ASM's `inc hl` ×3 skips it. Channel 8 is also busy
 * while a music drum hit sounds (drums are noise-instrument SFX there). A requested SFX
 * still loading counts as playing. A1b's text box polls this after a sound command.
 */
export function isSoundFinished(): boolean {
  return soundFinished(sfxEngine, engine, pendingSfx);
}

/**
 * Tick the audio engine. Called from gameTick() but runs at fixed ~59.7 Hz
 * regardless of game FPS, using its own time accumulator.
 */
export function tickAudio(): void {
  if (!engine) return;

  const now = performance.now();
  if (lastAudioTime === 0) {
    lastAudioTime = now;
    return;
  }

  const elapsed = now - lastAudioTime;
  lastAudioTime = now;

  // Accumulate time and tick at GB VBlank rate
  audioAccumulatorMs += elapsed;

  // Cap to prevent spiral (e.g. if tab was backgrounded)
  if (audioAccumulatorMs > TICK_INTERVAL_MS * 8) {
    audioAccumulatorMs = TICK_INTERVAL_MS * 2;
  }

  while (audioAccumulatorMs >= TICK_INTERVAL_MS) {
    audioAccumulatorMs -= TICK_INTERVAL_MS;
    audioUpdate(engine, sfxEngine);
  }
}

/**
 * Check if music is currently playing.
 */
export function isMusicPlaying(): boolean {
  return engine?.isPlaying() ?? false;
}

/**
 * Check if an SFX is currently playing: any, or the one named. A named SFX still
 * loading counts as playing.
 */
export function isSfxPlaying(name?: string): boolean {
  if (name !== undefined) {
    if (currentSfx !== name) return false;
    return !sfxCache.has(name) || (sfxEngine?.isPlaying() ?? false);
  }
  return sfxEngine?.isPlaying() ?? false;
}

/**
 * Suspend audio output (mute). Used when game is paused.
 */
export function suspendAudio(): void {
  synth?.getContext()?.suspend();
}

/**
 * Resume audio output (unmute). Used when game is unpaused.
 */
export function resumeAudioOutput(): void {
  synth?.getContext()?.resume();
}

// Expose for browser console debugging
const _win = window as unknown as Record<string, unknown>;
_win._audioEngine = () => engine;
_win._audioSynth = () => synth;
_win._sfxEngine = () => sfxEngine;
// A1a (DECISIONS #40): hear an SFX before anything in the game plays it, e.g.
// _playSFX('get_item1'). J2 decides this with the rest of the debug tooling.
_win._playSFX = (name: string) => playSFX(name);

// ─── Internal ────────────────────────────────────────────────────────────────

async function loadSharedData(): Promise<void> {
  if (!engine) return;

  try {
    // Load wave samples
    if (!waveSamples) {
      const resp = await fetch('audio/wave_samples.json');
      waveSamples = await resp.json() as number[][];
      engine.setWaveSamples(waveSamples);
      sfxEngine?.setWaveSamples(waveSamples);
    }

    // Load noise instruments
    if (!noiseInstruments) {
      const resp = await fetch('audio/noise_instruments.json');
      noiseInstruments = (await resp.json()) as NoiseInstrument[];
      engine.setNoiseInstruments(noiseInstruments);
    }
  } catch (e) {
    console.warn('Failed to load audio data:', e);
  }

  // Every extracted SFX, so playSFX never waits on a fetch
  await Promise.all(EXTRACTED_SFX.filter(name => !sfxCache.has(name)).map(loadSfx));
}
