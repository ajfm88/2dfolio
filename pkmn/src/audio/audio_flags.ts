// WRAM status bits the audio request state reads. Transient, never saved; plain module state so
// callers (StatusScreen, the Pallet escort) need no audio facade.

// wStatusFlags2 BIT_NO_AUDIO_FADE_OUT: FadeOutAudio's idle tick leaves NR50 alone while set.
// StatusScreen/StatusScreen2 set it with their own rAUDVOL and clear it on exit.
let noAudioFadeOut = false;
export function isNoAudioFadeOut(): boolean { return noAudioFadeOut; }
export function setNoAudioFadeOut(value: boolean): void { noAudioFadeOut = value; }

// wStatusFlags7 BIT_NO_MAP_MUSIC: set by the Pallet escort (auto_movement.asm:87), cleared by
// OaksLabFollowedOakScript. LoadMapData skips its six passes and PlayDefaultMusicFadeOutCurrent
// while it is set; connections do not look at it.
let noMapMusic = false;
export function isNoMapMusic(): boolean { return noMapMusic; }
export function setNoMapMusic(value: boolean): void { noMapMusic = value; }
