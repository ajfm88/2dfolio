import type { Program } from './battle_menu_context';
import { delayFrames } from './battle_menu_context';

export interface BattleVoiceHost {
  cry(species: number): Program;
  /** Plays PCM and clears the ids before reporting a pending VBlank. */
  clip(id: number): boolean;
}
/** pret home/pokemon.asm:140-155. The battle session supplies the shared PlayCry program. */
export function* playCryCue(host: BattleVoiceHost, species: number): Program {
  yield* host.cry(species & 255);
}
/** pret audio/pikachu_pcm.asm:1-23,86-93. Service the pending VBlank after PCM's in-call clear. */
export function* playPikachuClipCue(host: BattleVoiceHost, id: number): Program {
  yield* delayFrames(3);
  if (host.clip(id & 255)) yield 'serviced';
}
