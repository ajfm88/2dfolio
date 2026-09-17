import { describe, expect, it } from 'vitest';
import { horizonY, pickRecyclable, wrap } from './parallax.js';

/**
 * @param {number} cols
 * @param {number} rows
 * @param {number} [waterRow] row to fill with water; omit for empty
 */
function stub(cols, rows, waterRow) {
  const water = new Uint8Array(cols * rows);
  if (waterRow !== undefined) {
    for (let c = 0; c < cols; c++) water[waterRow * cols + c] = 1;
  }
  return { layers: { water }, cols, rows };
}

describe('horizonY', () => {
  it('uses the top of the first water row', () => {
    expect(horizonY(stub(40, 12, 11))).toBe(11 * 32);
  });

  it('uses a mid-grid water row', () => {
    expect(horizonY(stub(8, 12, 5))).toBe(5 * 32);
  });

  it('uses row 0 when water starts at the top', () => {
    expect(horizonY(stub(8, 12, 0))).toBe(0);
  });

  it('falls back to the bottom edge when water is empty', () => {
    expect(horizonY(stub(8, 12))).toBe(12 * 32);
  });
});

describe('wrap', () => {
  it('leaves 0 in range', () => {
    expect(wrap(0, 10)).toBe(0);
  });

  it('wraps a positive overflow', () => {
    expect(wrap(15, 10)).toBe(5);
  });

  it('wraps a negative offset', () => {
    expect(wrap(-1, 10)).toBe(9);
  });

  it('wraps x === w to 0', () => {
    expect(wrap(10, 10)).toBe(0);
  });
});

// Issue #3: recycle must only move a cloud that has fully exited the left edge,
// never a visible one, or clouds pop out mid-screen. period 1000, viewW 200.
describe('pickRecyclable', () => {
  it('returns -1 when every cloud is on screen or straddling the left edge', () => {
    const clouds = [
      { x: 50, w: 30 }, // s = 50, fully visible
      { x: 990, w: 30 }, // s = -10, straddling the left edge (partly visible)
    ];
    expect(pickRecyclable(clouds, 0, 200, 1000, 1)).toBe(-1);
  });

  it('never picks a visible cloud when an exited one is available', () => {
    const clouds = [
      { x: 10, w: 30 }, // s = 10, visible near the left edge (the old bug's pick)
      { x: 950, w: 30 }, // s = -50, fully off the left edge
    ];
    expect(pickRecyclable(clouds, 0, 200, 1000, 1)).toBe(1);
  });

  it('picks the most recently exited among several off-screen clouds', () => {
    const clouds = [
      { x: 900, w: 30 }, // s = -100
      { x: 950, w: 30 }, // s = -50, closest to the edge → most recent
      { x: 250, w: 30 }, // s = -750, deep in the gap, about to re-enter right
    ];
    expect(pickRecyclable(clouds, 0, 200, 1000, 1)).toBe(1);
  });

  it('honours camX and the parallax factor when computing screen x', () => {
    // camX * factor = 500. x=560 → s=60 (visible); x=450 → s=-50 (exited).
    const clouds = [
      { x: 560, w: 40 },
      { x: 450, w: 40 },
    ];
    expect(pickRecyclable(clouds, 1000, 200, 1000, 0.5)).toBe(1);
  });
});
