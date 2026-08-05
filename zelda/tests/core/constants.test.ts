import { describe, it, expect } from 'vitest';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  HUD_HEIGHT,
  PLAY_AREA_HEIGHT,
  TILE_SIZE,
  TILES_X,
  TILES_Y,
  TARGET_FPS,
  FRAME_TIME,
} from '../../src/core/constants.js';

describe('NES Zelda constants', () => {
  it('has correct screen dimensions', () => {
    expect(SCREEN_WIDTH).toBe(256);
    expect(SCREEN_HEIGHT).toBe(240);
  });

  it('HUD + play area equals screen height', () => {
    expect(HUD_HEIGHT + PLAY_AREA_HEIGHT).toBe(SCREEN_HEIGHT);
  });

  it('tile grid covers the play area', () => {
    expect(TILES_X * TILE_SIZE).toBe(SCREEN_WIDTH);
    expect(TILES_Y * TILE_SIZE).toBe(PLAY_AREA_HEIGHT);
  });

  it('targets 60 fps', () => {
    expect(TARGET_FPS).toBe(60);
    expect(FRAME_TIME).toBeCloseTo(1000 / 60, 5);
  });
});
