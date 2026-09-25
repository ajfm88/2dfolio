export const TILE = 32;
export const VIEW_H = 360;
export const VIEW_W_MIN = 512;
export const VIEW_W_MAX = 768;
export const ANIM_FPS = 10;
export const FIXED_DT = 1 / 60;

// Mode-switch wipe, in seconds (ported from Pirate Maker main.py Transition, which
// ran on pixel speed; fixed durations keep it the same on every viewport width).
export const WIPE_CLOSE = 0.4;
export const WIPE_HOLD = 0.1;
export const WIPE_OPEN = 0.4;
// Each half of the reduced-motion fade.
export const WIPE_FADE = 0.05;
// --ink. The canvas cannot read CSS custom properties.
export const WIPE_COLOR = '#33323d';

export const Z = {
  bg: 0,
  clouds: 1,
  bgTiles: 2,
  bgDecor: 3,
  main: 5,
  water: 6,
  fg: 7,
  fx: 8,
};
