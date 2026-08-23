import { describe, it, expect } from 'vitest';
import { MagicRod, RodState } from '../../../src/objects/weapons/magic-rod.js';
import { Direction } from '../../../src/core/types.js';

describe('MagicRod', () => {
  describe('construction', () => {
    it('starts inactive', () => {
      const rod = new MagicRod();
      expect(rod.isActive()).toBe(false);
      expect(rod.state).toBe(RodState.Inactive);
    });
  });

  describe('start', () => {
    it('transitions to Windup on start', () => {
      const rod = new MagicRod();
      rod.start(Direction.Right);
      expect(rod.isActive()).toBe(true);
      expect(rod.state).toBe(RodState.Windup);
      expect(rod.direction).toBe(Direction.Right);
    });
  });

  describe('state machine timing', () => {
    it('follows 5f Windup → 8f Extended → 1f FireShot → 1f Retract1 → 1f Retract2 → Inactive', () => {
      const rod = new MagicRod();
      rod.start(Direction.Up);

      // Windup: 5 frames
      for (let i = 0; i < 5; i++) {
        const r = rod.update();
        expect(r.shouldFireShot).toBe(false);
        expect(r.done).toBe(false);
      }
      expect(rod.state).toBe(RodState.Extended);

      // Extended: 7 frames before the transition frame
      for (let i = 0; i < 7; i++) {
        const r = rod.update();
        expect(r.shouldFireShot).toBe(false);
        expect(r.done).toBe(false);
      }
      expect(rod.state).toBe(RodState.Extended);

      // 8th Extended frame transitions to FireShot and returns shouldFireShot
      const fireResult = rod.update();
      expect(fireResult.shouldFireShot).toBe(true);
      expect(fireResult.done).toBe(false);
      expect(rod.state).toBe(RodState.FireShot);

      // FireShot: 1 frame → Retract1
      const retract1 = rod.update();
      expect(retract1.shouldFireShot).toBe(false);
      expect(retract1.done).toBe(false);
      expect(rod.state).toBe(RodState.Retract1);

      // Retract1: 1 frame → Retract2
      const retract2 = rod.update();
      expect(retract2.shouldFireShot).toBe(false);
      expect(retract2.done).toBe(false);
      expect(rod.state).toBe(RodState.Retract2);

      // Retract2: 1 frame → Inactive (done)
      const doneResult = rod.update();
      expect(doneResult.done).toBe(true);
      expect(doneResult.shouldFireShot).toBe(false);
      expect(rod.state).toBe(RodState.Inactive);
      expect(rod.isActive()).toBe(false);
    });

    it('total cycle is 16 frames (5+8+1+1+1)', () => {
      const rod = new MagicRod();
      rod.start(Direction.Down);
      let frames = 0;
      let shotFired = false;
      while (rod.isActive()) {
        const r = rod.update();
        frames++;
        if (r.shouldFireShot) shotFired = true;
        if (r.done) break;
      }
      expect(frames).toBe(16);
      expect(shotFired).toBe(true);
    });
  });

  describe('shouldFireShot', () => {
    it('fires exactly once per swing', () => {
      const rod = new MagicRod();
      rod.start(Direction.Left);
      let shotCount = 0;
      while (rod.isActive()) {
        const r = rod.update();
        if (r.shouldFireShot) shotCount++;
        if (r.done) break;
      }
      expect(shotCount).toBe(1);
    });
  });

  describe('hitbox', () => {
    it('returns null during Windup', () => {
      const rod = new MagicRod();
      rod.start(Direction.Up);
      expect(rod.getHitbox(100, 80)).toBeNull();
    });

    it('returns a rect during Extended', () => {
      const rod = new MagicRod();
      rod.start(Direction.Up);
      for (let i = 0; i < 5; i++) rod.update(); // past Windup
      expect(rod.state).toBe(RodState.Extended);
      const hb = rod.getHitbox(100, 80);
      expect(hb).not.toBeNull();
      expect(hb!.width).toBeGreaterThan(0);
      expect(hb!.height).toBeGreaterThan(0);
    });

    it('returns null after Extended', () => {
      const rod = new MagicRod();
      rod.start(Direction.Up);
      for (let i = 0; i < 13; i++) rod.update(); // past Extended
      expect(rod.getHitbox(100, 80)).toBeNull();
    });
  });

  describe('rod position', () => {
    it('returns null during Inactive and Windup', () => {
      const rod = new MagicRod();
      expect(rod.getRodPosition(100, 80)).toBeNull();
      rod.start(Direction.Right);
      expect(rod.getRodPosition(100, 80)).toBeNull();
    });

    it('returns offset position during Extended', () => {
      const rod = new MagicRod();
      rod.start(Direction.Right);
      for (let i = 0; i < 5; i++) rod.update();
      const pos = rod.getRodPosition(100, 80);
      expect(pos).not.toBeNull();
      expect(pos!.x).toBe(100 + 11); // Right extended offset
      expect(pos!.y).toBe(80 + 3);
    });
  });

  describe('cancel', () => {
    it('immediately deactivates the rod', () => {
      const rod = new MagicRod();
      rod.start(Direction.Up);
      for (let i = 0; i < 3; i++) rod.update();
      expect(rod.isActive()).toBe(true);
      rod.cancel();
      expect(rod.isActive()).toBe(false);
      expect(rod.state).toBe(RodState.Inactive);
    });
  });
});
