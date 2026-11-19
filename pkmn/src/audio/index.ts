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
import { acceptsSfxChannel } from './sfx_priority';
import { audioUpdate, soundFinished, updateMusic6Times as sixPasses } from './sound_wait';
import { PlaySound } from './play_sound';
import { isNoAudioFadeOut } from './audio_flags';
import { engineHost } from './request_host';
import { SFX_IDS, musicIdentity, musicNameForSound, sfxNameForSound, textSoundId } from './sound_ids';
import { rivalAlternateStart } from './rival_start';
import { AudioFade } from './fade_audio';
import { battleMusicFor } from './battle_music';
import { setLowHealthAlarm, setLowHealthChannel5 } from './low_health_alarm';
import { PIKACHU_PCM_HZ, clipFrozenFrames, clipMissedVBlanks, decodePikachuClip } from './pikachu_pcm';
import type { PikachuClip, PikachuClipFile } from './pikachu_pcm';
import { freezeFrames } from '../core/cpu_freeze';
import type { BattleMusicInput } from './battle_music';
import type { MusicData, NoiseInstrument } from './music_engine';
import type { SfxData } from './sfx_engine';

let synth: GBSynthesizer | null = null;
let engine: MusicEngine | null = null;
let sfxEngine: SfxEngine | null = null;
let fade: AudioFade | undefined;
// The cartridge's home/audio.asm state (wNewSoundID, wLastMusicSoundID, banks, fade control)
let requests: PlaySound | undefined;
// What the last PlaySound dispatch started (loading may still be under way)
let startPromise: Promise<void> = Promise.resolve();
let nextMusicStart: 'rivalAlternate' | undefined;
// Newest music start; a slower fetch of an older one must not play over it
let musicSeq = 0;
// PlayDefaultMusic's WaitForSoundToFinish, resolved on the audio clock
let pendingDefault: ReturnType<typeof musicIdentity> = undefined;
let inTick = false;
let initialized = false;
let audioReady = false;

/** Unused battle-session seam; the page retains ownership of these engines and their clock. */
export function getBattleAudioEngines(): { sfx: SfxEngine; music: MusicEngine; banks: PlaySound } {
  if (!sfxEngine || !engine || !requests) throw new Error('audio is not initialized');
  return { sfx: sfxEngine, music: engine, banks: requests };
}

/** rAUDVOL / NR50, as used by StatusScreen and StatusScreen2. */
export function setMasterVolume(left: number, right: number): void {
  synth?.setMasterVolume(left, right);
}

/** AnimateHealingMachine's wAudioFadeOutControl = control; StopAllMusic. Before the splash
 *  unlock nothing is playing and nothing is requested, so it stops at once. */
export function fadeOutAndStopMusic(control: number): void {
  pendingDefault = undefined;
  fade?.fadeOutAndStopMusic(audioReady ? control : 0);
}


export function isAudioFadingOut(): boolean { return fade?.isFadingOut() ?? false; }

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
// Pikachu's voice clips by pret's number (PikachuCryN), decoded
const clipCache: Map<number, PikachuClip> = new Map();
// The SFX asked for last; only a request still loading reads it (isSfxPlaying)
let currentSfx: string | null = null;
// wChannelSoundIDs + CHAN5–8 as the field's PlaySound wrote them, with the file each id played (V5g2).
// A channel counts only while its SFX plays: sound_ret, InitSFXVariables and PlaySound's ID clear all
// leave it idle, so an idle channel reads 0, as its ID does on the cartridge.
const fieldSounds = new Map<number, { id: number; file: string }>();
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
  requests = new PlaySound(engineHost(synth, engine, sfxEngine, determineAudioFunction,
    () => soundFinished(sfxEngine, engine, pendingSfx), () => { musicSeq++; }));
  fade = new AudioFade(synth, engine, sfxEngine, requests);

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

// (bank, id) pairs already reported as having no committed file
const unmappedSfx = new Set<string>();

