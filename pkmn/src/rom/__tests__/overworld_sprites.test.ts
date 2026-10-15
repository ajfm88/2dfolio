import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BinaryReader } from '../binary_reader';
import { installNodeImageData } from '../node_image_data';
import { extractOverworldSprites } from '../extractors/graphics';
import { SPRITE_SHEET_PTRS } from '../rom_offsets';
import { decode2bpp } from '../tile_decoder';
import type { MapSpriteSetsFile } from '../extractors/map_sprite_sets';

const romPath = process.env.ROM_PATH;
const refs = resolve(__dirname, '../../../../refs/pokeyellow/gfx/sprites');
const metadata: MapSpriteSetsFile = JSON.parse(readFileSync(resolve(__dirname, '../../../data/map_sprite_sets.json'), 'utf8'));
let bytes: Uint8Array;
let images: Record<string, ImageData>;
describe.skipIf(!romPath)('BUG-1: SpriteSheetPointerTable byte sizes', () => {
  beforeAll(() => {
    installNodeImageData(); bytes = new Uint8Array(readFileSync(resolve(romPath!)));
    images = extractOverworldSprites(new BinaryReader(bytes.slice().buffer));
  });
  it('all 76 sheets are 16x96 walking or 16x16 still, matching A5b2 picture classes', () => {
    expect(Object.keys(images)).toHaveLength(76);
    for (const [url, image] of Object.entries(images)) {
      const name = basename(url, '.png');
      // The A5b2 canonical bridge omits old_amber's duplicate IDs 78/79.
      const picture = metadata.pictures[name === 'old_amber' ? 79 : metadata.pictureIdsBySprite[name]];
      expect(picture, url).toBeDefined();
      expect([image.width, image.height], url).toEqual([16, picture.kind === 'walking' ? 96 : 16]);
    }
  });
  it.skipIf(!existsSync(refs))('every available pret row matches, including standing-only sheets and nurse bow', () => {
    for (const [url, image] of Object.entries(images)) {
      const name = basename(url, '.png');
      const png = PNG.sync.read(readFileSync(resolve(refs, `${name === 'prof' ? 'oak' : name}.png`)));
      expect(png.width, name).toBe(16);
      expect([16, 48, 64, 96], name).toContain(png.height);
      const count = 16 * Math.min(png.height, 96) * 4;
      expect(Buffer.from(image.data.subarray(0, count)), name).toEqual(png.data.subarray(0, count));
    }
  });
  it('rejects a still picture with a walking size byte instead of reading the next sprites', () => {
    const changed = bytes.slice(); changed[SPRITE_SHEET_PTRS + 70 * 4 + 2] = 0xc0;
    expect(() => extractOverworldSprites(new BinaryReader(changed.buffer))).toThrow('still picture has 12 tiles');
    // Reintroducing the old 64-tile decode produces a 256-high sheet; the same size assertion catches it.
    const rom = new BinaryReader(bytes.slice().buffer); const entry = SPRITE_SHEET_PTRS + 70 * 4;
    const address = rom.readByte(entry + 3) * 0x4000 + (rom.readWord(entry) & 0x3fff);
    const wrong = decode2bpp(rom.readBytes(address, 64 * 16), 2);
    expect(() => expect([wrong.width, wrong.height]).toEqual([16, 16])).toThrow();
  });
});
