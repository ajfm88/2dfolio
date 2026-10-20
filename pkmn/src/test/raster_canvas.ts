// Small deterministic Canvas double for native raster integration tests. Supports only
// nearest-neighbour blits, opaque/transparent pixels and the transforms used by renderer.ts.
export class RasterCanvas {
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  private storage = new Uint8ClampedArray();
  private tx = 0;
  private ty = 0;
  private sx = 1;
  private sy = 1;
  private readonly stack: number[][] = [];
  get pixels(): Uint8ClampedArray {
    if (this.storage.length !== this.width * this.height * 4) this.storage = new Uint8ClampedArray(this.width * this.height * 4);
    return this.storage;
  }
  readonly context = {
    fillStyle: '#000000', imageSmoothingEnabled: true,
    save: (): void => { this.stack.push([this.tx, this.ty, this.sx, this.sy]); },
    restore: (): void => { [this.tx, this.ty, this.sx, this.sy] = this.stack.pop()!; },
    translate: (x: number, y: number): void => { this.tx += x * this.sx; this.ty += y * this.sy; },
    scale: (x: number, y: number): void => { this.sx *= x; this.sy *= y; },
    clearRect: (x: number, y: number, w: number, h: number): void => { this.rect(x, y, w, h, [0, 0, 0, 0]); },
    fillRect: (x: number, y: number, w: number, h: number): void => {
      const fill = this.context.fillStyle;
      const rgb = fill.startsWith('#') ? [1, 3, 5].map(offset => parseInt(fill.slice(offset, offset + 2), 16))
        : fill.match(/\d+/g)!.map(Number);
      this.rect(x, y, w, h, [...rgb, 255]);
    },
    getImageData: (x: number, y: number, w: number, h: number): ImageData => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) data.set(this.pixel(x + col, y + row), (row * w + col) * 4);
      return new ImageData(data, w, h);
    },
    putImageData: (image: ImageData, x: number, y: number): void => {
      for (let row = 0; row < image.height; row++) for (let col = 0; col < image.width; col++)
        this.write(x + col, y + row, image.data.subarray((row * image.width + col) * 4, (row * image.width + col + 1) * 4));
    },
    drawImage: (source: RasterCanvas | ImageData, ...args: number[]): void => {
      const data = source instanceof RasterCanvas ? source.pixels : source.data;
      let sx = 0, sy = 0, sw = source.width, sh = source.height, dx = args[0], dy = args[1], dw = sw, dh = sh;
      if (args.length === 4) { dw = args[2]; dh = args[3]; }
      if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
        const offset = ((sy + Math.floor(y * sh / dh)) * source.width + sx + Math.floor(x * sw / dw)) * 4;
        if (data[offset + 3] === 0) continue;
        const px = this.tx + this.sx * (dx + x) + (this.sx < 0 ? -1 : 0);
        const py = this.ty + this.sy * (dy + y) + (this.sy < 0 ? -1 : 0);
        this.write(px, py, data.subarray(offset, offset + 4));
      }
    },
  };
  getContext(): CanvasRenderingContext2D { return this.context as unknown as CanvasRenderingContext2D; }
  pixel(x: number, y: number): Uint8ClampedArray {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return new Uint8ClampedArray(4);
    return this.pixels.slice((y * this.width + x) * 4, (y * this.width + x + 1) * 4);
  }
  private write(x: number, y: number, colour: ArrayLike<number>): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.pixels.set(colour, (y * this.width + x) * 4);
  }
  private rect(x: number, y: number, width: number, height: number, colour: ArrayLike<number>): void {
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) this.write(x + col, y + row, colour);
  }
  asCanvas(): HTMLCanvasElement { return this as unknown as HTMLCanvasElement; }
}
