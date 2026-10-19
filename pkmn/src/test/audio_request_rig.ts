// Request state plus the existing real audio_rig engines. No facade/browser mock.
import { rig, musicData, sfxData } from './audio_rig';
import { AudioFade } from '../audio/fade_audio';
import { PlaySound } from '../audio/play_sound';
import { audioUpdate, soundFinished, updateMusic6Times } from '../audio/sound_wait';
import { musicNameForSound, sfxNameForSound } from '../audio/sound_ids';

export function requestRig() {
  const base = rig();
  const { synth, music, sfx } = base;
  const starts: { u: number; id: number; bank: number; name: string; kind: 'music' | 'sfx' }[] = [];
  const stops: number[] = [], clears: number[] = [];
  const requests = new PlaySound({
    volume: () => synth.masterVolumeRegister,
    setVolume: value => synth.setMasterVolume(value >>> 4, value & 0xf),
    clearSfxIds: () => { clears.push(synth.update); sfx.clearSoundIds(); music.cancelDrum(); },
    stopAllAudio: () => { stops.push(synth.update); music.stop(); sfx.stop(); synth.setMasterVolume(7, 7); },
    determineAudioFunction: (id, bank) => {
      const name = musicNameForSound(id, bank);
      if (name) {
        starts.push({ u: synth.update, id, bank, name, kind: 'music' }); music.play(musicData(name));
      } else {
        const effect = sfxNameForSound(id);
        if (!effect) throw new Error(`Unknown rig sound ${bank}:${id}`);
        starts.push({ u: synth.update, id, bank, name: effect, kind: 'sfx' }); sfx.play(sfxData(effect));
      }
    },
    soundFinished: () => soundFinished(sfx, music, 0),
  });
  const fade = new AudioFade(synth, music, sfx, requests);
  const update = () => { synth.update++; audioUpdate(music, sfx, fade); };
  const state = () => ({ newId: requests.newSoundId, last: requests.lastMusicSoundId,
    bank: requests.audioBank, savedBank: requests.savedAudioBank, control: requests.fadeControl,
    counter: requests.fadeCounter, reload: requests.fadeReload });
  return { synth, music, sfx, fade, requests, starts, stops, clears, state, update,
    run: (n: number) => { for (let i = 0; i < n; i++) update(); },
    sixPasses: () => updateMusic6Times(music, sfx),
  };
}
