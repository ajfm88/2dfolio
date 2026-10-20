import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { IntroScreen } from './intro_screen';
import { introPictureCanvas, prepareIntroPicture, renderIntroScreen, withIntroWindow } from './intro_screen_render';
import { textBgTransfer } from '../text/bg_transfer';
import { getPaletteColors } from '../renderer/palettes';
import { installNodeImageData } from '../rom/node_image_data';
import { fillRect } from '../renderer';

const palette = getPaletteColors('MEWMON');
vi.mock('../audio', () => ({ playSFX: vi.fn(), isSoundFinished: () => true }));
vi.mock('../input', () => ({ isHeld: () => false, syncJoypadRead: vi.fn() }));
type Rect = { x: number; y: number; width: number; height: number };
/** Small raster test double: Canvas clipping/translation, cropped blits and ImageData, no browser/audio. */
class Raster {
  readonly pixels = new Uint8ClampedArray(160 * 144 * 4);
  private tx = 0;
  private clip: Rect = { x: 0, y: 0, width: 160, height: 144 };
  private path: Rect = this.clip;
  private stack: { tx: number; clip: Rect }[] = [];
  readonly context = {
    save: () => { this.stack.push({ tx: this.tx, clip: this.clip }); },
    restore: () => { const state = this.stack.pop()!; this.tx = state.tx; this.clip = state.clip; },
    beginPath: () => {},
    rect: (x: number, y: number, width: number, height: number) => { this.path = { x: x + this.tx, y, width, height }; },
    clip: () => { this.clip = this.path; },
    translate: (x: number, _y: number) => { this.tx += x; },
    getImageData: () => new ImageData(this.pixels.slice(), 160, 144),
    putImageData: (image: ImageData) => { this.pixels.set(image.data); },
  };
  pixel(x: number, y: number): number[] { return Array.from(this.pixels.slice((y * 160 + x) * 4, (y * 160 + x + 1) * 4)); }
  write(x: number, y: number, colour: ArrayLike<number>): void {
    x += this.tx;
    if (x < 0 || x >= 160 || y < 0 || y >= 144 || x < this.clip.x || x >= this.clip.x + this.clip.width ||
      y < this.clip.y || y >= this.clip.y + this.clip.height) return;
    this.pixels.set(colour, (y * 160 + x) * 4);
  }
  fill(x: number, y: number, width: number, height: number, colour: readonly number[]): void {
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) this.write(x + dx, y + dy, colour);
  }
  tile(image: ImageData, id: number, x: number, y: number): void {
    const sx = id % 7 * 8, sy = Math.floor(id / 7) * 8;
    for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
      const from = ((sy + dy) * image.width + sx + dx) * 4;
      this.write(x + dx, y + dy, image.data.subarray(from, from + 4));
    }
  }
}
let raster: Raster;
vi.mock('../renderer', async importOriginal => {
  const actual = await importOriginal<typeof import('../renderer')>();
  return { ...actual, getCtx: () => raster.context, getScale: () => 1, getActivePalette: () => 'MEWMON',
    fillRect: (x: number, y: number, w: number, h: number, index: number) => raster.fill(x, y, w, h, [...palette[index], 255]),
    drawTile: (canvas: HTMLCanvasElement, tile: number, x: number, y: number) =>
      raster.tile((canvas as unknown as { pixels: ImageData }).pixels, tile, x, y),
  };
});
beforeAll(() => installNodeImageData());
beforeEach(() => {
  raster = new Raster(); raster.fill(0, 0, 160, 144, [255, 255, 255, 255]);
  textBgTransfer.enabled = true; textBgTransfer.resetPortion();
});
afterEach(() => vi.unstubAllGlobals());
const canvasFor = (pixels: ImageData): HTMLCanvasElement => ({ width: pixels.width, height: pixels.height, pixels,
  getContext: () => ({ getImageData: () => pixels }),
}) as unknown as HTMLCanvasElement;
function image(name: string): ImageData {
  const png = PNG.sync.read(readFileSync(resolve(__dirname, '../../static/gfx', name)));
  return new ImageData(new Uint8ClampedArray(png.data), png.width, png.height);
}
function solid(index: number): ImageData {
  const pixels = new Uint8ClampedArray(56 * 56 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([...palette[index], 255], offset);
  return new ImageData(pixels, 56, 56);
}
function copy(screen: IntroScreen, name: string): void {
  const run = screen.copyVideoData(name); run.next();
  for (let i = 0; i < 7; i++) { screen.vblank(); run.next(); }
}
function comparePicture(source: ImageData, left: number, top: number, mirror = false): void {
  const expected = new Uint8ClampedArray(160 * 144 * 4);
  for (let offset = 0; offset < expected.length; offset += 4) expected.set([255, 255, 255, 255], offset);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const from = (y * source.width + (mirror ? source.width - 1 - x : x)) * 4;
    expected.set(source.data.subarray(from, from + 4), ((top + y) * 160 + left + x) * 4);
  }
  expect(Buffer.from(raster.pixels).equals(Buffer.from(expected))).toBe(true);
}

