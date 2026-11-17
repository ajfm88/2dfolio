// Audio1_PlaySound's channel test (audio/engine_1.asm:1404–1449), shared by the field and the battle.

/** The first id past the noise instruments (constants/music_constants.asm). */
export const NOISE_INSTRUMENTS_END = 0x14;

/**
 * May an SFX with id `incoming` take header channel `channel` (5–8) whose wChannelSoundIDs entry is `old`?
 * An empty channel always; CHAN8 refuses a noise instrument (a drum) while busy, and a real SFX there beats a drum;
 * otherwise the lower or equal id wins. One refusal ends the whole PlaySound.
 */
export function acceptsSfxChannel(channel: number, incoming: number, old: number): boolean {
  if (old === 0) return true;
  if (channel === 8 && incoming < NOISE_INSTRUMENTS_END) return false;
  if (channel === 8 && old <= NOISE_INSTRUMENTS_END) return true;
  return incoming <= old;
}
