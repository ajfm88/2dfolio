import { describe, it, expect } from 'vitest';
import {
  computeCanvasLayout,
  reservedBottomFor,
} from '../../src/render/canvas-layout.js';

// A representative high-DPR phone. NOTE: 2.625 is an assumed value, not measured
// from the reporter's Galaxy Note 10+ — that device is more likely dpr 3.5 at a
// 412px viewport. The maths is what's under test here, not the device profile.
const PHONE_DPR = 2.625;
const PAD_RESERVE = 260;

describe('computeCanvasLayout — device-pixel scaling', () => {
  it('reaches 4x at dpr 2.625 in portrait instead of collapsing to 1x', () => {
    const layout = computeCanvasLayout({
      viewportW: 412,
      viewportH: 800,
      dpr: PHONE_DPR,
      reservedBottom: PAD_RESERVE,
    });

    expect(layout.scale).toBe(4);
    // 256 * 4 / 2.625 — fills ~95% of the 412px width.
    expect(layout.cssW).toBeCloseTo(390.1, 1);
    expect(layout.cssH).toBeCloseTo(365.7, 1);
  });

  it('lands each NES pixel on a whole number of device pixels', () => {
    for (const dpr of [1, 1.5, 2, 2.625, 3]) {
      const { scale, cssW } = computeCanvasLayout({
        viewportW: 412,
        viewportH: 800,
        dpr,
        reservedBottom: PAD_RESERVE,
      });
      expect(Number.isInteger(scale)).toBe(true);
      expect(cssW * dpr).toBeCloseTo(256 * scale, 6);
    }
  });

  it('centres the canvas in the space above the pads', () => {
    const layout = computeCanvasLayout({
      viewportW: 412,
      viewportH: 800,
      dpr: PHONE_DPR,
      reservedBottom: PAD_RESERVE,
    });

    expect(layout.left).toBeCloseTo((412 - layout.cssW) / 2, 3);
    // Centred within 800 - 260, so the whole canvas clears the pad band.
    expect(layout.top).toBeCloseTo((800 - PAD_RESERVE - layout.cssH) / 2, 3);
    expect(layout.top + layout.cssH).toBeLessThanOrEqual(800 - PAD_RESERVE);
  });

  it('still scales up on a desktop viewport at dpr 1', () => {
    const layout = computeCanvasLayout({
      viewportW: 1920,
      viewportH: 1080,
      dpr: 1,
      reservedBottom: 0,
    });

    expect(layout.scale).toBe(4);
    expect(layout.cssW).toBe(1024);
    expect(layout.cssH).toBe(960);
  });

  it('never returns a scale below 1, even when the canvas cannot fit', () => {
    for (const [w, h] of [[320, 400], [200, 200], [100, 100]] as const) {
      expect(computeCanvasLayout({
        viewportW: w, viewportH: h, dpr: 1, reservedBottom: 0,
      }).scale).toBe(1);
    }
  });

  it('subtracts safe-area insets from the available box', () => {
    const insets = { top: 40, right: 10, bottom: 20, left: 10 };
    const layout = computeCanvasLayout({
      viewportW: 412,
      viewportH: 800,
      dpr: PHONE_DPR,
      reservedBottom: 0,
      insets,
    });

    expect(layout.left).toBeGreaterThanOrEqual(insets.left);
    expect(layout.top).toBeGreaterThanOrEqual(insets.top);
  });

  it('treats a zero or bogus dpr as 1 rather than dividing by zero', () => {
    const layout = computeCanvasLayout({
      viewportW: 1920, viewportH: 1080, dpr: 0, reservedBottom: 0,
    });
    expect(Number.isFinite(layout.cssW)).toBe(true);
    expect(layout.scale).toBe(4);
  });
});

describe('reservedBottomFor — pads only steal height in portrait', () => {
  it('reserves the pad band in portrait', () => {
    expect(reservedBottomFor(412, 800, PAD_RESERVE)).toBe(PAD_RESERVE);
  });

  it('reserves nothing in landscape, where the pads sit in the side margins', () => {
    expect(reservedBottomFor(869, 412, PAD_RESERVE)).toBe(0);
  });

  it('keeps the game full-size in landscape rather than crushing it', () => {
    const landscape = computeCanvasLayout({
      viewportW: 869,
      viewportH: 412,
      dpr: PHONE_DPR,
      reservedBottom: reservedBottomFor(869, 412, PAD_RESERVE),
    });

    expect(landscape.scale).toBe(4);
    // Would be a ~150px strip if the pad band were subtracted here.
    expect(landscape.cssH).toBeGreaterThan(300);
  });

  it('reserves nothing when there are no pads (desktop)', () => {
    expect(reservedBottomFor(412, 800, 0)).toBe(0);
  });
});
