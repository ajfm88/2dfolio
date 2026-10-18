// home/fade_audio.asm, plus PlaySound's stop-after-fade path in home/audio.asm.
import type { MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';
import type { GBSynthesizer } from './synthesizer';

const STOP_ALL_MUSIC = 0xff;

export class AudioFade {
  private control = 0;
  private counter = 0;
  private reload = 0;
  // wAudioFadeOutControl queues the sound ID. Queued tracks belong to the later map-fade slice.
  private queuedSoundId = STOP_ALL_MUSIC;

  constructor(
    private readonly synth: GBSynthesizer,
    private readonly music: MusicEngine,
    private readonly sfx: SfxEngine,
  ) {}

  /** wAudioFadeOutControl = control; StopAllMusic. No music (or a second stop) stops at once. */
  fadeOutAndStopMusic(control: number): void {
    this.queuedSoundId = STOP_ALL_MUSIC;
    // PlaySound clears CHAN5–8 IDs even when it queues the music stop.
    this.sfx.stop();
    if (control === 0 || !this.music.isPlaying() || this.isFadingOut()) {
      this.stopAll();
      return;
    }
    this.counter = this.reload = control;
    this.control = this.queuedSoundId;
  }

  isFadingOut(): boolean { return this.control !== 0; }

  /** FadeOutAudio runs before Audio1_UpdateMusic, once per audio update. */
  tick(): void {
    // Idle volume belongs to explicit callers (StatusScreen/Pokédex's NO_AUDIO_FADE_OUT).
    // Completion already restores $77; no unconditional idle write is needed here.
    if (!this.isFadingOut()) return;
    if (this.counter !== 0) { this.counter--; return; }
    this.counter = this.reload;
    const volume = this.synth.masterVolumeRegister;
    if (volume === 0) {
      this.control = 0;
      if (this.queuedSoundId === STOP_ALL_MUSIC) this.stopAll();
      return;
    }
    // Separate DEC/SWAP/OR operations, including the source's nibble-underflow behavior.
    const right = ((volume & 0xf) - 1) & 0xff;
    const left = ((volume >>> 4) - 1) & 0xff;
    const next = ((left << 4) | (left >>> 4) | right) & 0xff;
    this.synth.setMasterVolume(next >>> 4, next & 0xf);
  }

  private stopAll(): void {
    this.control = 0;
    this.music.stop();
    this.sfx.stop();
    // Audio2_StopAllAudio writes $77 itself: same update as completion, never one later.
    this.synth.setMasterVolume(7, 7);
  }
}
