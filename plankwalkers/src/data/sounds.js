/**
 * Audio manifest. Per-sound `volume` (0–1, default 1.0) is the authored mix
 * level — how loud this sound is relative to others at the same master volume.
 *
 * attack.wav is deliberately absent — sword combat is out of scope in v1.
 */
export const sounds = {
  jump:   { src: '/assets/audio/jump.wav' },
  coin:   { src: '/assets/audio/coin.wav', volume: 0.4 },
  damage: { src: '/assets/audio/damage.wav', volume: 0.6 },
  pearl:  { src: '/assets/audio/pearl.wav', volume: 0.8 },
  hit:    { src: '/assets/audio/hit.wav', volume: 0.7 },
  music:  { src: '/assets/audio/starlight_city.mp3' },
};
