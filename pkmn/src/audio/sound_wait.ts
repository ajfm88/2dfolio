/**
 * One audio update (Audio1_UpdateMusic, engine_1.asm 3–35): the music channels CHAN1–4,
 * each suppressed while its SFX channel is busy, then the SFX channels CHAN5–8. So on the
 * update an SFX ends, the music under it is still suppressed.
 */
export function audioUpdate(music: MusicEngine | null, sfx: SfxEngine | null): void {
  music?.tick(sfx ?? undefined);
  sfx?.tick();
}

/**
 * WaitForSoundToFinish's condition (home/delay.asm), as a pure function of the engines.
 *
 *   ld hl, wChannelSoundIDs + CHAN5 / or [hl] / inc hl / or [hl] / inc hl / inc hl / or [hl]
 *
 * Software channels 5, 6 and 8 must all be idle; channel 7 is skipped. Channel 8 is also
 * held by music drum hits, which are noise-instrument SFX there. A requested SFX still
 * loading counts as playing.
 */

import type { MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';

export function soundFinished(sfx: SfxEngine | null, music: MusicEngine | null, pendingLoads: number): boolean {
  if (pendingLoads > 0) return false;
  if (!sfx) return true;
  return !sfx.isChannelActive(0) && !sfx.isChannelActive(1) && !sfx.isChannelActive(3)
    && !(music?.channel8DrumBusy ?? false);
}
