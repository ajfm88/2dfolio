import { describe, it, expect } from 'vitest';
import {
  clearBackgroundPixels,
  keyColor,
  SPRITE_BOX_GREY,
} from '../../src/render/transparency.js';

const GREEN: [number, number, number] = [0, 128, 0];
const GREY = SPRITE_BOX_GREY as readonly [number, number, number];
const SPRITE: [number, number, number] = [252, 152, 56];

const isGreen = keyColor(...GREEN);
const isGrey = keyColor(GREY[0], GREY[1], GREY[2]);

/** Build an opaque RGBA buffer from a grid of colours (row-major). */
function buffer(pixels: readonly (readonly [number, number, number])[]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => {
    d[i * 4] = p[0];
    d[i * 4 + 1] = p[1];
    d[i * 4 + 2] = p[2];
    d[i * 4 + 3] = 255;
  });
  return d;
}

const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number): number =>
  d[(y * w + x) * 4 + 3]!;

describe('clearBackgroundPixels', () => {
  it('clears the primary background everywhere, including pockets inside sprites', () => {
    // A green pixel ringed by sprite colour. The primary is a global match by
    // design — those pockets (a Gleeok neck loop) must stay transparent.
    const d = buffer([
      SPRITE, SPRITE, SPRITE,
      SPRITE, GREEN, SPRITE,
      SPRITE, SPRITE, SPRITE,
    ]);
    clearBackgroundPixels(d, 3, 3, { primary: isGreen });
    expect(alphaAt(d, 3, 1, 1)).toBe(0);
    expect(alphaAt(d, 3, 0, 0)).toBe(255);
  });

  it('clears secondary colour that touches the border', () => {
    const d = buffer([
      GREY, GREY, GREY,
      GREEN, SPRITE, GREEN,
      GREEN, GREEN, GREEN,
    ]);
    clearBackgroundPixels(d, 3, 3, { primary: isGreen, secondary: isGrey });
    expect(alphaAt(d, 3, 0, 0)).toBe(0);
    expect(alphaAt(d, 3, 1, 0)).toBe(0);
    expect(alphaAt(d, 3, 2, 0)).toBe(0);
    expect(alphaAt(d, 3, 1, 1)).toBe(255); // sprite survives
  });

  it('keeps secondary colour enclosed by sprite pixels — grey armour is not punched out', () => {
    const d = buffer([
      SPRITE, SPRITE, SPRITE,
      SPRITE, GREY, SPRITE,
      SPRITE, SPRITE, SPRITE,
    ]);
    clearBackgroundPixels(d, 3, 3, { primary: isGreen, secondary: isGrey });
    expect(alphaAt(d, 3, 1, 1)).toBe(255);
  });

  it('reaches the secondary colour through cleared primary pixels', () => {
    // The real sheet layout: outer green field, grey backing box inside it, sprite
    // on top of the box. The fill has to travel through the green to reach the grey.
    const d = buffer([
      GREEN, GREEN, GREEN, GREEN,
      GREEN, GREY, GREY, GREEN,
      GREEN, GREY, SPRITE, GREEN,
      GREEN, GREEN, GREEN, GREEN,
    ]);
    clearBackgroundPixels(d, 4, 4, { primary: isGreen, secondary: isGrey });
    expect(alphaAt(d, 4, 1, 1)).toBe(0);
    expect(alphaAt(d, 4, 2, 1)).toBe(0);
    expect(alphaAt(d, 4, 1, 2)).toBe(0);
    expect(alphaAt(d, 4, 2, 2)).toBe(255); // sprite untouched
  });

  it('leaves the secondary colour alone when no secondary test is given', () => {
    const d = buffer([GREY, GREY, GREY, GREY]);
    clearBackgroundPixels(d, 2, 2, { primary: isGreen });
    expect(alphaAt(d, 2, 0, 0)).toBe(255);
  });

  it('handles a zero-sized image without throwing', () => {
    expect(() => clearBackgroundPixels(new Uint8ClampedArray(0), 0, 0, { primary: isGreen }))
      .not.toThrow();
  });
});
