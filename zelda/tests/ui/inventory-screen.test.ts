import { describe, it, expect } from 'vitest';
import { getNextOwnedSlot } from '../../src/ui/inventory-screen.js';
import { Inventory } from '../../src/objects/player/inventory.js';

describe('getNextOwnedSlot', () => {
  it('cycles to next owned slot going right', () => {
    const inv = new Inventory();
    inv.woodBoomerang = true;
    inv.candle = 1;
    inv.selectedBSlot = 0;
    const next = getNextOwnedSlot(inv, 0, 1);
    // Slot 1 (bomb) is gated on hasBombs, 2/3 need the bow — so candle is next
    expect(next).toBe(4);
  });

  it('cycles backward going left', () => {
    const inv = new Inventory();
    inv.woodBoomerang = true;
    inv.candle = 1;
    inv.selectedBSlot = 4;
    const next = getNextOwnedSlot(inv, 4, -1);
    // 4→3 skip→2 no bow→1 no bombs→0 boomerang
    expect(next).toBe(0);
  });

  it('always skips slot 3 (bow)', () => {
    const inv = new Inventory();
    inv.bow = true;
    inv.arrow = 1;
    inv.candle = 1;
    // From slot 2 going right: should skip 3 and land on 4
    const next = getNextOwnedSlot(inv, 2, 1);
    expect(next).toBe(4);
  });

  it('wraps around the 9 slots', () => {
    const inv = new Inventory();
    inv.wand = true; // slot 8
    inv.woodBoomerang = true; // slot 0
    // From slot 8 going right: wraps to 0
    const next = getNextOwnedSlot(inv, 8, 1);
    expect(next).toBe(0);
  });

  it('returns current slot if only one other owned item', () => {
    const inv = new Inventory();
    inv.wand = true; // slot 8 only
    const next = getNextOwnedSlot(inv, 8, 1);
    // Nothing else is owned, so the wrap lands back on the wand
    expect(next).toBe(8);
  });

  it('slot 1 only selectable when bombs are owned', () => {
    const inv = new Inventory();
    inv.wand = true; // slot 8, so there is always somewhere else to land
    // Without bombs, going right from 0 skips slot 1 entirely
    expect(getNextOwnedSlot(inv, 0, 1)).toBe(8);
    // Owning bombs opens the slot up
    inv.hasBombs = true;
    expect(getNextOwnedSlot(inv, 0, 1)).toBe(1);
  });

  it('slot 2 only selectable when bow is owned', () => {
    const inv = new Inventory();
    inv.arrow = 1;
    inv.wand = true;
    // Arrow without bow: from slot 1 going right, should skip 2 and 3
    const next = getNextOwnedSlot(inv, 1, 1);
    expect(next).toBe(8); // wand (skips 2=no bow, 3=always skip, 4-7 empty)

    // With bow: slot 2 is reachable
    inv.bow = true;
    const next2 = getNextOwnedSlot(inv, 1, 1);
    expect(next2).toBe(2);
  });
});