/** DetermineAudioFunction: the numeric ID and the current audio bank pick music or an SFX. */
function determineAudioFunction(id: number, bank: number): void {
  const music = musicNameForSound(id, bank);
  if (music) {
    const start = nextMusicStart;
    nextMusicStart = undefined;
    startPromise = startMusic(music, start);
    return;
  }
  const sfx = sfxNameForSound(id, bank);
  if (sfx) { startPromise = startSfx(sfx, id); return; }
  // No committed file holds this bank's entry: nothing plays, never another bank's body.
  const key = `${bank}:${id}`;
  if (!unmappedSfx.has(key)) {
    unmappedSfx.add(key);
    console.warn(`No SFX file for id $${id.toString(16)} in audio bank $${bank.toString(16)}`);
  }
}

async function startMusic(name: string, start?: 'rivalAlternate'): Promise<void> {
  if (!engine || !audioReady) return;
  const seq = ++musicSeq;
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
    if (seq !== musicSeq) return;
  }

  // Reset audio timing accumulator for fresh playback (a fade completing inside the tick keeps it)
  if (!inTick) {
    audioAccumulatorMs = 0;
    lastAudioTime = performance.now();
  }
  engine.play(start === 'rivalAlternate' ? rivalAlternateStart(data) : data);
}

/**
 * PlayMusic: play a track by name (e.g. "titlescreen", "yellowintro"). Cancels any fade and
 * changes the audio bank; wLastMusicSoundID is untouched.
 */
export function playMusic(name: string, start?: 'rivalAlternate'): Promise<void> {
  if (!engine || !audioReady || !requests) return Promise.resolve();
  pendingDefault = undefined;
  const id = musicIdentity(name);
  if (!id) return startMusic(name, start); // no header (PokeFluteInBattle): a direct routine
  nextMusicStart = start;
  startPromise = Promise.resolve();
  requests.playMusic(id);
  nextMusicStart = undefined;
  return startPromise;
}

/** wNewSoundID = track; PlaySound (Mom's and the machine's PkmnHealed). A bank-3 song is stopped
 *  and the bank switched first, as AnimateHealingMachine does; the old bank is saved. */
export function playMusicNew(name: string): Promise<void> {
  if (!engine || !audioReady || !requests) return Promise.resolve();
  const id = musicIdentity(name);
  if (!id) return startMusic(name);
  requests.savedAudioBank = requests.audioBank;
  if (requests.audioBank === 0x1f) {
    requests.stopAllMusic();
    requests.audioBank = id.bank;
  }
  startPromise = Promise.resolve();
  requests.playNewSound(id.id);
  return startPromise;
}

/** PlayDefaultMusic: waits for the sound to finish, then restarts the map's song at once. */
export function playDefaultMusic(track: string): void {
  const id = musicIdentity(track);
  if (!id || !engine || !audioReady || !requests) return;
  void preloadMusic(track);
  pendingDefault = undefined;
  if (!requests.playDefaultMusic(id)) pendingDefault = id;
}

/** The nurse's restoration (pokecenter.asm:53–60): control 0, bank restored, last = new = map song. */
export function restoreNurseMusic(track: string): void {
  const id = musicIdentity(track);
  if (!id || !engine || !audioReady || !requests) return;
  pendingDefault = undefined;
  requests.fadeControl = 0;
  requests.audioBank = requests.savedAudioBank;
  requests.lastMusicSoundId = id.id;
  startPromise = Promise.resolve();
  requests.playNewSound(id.id);
}

/** PlayDefaultMusicFadeOutCurrent (walking branch): c = 10, or 8 with last = 0 after a battle. */
export function playDefaultMusicFadeOutCurrent(track: string, afterBattle = false): void {
  const id = musicIdentity(track);
  if (!id || !engine || !audioReady || !requests) return;
  void preloadMusic(track); // the queued song must be cached when the fade completes
  pendingDefault = undefined;
  requests.playDefaultMusicFadeOutCurrent(id, afterBattle);
}

/** HandleBlackOut's StopAllSounds, after StopMusic's fade has been waited out. */
export function stopAllSounds(): void {
  pendingDefault = undefined;
  requests?.stopAllSounds();
}

/** PrepareTitleScreen's two writes (title.asm:20–22): wAudioROMBank = wAudioSavedROMBank = bank. */
export function setAudioBank(bank: number): void {
  if (!requests) return;
  requests.audioBank = requests.savedAudioBank = bank;
}

/** StopAllMusic (home/audio.asm): wNewSoundID = SFX_STOP_ALL_MUSIC, then PlaySound. The fade control is untouched. */
export function stopAllMusic(): void {
  requests?.stopAllMusic();
}

