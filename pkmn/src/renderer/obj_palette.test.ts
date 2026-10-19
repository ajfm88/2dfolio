import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectRawImage, loadSpriteMapped, loadSprite, loadTileset, obpMapping, OBP0_MAPPING } from './renderer';
import { getPaletteColors } from './palettes';
import { installNodeImageData } from '../rom/node_image_data';
import { initRenderer, loadEmoteSprite, drawZzzBubble, drawExclamationBubble } from './renderer';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

afterEach(() => vi.unstubAllGlobals());
describe('OBJ register mapping and asset cache', () => {
  it('preloads the committed ZZZ and shock sprites and draws the correct 16x16 sheet above its target', async () => {
    installNodeImageData();
    const draw = vi.fn();
    const screen = { width: 0, height: 0, style: {}, getContext: () => ({ drawImage: draw }) };
    vi.stubGlobal('document', { getElementById: (id: string) => id === 'screen' ? screen : null,
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) });
    vi.stubGlobal('window', { innerWidth: 480, innerHeight: 432, addEventListener() {} });
    for (const name of ['shock', 'zzz']) {
      const png = PNG.sync.read(readFileSync(resolve(__dirname, `../../static/gfx/emotes/${name}.png`)));
      injectRawImage(`/gfx/emotes/${name}.png`, new ImageData(new Uint8ClampedArray(png.data), png.width, png.height));
    }
    initRenderer(); await loadEmoteSprite();
    drawExclamationBubble(40, 60); const shock = draw.mock.calls[0][0];
    drawZzzBubble(72, 44); const zzz = draw.mock.calls[1][0];
    expect(zzz).toBe(await loadSprite('/gfx/emotes/zzz.png'));
    expect(zzz).not.toBe(shock); expect([zzz.width, zzz.height]).toEqual([16, 16]);
    expect(draw.mock.calls[1].slice(1)).toEqual([0, 0, 16, 16, 72, 28, 16, 16]);
  });
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
