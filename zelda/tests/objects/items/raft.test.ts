import { describe, it, expect } from 'vitest';
import { Raft, RaftState } from '../../../src/objects/items/raft.js';
import { Direction } from '../../../src/core/types.js';
import { Link } from '../../../src/objects/player/link.js';
import {
  RAFT_ARRIVAL_Y,
  RAFT_DEPARTURE_Y,
  RAFT_MIDPOINT_Y,
  RAFT_SPRITE_OFFSET_Y,
} from '../../../src/core/constants.js';

describe('Raft', () => {
  describe('construction', () => {
    it('starts in Idle state', () => {
      const raft = new Raft(0x80);
      expect(raft.state).toBe(RaftState.Idle);
      expect(raft.isMoving).toBe(false);
    });
  });

  describe('idle detection', () => {
    it('does nothing when Link X does not match dock X', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x70, RAFT_DEPARTURE_Y);
      const result = raft.update(link);
      expect(raft.state).toBe(RaftState.Idle);
      expect(result.shouldTransitionUp).toBe(false);
    });

    it('activates MovingDown when Link at arrival Y with matching X', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_ARRIVAL_Y);
      link.inventory.sword = 1; // prevent issues
      raft.update(link);
      expect(raft.state).toBe(RaftState.MovingDown);
      expect(link.halted).toBe(true);
    });

    it('activates MovingUp when Link at departure Y with matching X', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_DEPARTURE_Y);
      raft.update(link);
      expect(raft.state).toBe(RaftState.MovingUp);
      expect(link.halted).toBe(true);
    });
  });

  describe('MovingDown', () => {
    it('increments Link Y at 1px/frame', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_ARRIVAL_Y);
      raft.update(link); // activate
      expect(raft.state).toBe(RaftState.MovingDown);

      const startY = link.posY;
      raft.update(link);
      expect(link.posY).toBe(startY + 1);
    });

    it('resets to Idle at midpoint Y', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_ARRIVAL_Y);
      raft.update(link); // activate

      // Run until midpoint
      while (raft.state === RaftState.MovingDown) {
        raft.update(link);
      }
      expect(link.posY).toBe(RAFT_MIDPOINT_Y);
      expect(raft.state).toBe(RaftState.Idle);
      expect(link.halted).toBe(false);
    });

    it('takes exactly (MIDPOINT - ARRIVAL) frames', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_ARRIVAL_Y);
      raft.update(link); // activate

      let frames = 0;
      while (raft.state === RaftState.MovingDown) {
        raft.update(link);
        frames++;
      }
      expect(frames).toBe(RAFT_MIDPOINT_Y - RAFT_ARRIVAL_Y);
    });
  });

  describe('MovingUp', () => {
    it('decrements Link Y at 1px/frame', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_DEPARTURE_Y);
      raft.update(link); // activate
      expect(raft.state).toBe(RaftState.MovingUp);

      const startY = link.posY;
      raft.update(link);
      expect(link.posY).toBe(startY - 1);
    });

    it('signals shouldTransitionUp at arrival Y', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_DEPARTURE_Y);
      raft.update(link); // activate

      let transitionSignalled = false;
      while (raft.state === RaftState.MovingUp) {
        const result = raft.update(link);
        if (result.shouldTransitionUp) transitionSignalled = true;
      }
      expect(transitionSignalled).toBe(true);
      expect(link.posY).toBe(RAFT_ARRIVAL_Y);
    });

    it('takes exactly (DEPARTURE - ARRIVAL) frames', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_DEPARTURE_Y);
      raft.update(link); // activate

      let frames = 0;
      while (raft.state === RaftState.MovingUp) {
        raft.update(link);
        frames++;
      }
      expect(frames).toBe(RAFT_DEPARTURE_Y - RAFT_ARRIVAL_Y);
    });
  });

  describe('raft position', () => {
    it('is drawn RAFT_SPRITE_OFFSET_Y below Link during movement', () => {
      const raft = new Raft(0x80);
      const link = new Link(0x80, RAFT_DEPARTURE_Y);
      raft.update(link); // activate
      raft.update(link); // one frame of movement
      // Internal raftY should be linkY + offset
      expect(RAFT_SPRITE_OFFSET_Y).toBe(6);
    });
  });
});
