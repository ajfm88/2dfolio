import { describe, expect, it } from 'vitest';
import { FIXED_DT, WIPE_CLOSE, WIPE_FADE, WIPE_HOLD, WIPE_OPEN } from '../settings.js';
import { createTransition, fadeAlpha, holeFraction } from './transition.js';

/**
 * Step a transition until it ends, recording when each callback fired.
 * @param {boolean} reducedMotion
 */
function run(reducedMotion) {
  const tr = createTransition();
  /** @type {{ cover: number[], end: number[] }} */
  const log = { cover: [], end: [] };
  let t = 0;
  tr.start({
    reducedMotion,
    onCover: () => log.cover.push(t),
    onEnd: () => log.end.push(t),
  });
  let steps = 0;
  while (tr.active && steps < 1000) {
    t += FIXED_DT;
    tr.update(FIXED_DT);
    steps++;
  }
  return { tr, log };
}

describe('holeFraction', () => {
  it('closes, holds shut, then opens', () => {
    expect(holeFraction(0)).toBe(1);
    expect(holeFraction(WIPE_CLOSE / 2)).toBeCloseTo(0.5);
    expect(holeFraction(WIPE_CLOSE)).toBe(0);
    expect(holeFraction(WIPE_CLOSE + WIPE_HOLD / 2)).toBe(0);
    expect(holeFraction(WIPE_CLOSE + WIPE_HOLD + WIPE_OPEN / 2)).toBeCloseTo(0.5);
    expect(holeFraction(WIPE_CLOSE + WIPE_HOLD + WIPE_OPEN)).toBe(1);
  });
});

describe('fadeAlpha', () => {
  it('fades in to full cover, then out', () => {
    expect(fadeAlpha(0)).toBe(0);
    expect(fadeAlpha(WIPE_FADE / 2)).toBeCloseTo(0.5);
    expect(fadeAlpha(WIPE_FADE)).toBe(1);
    expect(fadeAlpha(WIPE_FADE * 1.5)).toBeCloseTo(0.5);
    expect(fadeAlpha(WIPE_FADE * 2)).toBe(0);
  });
});

describe('createTransition', () => {
  it('wipe: onCover once when shut, onEnd once when open again', () => {
    const { tr, log } = run(false);
    expect(log.cover).toHaveLength(1);
    expect(log.end).toHaveLength(1);
    expect(log.cover[0]).toBeGreaterThanOrEqual(WIPE_CLOSE - 1e-9);
    expect(log.cover[0]).toBeLessThan(WIPE_CLOSE + FIXED_DT * 1.5);
    const total = WIPE_CLOSE + WIPE_HOLD + WIPE_OPEN;
    expect(log.end[0]).toBeGreaterThanOrEqual(total - 1e-9);
    expect(log.end[0]).toBeLessThan(total + FIXED_DT * 1.5);
    expect(tr.active).toBe(false);
  });

  it('reduced motion: a short fade with no hold', () => {
    const { log } = run(true);
    expect(log.cover).toHaveLength(1);
    expect(log.end).toHaveLength(1);
    expect(log.cover[0]).toBeLessThan(WIPE_FADE + FIXED_DT * 1.5);
    expect(log.end[0]).toBeLessThan(WIPE_FADE * 2 + FIXED_DT * 1.5);
  });

  it('refuses a second start while running, accepts one after', () => {
    const tr = createTransition();
    let covers = 0;
    const opts = { reducedMotion: true, onCover: () => { covers++; }, onEnd: () => {} };
    expect(tr.start(opts)).toBe(true);
    expect(tr.active).toBe(true);
    expect(tr.start(opts)).toBe(false);
    for (let i = 0; i < 100; i++) tr.update(FIXED_DT);
    expect(covers).toBe(1);
    expect(tr.active).toBe(false);
    expect(tr.start(opts)).toBe(true);
  });

  it('a new wipe may start from inside onEnd', () => {
    const tr = createTransition();
    let restarted = false;
    tr.start({
      reducedMotion: true,
      onCover: () => {},
      onEnd: () => {
        restarted = tr.start({ reducedMotion: true, onCover: () => {}, onEnd: () => {} });
      },
    });
    for (let i = 0; i < 20; i++) tr.update(FIXED_DT);
    expect(restarted).toBe(true);
  });

  it('update and draw do nothing while inactive', () => {
    const tr = createTransition();
    tr.update(FIXED_DT);
    /** @type {string[]} */
    const calls = [];
    const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({
      fillRect: () => calls.push('fillRect'),
    }));
    tr.draw(ctx, 512, 360);
    expect(calls).toEqual([]);
  });
});
