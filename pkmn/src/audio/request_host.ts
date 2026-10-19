import type { PlaySoundHost } from './play_sound';
import type { MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';
import type { GBSynthesizer } from './synthesizer';
import { soundFinished } from './sound_wait';

/** The real engines behind PlaySound: the same host for the shared facade state and a bare AudioFade. */
export function engineHost(
  synth: GBSynthesizer, music: MusicEngine, sfx: SfxEngine,
  determineAudioFunction: (id: number, bank: number) => void,
  isSoundFinished: () => boolean = () => soundFinished(sfx, music, 0),
  onStopAll: () => void = () => {},
): PlaySoundHost {
  return {
    volume: () => synth.masterVolumeRegister,
    setVolume: value => synth.setMasterVolume(value >>> 4, value & 0xf),
    clearSfxIds: () => { sfx.clearSoundIds(); music.cancelDrum(); },
    stopAllAudio: () => {
      onStopAll();
      music.stop(); sfx.stop();
      // Completion's StopAllMusic and the queued $ff both restore NR50; one write is observable.
      if (synth.masterVolumeRegister !== 0x77) synth.setMasterVolume(7, 7);
    },
    determineAudioFunction,
    soundFinished: isSoundFinished,
  };
}
