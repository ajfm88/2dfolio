// Game Boy tile format decoders: 1bpp/2bpp binary → grayscale ImageData
// These produce grayscale values matching renderer.ts grayToColorIndex():
//   shade 0 → 255 (white), shade 1 → 170, shade 2 → 85, shade 3 → 0 (black)

// Shade values for 2bpp (4 shades)
const SHADE_2BPP = [255, 170, 85, 0];

// Shade values for 1bpp via CopyVideoDataDouble (2 shades: white and black only)
const SHADE_1BPP = [255, 0]; // bit 0 → white (255), bit 1 → black (0)

/**
 * Decode 2bpp tile data into grayscale RGBA ImageData.
 * Each tile is 8x8 pixels, 16 bytes (2 bytes per row).
 * @param data Raw 2bpp tile bytes
 * @param tilesWide Number of tiles per row in the output image
 */
export function decode2bpp(data: Uint8Array, tilesWide: number): ImageData {
  const totalTiles = Math.floor(data.length / 16);
  const tilesHigh = Math.ceil(totalTiles / tilesWide);
  const width = tilesWide * 8;
  const height = tilesHigh * 8;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let t = 0; t < totalTiles; t++) {
    const tileX = (t % tilesWide) * 8;
    const tileY = Math.floor(t / tilesWide) * 8;

    for (let row = 0; row < 8; row++) {
      const lo = data[t * 16 + row * 2];
      const hi = data[t * 16 + row * 2 + 1];

      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        const shade = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);
        const gray = SHADE_2BPP[shade];

        const px = tileX + col;
        const py = tileY + row;
        const idx = (py * width + px) * 4;
        pixels[idx] = gray;
        pixels[idx + 1] = gray;
        pixels[idx + 2] = gray;
        pixels[idx + 3] = 255;
      }
    }
  }

  return new ImageData(pixels, width, height);
}

/**
 * Decode 1bpp tile data into grayscale RGBA ImageData.
 * Simulates CopyVideoDataDouble: each byte is doubled to produce 2bpp
 * with only shades 0 (white) and 3 (black).
 * Each tile is 8x8 pixels, 8 bytes (1 byte per row).
 * @param data Raw 1bpp tile bytes
 * @param tilesWide Number of tiles per row in the output image
 */
export function decode1bpp(data: Uint8Array, tilesWide: number): ImageData {
  const totalTiles = Math.floor(data.length / 8);
  const tilesHigh = Math.ceil(totalTiles / tilesWide);
  const width = tilesWide * 8;
  const height = tilesHigh * 8;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let t = 0; t < totalTiles; t++) {
    const tileX = (t % tilesWide) * 8;
    const tileY = Math.floor(t / tilesWide) * 8;

    for (let row = 0; row < 8; row++) {
      const byte = data[t * 8 + row];

      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        const shade = (byte >> bit) & 1;
        const gray = SHADE_1BPP[shade];

        const px = tileX + col;
        const py = tileY + row;
        const idx = (py * width + px) * 4;
        pixels[idx] = gray;
        pixels[idx + 1] = gray;
        pixels[idx + 2] = gray;
        pixels[idx + 3] = 255;
      }
    }
  }

  return new ImageData(pixels, width, height);
}
