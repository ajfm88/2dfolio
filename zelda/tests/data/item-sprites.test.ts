import { describe, it, expect } from 'vitest';
import { getItemSpritePos, ITEM_CELL_SIZE } from '../../src/data/item-sprites.js';

describe('item-sprites', () => {
  it('returns position for WoodSword (0x01)', () => {
    const pos = getItemSpritePos(0x01);
    expect(pos).not.toBeNull();
    expect(pos!.col).toBeGreaterThanOrEqual(0);
    expect(pos!.row).toBeGreaterThanOrEqual(0);
  });

  it('returns position for Bomb (0x00)', () => {
    const pos = getItemSpritePos(0x00);
    expect(pos).not.toBeNull();
  });

  it('returns position for HeartContainer (0x1A)', () => {
    const pos = getItemSpritePos(0x1a);
    expect(pos).not.toBeNull();
  });

  it('returns position for Key (0x19)', () => {
    const pos = getItemSpritePos(0x19);
    expect(pos).not.toBeNull();
  });

  it('returns null for unknown item ID', () => {
    expect(getItemSpritePos(0x3f)).toBeNull();
    expect(getItemSpritePos(0xff)).toBeNull();
  });

  it('all mapped items have valid grid positions', () => {
    const knownIds = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0f, 0x10,
                      0x11, 0x12, 0x13, 0x14, 0x15, 0x18, 0x19, 0x1a,
                      0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x22, 0x23];
    for (const id of knownIds) {
      const pos = getItemSpritePos(id);
      expect(pos, `item 0x${id.toString(16)}`).not.toBeNull();
      expect(pos!.col).toBeLessThan(10);
      expect(pos!.row).toBeLessThan(4);
    }
  });

  it('ITEM_CELL_SIZE is 40', () => {
    expect(ITEM_CELL_SIZE).toBe(40);
  });
});
