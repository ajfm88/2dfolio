// Pure scanout of the opening's screen model (note 114 §3). LCDC_DEFAULT: BG on $9800, window on $9C00 at WX - 7,
// BG and window tiles through LCDC_BLOCK21, 8 × 8 objects from $8000. CGB colours: a pixel's index goes through its
// DMG register (BGP; OBP0 for OBJ palettes 0–3, OBP1 for 4–7, as InitCGBPalettes converts them), then picks a colour
// of the slot's CGB base palette. The browser wrapper only scales the result.
import { getCtx, getScale } from '../renderer';
import { getPaletteColors } from '../renderer/palettes';
import { dmgShadeMapping } from '../renderer/palette_shades';
import { bgTileIndex, type OpeningScreen } from './opening_screen';

const WIDTH = 160;
const HEIGHT = 144;
/** The CGB's colour while the LCD is off or skips its first frame: RGB15 $7FFF (DECISIONS #97). */
export const LCD_OFF_COLOUR = [255, 255, 255] as const;
/** OAM_COUNT; at most ten objects are drawn on one line. */
const OBJECTS = 40;
const OBJECTS_PER_LINE = 10;

/** 160 × 144 RGBA. */
export function renderOpeningScreen(screen: OpeningScreen): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  if (screen.blankFrame) {
    for (let at = 0; at < pixels.length; at += 4) {
      pixels[at] = LCD_OFF_COLOUR[0]; pixels[at + 1] = LCD_OFF_COLOUR[1]; pixels[at + 2] = LCD_OFF_COLOUR[2]; pixels[at + 3] = 255;
    }
    return pixels;
  }
  const bgMapping = dmgShadeMapping(screen.bgp);
  const objMappings = [dmgShadeMapping(screen.obp0), dmgShadeMapping(screen.obp1)];
  const bgRaw = new Uint8Array(WIDTH);
  const bgOver = new Uint8Array(WIDTH);
  const oam = screen.shownOam;
  for (let y = 0; y < HEIGHT; y++) {
    const window = screen.wy <= y && screen.wy < HEIGHT;
    for (let x = 0; x < WIDTH; x++) {
      const inWindow = window && x >= screen.wx - 7;
      const map = inWindow ? 1 : 0;
      const tx = inWindow ? x - (screen.wx - 7) : (x + screen.scx) & 0xff;
      const ty = inWindow ? y - screen.wy : (y + screen.scy) & 0xff;
      const cell = (ty >> 3) * 32 + (tx >> 3);
      const attribute = screen.attributes[map][cell];
      const px = attribute & 0x20 ? 7 - (tx & 7) : tx & 7;
      const py = attribute & 0x40 ? 7 - (ty & 7) : ty & 7;
      const raw = screen.vram[bgTileIndex(screen.bgMaps[map][cell])][py * 8 + px];
      bgRaw[x] = raw; bgOver[x] = attribute & 0x80 ? 1 : 0;
      put(pixels, x, y, getPaletteColors(screen.bgPalettes[attribute & 7] ?? 'ROUTE')[bgMapping[raw]]);
    }
    // The first ten objects in OAM order whose rows cover this line; a lower index wins an overlap (CGB).
    const line: number[] = [];
    for (let index = 0; index < OBJECTS && line.length < OBJECTS_PER_LINE; index++) {
      const top = oam[index * 4] - 16;
      if (y >= top && y < top + 8) line.push(index);
    }
    for (let i = line.length - 1; i >= 0; i--) {
      const at = line[i] * 4;
      const top = oam[at] - 16, left = oam[at + 1] - 8, tile = oam[at + 2], flags = oam[at + 3];
      const slot = flags & 7;
      const palette = getPaletteColors(screen.objPalettes[slot] ?? 'ROUTE');
      const mapping = objMappings[slot < 4 ? 0 : 1];
      const py = flags & 0x40 ? 7 - (y - top) : y - top;
      for (let column = 0; column < 8; column++) {
        const x = left + column;
        if (x < 0 || x >= WIDTH) continue;
        const raw = screen.vram[tile][py * 8 + (flags & 0x20 ? 7 - column : column)];
        if (raw === 0) continue;
        if ((flags & 0x80 || bgOver[x]) && bgRaw[x] !== 0) continue;
        put(pixels, x, y, palette[mapping[raw]]);
      }
    }
  }
  return pixels;
}

function put(pixels: Uint8ClampedArray, x: number, y: number, colour: readonly number[]): void {
  const at = (y * WIDTH + x) * 4;
  pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2]; pixels[at + 3] = 255;
}

let presentCanvas: HTMLCanvasElement | undefined;
/** Presentation only: the native frame, scaled with nearest-neighbour pixels. */
export function presentOpeningScreen(screen: OpeningScreen): void {
  const pixels = renderOpeningScreen(screen);
  if (!presentCanvas) {
    presentCanvas = document.createElement('canvas');
    presentCanvas.width = WIDTH; presentCanvas.height = HEIGHT;
  }
  presentCanvas.getContext('2d')!.putImageData(new ImageData(pixels, WIDTH, HEIGHT), 0, 0);
  const ctx = getCtx(), scale = getScale();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(presentCanvas, 0, 0, WIDTH * scale, HEIGHT * scale);
}
