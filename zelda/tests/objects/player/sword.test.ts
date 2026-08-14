import { describe, it, expect } from 'vitest';
import { SwordSwing, SwordState } from '../../../src/objects/player/sword.js';
import { Direction } from '../../../src/core/types.js';

describe('SwordSwing', () => {
  describe('initial state', () => {
    it('starts inactive', () => {
      const sword = new SwordSwing();
      expect(sword.isActive()).toBe(false);
      expect(sword.state).toBe(SwordState.Inactive);
    });
  });

  describe('start', () => {
    it('transitions to Windup on start', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Right);
      expect(sword.isActive()).toBe(true);
      expect(sword.state).toBe(SwordState.Windup);
      expect(sword.direction).toBe(Direction.Right);
    });
  });

  describe('state machine timing', () => {
    it('stays in Windup for 5 frames', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      for (let i = 0; i < 4; i++) {
        sword.update();
        expect(sword.state).toBe(SwordState.Windup);
      }
      sword.update(); // frame 5 — transitions
      expect(sword.state).toBe(SwordState.Extended);
    });

    it('stays in Extended for 8 frames', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      for (let i = 0; i < 5; i++) sword.update(); // exhaust Windup
      for (let i = 0; i < 7; i++) {
        sword.update();
        expect(sword.state).toBe(SwordState.Extended);
      }
      sword.update(); // frame 8 — transitions
      expect(sword.state).toBe(SwordState.Retracting);
    });

    it('retracts for 3 frames then becomes Inactive', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      for (let i = 0; i < 5; i++) sword.update(); // Windup
      for (let i = 0; i < 8; i++) sword.update(); // Extended
      // Now in Retracting
      sword.update(); // retract step 0→1
      expect(sword.state).toBe(SwordState.Retracting);
      sword.update(); // retract step 1→2
      expect(sword.state).toBe(SwordState.Retracting);
      const result = sword.update(); // retract step 2→done
      expect(sword.state).toBe(SwordState.Inactive);
      expect(result.done).toBe(true);
    });

    it('total duration is 16 frames', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      let frames = 0;
      while (sword.isActive()) {
        sword.update();
        frames++;
      }
      expect(frames).toBe(16);
    });
  });

  describe('shouldFireBeam', () => {
    it('returns true on transition from Extended to Retracting', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Right);
      const results: boolean[] = [];
      while (sword.isActive()) {
        const r = sword.update();
        results.push(r.shouldFireBeam);
      }
      // shouldFireBeam should be true exactly once (at frame 13: Extended → Retracting)
      expect(results.filter(Boolean).length).toBe(1);
      expect(results[12]).toBe(true); // 0-indexed: frame 13 = index 12
    });
  });

  describe('getHitbox', () => {
    it('returns null during Windup', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      expect(sword.getHitbox(100, 80)).toBeNull();
    });

    it('returns hitbox during Extended', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      for (let i = 0; i < 5; i++) sword.update(); // exhaust Windup
      const hitbox = sword.getHitbox(100, 80);
      expect(hitbox).not.toBeNull();
      expect(hitbox!.width).toBe(24);
      expect(hitbox!.height).toBe(32);
    });

    it('returns correct hitbox for horizontal direction', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Right);
      for (let i = 0; i < 5; i++) sword.update();
      const hitbox = sword.getHitbox(100, 80);
      expect(hitbox).not.toBeNull();
      expect(hitbox!.width).toBe(32);
      expect(hitbox!.height).toBe(24);
    });

    it('returns null during Retracting', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      for (let i = 0; i < 13; i++) sword.update(); // Windup + Extended
      expect(sword.getHitbox(100, 80)).toBeNull();
    });
  });

  describe('getSwordPosition', () => {
    it('returns null during Windup', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      expect(sword.getSwordPosition(100, 80)).toBeNull();
    });

    it('returns position during Extended', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Right);
      for (let i = 0; i < 5; i++) sword.update();
      const pos = sword.getSwordPosition(100, 80);
      expect(pos).not.toBeNull();
      expect(pos!.x).toBe(111); // 100 + 11
      expect(pos!.y).toBe(83);  // 80 + 3
    });

    it('returns closer position during Retracting', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Right);
      for (let i = 0; i < 5; i++) sword.update(); // Windup
      const extPos = sword.getSwordPosition(100, 80);
      for (let i = 0; i < 8; i++) sword.update(); // Extended
      const retPos = sword.getSwordPosition(100, 80);
      expect(retPos).not.toBeNull();
      expect(retPos!.x).toBeLessThan(extPos!.x); // closer to Link
    });
  });

  describe('can restart after completion', () => {
    it('can start a new swing after previous one completes', () => {
      const sword = new SwordSwing();
      sword.start(Direction.Down);
      while (sword.isActive()) sword.update();
      expect(sword.isActive()).toBe(false);

      sword.start(Direction.Left);
      expect(sword.isActive()).toBe(true);
      expect(sword.direction).toBe(Direction.Left);
    });
  });
});
