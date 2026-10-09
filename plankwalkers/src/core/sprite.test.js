import { describe, expect, it } from 'vitest';
import { createSprite } from './sprite.js';

describe('sprite drawSpan', () => {
  function setup() {
    const image = { id: 's' };
    /** @type {unknown[][]} */
    const calls = [];
    const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({
      /** @param {unknown[]} args */
      drawImage(...args) { calls.push(args); },
    }));
    const sprite = createSprite({
      image: /** @type {CanvasImageSource} */ (/** @type {unknown} */ (image)),
      fw: 10,
      fh: 3,
      n: 4,
      fps: 10,
    });
    sprite.update(0.25);
    return { sprite, ctx, image, calls };
  }

  it('draws the requested source columns from the current frame', () => {
    const { sprite, ctx, image, calls } = setup();
    sprite.drawSpan(ctx, { x: 0, y: 0 }, 5, 7, 2, 6);
    expect(calls).toEqual([[image, 22, 0, 4, 3, 7, 7, 4, 3]]);
  });

  it('draws a full span with the same arguments as an unflipped draw', () => {
    const { sprite, ctx, calls } = setup();
    const cam = { x: 1.4, y: -0.6 };
    sprite.draw(ctx, cam, 5.5, 7.2);
    sprite.drawSpan(ctx, cam, 5.5, 7.2, 0, 10);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  it('does not draw empty or reversed spans', () => {
    const { sprite, ctx, calls } = setup();
    sprite.drawSpan(ctx, { x: 0, y: 0 }, 5, 7, 2, 2);
    sprite.drawSpan(ctx, { x: 0, y: 0 }, 5, 7, 6, 2);
    expect(calls).toEqual([]);
  });
});
