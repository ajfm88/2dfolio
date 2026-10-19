// home/audio.asm + home/fade_audio.asm. Pure WRAM/request logic: no browser or assets.
export interface SoundIdentity { readonly id: number; readonly bank: number }

export interface PlaySoundHost {
  volume(): number;
  setVolume(value: number): void;
  clearSfxIds(): void;
  /** Audio2_StopAllAudio includes restoring NR50=$77. */
  stopAllAudio(): void;
  determineAudioFunction(id: number, bank: number): void;
  soundFinished(): boolean;
}

export const STOP_ALL_MUSIC = 0xff;
export type SoundRequestResult = 'played' | 'queued' | 'dropped';

/** Numeric bytes deliberately mirror WRAM: control changes from a length to a sound ID. */
export class PlaySound {
  newSoundId = 0;
  lastMusicSoundId = 0;
  audioBank = 0x02;
  savedAudioBank = 0x02;
  fadeControl = 0;
  fadeCounter = 0;
  fadeReload = 0;
  noAudioFadeOut = false;

  constructor(private readonly host: PlaySoundHost) {}

  /** PM: cancels the fade and changes both banks; it never writes lastMusicSoundId. */
  playMusic(sound: SoundIdentity): SoundRequestResult {
    this.newSoundId = sound.id;
    this.fadeControl = 0;
    this.audioBank = this.savedAudioBank = sound.bank;
    return this.playSound(sound.id);
  }

  /** PN: an explicit wNewSoundID write followed by PlaySound. */
  playNewSound(id: number): SoundRequestResult {
    this.newSoundId = id;
    return this.playSound(id);
  }

  /** PS: register A is the argument; an ordinary SFX does not write wNewSoundID. */
  playSound(id: number): SoundRequestResult {
    if (this.newSoundId !== 0) this.host.clearSfxIds();
    if (this.fadeControl !== 0) {
      if (this.newSoundId === 0) return 'dropped';
      this.newSoundId = 0;
      if (this.lastMusicSoundId !== STOP_ALL_MUSIC) {
        this.lastMusicSoundId = id;
        this.fadeCounter = this.fadeReload = this.fadeControl;
        this.fadeControl = id;
        return 'queued';
      }
      this.fadeControl = 0;
    }
    this.newSoundId = 0;
    if (id === STOP_ALL_MUSIC) this.host.stopAllAudio();
    else this.host.determineAudioFunction(id, this.audioBank);
    return 'played';
  }

  /** PW: false means the caller's CPU wait is still blocked; retry with the same A. */
  playSoundWaitForCurrent(id: number): boolean {
    if (!this.host.soundFinished()) return false;
    this.playSound(id);
    return true;
  }

  /** SA: does not overwrite an existing fade length/queued ID with zero. */
  stopAllMusic(): SoundRequestResult { return this.playNewSound(STOP_ALL_MUSIC); }

  /** home/init.asm StopAllSounds, called after StopMusic's fade wait. */
  stopAllSounds(): void {
    this.audioBank = this.savedAudioBank = 0x02;
    this.newSoundId = this.lastMusicSoundId = this.fadeControl = 0;
    this.stopAllMusic();
  }

  /** DM: unlike the nurse/Mom's direct requests, always waits and forces last=0. */
  playDefaultMusic(sound: SoundIdentity): boolean {
    if (!this.host.soundFinished()) return false;
    this.lastMusicSoundId = 0;
    this.defaultMusicCommon(sound, 0);
    return true;
  }

  /** DF: walking branch; bike/surf selection remains with its future callers. */
  playDefaultMusicFadeOutCurrent(sound: SoundIdentity, afterBattle = false): void {
    if (afterBattle) this.lastMusicSoundId = 0;
    this.defaultMusicCommon(sound, afterBattle ? 8 : 10);
  }

  private defaultMusicCommon(sound: SoundIdentity, control: number): void {
    const differentBank = this.audioBank !== sound.bank;
    this.savedAudioBank = sound.bank;
    if (differentBank && control === 0) this.audioBank = sound.bank;
    if (!differentBank && this.lastMusicSoundId === sound.id) return;
    this.fadeControl = control;
    this.lastMusicSoundId = sound.id;
    this.playNewSound(sound.id);
  }

  isFadingOut(): boolean { return this.fadeControl !== 0; }

  /** FadeOutAudio, before this VBlank's music and SFX passes. */
  tick(): void {
    if (!this.isFadingOut()) {
      if (!this.noAudioFadeOut) this.host.setVolume(0x77);
      return;
    }
    if (this.fadeCounter !== 0) { this.fadeCounter--; return; }
    this.fadeCounter = this.fadeReload;
    const volume = this.host.volume();
    if (volume === 0) {
      const queued = this.fadeControl;
      this.fadeControl = 0;
      this.stopAllMusic();
      this.audioBank = this.savedAudioBank;
      this.playNewSound(queued);
      return;
    }
    // DEC/SWAP/OR, including asymmetric-nibble underflow, as in the existing fade.
    const right = ((volume & 0xf) - 1) & 0xff;
    const left = ((volume >>> 4) - 1) & 0xff;
    this.host.setVolume(((left << 4) | (left >>> 4) | right) & 0xff);
  }
}
