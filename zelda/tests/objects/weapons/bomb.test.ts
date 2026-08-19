import { describe, it, expect } from 'vitest';
import { Bomb, BombState } from '../../../src/objects/weapons/bomb.js';

describe('Bomb', () => {
  it('starts in Idle state', () => {
    const bomb = new Bomb(100, 80);
    expect(bomb.state).toBe(BombState.Idle);
    expect(bomb.isActive).toBe(true);
    expect(bomb.isDetonating).toBe(false);
  });

  it('transitions through states with correct NES timings', () => {
    const bomb = new Bomb(100, 80);

    // BombTimes: $30=48, $18=24, $0C=12, $06=6
    // Idle phase: 48 frames
    for (let i = 0; i < 48; i++) {
      expect(bomb.state).toBe(BombState.Idle);
      bomb.update();
    }

    // Fuse phase: 24 frames
    for (let i = 0; i < 24; i++) {
      expect(bomb.state).toBe(BombState.Fuse);
      bomb.update();
    }

    // Detonating phase: 12 frames
    for (let i = 0; i < 12; i++) {
      expect(bomb.state).toBe(BombState.Detonating);
      expect(bomb.isDetonating).toBe(true);
      bomb.update();
    }

    // Exploding phase: 6 frames
    for (let i = 0; i < 6; i++) {
      expect(bomb.state).toBe(BombState.Exploding);
      bomb.update();
    }

    // Dead
    expect(bomb.state).toBe(BombState.Dead);
    expect(bomb.isActive).toBe(false);
  });

  it('provides a hitbox at its position', () => {
    const bomb = new Bomb(50, 70);
    const hb = bomb.getHitbox();
    expect(hb.x).toBe(50);
    expect(hb.y).toBe(70);
    expect(hb.width).toBe(16);
    expect(hb.height).toBe(16);
  });
});
