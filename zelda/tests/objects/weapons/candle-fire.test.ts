import { describe, it, expect } from 'vitest';
import { Direction } from '../../../src/core/types.js';
import { CandleFire, FireState } from '../../../src/objects/weapons/candle-fire.js';

describe('CandleFire', () => {
  it('starts in Walking state', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    expect(fire.state).toBe(FireState.Walking);
    expect(fire.isActive).toBe(true);
    expect(fire.isStanding).toBe(false);
  });

  it('walks 16px then transitions to Standing', () => {
    const fire = new CandleFire(100, 80, Direction.Right);
    for (let i = 0; i < 16; i++) {
      expect(fire.state).toBe(FireState.Walking);
      fire.update();
    }
    expect(fire.state).toBe(FireState.Standing);
    expect(fire.x).toBe(116); // moved 16px right
    expect(fire.y).toBe(80);
  });

  it('walks in the correct direction', () => {
    const fireDown = new CandleFire(100, 80, Direction.Down);
    for (let i = 0; i < 16; i++) fireDown.update();
    expect(fireDown.y).toBe(96);
    expect(fireDown.x).toBe(100);

    const fireUp = new CandleFire(100, 80, Direction.Up);
    for (let i = 0; i < 16; i++) fireUp.update();
    expect(fireUp.y).toBe(64);

    const fireLeft = new CandleFire(100, 80, Direction.Left);
    for (let i = 0; i < 16; i++) fireLeft.update();
    expect(fireLeft.x).toBe(84);
  });

  it('stands for 63 frames then dies', () => {
    const fire = new CandleFire(100, 80, Direction.Down);
    // Walk phase
    for (let i = 0; i < 16; i++) fire.update();
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
});
