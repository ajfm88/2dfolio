import { describe, it, expect } from 'vitest';
import { InventorySlide, SlidePhase } from '../../src/ui/inventory-slide.js';

describe('InventorySlide', () => {
  it('starts idle', () => {
    const slide = new InventorySlide();
    expect(slide.phase).toBe(SlidePhase.Idle);
    expect(slide.isVisible).toBe(false);
    expect(slide.isActive).toBe(false);
    expect(slide.offset).toBe(0);
  });

  it('transitions to SlideDown on open()', () => {
    const slide = new InventorySlide();
    slide.open();
    expect(slide.phase).toBe(SlidePhase.SlideDown);
    expect(slide.isVisible).toBe(true);
    expect(slide.isActive).toBe(false);
  });

  it('advances offset by 3px per frame during slide down', () => {
    const slide = new InventorySlide();
    slide.open();
    slide.update();
    expect(slide.offset).toBe(3);
    slide.update();
    expect(slide.offset).toBe(6);
  });

  it('becomes Active when offset reaches play area height (176)', () => {
    const slide = new InventorySlide();
    slide.open();
    // 176 / 3 = 58.67, so need 59 updates (59 * 3 = 177, clamped to 176)
    for (let i = 0; i < 59; i++) {
      slide.update();
    }
    expect(slide.phase).toBe(SlidePhase.Active);
    expect(slide.isActive).toBe(true);
    expect(slide.offset).toBe(176);
  });

  it('slides up on close()', () => {
    const slide = new InventorySlide();
    slide.open();
    for (let i = 0; i < 59; i++) slide.update();
    expect(slide.isActive).toBe(true);

    slide.close();
    expect(slide.phase).toBe(SlidePhase.SlideUp);
    slide.update();
    expect(slide.offset).toBe(173);
  });

  it('returns to Idle when slide up completes', () => {
    const slide = new InventorySlide();
    slide.open();
    for (let i = 0; i < 59; i++) slide.update();
    slide.close();
    for (let i = 0; i < 59; i++) slide.update();
    expect(slide.phase).toBe(SlidePhase.Idle);
    expect(slide.isVisible).toBe(false);
  });

  it('ignores open() when not idle', () => {
    const slide = new InventorySlide();
    slide.open();
    slide.update();
    slide.open(); // should be ignored
    expect(slide.offset).toBe(3); // not reset
  });

  it('ignores close() when not active', () => {
    const slide = new InventorySlide();
    slide.close(); // should be ignored — still idle
    expect(slide.phase).toBe(SlidePhase.Idle);
  });
});
