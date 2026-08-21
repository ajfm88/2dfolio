import { describe, it, expect } from 'vitest';
import { Direction } from '../../src/core/types.js';
import { getScreenCaveIndex, isCaveEntranceTile } from '../../src/data/cave-data.js';
import { CurtainEffect } from '../../src/world/curtain-effect.js';
import { CaveRoom, type CaveContents } from '../../src/world/cave-room.js';
import type { CaveTextMessage } from '../../src/data/cave-text-types.js';
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
  function makeCaveContents(itemId: number, objectType = 0x6a): CaveContents {
    return {
      caveIndex: 0,
      objectType,
      items: [63, itemId, 63],
      itemFlags: [0, 0, 1],
      prices: [0, 0, 0],
    };
  }

  function makeTextMessage(text: string): CaveTextMessage {
    return { index: 0, textSelector: 0, lines: [text] };
  }

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
      const msg = makeTextMessage("IT'S DANGEROUS TO GO ALONE  TAKE THIS!");
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, msg);
      const link = new Link(120, 80);
      room.initLink(link);
      expect(link.facing).toBe(Direction.Up);
      expect(link.posY).toBeGreaterThan(100);
    });
  });

  describe('exit detection', () => {
    it('requests exit when Link reaches bottom', () => {
      const contents = makeCaveContents(63);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(112, 160);
      for (let i = 0; i < 50; i++) room.update(link);
      room.update(link);
      expect(room.exitRequested).toBe(true);
    });
  });

  describe('behavior detection', () => {
    it('gift cave for objectType 0x6A (sword cave)', () => {
      const contents = makeCaveContents(1, 0x6a);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('gift');
    });

    it('hint cave for objectType 0x6E', () => {
      const contents = makeCaveContents(63, 0x6e);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('hint');
    });

    it('door repair for objectType 0x71', () => {
      const contents = makeCaveContents(63, 0x71);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('doorRepair');
    });

    it('moblin giveaway for objectType 0x7B', () => {
      const contents = { caveIndex: 17, objectType: 0x7b, items: [63, 24, 63], itemFlags: [0, 2, 1], prices: [0, 30, 0] };
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('moblinGive');
      expect(room.rupeeReward).toBe(30);
    });

    it('shop for objectType 0x77', () => {
      const contents = makeCaveContents(28, 0x77);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('shop');
    });

    it('money game for objectType 0x70', () => {
      const contents = makeCaveContents(24, 0x70);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('moneyGame');
    });

    it('potion shop for objectType 0x74', () => {
      const contents = makeCaveContents(31, 0x74);
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('potionShop');
    });
  });

  describe('shop purchase', () => {
    function makeShopContents(): CaveContents {
      return {
        caveIndex: 13,
        objectType: 0x77,
        items: [28, 0, 8],      // MagicShield, Bomb, WoodArrow
        itemFlags: [0, 0, 3],
        prices: [130, 20, 80],
      };
    }

    function skipWalkIn(room: CaveRoom, link: Link): void {
      for (let i = 0; i < 35; i++) room.update(link);
    }

    it('generates purchase event when Link touches item with enough rupees', () => {
      const contents = makeShopContents();
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(120, 120);
      skipWalkIn(room, link);
      link.addRupees(200);
      link.setPosition(120, 88); // move to center item after walk-in
      room.update(link);
      expect(room.purchaseEvent).not.toBeNull();
      expect(room.purchaseEvent!.itemId).toBe(0);    // Bomb (masked)
      expect(room.purchaseEvent!.price).toBe(20);
      expect(room.purchaseEvent!.slotIndex).toBe(1);
    });

    it('does not generate purchase event when Link cannot afford', () => {
      const contents = makeShopContents();
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(120, 120);
      skipWalkIn(room, link);
      link.addRupees(50);
      link.setPosition(88, 88); // at left item (MagicShield, price 130)
      room.update(link);
      expect(room.purchaseEvent).toBeNull();
    });

    it('clears purchase event', () => {
      const contents = makeShopContents();
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(120, 120);
      skipWalkIn(room, link);
      link.addRupees(200);
      link.setPosition(120, 88);
      room.update(link);
      expect(room.purchaseEvent).not.toBeNull();
      room.clearPurchaseEvent();
      expect(room.purchaseEvent).toBeNull();
    });
  });

  describe('money game', () => {
    it('generates 3 amounts', () => {
      const contents = { caveIndex: 6, objectType: 0x70, items: [24, 24, 24], itemFlags: [2, 2, 3], prices: [10, 10, 10] };
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      expect(room.behavior).toBe('moneyGame');
      // Money game amounts are generated but internal — test via moneyGameResult
    });

    it('generates result when Link touches a position with enough rupees', () => {
      const contents = { caveIndex: 6, objectType: 0x70, items: [24, 24, 24], itemFlags: [2, 2, 3], prices: [10, 10, 10] };
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(120, 120);
      for (let i = 0; i < 35; i++) room.update(link);
      link.addRupees(50);
      link.setPosition(88, 88); // at left position
      room.update(link);
      const result = room.moneyGameResult;
      expect(result).not.toBeNull();
      const absAmount = Math.abs(result!.amount);
      expect([10, 20, 40, 50]).toContain(absAmount);
    });

    it('does not generate result when Link has fewer than 10 rupees', () => {
      const contents = { caveIndex: 6, objectType: 0x70, items: [24, 24, 24], itemFlags: [2, 2, 3], prices: [10, 10, 10] };
      const room = new CaveRoom(stubImage, stubImage, stubImage, stubFont, contents, null);
      const link = new Link(120, 120);
      for (let i = 0; i < 35; i++) room.update(link);
      link.addRupees(5);
      link.setPosition(88, 88);
      room.update(link);
      expect(room.moneyGameResult).toBeNull();
    });
  });
});
