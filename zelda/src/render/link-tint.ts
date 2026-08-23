// Link sprite tinting for ring palette changes — Z_01.asm:4710
// Green (default) → blue (blue ring, NES $32) → red (red ring, NES $16).
// Replaces Link's green tunic pixels with the target ring color.

// NES Link green tunic color range — hue detection for the green channel
const GREEN_HUE_MIN = 80;
const GREEN_HUE_MAX = 160;
const GREEN_SAT_MIN = 0.2;
const GREEN_BRIGHT_MIN = 30;

export function createTintedLinkImage(
  image: HTMLImageElement | HTMLCanvasElement,
  tintColor: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  // Parse target color
  const target = parseHexColor(tintColor);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const a = d[i + 3]!;
    if (a === 0) continue;

    if (isGreenTunic(r, g, b)) {
      const brightness = Math.max(r, g, b) / 255;
      d[i] = Math.round(target.r * brightness);
      d[i + 1] = Math.round(target.g * brightness);
      d[i + 2] = Math.round(target.b * brightness);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function isGreenTunic(r: number, g: number, b: number): boolean {
  if (g < GREEN_BRIGHT_MIN) return false;
  if (g <= r || g <= b) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return false;

  const sat = (max - min) / max;
  if (sat < GREEN_SAT_MIN) return false;

  const delta = max - min;
  if (delta === 0) return false;
  const hue = ((g - b) / delta) * 60;
  const normalizedHue = hue < 0 ? hue + 360 : hue;
  return normalizedHue >= GREEN_HUE_MIN && normalizedHue <= GREEN_HUE_MAX;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
