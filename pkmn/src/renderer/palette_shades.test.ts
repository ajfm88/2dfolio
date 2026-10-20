import { describe, expect, it, vi } from 'vitest';
import { applyBgShades, dmgShadeMapping, remapBgShades } from './palette_shades';
import { getPaletteColors } from './palettes';
import { obpMapping } from './renderer';

const cases = [
  [0x54, [0, 1, 1, 1]], [0xa8, [0, 2, 2, 2]], [0xfc, [0, 3, 3, 3]],
  [0xf8, [0, 2, 3, 3]], [0xf4, [0, 1, 3, 3]], [0xe4, [0, 1, 2, 3]],
  [0x90, [0, 0, 1, 2]], [0x40, [0, 0, 0, 1]], [0x00, [0, 0, 0, 0]],
  [0xd0, [0, 0, 1, 3]], [0x80, [0, 0, 0, 2]], [0xe0, [0, 0, 2, 3]],
] as const;
const palette = getPaletteColors('MEWMON');

describe('intro DMG/CGB shade pass', () => {
  it.each(cases)('register %i selects the traced low-bits-first shades', (reg, expected) => {
    expect(dmgShadeMapping(reg)).toEqual(expected);
    expect(obpMapping(reg)).toEqual(expected);
  });

  it('matches every MEWMON index exactly and treats both #181818 font and #191919 as index 3', () => {
    expect(palette).toEqual([[255, 255, 255], [239, 191, 80], [209, 8, 54], [25, 25, 25]]);
    const source = new Uint8ClampedArray([...palette.flatMap(rgb => [...rgb, 255]), 24, 24, 24, 173]);
    for (const [reg, expected] of cases.filter(([reg]) => reg !== 0xe4)) {
      const pixels = source.slice(); remapBgShades(pixels, reg, palette);
      expect(Array.from(pixels)).toEqual([
        ...expected.flatMap(index => [...palette[index], 255]), ...palette[expected[3]], 173,
      ]);
    }
    expect(Array.from(source.slice(-4))).toEqual([24, 24, 24, 173]);
  });

  it('$E4 leaves every byte intact, including font ink, alpha and otherwise unknown colours', () => {
    const pixels = new Uint8ClampedArray([24, 24, 24, 255, 25, 25, 25, 19, 1, 2, 3, 7]);
    const before = pixels.slice(); remapBgShades(pixels, 0xe4, palette);
    expect(pixels).toEqual(before);
    const get = vi.fn(), put = vi.fn();
    applyBgShades({ getImageData: get, putImageData: put } as unknown as CanvasRenderingContext2D, 0xe4, palette);
    expect(get).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
  });

  it('fails loudly on an unknown colour instead of approximating it to a neighbouring shade', () => {
    expect(() => remapBgShades(new Uint8ClampedArray([26, 25, 25, 255]), 0x54, palette)).toThrow('Unknown BG colour');
    expect(() => remapBgShades(new Uint8ClampedArray(4), 0x54, [palette[0], palette[0], palette[2], palette[3]]))
      .toThrow('four distinct colours');
    expect(() => remapBgShades(new Uint8ClampedArray(4), 0x54, [[24, 24, 24], palette[1], palette[2], palette[3]]))
      .toThrow('conflicts with font ink');
  });

  it('reads and writes the native screen once, recolouring the canvas before it is composited', () => {
    const image = { data: new Uint8ClampedArray([24, 24, 24, 255]) };
    const get = vi.fn(() => image), put = vi.fn();
    applyBgShades({ getImageData: get, putImageData: put } as unknown as CanvasRenderingContext2D, 0x90, palette);
    expect(get).toHaveBeenCalledWith(0, 0, 160, 144);
    expect(put).toHaveBeenCalledWith(image, 0, 0);
    expect(Array.from(image.data)).toEqual([...palette[2], 255]);
  });
});
