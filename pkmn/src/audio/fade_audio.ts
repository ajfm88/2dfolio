import type { MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';
import type { GBSynthesizer } from './synthesizer';
import { PlaySound } from './play_sound';
import { engineHost } from './request_host';

/** FadeOutAudio plus the healing machine's StopAllMusic entry, on a PlaySound state. */
export class AudioFade {
  readonly requests: PlaySound;

  /** `requests` is the facade's shared state; a bare AudioFade (engine tests) builds its own over the same engines. */
  constructor(synth: GBSynthesizer, music: MusicEngine, sfx: SfxEngine, requests?: PlaySound) {
    this.requests = requests ?? new PlaySound(engineHost(synth, music, sfx, () => {
      throw new Error('A queued sound requires the audio request host');
    }));
  }

  /** wAudioFadeOutControl = control; StopAllMusic. */
  fadeOutAndStopMusic(control: number): void {
    this.requests.fadeControl = control;
    this.requests.stopAllMusic();
  }

  isFadingOut(): boolean { return this.requests.isFadingOut(); }

  /** FadeOutAudio runs before Audio1_UpdateMusic, once per audio update. */
  tick(): void {
    this.requests.tick();
  }
}
