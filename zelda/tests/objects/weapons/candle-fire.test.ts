import { describe, it, expect } from 'vitest';
import { Direction } from '../../../src/core/types.js';
import { CandleFire, FireState, FIRE_DAMAGE } from '../../../src/objects/weapons/candle-fire.js';

describe('CandleFire', () => {
  it('starts in Walking state', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    expect(fire.state).toBe(FireState.Walking);
    expect(fire.isActive).toBe(true);
    expect(fire.isStanding).toBe(false);
  });

  it('walks 16px at 0.5px/frame (32 frames) then transitions to Standing', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    // QSpeed $20 = 0.5px/frame: 4 applications of 0x20 = 0x80 per frame
    // 0x80/256 = 0.5 whole pixels. So 2 frames per pixel, 32 frames for 16px.
    for (let i = 0; i < 32; i++) {
      expect(fire.state).toBe(FireState.Walking);
      fire.update();
    }
    expect(fire.state).toBe(FireState.Standing);
    expect(fire.x).toBe(116); // moved 16px right
    expect(fire.y).toBe(80);
  });

  it('walks in the correct direction', () => {
    const fireDown = new CandleFire(100, 80, Direction.Down);
    for (let i = 0; i < 32; i++) fireDown.update();
    expect(fireDown.y).toBe(96);
    expect(fireDown.x).toBe(100);

    const fireUp = new CandleFire(100, 80, Direction.Up);
    for (let i = 0; i < 32; i++) fireUp.update();
    expect(fireUp.y).toBe(64);

    const fireLeft = new CandleFire(100, 80, Direction.Left);
    for (let i = 0; i < 32; i++) fireLeft.update();
    expect(fireLeft.x).toBe(84);
  });

  it('stands for 63 frames then dies', () => {
    const fire = new CandleFire(100, 80, Direction.Down);
    // Walk phase: 32 frames at 0.5px/frame
    for (let i = 0; i < 32; i++) fire.update();
    expect(fire.isStanding).toBe(true);

    // Standing phase: 63 frames
    for (let i = 0; i < 63; i++) {
      expect(fire.state).toBe(FireState.Standing);
      fire.update();
    }

    expect(fire.state).toBe(FireState.Dead);
    expect(fire.isActive).toBe(false);
  });

  it('provides a hitbox at its position', () => {
    const fire = new CandleFire(50, 70, Direction.Up);
    const hb = fire.getHitbox();
    expect(hb.x).toBe(50);
    expect(hb.y).toBe(70);
    expect(hb.width).toBe(16);
    expect(hb.height).toBe(16);
  });

  it('moves at exactly 0.5 pixels per frame', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    // After 1 frame: 0.5px — no whole pixel yet (subpixel only)
    fire.update();
    expect(fire.x).toBe(100);
    // After 2 frames: 1.0px — one whole pixel
    fire.update();
    expect(fire.x).toBe(101);
    // After 4 frames: 2.0px
    fire.update();
    fire.update();
    expect(fire.x).toBe(102);
  });

  it('total lifetime is 32 walk + 63 stand = 95 frames', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    for (let i = 0; i < 95; i++) {
      expect(fire.isActive).toBe(true);
      fire.update();
    }
    expect(fire.isActive).toBe(false);
  });

  it('exports FIRE_DAMAGE as 0x10', () => {
    expect(FIRE_DAMAGE).toBe(0x10);
  });
});
