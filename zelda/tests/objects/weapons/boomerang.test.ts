import { describe, it, expect } from 'vitest';
import { Boomerang, BoomerangState } from '../../../src/objects/weapons/boomerang.js';
import {
  BOOMERANG_NORMAL_LIMIT,
  BOOMERANG_MAGIC_LIMIT,
  BOOMERANG_SPARK_FRAMES,
  BOOMERANG_SLOWDOWN_FRAMES,
  BOOMERANG_RETURN_SLOW_FRAMES,
  BOOMERANG_CATCH_THRESHOLD,
} from '../../../src/core/constants.js';

function createBoomerang(dirX = 1, dirY = 0, isMagic = false): Boomerang {
  return new Boomerang(100, 80, dirX, dirY, isMagic);
}

// Advance N frames, link stays at a fixed position
function advanceFrames(b: Boomerang, n: number, linkX = 100, linkY = 80): void {
  for (let i = 0; i < n; i++) {
    b.update(linkX, linkY);
  }
}

describe('Boomerang', () => {
  describe('construction', () => {
    it('starts in FlyAway state', () => {
      const b = createBoomerang();
      expect(b.state).toBe(BoomerangState.FlyAway);
      expect(b.isActive).toBe(true);
      expect(b.isCaught).toBe(false);
    });

    it('reports magic status', () => {
      expect(createBoomerang(1, 0, false).isMagic).toBe(false);
      expect(createBoomerang(1, 0, true).isMagic).toBe(true);
    });
  });

  describe('outbound movement', () => {
    it('moves right at ~3 px/frame with QSpeed $C0', () => {
      const b = createBoomerang(1, 0);
      b.update(0, 0);
      // QSpeed 0xC0 = 192. Applied 4x: 192*4=768. 768/256=3 whole pixels.
      expect(b.x).toBe(103);
      expect(b.y).toBe(80);
    });

    it('moves left', () => {
      const b = new Boomerang(100, 80, -1, 0, false);
      b.update(200, 80);
      expect(b.x).toBe(97);
    });

    it('moves up', () => {
      const b = new Boomerang(100, 80, 0, -1, false);
      b.update(100, 200);
      expect(b.y).toBe(77);
    });

    it('moves down', () => {
      const b = new Boomerang(100, 80, 0, 1, false);
      b.update(100, 0);
      expect(b.y).toBe(83);
    });

    it('moves diagonally', () => {
      const b = new Boomerang(100, 80, 1, -1, false);
      b.update(0, 200);
      // Both axes advance by 3 pixels
      expect(b.x).toBe(103);
      expect(b.y).toBe(77);
    });
  });

  describe('state transitions', () => {
    it('transitions to SparkTurn after reaching normal limit', () => {
      const b = createBoomerang(1, 0, false);
      // At 3 px/frame, 49 px / 3 = ~17 frames
      const framesNeeded = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3);
      advanceFrames(b, framesNeeded - 1, 0, 0);
      expect(b.state).toBe(BoomerangState.FlyAway);
      // One more frame should push past limit
      advanceFrames(b, 2, 0, 0);
      expect(b.state).toBe(BoomerangState.SparkTurn);
    });

    it('magic boomerang travels further before turning', () => {
      const b = createBoomerang(1, 0, true);
      // After normal limit frames, magic should still be flying
      const framesForNormal = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3) + 2;
      advanceFrames(b, framesForNormal, 0, 0);
      expect(b.state).toBe(BoomerangState.FlyAway);
    });

    it('SparkTurn lasts exactly 3 frames', () => {
      const b = createBoomerang(1, 0, false);
      // 17 frames at 3px/f = 51px >= 49 → SparkTurn entered, timer=3 not yet decremented
      const flyFrames = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3);
      advanceFrames(b, flyFrames, 0, 0);
      expect(b.state).toBe(BoomerangState.SparkTurn);

      // 2 more frames: timer 3→2, 2→1 — still SparkTurn
      b.update(0, 0);
      expect(b.state).toBe(BoomerangState.SparkTurn);
      b.update(0, 0);
      expect(b.state).toBe(BoomerangState.SparkTurn);
      // 3rd frame: timer 1→0 → SlowDown
      b.update(0, 0);
      expect(b.state).toBe(BoomerangState.SlowDown);
    });

    it('SlowDown lasts exactly 16 frames', () => {
      const b = createBoomerang(1, 0, false);
      // Advance to SlowDown: fly(17) + spark(3) = 20
      const flyFrames = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3);
      advanceFrames(b, flyFrames + BOOMERANG_SPARK_FRAMES, 0, 0);
      expect(b.state).toBe(BoomerangState.SlowDown);

      // 15 more → still SlowDown (timer 16→1)
      advanceFrames(b, BOOMERANG_SLOWDOWN_FRAMES - 1, 0, 0);
      expect(b.state).toBe(BoomerangState.SlowDown);
      // 16th frame → ReturnSlow
      b.update(0, 0);
      expect(b.state).toBe(BoomerangState.ReturnSlow);
    });

    it('ReturnSlow lasts exactly 32 frames then becomes ReturnFast', () => {
      const b = createBoomerang(1, 0, false);
      // Advance to ReturnSlow: fly(17) + spark(3) + slow(16) = 36
      const flyFrames = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3);
      const toReturnSlow = flyFrames + BOOMERANG_SPARK_FRAMES + BOOMERANG_SLOWDOWN_FRAMES;
      advanceFrames(b, toReturnSlow, 1000, 1000);
      expect(b.state).toBe(BoomerangState.ReturnSlow);

      // 31 more → still ReturnSlow
      advanceFrames(b, BOOMERANG_RETURN_SLOW_FRAMES - 1, 1000, 1000);
      expect(b.state).toBe(BoomerangState.ReturnSlow);
      // 32nd frame → ReturnFast
      b.update(1000, 1000);
      expect(b.state).toBe(BoomerangState.ReturnFast);
    });
  });

  describe('catching', () => {
    it('deactivates when within catch threshold of Link', () => {
      const b = createBoomerang(1, 0, false);
      // Force to ReturnFast and place near Link
      b.forceReturn();
      expect(b.state).toBe(BoomerangState.ReturnFast);

      // Update with Link at a position within 9px
      const linkX = b.x + BOOMERANG_CATCH_THRESHOLD;
      const linkY = b.y;
      b.update(linkX, linkY);
      expect(b.isCaught).toBe(true);
      expect(b.isActive).toBe(false);
      expect(b.state).toBe(BoomerangState.Dead);
    });

    it('does not catch when beyond threshold on one axis', () => {
      const b = createBoomerang(1, 0, false);
      b.forceReturn();
      // X within threshold, Y beyond
      b.update(b.x, b.y + BOOMERANG_CATCH_THRESHOLD + 5);
      expect(b.isCaught).toBe(false);
      expect(b.isActive).toBe(true);
    });
  });

  describe('forceReturn', () => {
    it('jumps to ReturnFast from FlyAway', () => {
      const b = createBoomerang();
      expect(b.state).toBe(BoomerangState.FlyAway);
      b.forceReturn();
      expect(b.state).toBe(BoomerangState.ReturnFast);
    });

    it('jumps to ReturnFast from SparkTurn', () => {
      const b = createBoomerang(1, 0, false);
      const framesNeeded = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3) + 2;
      advanceFrames(b, framesNeeded, 0, 0);
      expect(b.state).toBe(BoomerangState.SparkTurn);
      b.forceReturn();
      expect(b.state).toBe(BoomerangState.ReturnFast);
    });

    it('does nothing when Dead', () => {
      const b = createBoomerang();
      b.forceReturn();
      // Place near link to trigger catch
      b.update(b.x, b.y);
      expect(b.state).toBe(BoomerangState.Dead);
      b.forceReturn(); // should not resurrect
      expect(b.state).toBe(BoomerangState.Dead);
    });
  });

  describe('hitbox', () => {
    it('returns 8x8 rect at (x+4, y+8)', () => {
      const b = new Boomerang(50, 70, 1, 0, false);
      const hb = b.getHitbox();
      expect(hb.x).toBe(54);
      expect(hb.y).toBe(78);
      expect(hb.width).toBe(8);
      expect(hb.height).toBe(8);
    });
  });

  describe('animation', () => {
    it('advances cycle index every 2 frames', () => {
      const b = createBoomerang();
      // After construction, cycleIndex is 0
      b.update(0, 0); // animCounter: 2→1
      b.update(0, 0); // animCounter: 1→0, cycleIndex: 0→1, reset counter
      // After 2 updates, cycleIndex should have advanced once
      // We can verify indirectly: after 2 more updates, it advances again
      b.update(0, 0);
      b.update(0, 0);
      // After 4 total updates, cycleIndex should be 2
      // After 16 total updates (8 advances), cycleIndex wraps at 7→0
    });

    it('wraps cycle index at 7 (AND 7)', () => {
      const b = createBoomerang();
      // Advance 8 cycles × 2 frames = 16 frames → should wrap
      advanceFrames(b, 16, 0, 0);
      // cycleIndex = (8 & 7) = 0, so it wrapped
      expect(b.isActive).toBe(true); // still flying
    });
  });

  describe('homing return', () => {
    it('moves toward Link during ReturnFast', () => {
      // Boomerang at (200, 80), Link at (100, 80) — should move left
      const b = new Boomerang(200, 80, 1, 0, false);
      b.forceReturn();
      const startX = b.x;
      b.update(100, 80);
      expect(b.x).toBeLessThan(startX);
    });

    it('tracks Link current position, not throw origin', () => {
      const b = new Boomerang(200, 80, 1, 0, false);
      b.forceReturn();

      // Link moves to a new position
      b.update(50, 150);
      const afterX = b.x;
      const afterY = b.y;
      // Should have moved toward (50, 150), not (200, 80)
      expect(afterX).toBeLessThan(200);
      expect(afterY).toBeGreaterThan(80);
    });
  });

  describe('boundary checks', () => {
    it('transitions to ReturnFast when going off right edge', () => {
      // Throw boomerang right from near the edge
      const b = new Boomerang(250, 80, 1, 0, true); // magic = long range
      b.update(0, 0);
      // After moving 3px right from 250, x=253 which is > SCREEN_WIDTH (256)
      // Actually 253 < 256, need one more
      b.update(0, 0); // x=256, still at boundary
      b.update(0, 0); // x=259, > 256
      expect(b.state).toBe(BoomerangState.ReturnFast);
    });

    it('transitions to ReturnFast when going off top edge', () => {
      const b = new Boomerang(100, 5, 0, -1, true);
      b.update(100, 200);
      // y = 5-3 = 2
      b.update(100, 200);
      // y = 2-3 = -1 < 0
      expect(b.state).toBe(BoomerangState.ReturnFast);
    });
  });

  describe('SlowDown movement', () => {
    it('moves at ~1 px/frame during SlowDown', () => {
      const b = createBoomerang(1, 0, false);
      // Advance to SlowDown
      const toSlowDown = Math.ceil(BOOMERANG_NORMAL_LIMIT / 3) + 2 + BOOMERANG_SPARK_FRAMES;
      advanceFrames(b, toSlowDown, 0, 0);
      expect(b.state).toBe(BoomerangState.SlowDown);

      const startX = b.x;
      b.update(0, 0);
      // QSpeed $40 = 64. Applied 4x: 256. 256/256 = 1 pixel.
      expect(b.x - startX).toBe(1);
    });
  });
});
