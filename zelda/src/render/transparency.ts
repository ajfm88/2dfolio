// Sprite-sheet transparency keying.
//
// The Spriters Resource sheets this project uses (dungeon-enemies.png,
// overworld-enemies-alt.png, bosses.png, npcs.png) carry **two** background
// colours: an outer field — green #008000 or cyan #00FFFF — and a grey #747474
// backing box drawn behind each individual sprite. Keying only the outer colour
// leaves every sprite sitting inside a visible grey rectangle.
//
// Grey is also a real NES sprite colour (armour, bones, rock), so the secondary
// colour cannot simply be matched globally: measured on these sheets, ~99% of the
// grey is edge-connected backing but 128-251 pixels per sheet are enclosed inside
// sprites and must survive. Hence the flood fill below — reachability from the
// image border decides, not colour alone.
//
// The primary colour stays a plain global match. It is 92-96% edge-connected,
// meaning ~3,000 px per sheet sit enclosed inside sprites (a Gleeok's neck loop,
// the gap in a Zora's mouth) and are correctly transparent today; flood-filling
// the primary as well would turn those opaque.

export type ColorTest = (r: number, g: number, b: number) => boolean;

/** Exact-ish match helper for a known key colour. */
export function keyColor(r: number, g: number, b: number, tolerance = 3): ColorTest {
  return (pr, pg, pb) =>
    Math.abs(pr - r) < tolerance &&
    Math.abs(pg - g) < tolerance &&
    Math.abs(pb - b) < tolerance;
}

/** The grey backing box behind each sprite on the Spriters Resource sheets. */
export const SPRITE_BOX_GREY: readonly [number, number, number] = [116, 116, 116];

export interface TransparencyOptions {
  /** Cleared wherever it appears. The sheet's outer background. */
  readonly primary: ColorTest;
  /**
   * Cleared only where reachable from the image border, travelling through
   * primary-or-secondary pixels. Omit for sheets with a single background.
   */
  readonly secondary?: ColorTest;
}

/**
 * The algorithm, over a raw RGBA buffer. Separated from the canvas plumbing below
 * so it is testable without a DOM. Mutates `d` in place.
 */
export function clearBackgroundPixels(
  d: Uint8ClampedArray,
  width: number,
  height: number,
  options: TransparencyOptions,
): void {
  if (width === 0 || height === 0) return;

  // Pass 1 — clear the primary background everywhere.
  const isSecondary = options.secondary;
  const secondaryAt = new Uint8Array(isSecondary ? width * height : 0);
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    if (options.primary(r, g, b)) {
      d[i + 3] = 0;
    } else if (isSecondary && isSecondary(r, g, b)) {
      secondaryAt[p] = 1;
    }
  }

  // Pass 2 — flood fill inward from the border through background pixels, and
  // clear only the secondary pixels the fill can actually reach. A sprite's own
  // grey is enclosed by sprite pixels, so the fill never touches it.
  if (isSecondary) {
    const reached = new Uint8Array(width * height);
    const stack: number[] = [];

    const push = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const p = y * width + x;
      if (reached[p]) return;
      // Passable if it is already-cleared primary or an uncleared secondary pixel.
      if (d[p * 4 + 3] !== 0 && !secondaryAt[p]) return;
      reached[p] = 1;
      stack.push(p);
    };

    for (let x = 0; x < width; x++) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      push(0, y);
      push(width - 1, y);
    }

    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }

    for (let p = 0; p < width * height; p++) {
      if (secondaryAt[p] && reached[p]) d[p * 4 + 3] = 0;
    }
  }
}

/**
 * Copy `image` to a canvas with its background colours made transparent.
 * Returns the canvas; the source image is never modified.
 */
export function applyTransparency(
  image: HTMLImageElement | HTMLCanvasElement,
  options: TransparencyOptions,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  if (canvas.width === 0 || canvas.height === 0) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  clearBackgroundPixels(imageData.data, canvas.width, canvas.height, options);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
