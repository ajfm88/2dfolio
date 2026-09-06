import { describe, it, expect } from 'vitest';
import { ItemPickup } from '../../../src/objects/pickups/item-pickup.js';

describe('ItemPickup', () => {
  it('starts active', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    expect(pickup.isActive).toBe(true);
    expect(pickup.isCollected).toBe(false);
    expect(pickup.itemId).toBe(0x22);
  });

  it('expires after enough updates', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    // 255 ticks × 2 frames = 510 update calls
    for (let i = 0; i < 510; i++) {
      pickup.update();
    }
    expect(pickup.isActive).toBe(false);
  });

  it('becomes inactive on collect', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    pickup.collect();
    expect(pickup.isActive).toBe(false);
    expect(pickup.isCollected).toBe(true);
  });

  it('detects collision with overlapping rect', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    const overlapping = { x: 90, y: 75, width: 16, height: 16 };
    expect(pickup.checkCollision(overlapping)).toBe(true);
  });

  it('rejects collision with non-overlapping rect', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    const far = { x: 200, y: 200, width: 16, height: 16 };
    expect(pickup.checkCollision(far)).toBe(false);
  });

  it('rejects collision when collected', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    pickup.collect();
    const overlapping = { x: 90, y: 75, width: 16, height: 16 };
    expect(pickup.checkCollision(overlapping)).toBe(false);
  });
});

describe('ItemPickup rendering', () => {
  // items.png is 400×160 = 10 cols × 4 rows of 40×40, cropped to the centre 16×16.
  const fakeSheet = { width: 400, height: 160 } as unknown as HTMLCanvasElement;

  function captureDraw(pickup: ItemPickup): number[][] {
    const calls: number[][] = [];
    const ctx = { drawImage: (_img: unknown, ...a: number[]) => calls.push(a) };
    pickup.render(ctx as unknown as CanvasRenderingContext2D, fakeSheet);
    return calls;
  }

  // Regression: the constructor used to be (x, y, itemId) while every call site
  // passed (itemId, x, y), so itemId held a world Y coordinate, no grid cell
  // matched, and dropped items drew nothing at all.
  it('draws the heart cell at the pickup position', () => {
    const calls = captureDraw(new ItemPickup(0x22, 100, 80));
    expect(calls).toHaveLength(1);
    const [sx, sy, sw, sh, dx, dy] = calls[0]!;
    expect([sx, sy]).toEqual([6 * 40 + 12, 3 * 40 + 12]); // Heart = col 6, row 3
    expect([sw, sh]).toEqual([16, 16]);
    expect([dx, dy]).toEqual([100, 80]);
  });

  it('draws a distinct cell per item id', () => {
    const heart = captureDraw(new ItemPickup(0x22, 0, 0))[0]!;
    const fairy = captureDraw(new ItemPickup(0x23, 0, 0))[0]!;
    expect(heart.slice(0, 2)).not.toEqual(fairy.slice(0, 2));
  });

  it('draws nothing once collected', () => {
    const pickup = new ItemPickup(0x22, 100, 80);
    pickup.collect();
    expect(captureDraw(pickup)).toHaveLength(0);
  });
});
