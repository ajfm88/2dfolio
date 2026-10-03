// Minimal ImageData for Node — lets the browser extractors run in the setup
// script and in tests. The extractors only ever call
// `new ImageData(pixels, width, height)` (tile_decoder.ts); browsers provide the
// real class, Node doesn't. Never imported by browser code.

class NodeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace = 'srgb';

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    if (data.length !== width * height * 4) {
      throw new Error(`ImageData: ${data.length} bytes does not match ${width}x${height}`);
    }
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

/** Install NodeImageData as the global ImageData, unless one already exists. */
export function installNodeImageData(): void {
  const g = globalThis as { ImageData?: unknown };
  if (typeof g.ImageData === 'undefined') {
    g.ImageData = NodeImageData;
  }
}
