import { getCtx, getScale, getActivePalette, getPaletteColors, fillRect, drawTile, applyBgShades } from '../renderer';
import { drawScreenTile } from './menu_render';
import type { IntroScreen } from './intro_screen';

/** AlignSpriteDataCentered, then reverse each tile's pixels; the tilemap reverses the columns separately. */
export function prepareIntroPicture(source: ImageData, flipped = false, background: readonly number[] = [255, 255, 255]): ImageData {
  if (source.width > 56 || source.height > 56 || source.width % 8 || source.height % 8)
    throw new Error('Intro picture must fit a 7×7 tile box');
  const pixels = new Uint8ClampedArray(56 * 56 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([...background, 255], offset);
  const left = Math.floor((8 - source.width / 8) / 2) * 8;
  const top = 56 - source.height;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const destX = left + (flipped ? Math.floor(x / 8) * 8 + 7 - x % 8 : x);
    const from = (y * source.width + x) * 4;
    pixels.set(source.data.subarray(from, from + 4), ((top + y) * 56 + destX) * 4);
  }
  return new ImageData(pixels, 56, 56);
}

/** The source is already colourized by loadTileset; no second palette conversion or whole-image flip. */
export function introPictureCanvas(source: HTMLCanvasElement, flipped = false): HTMLCanvasElement {
  const image = source.getContext('2d')!.getImageData(0, 0, source.width, source.height);
  const padded = prepareIntroPicture(image, flipped, getPaletteColors(getActivePalette())[0]);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 56;
  canvas.getContext('2d')!.putImageData(padded, 0, 0);
  return canvas;
}

/** rWX is relative to the screen's left edge minus seven; clip in screen coordinates before translating. */
export function withIntroWindow(wx: number, draw: () => void): void {
  const ctx = getCtx(), scale = getScale();
  ctx.save();
  try {
    ctx.beginPath(); ctx.rect(0, 0, 160 * scale, 144 * scale); ctx.clip();
    ctx.translate((wx - 7) * scale, 0);
    draw();
  } finally { ctx.restore(); }
}

/** Draw scanout, shade BG/window once, then let the caller draw its pre-mapped OBJ sprites. No clocks here. */
export function renderIntroScreen(
  screen: IntroScreen, pictures: ReadonlyMap<string, HTMLCanvasElement>, drawObjects: () => void = () => {},
): void {
  fillRect(0, 0, 160, 144, 0);
  const slots = screen.slots;
  withIntroWindow(screen.wx, () => {
    screen.visibleCells.forEach((cell, index) => {
      const x = index % 20 * 8, y = Math.floor(index / 20) * 8;
      if (typeof cell === 'string') drawScreenTile(cell, x, y);
      else {
        const slot = slots[cell];
        if (!slot) return;
        const picture = pictures.get(slot.picture);
        if (!picture) throw new Error(`Missing intro picture ${slot.picture}`);
        // vFrontPic is column-major, canvas drawTile is row-major.
        drawTile(picture, slot.tile % 7 * 7 + Math.floor(slot.tile / 7), x, y);
      }
    });
  });
  applyBgShades(getCtx(), screen.bgp, getPaletteColors(getActivePalette()));
  drawObjects();
}
