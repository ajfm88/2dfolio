// Browser-only PNG decode adapter. The box builder and shared RGBA conversion stay in battle_pictures.ts.
import type { PictureDecoder } from './battle_pictures';

export interface BrowserPictureIO {
  image(file: string): Promise<CanvasImageSource & { width: number; height: number }>;
  canvas(): HTMLCanvasElement;
}
/** home/pics.asm:44-193 consumes decoded pixels; this adapter only replaces the development PNG decoder. */
export function browserPictureDecoder(io: BrowserPictureIO = {
  image: async file => { const image = new Image(); image.src = file; await image.decode(); return image; },
  canvas: () => document.createElement('canvas'),
}): PictureDecoder {
  return async file => {
    const image = await io.image(file), canvas = io.canvas();
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('picture canvas context');
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };
}
