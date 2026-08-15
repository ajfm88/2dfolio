import { describe, it, expect } from 'vitest';
import { PushBlock, PushBlockState, type PushBlockLinkInfo } from '../../src/world/push-block.js';
import { Direction } from '../../src/core/types.js';

function makeLinkInfo(overrides: Partial<PushBlockLinkInfo> = {}): PushBlockLinkInfo {
  return {
    posX: 128,
    posY: 77, // +3 offset → 80, matching block Y
    facing: Direction.Right,
    isMoving: true,
    ...overrides,
  };
}

describe('PushBlock', () => {
  describe('idle state', () => {
    it('starts in idle state', () => {
      const block = new PushBlock(144, 80);
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('stays idle when enemies are alive', () => {
      const block = new PushBlock(144, 80);
      const link = makeLinkInfo({ posX: 128, facing: Direction.Right });
      for (let i = 0; i < 20; i++) {
        block.update(link, false);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('stays idle when Link is not aligned', () => {
      const block = new PushBlock(144, 80);
      const link = makeLinkInfo({ posX: 100, posY: 50, facing: Direction.Right });
      for (let i = 0; i < 20; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('stays idle when Link faces wrong direction', () => {
      const block = new PushBlock(144, 80);
      // Link to the left of block, should face Right to push — but faces Left
      const link = makeLinkInfo({ posX: 128, facing: Direction.Left });
      for (let i = 0; i < 20; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('stays idle when Link is too far away', () => {
      const block = new PushBlock(200, 80);
      const link = makeLinkInfo({ posX: 128, facing: Direction.Right });
      for (let i = 0; i < 20; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('stays idle when Link is not moving', () => {
      const block = new PushBlock(144, 80);
      const link = makeLinkInfo({ posX: 128, facing: Direction.Right, isMoving: false });
      for (let i = 0; i < 20; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('resets push timer when alignment breaks', () => {
      const block = new PushBlock(144, 80);
      const alignedLink = makeLinkInfo({ posX: 128, facing: Direction.Right });
      // Push for 10 frames (not enough)
      for (let i = 0; i < 10; i++) {
        block.update(alignedLink, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
      // Break alignment
      const misalignedLink = makeLinkInfo({ posX: 50, facing: Direction.Right });
      block.update(misalignedLink, true);
      // Resume pushing — should need full 16 frames again
      for (let i = 0; i < 15; i++) {
        block.update(alignedLink, true);
      }
      expect(block.state).toBe(PushBlockState.Idle);
    });

    it('transitions to Moving after 16 frames of pushing', () => {
      const block = new PushBlock(144, 80);
      const link = makeLinkInfo({ posX: 128, facing: Direction.Right });
      for (let i = 0; i < 16; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Moving);
    });
  });

  describe('moving state', () => {
    function createMovingBlock(dir: Direction): PushBlock {
      let link: PushBlockLinkInfo;
      let block: PushBlock;

      switch (dir) {
        case Direction.Right:
          block = new PushBlock(144, 80);
          link = makeLinkInfo({ posX: 128, posY: 77, facing: Direction.Right });
          break;
        case Direction.Left:
          block = new PushBlock(112, 80);
          link = makeLinkInfo({ posX: 128, posY: 77, facing: Direction.Left });
          break;
        case Direction.Down:
          block = new PushBlock(128, 96);
          link = makeLinkInfo({ posX: 128, posY: 80, facing: Direction.Down });
          break;
        case Direction.Up:
          block = new PushBlock(128, 64);
          link = makeLinkInfo({ posX: 128, posY: 77, facing: Direction.Up });
          break;
      }

      for (let i = 0; i < 16; i++) {
        block.update(link, true);
      }
      return block;
    }

    it('slides right by exactly 16px', () => {
      const block = createMovingBlock(Direction.Right);
      const startX = block.x;
      const dummyLink = makeLinkInfo();
      for (let i = 0; i < 16; i++) {
        block.update(dummyLink, true);
      }
      expect(block.x).toBe(startX + 16);
      expect(block.state).toBe(PushBlockState.Done);
    });

    it('slides left by exactly 16px', () => {
      const block = createMovingBlock(Direction.Left);
      const startX = block.x;
      const dummyLink = makeLinkInfo();
      for (let i = 0; i < 16; i++) {
        block.update(dummyLink, true);
      }
      expect(block.x).toBe(startX - 16);
      expect(block.state).toBe(PushBlockState.Done);
    });

    it('slides down by exactly 16px', () => {
      const block = createMovingBlock(Direction.Down);
      const startY = block.y;
      const dummyLink = makeLinkInfo();
      for (let i = 0; i < 16; i++) {
        block.update(dummyLink, true);
      }
      expect(block.y).toBe(startY + 16);
      expect(block.state).toBe(PushBlockState.Done);
    });

    it('slides up by exactly 16px', () => {
      const block = createMovingBlock(Direction.Up);
      const startY = block.y;
      const dummyLink = makeLinkInfo();
      for (let i = 0; i < 16; i++) {
        block.update(dummyLink, true);
      }
      expect(block.y).toBe(startY - 16);
      expect(block.state).toBe(PushBlockState.Done);
    });

    it('sets pushComplete when done', () => {
      const block = createMovingBlock(Direction.Right);
      expect(block.pushComplete).toBe(false);
      const dummyLink = makeLinkInfo();
      for (let i = 0; i < 16; i++) {
        block.update(dummyLink, true);
      }
      expect(block.pushComplete).toBe(true);
    });
  });

  describe('done state', () => {
    it('remains done after further updates', () => {
      const block = new PushBlock(144, 80);
      const link = makeLinkInfo({ posX: 128, facing: Direction.Right });
      // Push to moving
      for (let i = 0; i < 16; i++) {
        block.update(link, true);
      }
      // Slide to done
      for (let i = 0; i < 16; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Done);
      const xAfterDone = block.x;
      // Further updates don't change anything
      for (let i = 0; i < 10; i++) {
        block.update(link, true);
      }
      expect(block.state).toBe(PushBlockState.Done);
      expect(block.x).toBe(xAfterDone);
    });
  });

  describe('hitbox', () => {
    it('returns a 16×16 rect at block position', () => {
      const block = new PushBlock(100, 50);
      expect(block.getHitbox()).toEqual({ x: 100, y: 50, width: 16, height: 16 });
    });
  });
});
