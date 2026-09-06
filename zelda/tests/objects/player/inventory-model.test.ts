import { describe, it, expect } from 'vitest';
import { Inventory } from '../../../src/objects/player/inventory.js';

describe('Inventory', () => {
  describe('default state', () => {
    it('starts with no items', () => {
      const inv = new Inventory();
      expect(inv.sword).toBe(0);
      expect(inv.arrow).toBe(0);
      expect(inv.candle).toBe(0);
      expect(inv.bow).toBe(false);
      expect(inv.flute).toBe(false);
      expect(inv.food).toBe(false);
      expect(inv.wand).toBe(false);
      expect(inv.raft).toBe(false);
      expect(inv.book).toBe(false);
      expect(inv.ladder).toBe(false);
      expect(inv.magicKey).toBe(false);
      expect(inv.bracelet).toBe(false);
      expect(inv.magicShield).toBe(false);
      expect(inv.triforce).toBe(0);
      expect(inv.selectedBSlot).toBe(0);
    });
  });

  describe('hasSelectableItem', () => {
    it('slot 0: boomerang pseudo-slot (wood or magic)', () => {
      const inv = new Inventory();
      expect(inv.hasSelectableItem(0)).toBe(false);
      inv.woodBoomerang = true;
      expect(inv.hasSelectableItem(0)).toBe(true);
      inv.woodBoomerang = false;
      inv.magicBoomerang = true;
      expect(inv.hasSelectableItem(0)).toBe(true);
    });

    it('slot 2: arrow requires bow', () => {
      const inv = new Inventory();
      inv.arrow = 1;
      expect(inv.hasSelectableItem(2)).toBe(false);
      inv.bow = true;
      expect(inv.hasSelectableItem(2)).toBe(true);
    });

    it('slot 3: bow is never selectable', () => {
      const inv = new Inventory();
      inv.bow = true;
      expect(inv.hasSelectableItem(3)).toBe(false);
    });

    it('slot 4: candle', () => {
      const inv = new Inventory();
      expect(inv.hasSelectableItem(4)).toBe(false);
      inv.candle = 1;
      expect(inv.hasSelectableItem(4)).toBe(true);
    });

    it('slot 7: potion or letter', () => {
      const inv = new Inventory();
      expect(inv.hasSelectableItem(7)).toBe(false);
      inv.letter = 1;
      expect(inv.hasSelectableItem(7)).toBe(true);
      inv.letter = 0;
      inv.potion = 1;
      expect(inv.hasSelectableItem(7)).toBe(true);
    });
  });

  describe('getEquippedBItemId', () => {
    it('returns null when slot is empty', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 4;
      expect(inv.getEquippedBItemId()).toBeNull();
    });

    it('returns magic boomerang ID when magic boomerang owned', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 0;
      inv.magicBoomerang = true;
      expect(inv.getEquippedBItemId()).toBe(0x1e);
    });

    it('returns wood boomerang ID when only wood owned', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 0;
      inv.woodBoomerang = true;
      expect(inv.getEquippedBItemId()).toBe(0x1d);
    });

    it('returns bomb ID for slot 1', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 1;
      inv.hasBombs = true; // slot 1 is gated on owning bombs
      expect(inv.getEquippedBItemId()).toBe(0x00);
    });

    it('returns candle ID based on level', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 4;
      inv.candle = 1;
      expect(inv.getEquippedBItemId()).toBe(0x06);
      inv.candle = 2;
      expect(inv.getEquippedBItemId()).toBe(0x07);
    });

    it('returns potion ID or letter fallback for slot 7', () => {
      const inv = new Inventory();
      inv.selectedBSlot = 7;
      inv.letter = 1;
      expect(inv.getEquippedBItemId()).toBe(0x15);
      inv.potion = 1;
      expect(inv.getEquippedBItemId()).toBe(0x1f);
      inv.potion = 2;
      expect(inv.getEquippedBItemId()).toBe(0x20);
    });
  });

  describe('getSwordItemId', () => {
    it('returns null with no sword', () => {
      const inv = new Inventory();
      expect(inv.getSwordItemId()).toBeNull();
    });

    it('returns correct ID per sword level', () => {
      const inv = new Inventory();
      inv.sword = 1;
      expect(inv.getSwordItemId()).toBe(1);
      inv.sword = 2;
      expect(inv.getSwordItemId()).toBe(2);
      inv.sword = 3;
      expect(inv.getSwordItemId()).toBe(3);
    });
  });
});
