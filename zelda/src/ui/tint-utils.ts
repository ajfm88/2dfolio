// Creates a color-tinted copy of a font image: removes background first,
// then tints remaining pixels to the target color.
export function createTintedFontImage(
  image: HTMLImageElement,
  color: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  // Step 1: remove background using top-left pixel as key
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const keyR = d[0]!, keyG = d[1]!, keyB = d[2]!;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i]! - keyR) <= 2 &&
        Math.abs(d[i + 1]! - keyG) <= 2 &&
        Math.abs(d[i + 2]! - keyB) <= 2) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Step 2: tint remaining (non-transparent) pixels
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}
