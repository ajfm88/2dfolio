import { describe, it, expect } from 'vitest';
import { RecorderEffect, RecorderPhase } from '../../../src/objects/items/recorder.js';
import { Direction } from '../../../src/core/types.js';
import {
  FLUTE_TIMER,
  FLUTE_POND_CYCLE_INTERVAL,
  FLUTE_POND_CYCLE_STEPS,
  WHIRLWIND_CATCH_THRESHOLD,
  WHIRLWIND_DROP_X,
  WHIRLWIND_EXIT_X,
  WHIRLWIND_SPEED,
} from '../../../src/core/constants.js';

const FLUTE_SECRET_ROOMS = [66, 6, 41, 43, 48, 58, 60, 88, 96, 110, 114];

function createSecretRoomEffect(): RecorderEffect {
  return new RecorderEffect(66, Direction.Right, 0, 0, FLUTE_SECRET_ROOMS, 80);
}

function createWhirlwindEffect(triforce = 0x01, facing = Direction.Right): RecorderEffect {
  return new RecorderEffect(0, facing, triforce, 0, FLUTE_SECRET_ROOMS, 80);
}

describe('RecorderEffect', () => {
  describe('Tune phase', () => {
    it('starts in Tune phase', () => {
      const effect = createWhirlwindEffect();
      expect(effect.phase).toBe(RecorderPhase.Tune);
      expect(effect.isDone).toBe(false);
    });

    it('tune phase lasts exactly 152 frames', () => {
      const effect = createWhirlwindEffect();
      for (let i = 0; i < FLUTE_TIMER - 1; i++) {
        effect.update(100, 80);
        expect(effect.phase).toBe(RecorderPhase.Tune);
      }
      effect.update(100, 80);
      expect(effect.phase).not.toBe(RecorderPhase.Tune);
    });
  });

  describe('secret room detection', () => {
    it('enters PondDrying for room 66 (Q1 secret)', () => {
      const effect = createSecretRoomEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.PondDrying);
    });

    it('enters WhirlwindSource for non-secret room with triforce', () => {
      const effect = createWhirlwindEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.WhirlwindSource);
    });

    it('goes directly to Done for non-secret room without triforce', () => {
      const effect = new RecorderEffect(0, Direction.Right, 0, 0, FLUTE_SECRET_ROOMS, 80);
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.Done);
      expect(effect.isDone).toBe(true);
    });
  });

  describe('PondDrying phase', () => {
    it('runs 12 steps at 8-frame intervals', () => {
      const effect = createSecretRoomEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.PondDrying);

      let steps = 0;
      while (effect.phase === RecorderPhase.PondDrying) {
        effect.update(100, 80);
        steps++;
      }
      // 12 steps × 8 frames per step, but first cycle starts at 1 not 0
      expect(steps).toBe(FLUTE_POND_CYCLE_STEPS * FLUTE_POND_CYCLE_INTERVAL);
      expect(effect.phase).toBe(RecorderPhase.Done);
    });

    it('waterWalkable becomes true at step 10', () => {
      const effect = createSecretRoomEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);

      // Steps 1-9: no water walkable (9 steps × 8 frames = 72 frames)
      for (let i = 0; i < 9 * FLUTE_POND_CYCLE_INTERVAL; i++) {
        effect.update(100, 80);
      }
      expect(effect.waterWalkable).toBe(false);

      // Step 10: water becomes walkable (8 more frames)
      for (let i = 0; i < FLUTE_POND_CYCLE_INTERVAL; i++) {
        effect.update(100, 80);
      }
      expect(effect.waterWalkable).toBe(true);
    });

    it('revealStairs fires once at step 11', () => {
      const effect = createSecretRoomEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);

      // Steps 1-10: 80 frames
      for (let i = 0; i < 10 * FLUTE_POND_CYCLE_INTERVAL; i++) {
        effect.update(100, 80);
      }

      // Step 11: stairs revealed (8 more frames)
      for (let i = 0; i < FLUTE_POND_CYCLE_INTERVAL; i++) {
        effect.update(100, 80);
      }
      expect(effect.revealStairs).toBe(true);
      // Second read should return false (consumed)
      expect(effect.revealStairs).toBe(false);
    });
  });

  describe('WhirlwindSource phase', () => {
    it('whirlwind moves right at 2px/frame', () => {
      const effect = createWhirlwindEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.WhirlwindSource);

      const startX = effect.whirlwindX;
      effect.update(100, 80);
      expect(effect.whirlwindX).toBe(startX + WHIRLWIND_SPEED);
    });

    it('catches Link when within 9px on each axis', () => {
      const effect = createWhirlwindEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);

      // Advance whirlwind near Link position (100, 80)
      while (effect.whirlwindX < 100 - WHIRLWIND_CATCH_THRESHOLD - 1) {
        effect.update(100, 80);
        expect(effect.linkCaught).toBe(false);
      }

      // One more frame should catch Link
      while (!effect.linkCaught && effect.phase === RecorderPhase.WhirlwindSource) {
        effect.update(100, 80);
      }
      expect(effect.linkCaught).toBe(true);
    });

    it('transitions to TransitionPending at X >= 240', () => {
      const effect = createWhirlwindEffect();
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);

      while (effect.phase === RecorderPhase.WhirlwindSource) {
        effect.update(100, 80);
      }
      expect(effect.phase).toBe(RecorderPhase.TransitionPending);
      expect(effect.whirlwindX).toBeGreaterThanOrEqual(WHIRLWIND_EXIT_X);
    });
  });

  describe('WhirlwindDest phase', () => {
    it('drops Link at X = 128', () => {
      const effect = createWhirlwindEffect();
      effect.startDestinationPhase(0x8D);

      while (effect.phase === RecorderPhase.WhirlwindDest) {
        effect.update(0, 0x8D);
      }
      expect(effect.phase).toBe(RecorderPhase.Done);
      expect(effect.whirlwindX).toBeGreaterThanOrEqual(WHIRLWIND_DROP_X);
      expect(effect.linkCaught).toBe(false);
    });
  });

  describe('destination selection', () => {
    it('selects dungeon based on triforce bitmask', () => {
      // triforce = 0x01 (dungeon 0) with right-facing → advance to index 1
      // but bit 1 (index 1) is not set, so cycles to find bit 0 again
      const effect = new RecorderEffect(0, Direction.Right, 0x01, 0, FLUTE_SECRET_ROOMS, 80);
      // With triforce bit 0 set, destination should be dungeon 0 entrance
      expect(effect.destinationScreenId).toBe(0x36);
    });

    it('cycles through triforce bits based on facing direction', () => {
      // triforce = 0x04 (dungeon 2 only), starting index 0, facing right
      const effect = new RecorderEffect(0, Direction.Right, 0x04, 0, FLUTE_SECRET_ROOMS, 80);
      expect(effect.destinationScreenId).toBe(0x73); // dungeon 2 entrance
    });

    it('returns no whirlwind when triforce is 0', () => {
      const effect = new RecorderEffect(0, Direction.Right, 0, 0, FLUTE_SECRET_ROOMS, 80);
      for (let i = 0; i < FLUTE_TIMER; i++) effect.update(100, 80);
      expect(effect.phase).toBe(RecorderPhase.Done);
    });

    it('uses destination Y from TeleportYs table', () => {
      const effect = new RecorderEffect(0, Direction.Right, 0x02, 0, FLUTE_SECRET_ROOMS, 80);
      // Dungeon 1: TeleportY = 0xAD
      expect(effect.destinationLinkY).toBe(0xAD);
    });

    it('direction left/up decrements index', () => {
      // Start at index 0, face left → decrement → wraps to 7
      // triforce 0x80 = dungeon 7
      const effect = new RecorderEffect(0, Direction.Left, 0x80, 0, FLUTE_SECRET_ROOMS, 80);
      expect(effect.destinationScreenId).toBe(0x6C); // dungeon 7 entrance
    });
  });

  describe('updatedTeleportIndex', () => {
    it('persists the destination index for next flute use', () => {
      const effect = new RecorderEffect(0, Direction.Right, 0x01, 0, FLUTE_SECRET_ROOMS, 80);
      expect(effect.updatedTeleportIndex).toBe(0); // found at index 0 (after advancing from 0→1→...→0)
    });
  });
});
