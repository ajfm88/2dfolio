// Unused A5c3f checkpoint-06. Decoded committed PNGs only; no ROM, fetch or canvas in this module.
import trainerText from '../../data/trainers.json?raw';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';

interface TrainerPicture { id: number; pic: string; picOverride?: { trainerNoAtLeast: number; pic: string } }
const trainers = Object.values(JSON.parse(trainerText) as Record<string, TrainerPicture>);
export type PictureDecoder = (file: string) => Promise<RawImage>;

/** Decoded RGBA -> the renderer's four grayscale values. Shared by every injected decoder.
 * home/pics.asm:44-193 supplies 2bpp pixels; renderer gray thresholds are192/128/64. */
export function pictureRGBA(image: RawImage): RawImage {
  if (image.data.length !== image.width * image.height * 4) throw new Error('picture RGBA length');
  const data = new Uint8ClampedArray(image.data.length);
  for (let at = 0; at < data.length; at += 4) {
    const gray = image.data[at], value = gray >= 192 ? 255 : gray >= 128 ? 170 : gray >= 64 ? 85 : 0;
    data[at] = data[at + 1] = data[at + 2] = value; data[at + 3] = image.data[at + 3];
  }
  return { width: image.width, height: image.height, data };
}

/** home/pics.asm:58-104. White is index0, matching zeroed sprite buffers. */
function whiteBox(): RawImage { return { width: 56, height: 56, data: new Uint8ClampedArray(56 * 56 * 4).fill(255) }; }
/** home/pics.asm:107-124; scale_sprites.asm:71-87. Copy a decoded pixel without mutating the source. */
function copyPixel(source: RawImage, sx: number, sy: number, dest: RawImage, dx: number, dy: number): void {
  const data = dest.data as Uint8ClampedArray, src = (sy * source.width + sx) * 4, dst = (dy * dest.width + dx) * 4;
  for (let component = 0; component < 4; component++) data[dst + component] = source.data[src + component];
}

/** home/pics.asm:58-124. Low nibble columns, high nibble rows; SRL floors, rows bottom-align.
 * uncompress.asm:307,394,487,571-583 reverses each nibble; pics.asm:174-186 swaps them at merge:
 * combined, each tile's eight pixels reverse. Tile-column order is the separate tilemap owner's job. */
export function frontPictureBox(image: RawImage, dimensions: number, flipped = false): RawImage {
  const columns = dimensions & 15, rows = dimensions >>> 4;
  if (image.width !== columns * 8 || image.height !== rows * 8 || columns > 7 || rows > 7)
    throw new Error('picture dimensions disagree with decoded PNG');
  const box = whiteBox(), left = Math.floor((8 - columns) / 2) * 8, top = (7 - rows) * 8;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++)
    copyPixel(image, flipped ? (x & ~7) + 7 - (x & 7) : x, y, box, left + x, top + y);
  return box;
}

/** home/pics.asm:44-54; all committed mon fronts have square5/6/7-tile dimension bytes. */
export function monFrontBox(image: RawImage, flipped = false): RawImage {
  if (image.width !== image.height || ![40, 48, 56].includes(image.width)) throw new Error('non-square or unknown mon front');
  const tiles = image.width / 8;
  return frontPictureBox(image, tiles * 17, flipped);
}
/** init_battle.asm:71-74,156-158. Forced dimensions, independent of the mon-header byte. */
export function ghostPictureBox(image: RawImage, flipped = false): RawImage { return frontPictureBox(image, 0x66, flipped); }
/** init_battle.asm:156-158. A trainer must supply a full7x7 decoded buffer, even if a stale mon header says otherwise. */
export function trainerPictureBox(image: RawImage, flipped = false): RawImage { return frontPictureBox(image, 0x77, flipped); }

/** engine/battle/scale_sprites.asm:1-87. Keep source x/y0..27, duplicate each pixel2x2.
 * Synthetic flipped backs: nibble reversal occurs BEFORE scaling, then the merge swaps output nibbles.
 * That is not a post-scale full-byte reversal; no reachable normal battle sets the flip flag. */
export function backPictureBox(image: RawImage, flipped = false): RawImage {
  if (image.width !== 32 || image.height !== 32) throw new Error('back picture must be32x32');
  const box = whiteBox();
  for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) {
    const outputX = flipped ? (x & ~7) + ((x + 4) & 7) : x;
    const scaledSource = outputX >>> 1;
    const sx = flipped ? (scaledSource & ~3) + 3 - (scaledSource & 3) : scaledSource;
    copyPixel(image, sx, y >>> 1, box, x, y);
  }
  return box;
}

/** pic_pointers_money.asm:6-56; home/trainers2.asm IsFightingJessieJames; committed row metadata is authoritative. */
export function trainerPictureFile(classId: number, trainerNo = 1): string {
  const row = trainers.find(entry => entry.id === classId);
  if (!row) throw new Error(`no trainer picture row ${classId}`);
  return row.picOverride && trainerNo >= row.picOverride.trainerNoAtLeast ? row.picOverride.pic : row.pic;
}

/** home/pics.asm, core.asm:6384-6450, init_battle.asm:150-178, draw_hud_pokeball_gfx.asm:13-17.
 * Names exactly match the existing picture ports. Decode is the only injected I/O; all pixel work is pure. */
export async function loadBattleRenderTiles(decode: PictureDecoder): Promise<BattleRenderTiles> {
  const read = async (file: string) => pictureRGBA(await decode(file));
  const pictures = new Map<string, RawImage>(), flippedPictures = new Map<string, RawImage>();
  const load = async (key: string, file: string, builder: (image: RawImage, flipped?: boolean) => RawImage) => {
    const image = await read(file); pictures.set(key, builder(image)); flippedPictures.set(key, builder(image, true));
  };
  const [font, extra, hud1, hud2, hud3, balls] = await Promise.all([
    'gfx/font/font.png', 'gfx/font/font_battle_extra.png', 'gfx/battle/battle_hud_1.png',
    'gfx/battle/battle_hud_2.png', 'gfx/battle/battle_hud_3.png', 'gfx/battle/balls.png',
  ].map(read));
  await Promise.all([
    ...Array.from({ length: 151 }, (_, i) => load(`front/${i + 1}`, `gfx/sprites/front/${i + 1}.png`, monFrontBox)),
    ...Array.from({ length: 151 }, (_, i) => load(`back/${i + 1}`, `gfx/sprites/back/${i + 1}.png`, backPictureBox)),
    ...[...new Set(trainers.flatMap(row => [row.pic, ...(row.picOverride ? [row.picOverride.pic] : [])]))]
      .map(file => load(file, `gfx/trainers/${file}`, trainerPictureBox)),
    load('ghost', 'gfx/battle/ghost.png', ghostPictureBox), load('redb', 'gfx/player/redb.png', backPictureBox),
    load('prof.oakb', 'gfx/battle/prof.oakb.png', backPictureBox), load('oldmanb', 'gfx/battle/oldmanb.png', backPictureBox),
  ]);
  const sprites = { width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) };
  const across = balls.width / 8;
  for (let tile = 0; tile < 4; tile++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
    copyPixel(balls, (tile % across) * 8 + x, Math.floor(tile / across) * 8 + y,
      sprites, ((0x31 + tile) % 16) * 8 + x, Math.floor((0x31 + tile) / 16) * 8 + y);
  return { font, extra, hud1, hud2, hud3, pictures, flippedPictures, sprites };
}
