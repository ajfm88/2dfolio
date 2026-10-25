import type { Program } from './battle_menu_context';
import { delayFrames } from './battle_menu_context';

export interface BattleVoiceHost {
  getAlarm(): number;
  setAlarm(value: number): void;
  /** GetCryData/PlaySound and duration remain named presentation cues (J2/04b). */
  cry(species: number): void;
  clip(id: number): void;
  /** Audio2's four CPU-only SFX-ID clears after the deferred PCM body. */
  clearSfxIds?(): void;
}
/** pret home/pokemon.asm:140-155. Zero-duration declared cry cue, bracketed by the real alarm owner's accessors. */
export function playCryCue(host: BattleVoiceHost, species: number): void {
  const alarm = host.getAlarm(); host.setAlarm(0); host.cry(species & 255); host.setAlarm(alarm);
}
/** pret audio/pikachu_pcm.asm:1-23,86-93. Three serviced prefix frames, then PCM and CPU-only ID clears. */
export function* playPikachuClipCue(host: BattleVoiceHost, id: number): Program {
  yield* delayFrames(3); host.clip(id & 255); host.clearSfxIds?.();
}
