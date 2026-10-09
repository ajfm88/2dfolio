import { describe, expect, it } from 'vitest';
import atlasData from '../data/atlas.json';
import { islandTheme } from '../data/themes.js';
import { Z } from '../settings.js';
import { createEmptyModel } from './model.js';
import { DRAW_LAYER_ORDER, drawBackground, drawLevel } from './render.js';

describe('DRAW_LAYER_ORDER', () => {
  it('walks every settings.Z value, ascending, once', () => {
    expect(DRAW_LAYER_ORDER).toEqual([
      Z.bg,
      Z.clouds,
      Z.bgTiles,
      Z.bgDecor,
      Z.main,
      Z.water,
      Z.fg,
      Z.fx,
    ]);
    const values = Object.values(Z);
    expect(DRAW_LAYER_ORDER).toHaveLength(values.length);
    for (let i = 1; i < DRAW_LAYER_ORDER.length; i++) {
      expect(DRAW_LAYER_ORDER[i]).toBeGreaterThan(DRAW_LAYER_ORDER[i - 1]);
    }
  });
});

describe('reflections', () => {
  function setup() {
    const level = createEmptyModel({ cols: 40, rows: 12 });
    /** @type {number[][]} */
    const calls = [];
    const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({
      fillRect() {},
      drawImage() {},
    }));
    const clips = /** @type {Record<string, { fw: number, fh: number }>} */ (
      /** @type {unknown} */ (atlasData)
    );
    const atlas = {
      /** @param {string} id */
      get(id) {
        return {
          image: /** @type {CanvasImageSource} */ (/** @type {unknown} */ ({ id })),
          fw: clips[id].fw,
          fh: clips[id].fh,
        };
      },
    };
    const sprite = {
      draw() { throw new Error('Reflection used unclipped draw'); },
      /**
       * @param {CanvasRenderingContext2D} _ctx
       * @param {{ x: number, y: number }} _cam
       * @param {number} x
       * @param {number} _y
       * @param {number} k0
       * @param {number} k1
       */
      drawSpan(_ctx, _cam, x, _y, k0, k1) { calls.push([x, k0, k1]); },
    };
    const refl = { x: 100, w: 170, h: 10, sprite };
    const parallax = /** @type {ReturnType<import('./parallax.js').createParallax>} */ (
      /** @type {unknown} */ ({
        horizonY: 320, worldW: 1280, bigCloudX: 0, period: 1, small: [], reflects: [refl],
      })
    );
    const cam = { x: 0, y: 0 };
    function draw() {
      drawLevel(ctx, cam, 768, 360, level, islandTheme, atlas, parallax);
      return calls;
    }
    return { level, refl, parallax, cam, draw };
  }

  it('draws an empty horizon row as one full span', () => {
    const { draw } = setup();
    expect(draw()).toEqual([[100, 0, 170]]);
  });

  it('draws nothing when terrain blocks the entire reflection', () => {
    const { level, draw } = setup();
    for (let c = 3; c <= 8; c++) level.layers.terrain[10 * 40 + c] = 1;
    expect(draw()).toEqual([]);
  });

  it('clips around a terrain cell and merges the open spans', () => {
    const { level, draw } = setup();
    level.layers.terrain[10 * 40 + 5] = 1;
    expect(draw()).toEqual([[100, 0, 60], [100, 92, 170]]);
  });

  it('clips around a platform cell like terrain', () => {
    const { level, draw } = setup();
    level.layers.platform[10 * 40 + 5] = 1;
    expect(draw()).toEqual([[100, 0, 60], [100, 92, 170]]);
  });

  it('draws a water horizon row as one full span', () => {
    const { level, draw } = setup();
    for (let c = 3; c <= 8; c++) level.layers.water[10 * 40 + c] = 1;
    expect(draw()).toEqual([[100, 0, 170]]);
  });

  it('meets the rounded tile edges at a fractional reflection position', () => {
    const { level, refl, draw } = setup();
    level.layers.terrain[10 * 40 + 5] = 1;
    refl.x = 100.5;
    expect(draw()).toEqual([[100.5, 0, 59], [100.5, 91, 170]]);
  });

  it('ignores terrain above and below the reflection row', () => {
    const { level, draw } = setup();
    for (let c = 3; c <= 8; c++) {
      level.layers.terrain[9 * 40 + c] = 1;
      level.layers.terrain[11 * 40 + c] = 1;
    }
    expect(draw()).toEqual([[100, 0, 170]]);
  });

  it('keeps the full span when a no-water horizon is outside the grid', () => {
    const { level, parallax, cam, draw } = setup();
    for (let c = 0; c < 40; c++) level.layers.terrain[11 * 40 + c] = 1;
    parallax.horizonY = 384;
    cam.y = 64;
    expect(draw()).toEqual([[100, 0, 170]]);
  });
});

describe('drawBackground', () => {
  /** @param {number} camY */
  function drawAt(camY) {
    /** @type {{ id: string, dx: number, dy: number, w: number }[]} */
    const calls = [];
    const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({
      fillRect() {},
      /**
       * @param {{ id: string }} image
       * @param {number} _sx
       * @param {number} _sy
       * @param {number} _sw
       * @param {number} _sh
       * @param {number} dx
       * @param {number} dy
       * @param {number} w
       */
      drawImage(image, _sx, _sy, _sw, _sh, dx, dy, w) {
        calls.push({ id: image.id, dx, dy, w });
      },
    }));
    const clips = /** @type {Record<string, { fw: number, fh: number }>} */ (
      /** @type {unknown} */ (atlasData)
    );
    const atlas = {
      /** @param {string} id */
      get(id) {
        const clip = clips[id];
        return {
          image: /** @type {CanvasImageSource} */ (/** @type {unknown} */ ({ id })),
          fw: clip.fw,
          fh: clip.fh,
        };
      },
    };
    const parallax = /** @type {ReturnType<import('./parallax.js').createParallax>} */ (
      /** @type {unknown} */ ({ horizonY: 448, bigCloudX: 0, small: [], period: 1 })
    );
    drawBackground(ctx, { x: 0, y: camY }, 768, 360, islandTheme, atlas, parallax);
    return calls;
  }

  it('aligns the painted image horizon and cloud bank at the water line', () => {
    const calls = drawAt(152);
    const image = calls.filter((call) => call.id === 'bg/image');
    const clouds = calls.filter((call) => call.id === 'bg/clouds-big');
    expect(image.length).toBeGreaterThan(0);
    expect(clouds.length).toBeGreaterThan(0);
    expect(image.every((call) => call.dy === 210)).toBe(true);
    expect(clouds.every((call) => call.dy === 195)).toBe(true);
    expect(image[0].dy + islandTheme.bgImageHorizonRow).toBe(clouds[0].dy + 101);
    expect(Math.min(...image.map((call) => call.dx))).toBeLessThanOrEqual(0);
    expect(Math.max(...image.map((call) => call.dx + call.w))).toBeGreaterThanOrEqual(768);
  });

  it('rounds the image position after a fractional maker camera offset', () => {
    const image = drawAt(216.4).filter((call) => call.id === 'bg/image');
    expect(image.length).toBeGreaterThan(0);
    expect(image.every((call) => call.dy === 146)).toBe(true);
  });
});
