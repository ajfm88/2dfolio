/**
 * One VBlank audio update: FadeOutAudio, then the low-health alarm, then Audio1_UpdateMusic
 * (home/vblank.asm 66–73). The same order is Func_3082's. The music channels CHAN1–4,
 * each suppressed while its SFX channel or the alarm's CHAN5 id is busy, then the SFX
 * channels CHAN5–8. So on the update an SFX ends, the music under it is still suppressed.
 */
export function audioUpdate(music: MusicEngine | null, sfx: SfxEngine | null, fade?: AudioFade): void {
  fade?.tick();
  doLowHealthAlarm();
  music?.tick(sfx ?? undefined);
  sfx?.tick();
}

/** UpdateMusic6Times calls Audio1_UpdateMusic directly: no FadeOutAudio, alarm, or wall-clock tick. */
export function updateMusic6Times(music: MusicEngine | null, sfx: SfxEngine | null): void {
  for (let i = 0; i < 6; i++) {
    music?.tick(sfx ?? undefined);
    sfx?.tick();
  }
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
import type { AudioFade } from './fade_audio';
import { doLowHealthAlarm, lowHealthAlarm } from './low_health_alarm';

export function soundFinished(sfx: SfxEngine | null, music: MusicEngine | null, pendingLoads: number): boolean {
  // WaitForSoundToFinish returns immediately while bit 7 is set, including $FF.
  if ((lowHealthAlarm() & 0x80) !== 0) return true;
  if (pendingLoads > 0) return false;
  if (!sfx) return true;
  return !sfx.isChannelActive(0) && !sfx.isChannelActive(1) && !sfx.isChannelActive(3)
    && !(music?.channel8DrumBusy ?? false);
}
