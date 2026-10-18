import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectRawImage, loadSpriteMapped, loadSprite, loadTileset, obpMapping, OBP0_MAPPING } from './renderer';
import { getPaletteColors } from './palettes';
import { installNodeImageData } from '../rom/node_image_data';

afterEach(() => vi.unstubAllGlobals());
describe('OBJ register mapping and asset cache', () => {
  it('decodes the three source registers, keeping the existing OBP0 mapping', () => {
    expect(obpMapping(0xd0)).toEqual(OBP0_MAPPING);
    expect(obpMapping(0xe0)).toEqual([0, 0, 2, 3]);
    expect(obpMapping(0xc8)).toEqual([0, 2, 0, 3]);
  });

  it('remaps real RGBA data, retains transparency and caches by URL, palette and mapping', async () => {
    installNodeImageData();
    vi.stubGlobal('document', { createElement: () => {
      const canvas = { width: 0, height: 0, pixels: null as ImageData | null,
        getContext: () => ({ putImageData: (data: ImageData) => { canvas.pixels = data; } }) };
      return canvas;
    } });
    const url = '/gfx/obj-palette-test.png';
    const raw = new ImageData(new Uint8ClampedArray([255, 255, 255, 255, 170, 170, 170, 255,
      85, 85, 85, 255, 0, 0, 0, 255]), 4, 1);
    injectRawImage(url, raw);
    const normal = await loadSpriteMapped(url, obpMapping(0xe0), 'VIRIDIAN');
    const flash = await loadSpriteMapped(url, obpMapping(0xc8), 'VIRIDIAN');
    const pixels = (canvas: HTMLCanvasElement): number[] => Array.from((canvas as unknown as { pixels: ImageData }).pixels.data);
    const pal = getPaletteColors('VIRIDIAN');
    expect(pixels(normal)).toEqual([255, 255, 255, 0, ...pal[0], 255, ...pal[2], 255, ...pal[3], 255]);
    expect(pixels(flash)).toEqual([255, 255, 255, 0, ...pal[2], 255, ...pal[0], 255, ...pal[3], 255]);
    expect(await loadSpriteMapped(url, [0, 0, 2, 3], 'VIRIDIAN')).toBe(normal);
    expect(flash).not.toBe(normal);
    expect(await loadSpriteMapped(url, obpMapping(0xe0), 'PALLET')).not.toBe(normal);
    expect(await loadSprite(url, 'VIRIDIAN')).not.toBe(normal);
    expect(await loadTileset(url, 'VIRIDIAN')).not.toBe(normal);
    expect(Array.from(raw.data)).toEqual([255, 255, 255, 255, 170, 170, 170, 255,
      85, 85, 85, 255, 0, 0, 0, 255]); // cached source never recoloured in place
  });
});
