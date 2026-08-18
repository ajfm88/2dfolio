import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import { OVERWORLD_COLS, TILE_SIZE } from '../../src/core/constants.js';
import { getScreenCaveIndex, isCaveEntranceTile } from '../../src/data/cave-data.js';
import { CurtainEffect } from '../../src/world/curtain-effect.js';
import { CaveRoom, type CaveContents } from '../../src/world/cave-room.js';
import { Link } from '../../src/objects/player/link.js';

describe('cave-data', () => {
  describe('getScreenCaveIndex', () => {
    it('returns 0 for the sword cave screen (119)', () => {
      expect(getScreenCaveIndex(119)).toBe(0);
    });

    it('returns null for screens without caves', () => {
      expect(getScreenCaveIndex(8)).toBeNull();
      expect(getScreenCaveIndex(115)).toBeNull();
    });

    it('returns correct index for known cave screens', () => {
      expect(getScreenCaveIndex(6)).toBe(1);
      expect(getScreenCaveIndex(9)).toBe(3);
      expect(getScreenCaveIndex(117)).toBe(9);
    });
  });

  describe('isCaveEntranceTile', () => {
    it('returns true for cave entrance tile 12', () => {
      expect(isCaveEntranceTile(12)).toBe(true);
    });

    it('returns false for regular tiles', () => {
      expect(isCaveEntranceTile(0)).toBe(false);
      expect(isCaveEntranceTile(14)).toBe(false);
      expect(isCaveEntranceTile(27)).toBe(false);
    });
  });
});

describe('CurtainEffect', () => {
  describe('close', () => {
    it('starts not done', () => {
      const c = new CurtainEffect('close');
      expect(c.done).toBe(false);
    });

    it('completes after 8 steps × 4 frames = 32 frames', () => {
      const c = new CurtainEffect('close');
      let frames = 0;
      while (!c.done) {
        c.update();
        frames++;
        if (frames > 100) break;
      }
      expect(frames).toBe(32);
    });
  });

  describe('open', () => {
    it('starts not done', () => {
      const c = new CurtainEffect('open');
      expect(c.done).toBe(false);
    });

    it('completes after 8 steps × 4 frames = 32 frames', () => {
      const c = new CurtainEffect('open');
      let frames = 0;
      while (!c.done) {
        c.update();
        frames++;
        if (frames > 100) break;
      }
      expect(frames).toBe(32);
    });
  });
});

describe('CaveRoom', () => {
  function makeCaveContents(itemId: number): CaveContents {
    return {
      caveIndex: 0,
      items: [63, itemId, 63],
      itemFlags: [0, 0, 1],
      prices: [0, 0, 0],
    };
  }

  // Minimal stubs for image params (rendering not tested)
  const stubImage = {} as HTMLImageElement;
  const stubFont = { drawString: () => {} } as any;

  describe('sword cave contents', () => {
    it('has WoodSword (id 1) as center item', () => {
      const contents = makeCaveContents(1);
      expect(contents.items[1]).toBe(1);
    });
  });

  describe('initLink', () => {
    it('places Link at cave entrance facing up', () => {
      const contents = makeCaveContents(1);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, 119);
      const link = new Link(120, 80);
      room.initLink(link);
      expect(link.facing).toBe(Direction.Up);
      expect(link.posY).toBeGreaterThan(100);
    });
  });

  describe('exit detection', () => {
    it('requests exit when Link reaches bottom', () => {
      const contents = makeCaveContents(63);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, 119);
      const link = new Link(112, 160);
      // Skip walk-in phase
      for (let i = 0; i < 50; i++) room.update(link);
      room.update(link);
      expect(room.exitRequested).toBe(true);
    });
  });

  describe('returnScreenId', () => {
    it('returns the source screen ID', () => {
      const contents = makeCaveContents(1);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, 119);
      expect(room.returnScreenId).toBe(119);
    });
  });
});