/** `ld [wNewSoundID], a` / `call PlaySound` for a song in the current audio bank (the title's MUSIC_TITLE_SCREEN). */
export function playNewMusic(name: string): Promise<void> {
  const id = musicIdentity(name);
  if (!id || !engine || !audioReady || !requests) return Promise.resolve();
  startPromise = Promise.resolve();
  requests.playNewSound(id.id);
  return startPromise;
}

/** UpdateMusic6Times: six Audio1_UpdateMusic passes, with no FadeOutAudio tick. */
export function updateMusic6Times(): void {
  sixPasses(engine, sfxEngine);
}

/** Warm a track without starting playback; a cached playMusic starts before its first await. */
export async function preloadMusic(name: string): Promise<void> {
  if (!engine || !audioReady || musicCache.has(name)) return;
  try {
    const resp = await fetch(`audio/music/${name}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    musicCache.set(name, await resp.json() as MusicData);
  } catch (e) {
    console.warn(`Failed to preload music: ${name}`, e);
  }
}

/** PlayBattleMusic / PlayTrainerMusic / PlayBattleVictoryMusic's opening: control = 0, StopAllMusic. */
export function stopMusic(): void {
  pendingDefault = undefined;
  if (!requests) { engine?.stop(); return; }
  requests.fadeControl = 0;
  requests.stopAllMusic();
}

/** PlayBattleMusic: control=0 and the alarm byte 0, then SA, at E; DelayFrame; PM at E+1.
 * The caller primes this generator at E and resumes it on the next game frame.
 * CP4 supplies the following DelayFrame before BattleTransition, and preloads the song.
 */
export function* playBattleMusic(input: BattleMusicInput): Generator<void, void> {
  setLowHealthAlarm(0);
  stopMusic();
  yield;
  void playMusic(battleMusicFor(input));
}

/**
 * PlaySound with A only: an ordinary SFX (e.g. "press_ab", "start_menu"). During a map-music
 * fade the cartridge ignores it. SFX channels override the music channels while playing.
 */
export function playSFX(name: string): Promise<void> {
  if (!sfxEngine || !audioReady || !requests) return Promise.resolve();
  // A field id, else a text `sound` command's (TextCommandSounds: caught_mon, dex_page_added), so the current
  // bank's table picks the body as it does for every other request (V5g3 checkpoint-04).
  const id = SFX_IDS[name as keyof typeof SFX_IDS] ?? textSoundId(name);
  if (id === undefined) return startSfx(name);
  startPromise = Promise.resolve();
  requests.playSound(id);
  return startPromise;
}

/** wChannelSoundIDs + `channel` (5–8) for the field: the playing SFX's id, else 0. A music drum's id on CHAN8
 * is left out: field requests are never noise instruments, and a real SFX beats a drum (acceptsSfxChannel). */
function fieldChannelId(channel: number): number {
  if (!(sfxEngine?.isChannelActive(channel - 5) ?? false)) return 0;
  return fieldSounds.get(channel)?.id ?? 0;
}

async function startSfx(name: string, id?: number): Promise<void> {
  if (!sfxEngine) return;
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

  if (id === undefined) {
    // A name outside SFX_IDS and TEXT_SOUND_IDS (only the debug _playSFX today): upstream's replace-all, no ids.
    if (data.channels.some(ch => ch.id === 8)) engine?.cancelDrum();
    fieldSounds.clear();
    sfxEngine.play(data);
    return;
  }
  // Audio1_PlaySound (engine_1.asm:1404–1449): the header backwards; InitSFXVariables on each accepted
  // channel; one refusal returns, leaving the channels already cleared idle (a Gen 1 quirk kept).
  for (const channel of [...data.channels].reverse()) {
    if (!acceptsSfxChannel(channel.id, id, fieldChannelId(channel.id))) return;
    sfxEngine.clearChannelsForPriority([channel.id]);
    fieldSounds.delete(channel.id);
    // A real SFX on channel 8 replaces a drum hit there (Audio1_PlaySound 1433–1436)
    if (channel.id === 8) engine?.cancelDrum();
  }
  for (const channel of data.channels) fieldSounds.set(channel.id, { id, file: name });
  sfxEngine.installSfx(data);
}

export async function loadSfx(name: string): Promise<SfxData | undefined> {
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

/** Fetch one of Pikachu's voice clips (pret's number, PikachuCryN), so that it can start inside a frame. */
export async function loadPikachuClip(number: number): Promise<void> {
  if (clipCache.has(number)) return;
  const resp = await fetch(`audio/pikachu_cries/pikachu_cry_${number}.json`);
  if (!resp.ok) throw new Error(`Pikachu clip ${number}: HTTP ${resp.status}`);
  clipCache.set(number, decodePikachuClip(await resp.json() as PikachuClipFile, number));
}

/**
 * PlayPikachuSoundClip from `di` to `ei` (audio/pikachu_pcm.asm:23-92). Nothing else runs in that span, so its
 * writes are made here at once: rAUDVOL = $77; the clip on the wave channel; that channel left off afterwards
 * (rAUD3ENA 0 then $80 without a trigger, rAUDTERM's two bits cleared), so the music's wave voice returns with
 * its next note; wChannelSoundIDs + CHAN5..CHAN8 = 0. The game is frozen for every VBlank the clip misses but
 * the last. Returns whether a VBlank was missed: the cartridge services that one as soon as `ei` takes effect,
 * so a frame program yields once and resumes after it (playPikachuSoundClip).
 */
export function startPikachuClip(number: number): boolean {
  const clip = clipCache.get(number);
  if (!clip) throw new Error(`Pikachu clip ${number} is not loaded`);
  if (!synth || !engine || !sfxEngine) throw new Error('audio is not initialized');
  synth.setMasterVolume(7, 7);
  synth.playPcm(clip.bytes, PIKACHU_PCM_HZ);
  synth.silenceWave();
  sfxEngine.clearSoundIds(); engine.cancelDrum(); setLowHealthChannel5(0);
  freezeFrames(clipFrozenFrames(clip.bytes.length));
  return clipMissedVBlanks(clip.bytes.length) > 0;
}

/** PlayPikachuSoundClip as a frame program (a yield is one VBlank): its three DelayFrames, then the clip. */
export function* playPikachuSoundClip(number: number): Generator<void, void> {
  for (let frame = 0; frame < 3; frame++) yield;
  if (startPikachuClip(number)) yield;
}

/** A frozen frame (core/cpu_freeze.ts) has no audio update, and its time is not owed to the audio clock. */
export function holdAudioClock(): void {
  if (lastAudioTime !== 0) lastAudioTime = performance.now();
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

  if (requests) requests.noAudioFadeOut = isNoAudioFadeOut();
  inTick = true;
  while (audioAccumulatorMs >= TICK_INTERVAL_MS) {
    audioAccumulatorMs -= TICK_INTERVAL_MS;
    if (pendingDefault && requests?.playDefaultMusic(pendingDefault)) pendingDefault = undefined;
    audioUpdate(engine, sfxEngine, fade);
  }
  inTick = false;
}

/**
 * Check if music is currently playing.
 */
export function isMusicPlaying(): boolean {
  return engine?.isPlaying() ?? false;
}

/** Mom polls wChannelSoundIDs (CHAN1), not the engine's track-enabled latch. */
export function isMusicChannelActive(id: number): boolean {
  return engine?.getChannel(id)?.active ?? false;
}

/**
 * Check if an SFX is currently playing: any, or the one named. The named form is CollisionCheckOnLand's
 * `wChannelSoundIDs + CHAN5 == SFX_COLLISION`: a channel still holds that sound. A named SFX still loading
 * counts as playing.
 */
export function isSfxPlaying(name?: string): boolean {
  if (name !== undefined) {
    if (currentSfx === name && !sfxCache.has(name)) return true;
    return [5, 6, 7, 8].some(channel => fieldChannelId(channel) !== 0 && fieldSounds.get(channel)?.file === name);
  }
  return sfxEngine?.isPlaying() ?? false;
}

/** wChannelSoundIDs + `channel` (5–8) as the field sees it; 0 when idle. */
export function channelSoundId(channel: 5 | 6 | 7 | 8): number {
  return fieldChannelId(channel);
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
// Opening checkpoint-04 (note 113): hear one of Pikachu's clips before the title plays it, e.g.
// _playPikachuClip(1). It runs the clip's body without the three frames a caller waits first.
_win._playPikachuClip = async (number = 1) => { await loadPikachuClip(number); startPikachuClip(number); };

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
