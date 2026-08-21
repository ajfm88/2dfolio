import { describe, it, expect } from 'vitest';
import { ItemPickup } from '../../../src/objects/pickups/item-pickup.js';

describe('ItemPickup', () => {
  it('starts active', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    expect(pickup.isActive).toBe(true);
    expect(pickup.isCollected).toBe(false);
    expect(pickup.itemId).toBe(0x22);
  });

  it('expires after enough updates', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    // 255 ticks × 2 frames = 510 update calls
    for (let i = 0; i < 510; i++) {
      pickup.update();
    }
    expect(pickup.isActive).toBe(false);
  });

  it('becomes inactive on collect', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    pickup.collect();
    expect(pickup.isActive).toBe(false);
    expect(pickup.isCollected).toBe(true);
  });

  it('detects collision with overlapping rect', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    const overlapping = { x: 90, y: 75, width: 16, height: 16 };
    expect(pickup.checkCollision(overlapping)).toBe(true);
  });

  it('rejects collision with non-overlapping rect', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    const far = { x: 200, y: 200, width: 16, height: 16 };
    expect(pickup.checkCollision(far)).toBe(false);
  });

  it('rejects collision when collected', () => {
    const pickup = new ItemPickup(100, 80, 0x22);
    pickup.collect();
    const overlapping = { x: 90, y: 75, width: 16, height: 16 };
    expect(pickup.checkCollision(overlapping)).toBe(false);
  });
});