describe('intro window and picture rendering', () => {
  it.each([0, 7, 15, 119, 167, 255])('WX %i places the window at WX−7 and clips it to the screen', wx => {
    withIntroWindow(wx, () => fillRect(0, 0, 160, 144, 1));
    const offset = wx - 7;
    for (const x of [0, 6, 7, 8, 111, 112, 119, 152, 153, 159])
      expect(raster.pixel(x, 0), `screen x ${x}`).toEqual([...(x >= offset && x < offset + 160 ? palette[1] : palette[0]), 255]);
    fillRect(0, 143, 1, 1, 2); expect(raster.pixel(0, 143)).toEqual([...palette[2], 255]); // restored translation/clip
  });

  it('restores the window context even when drawing fails', () => {
    expect(() => withIntroWindow(119, () => { throw new Error('draw failed'); })).toThrow('draw failed');
    fillRect(0, 0, 1, 1, 2); expect(raster.pixel(0, 0)).toEqual([...palette[2], 255]);
  });

  it('draws all 49 column-major slot IDs from a row-major source without advancing time', () => {
    const screen = new IntroScreen(), pic = image('player/red.png');
    copy(screen, 'red'); screen.placePicture(); screen.vblank(); screen.vblank(); screen.vblank();
    const cells = screen.visibleCells, slots = screen.slots, portion = textBgTransfer.nextPortion;
    for (let render = 0; render < 3; render++) renderIntroScreen(screen, new Map([['red', canvasFor(pic)]]));
    comparePicture(pic, 48, 32);
    expect(screen.visibleCells).toEqual(cells); expect(screen.slots).toEqual(slots);
    expect(textBgTransfer.nextPortion).toBe(portion);
  });

  it('the window moves the entire picture and keeps the uncovered BG blank', () => {
    const screen = new IntroScreen(); copy(screen, 'red'); screen.placePicture();
    screen.vblank(); screen.vblank(); screen.vblank(); screen.wx = 119;
    renderIntroScreen(screen, new Map([['red', canvasFor(solid(1))]]));
    expect(raster.pixel(159, 32)).toEqual([...palette[0], 255]); // pic starts at160
    screen.wx = 111; renderIntroScreen(screen, new Map([['red', canvasFor(solid(1))]]));
    expect(raster.pixel(151, 32)).toEqual([...palette[0], 255]);
    expect(raster.pixel(152, 32)).toEqual([...palette[1], 255]);
    expect(raster.pixel(0, 32)).toEqual([...palette[0], 255]);
  });

  it('both shrink stages wipe the existing pic at the traced per-frame column/row boundaries', () => {
    const screen = new IntroScreen(); copy(screen, 'red'); screen.placePicture();
    screen.vblank(); screen.vblank(); screen.vblank();
    const pictures = new Map([['red', canvasFor(solid(1))], ['shrink1', canvasFor(solid(2))], ['shrink2', canvasFor(solid(3))]]);
    for (const [name, previous, next] of [['shrink1', 1, 2], ['shrink2', 2, 3]] as const) {
      const run = screen.copyVideoData(name); run.next();
      for (let frame = 1; frame <= 7; frame++) {
        screen.vblank(); renderIntroScreen(screen, pictures);
        for (let col = 0; col < 7; col++) for (let row = 0; row < 7; row++)
          expect(raster.pixel(48 + col * 8, 32 + row * 8)).toEqual([...palette[col * 7 + row < frame * 8 ? next : previous], 255]);
        run.next();
      }
    }
  });

  it('pads the real Pikachu, flips each tile plus column order, and mirrors exactly once at window (56,48)', () => {
    const pic = image('sprites/front/25.png'), source = pic.data.slice();
    const padded = prepareIntroPicture(pic, true); expect([padded.width, padded.height]).toEqual([56, 56]);
    const screen = new IntroScreen(); copy(screen, 'pikachu'); screen.placePicture(true);
    screen.vblank(); screen.vblank(); screen.vblank();
    renderIntroScreen(screen, new Map([['pikachu', canvasFor(padded)]]));
    comparePicture(pic, 56, 48, true); expect(pic.data).toEqual(source);
  });

  it.each(['player/red.png', 'trainers/rival1.png'])('%s keeps the byte-copy quirks invisible in all twelve slide positions', path => {
    const screen = new IntroScreen(), pic = image(path); copy(screen, 'pic'); screen.placePicture();
    screen.vblank(); screen.vblank(); screen.vblank();
    for (const direction of ['right', 'left'] as const) {
      if (direction === 'left') screen.clearArea(0, 0, 12, 11);
      const run = screen.slidePicture(direction); run.next();
      for (let step = 1; step <= 6; step++) {
        for (let third = 0; third < 3; third++) { screen.vblank(); run.next(); }
        renderIntroScreen(screen, new Map([['pic', canvasFor(pic)]]));
        comparePicture(pic, (direction === 'right' ? 6 + step : 12 - step) * 8, 32);
      }
    }
  });

  it('applies BGP to the BG/window before OBJ drawing, including the blank BG left of a window', () => {
    const screen = new IntroScreen(); copy(screen, 'red'); screen.placePicture();
    screen.vblank(); screen.vblank(); screen.vblank(); screen.bgp = 0xfc;
    renderIntroScreen(screen, new Map([['red', canvasFor(solid(1))]]), () => fillRect(48, 32, 1, 1, 1));
    expect(raster.pixel(48, 32)).toEqual([...palette[1], 255]); // OBJ was not passed through BGP
    expect(raster.pixel(49, 32)).toEqual([...palette[3], 255]);
    expect(raster.pixel(0, 0)).toEqual([...palette[0], 255]);
  });

  it('wraps prepared pixels in a fresh canvas without recolouring or altering the source', () => {
    const pic = image('sprites/front/25.png'); let written: ImageData | null = null;
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ putImageData: (pixels: ImageData) => { written = pixels; } }),
    }) });
    const prepared = introPictureCanvas(canvasFor(pic), true);
    expect([prepared.width, prepared.height]).toEqual([56, 56]);
    expect(written).toEqual(prepareIntroPicture(pic, true, palette[0]));
  });
});
