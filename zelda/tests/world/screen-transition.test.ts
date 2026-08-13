import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import { SCREEN_WIDTH, PLAY_AREA_HEIGHT } from '../../src/core/constants.js';
import { ScreenTransition, isHorizontal } from '../../src/world/screen-transition.js';
import type { OverworldScreen } from '../../src/data/overworld-types.js';

function makeScreen(id: number): OverworldScreen {
  return {
    id,
    row: Math.floor(id / 16),
    col: id % 16,
    uniqueRoomId: id & 0x3f,
    tiles: Array.from({ length: 11 }, () => Array.from({ length: 16 }, () => 0)),
  };
}

describe('ScreenTransition', () => {
  const oldScreen = makeScreen(0x77);
  const newScreen = makeScreen(0x78);

  describe('horizontal (Right)', () => {
    it('completes in 64 frames (256px / 4px)', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      let frames = 0;
      while (!t.done) {
        t.update();
        frames++;
      }
      expect(frames).toBe(64);
    });

    it('scrollOffset reaches SCREEN_WIDTH', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      for (let i = 0; i < 64; i++) t.update();
      expect(t.scrollOffset).toBe(SCREEN_WIDTH);
    });

    it('offset progresses by 4 each frame', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      t.update();
      expect(t.scrollOffset).toBe(4);
      t.update();
      expect(t.scrollOffset).toBe(8);
      t.update();
      expect(t.scrollOffset).toBe(12);
    });

    it('is not done before final frame', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      for (let i = 0; i < 63; i++) t.update();
      expect(t.done).toBe(false);
      t.update();
      expect(t.done).toBe(true);
    });
  });

  describe('horizontal (Left)', () => {
    it('completes in 64 frames', () => {
      const t = new ScreenTransition(Direction.Left, oldScreen, newScreen);
      let frames = 0;
      while (!t.done) {
        t.update();
        frames++;
      }
      expect(frames).toBe(64);
    });
  });

  describe('vertical (Down)', () => {
    it('completes in 44 frames (176px / 4px)', () => {
      const t = new ScreenTransition(Direction.Down, oldScreen, newScreen);
      let frames = 0;
      while (!t.done) {
        t.update();
        frames++;
      }
      expect(frames).toBe(44);
    });

    it('scrollOffset reaches PLAY_AREA_HEIGHT', () => {
      const t = new ScreenTransition(Direction.Down, oldScreen, newScreen);
      for (let i = 0; i < 44; i++) t.update();
      expect(t.scrollOffset).toBe(PLAY_AREA_HEIGHT);
    });
  });

  describe('vertical (Up)', () => {
    it('completes in 44 frames', () => {
      const t = new ScreenTransition(Direction.Up, oldScreen, newScreen);
      let frames = 0;
      while (!t.done) {
        t.update();
        frames++;
      }
      expect(frames).toBe(44);
    });
  });

  describe('getOldScreenOffset', () => {
    it('Right: old slides left (-offset, 0)', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      t.update();
      expect(t.getOldScreenOffset()).toEqual({ x: -4, y: 0 });
    });

    it('Left: old slides right (+offset, 0)', () => {
      const t = new ScreenTransition(Direction.Left, oldScreen, newScreen);
      t.update();
      expect(t.getOldScreenOffset()).toEqual({ x: 4, y: 0 });
    });

    it('Down: old slides up (0, -offset)', () => {
      const t = new ScreenTransition(Direction.Down, oldScreen, newScreen);
      t.update();
      expect(t.getOldScreenOffset()).toEqual({ x: 0, y: -4 });
    });

    it('Up: old slides down (0, +offset)', () => {
      const t = new ScreenTransition(Direction.Up, oldScreen, newScreen);
      t.update();
      expect(t.getOldScreenOffset()).toEqual({ x: 0, y: 4 });
    });
  });

  describe('getNewScreenOffset', () => {
    it('Right: new enters from right (256-offset, 0)', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: SCREEN_WIDTH - 4, y: 0 });
    });

    it('Left: new enters from left (-256+offset, 0)', () => {
      const t = new ScreenTransition(Direction.Left, oldScreen, newScreen);
      t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: -SCREEN_WIDTH + 4, y: 0 });
    });

    it('Down: new enters from bottom (0, 176-offset)', () => {
      const t = new ScreenTransition(Direction.Down, oldScreen, newScreen);
      t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: 0, y: PLAY_AREA_HEIGHT - 4 });
    });

    it('Up: new enters from top (0, -176+offset)', () => {
      const t = new ScreenTransition(Direction.Up, oldScreen, newScreen);
      t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: 0, y: -PLAY_AREA_HEIGHT + 4 });
    });

    it('Right at completion: new is at (0,0)', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      for (let i = 0; i < 64; i++) t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: 0, y: 0 });
    });

    it('Up at completion: new is at (0,0)', () => {
      const t = new ScreenTransition(Direction.Up, oldScreen, newScreen);
      for (let i = 0; i < 44; i++) t.update();
      expect(t.getNewScreenOffset()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('does not overshoot', () => {
    it('extra updates after completion do not increase offset', () => {
      const t = new ScreenTransition(Direction.Right, oldScreen, newScreen);
      for (let i = 0; i < 100; i++) t.update();
      expect(t.scrollOffset).toBe(SCREEN_WIDTH);
      expect(t.done).toBe(true);
    });
  });
});

describe('isHorizontal', () => {
  it('Left is horizontal', () => {
    expect(isHorizontal(Direction.Left)).toBe(true);
  });

  it('Right is horizontal', () => {
    expect(isHorizontal(Direction.Right)).toBe(true);
  });

  it('Up is not horizontal', () => {
    expect(isHorizontal(Direction.Up)).toBe(false);
  });

  it('Down is not horizontal', () => {
    expect(isHorizontal(Direction.Down)).toBe(false);
  });
});
