import { describe, expect, it } from 'vitest';
import { horizonY, wrap } from './parallax.js';

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
