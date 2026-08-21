import { describe, it, expect } from 'vitest';
import { Bomb, BombState, BOMB_DAMAGE } from '../../../src/objects/weapons/bomb.js';

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

  describe('explosion hitbox', () => {
    it('returns null during Idle state', () => {
      const bomb = new Bomb(100, 80);
      expect(bomb.getExplosionHitbox()).toBeNull();
    });

    it('returns null during Fuse state', () => {
      const bomb = new Bomb(100, 80);
      for (let i = 0; i < 48; i++) bomb.update(); // skip Idle
      expect(bomb.state).toBe(BombState.Fuse);
      expect(bomb.getExplosionHitbox()).toBeNull();
    });

    it('returns 48x48 rect centered on bomb during Detonating', () => {
      const bomb = new Bomb(100, 80);
      for (let i = 0; i < 72; i++) bomb.update(); // skip Idle (48) + Fuse (24)
      expect(bomb.state).toBe(BombState.Detonating);

      const hb = bomb.getExplosionHitbox();
      expect(hb).not.toBeNull();
      // Center is at (100+8, 80+8) = (108, 88), radius 24
      expect(hb!.x).toBe(108 - 24);
      expect(hb!.y).toBe(88 - 24);
      expect(hb!.width).toBe(48);
      expect(hb!.height).toBe(48);
    });

    it('returns null during Exploding state', () => {
      const bomb = new Bomb(100, 80);
      for (let i = 0; i < 84; i++) bomb.update(); // skip Idle+Fuse+Detonating
      expect(bomb.state).toBe(BombState.Exploding);
      expect(bomb.getExplosionHitbox()).toBeNull();
    });

    it('returns null when Dead', () => {
      const bomb = new Bomb(100, 80);
      for (let i = 0; i < 90; i++) bomb.update(); // run through all phases
      expect(bomb.state).toBe(BombState.Dead);
      expect(bomb.getExplosionHitbox()).toBeNull();
    });
  });

  describe('screen flash', () => {
    it('shouldFlash is false during non-Detonating states', () => {
      const bomb = new Bomb(100, 80);
      expect(bomb.shouldFlash).toBe(false); // Idle
      for (let i = 0; i < 48; i++) bomb.update();
      expect(bomb.shouldFlash).toBe(false); // Fuse
    });

    it('shouldFlash is true at specific Detonating timer values', () => {
      const bomb = new Bomb(100, 80);
      // Advance to Detonating (timer starts at 12)
      for (let i = 0; i < 72; i++) bomb.update();
      expect(bomb.state).toBe(BombState.Detonating);

      // Timer counts from 12 down to 1 over 12 updates
      // shouldFlash at timer 0x0B (11) and 0x06 (6)
      // After 1 update: timer = 11 → flash
      bomb.update();
      expect(bomb.shouldFlash).toBe(true);

      // Advance to timer 6: need 5 more updates (11→10→9→8→7→6)
      for (let i = 0; i < 4; i++) bomb.update();
      expect(bomb.shouldFlash).toBe(false); // timer = 7
      bomb.update();
      expect(bomb.shouldFlash).toBe(true); // timer = 6
    });
  });

  it('exports BOMB_DAMAGE as 0x40', () => {
    expect(BOMB_DAMAGE).toBe(0x40);
  });
});
