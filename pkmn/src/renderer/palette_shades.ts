// DMGPalToCGBPal (engine/gfx/palettes.asm): index i selects bits 2i..2i+1.
export type ShadePalette = readonly (readonly [number, number, number])[];

export function dmgShadeMapping(register: number): readonly number[] {
  return [0, 1, 2, 3].map(index => (register >> (2 * index)) & 3);
}

/** The opaque BG/window after drawing, before OBJ. $E4 preserves even the fixed font ink. */
export function remapBgShades(pixels: Uint8ClampedArray, register: number, palette: ShadePalette): void {
  if (register === 0xe4) return;
  const key = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
  const indices = new Map(palette.map(([r, g, b], index) => [key(r, g, b), index]));
  if (palette.length !== 4 || indices.size !== 4) throw new Error('BG shade palette must have four distinct colours');
  const font = key(24, 24, 24);
  if (indices.has(font) && indices.get(font) !== 3) throw new Error('BG palette conflicts with font ink');
  indices.set(font, 3);
  const mapping = dmgShadeMapping(register);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const index = indices.get(key(pixels[offset], pixels[offset + 1], pixels[offset + 2]));
    if (index === undefined) throw new Error(`Unknown BG colour at pixel ${offset / 4}`);
    const colour = palette[mapping[index]];
    pixels[offset] = colour[0]; pixels[offset + 1] = colour[1]; pixels[offset + 2] = colour[2];
  }
}

/** The native 160×144 canvas; callers draw sprites only after this pass. */
export function applyBgShades(ctx: CanvasRenderingContext2D, register: number, palette: ShadePalette): void {
  if (register === 0xe4) return;
  const image = ctx.getImageData(0, 0, 160, 144);
  remapBgShades(image.data, register, palette);
  ctx.putImageData(image, 0, 0);
}
