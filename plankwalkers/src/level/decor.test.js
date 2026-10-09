import { describe, expect, it } from 'vitest';
import { TILE, Z } from '../settings.js';
import {
  advanceDecorClock,
  buildDecorDrawList,
  createDecorVisual,
  decorFrameRect,
  decorOnScreen,
} from './decor.js';

/** @param {number} fw @param {number} fh */
function clip(fw, fh) {
  return { image: {}, fw, fh, n: 4, fps: 10 };
}

const PALM = clip(64, 64);
const LEFT = clip(51, 53);
const RIGHT = clip(52, 53);

/**
 * @param {string} k
 * @returns {import('./decor.js').ResolvedDecor | null}
 */
function resolve(k) {
  if (k === 'palm_back') return { z: Z.bgDecor, clip: PALM };
  if (k === 'palm_back_left') return { z: Z.bgDecor, clip: LEFT };
  if (k === 'palm_back_right') return { z: Z.fg, clip: RIGHT };
  return null;
}

describe('decorFrameRect', () => {
  it('anchors each packed palm on the cell bottom', () => {
    const out = { x: 0, y: 0, w: 0, h: 0 };
    decorFrameRect(4, 10, 64, 64, out);
    expect(out).toEqual({ x: 112, y: 288, w: 64, h: 64 });

    decorFrameRect(4, 10, 51, 53, out);
    expect(out.x).toBe(4 * TILE - 9.5);
    expect(out.y).toBe(11 * TILE - 53);
    expect(out.w).toBe(51);
    expect(out.h).toBe(53);

    decorFrameRect(4, 10, 52, 53, out);
    expect(out.x).toBe(4 * TILE - 10);
    expect(out.y).toBe(11 * TILE - 53);
    expect(out.w).toBe(52);
    expect(out.h).toBe(53);
  });

  it('allows a negative cell', () => {
    const out = { x: 0, y: 0, w: 0, h: 0 };
    decorFrameRect(-1, -1, 64, 64, out);
    expect(out).toEqual({ x: -48, y: -64, w: 64, h: 64 });
  });
});

describe('decorOnScreen', () => {
  const viewW = 120;
  const viewH = 80;

  it('keeps a crown that hangs into the view while its cell does not', () => {
    const rect = { x: 0, y: 0, w: 0, h: 0 };
    // Cell column 4 starts at 128, past a 120-wide view. The 64px frame
    // extends 16px left of the cell, so its crown is still inside.
    decorFrameRect(4, 2, 64, 64, rect);
    expect(rect.x).toBe(112);
    expect(4 * TILE).toBeGreaterThanOrEqual(viewW);
    expect(decorOnScreen(rect, 0, 0, viewW, viewH)).toBe(true);
  });

  it('rejects a sprite that only touches the right or bottom edge', () => {
    const rect = { x: 100, y: 40, w: 20, h: 40 };
    expect(decorOnScreen(rect, 0, 0, 100, 80)).toBe(false);
    expect(decorOnScreen({ x: 0, y: 80, w: 10, h: 10 }, 0, 0, 100, 80)).toBe(false);
  });

  it('keeps a sprite that crosses the left or top edge', () => {
    const rect = { x: -48, y: -32, w: 64, h: 64 };
    expect(decorOnScreen(rect, 0, 0, 100, 80)).toBe(true);
  });
});

describe('buildDecorDrawList', () => {
  it('orders a copy by z, row and column and leaves the records alone', () => {
    const records = [
      { k: 'palm_back', c: 2, r: 1 },
      { k: 'palm_back_right', c: 0, r: 0 },
      { k: 'palm_back', c: 0, r: 0 },
      { k: 'nope', c: 9, r: 9 },
      { k: 'palm_back_left', c: 1, r: 0 },
    ];
    const before = records.map((rec) => rec);
    /** @type {import('./decor.js').DecorItem[]} */
    const items = [];
    /** @type {import('./decor.js').DecorClock[]} */
    const clocks = [];
    const count = buildDecorDrawList(records, resolve, items, clocks);
    expect(records.map((rec) => rec)).toEqual(before);
    expect(records[0]).toBe(before[0]);
    expect(items.slice(0, count).map((item) => [item.z, item.r, item.c, item.k])).toEqual([
      [Z.bgDecor, 0, 0, 'palm_back'],
      [Z.bgDecor, 0, 1, 'palm_back_left'],
      [Z.bgDecor, 1, 2, 'palm_back'],
      [Z.fg, 0, 0, 'palm_back_right'],
    ]);
  });

  it('keeps source order when z, row and column match', () => {
    const records = [
      { k: 'palm_back', c: 3, r: 3 },
      { k: 'palm_back_left', c: 3, r: 3 },
    ];
    /** @type {import('./decor.js').DecorItem[]} */
    const items = [];
    const count = buildDecorDrawList(records, resolve, items, []);
    expect(items.slice(0, count).map((item) => item.k)).toEqual([
      'palm_back',
      'palm_back_left',
    ]);
  });

  it('reuses the item pool and replaces a same-length kind', () => {
    /** @type {import('./decor.js').DecorItem[]} */
    const items = [];
    /** @type {import('./decor.js').DecorClock[]} */
    const clocks = [];
    buildDecorDrawList([{ k: 'palm_back', c: 4, r: 4 }], resolve, items, clocks);
    expect(items).toHaveLength(1);
    expect(items[0].clip).toBe(PALM);
    buildDecorDrawList([{ k: 'palm_back_left', c: 4, r: 4 }], resolve, items, clocks);
    expect(items).toHaveLength(1);
    expect(items[0].k).toBe('palm_back_left');
    expect(items[0].clip).toBe(LEFT);
    expect(items[0].w).toBe(51);
    expect(items[0].h).toBe(53);
    buildDecorDrawList([], resolve, items, clocks);
    expect(items).toHaveLength(1);
  });
});

describe('createDecorVisual', () => {
  it('advances each placed kind once per update', () => {
    const visual = createDecorVisual(resolve);
    visual.sync([
      { k: 'palm_back', c: 0, r: 0 },
      { k: 'palm_back', c: 1, r: 0 },
      { k: 'palm_back_left', c: 2, r: 0 },
    ]);
    visual.update(0.1);
    expect(visual.frameOf('palm_back')).toBe(1);
    expect(visual.frameOf('palm_back_left')).toBe(1);
    expect(visual.frameOf('palm_back_right')).toBeNull();
  });

  it('does not keep a replaced kind animating', () => {
    const visual = createDecorVisual(resolve);
    visual.sync([{ k: 'palm_back', c: 4, r: 4 }]);
    visual.update(0.1);
    visual.sync([{ k: 'palm_back_left', c: 4, r: 4 }]);
    const frozen = visual.frameOf('palm_back');
    visual.update(0.1);
    expect(visual.frameOf('palm_back')).toBe(frozen);
    expect(visual.frameOf('palm_back_left')).toBe(1);
  });
});

describe('advanceDecorClock', () => {
  it('wraps the same way as a sprite clip', () => {
    const clock = { k: 'palm_back', frameIndex: 3.5, fps: 10, n: 4, used: false };
    advanceDecorClock(clock, 0.1);
    expect(clock.frameIndex).toBeCloseTo(0.5);
  });
});
