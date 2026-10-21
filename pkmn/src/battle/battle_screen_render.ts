// Pure battle scanout. The browser wrapper only calls putImageData. No HUD writers and no clock.
import { getCtx } from '../renderer';
import { dmgShadeMapping } from '../renderer/palette_shades';
import { BATTLE_BG_ATTRIBUTES } from './battle_attributes';
import { battleGlyphTile } from './battle_screen';
import type { BattleCell, BattleHudSlot, BattlePicSlot, BattleScreen, Rgb } from './battle_screen';

export interface RawImage {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}
export interface BattleRenderTiles {
  font: RawImage;
  extra: RawImage;
  hud1: RawImage;
  hud2: RawImage;
  hud3: RawImage;
  pictures: ReadonlyMap<string, RawImage>;
  /** $8000 sprite tiles. OAM never reads the BG picture or HUD slots. */
  sprites: RawImage;
}

const WIDTH = 160;
const HEIGHT = 144;
const indexCache = new WeakMap<object, Map<number, Uint8Array>>();

function grayToColorIndex(gray: number): number {
  if (gray >= 192) return 0;
  if (gray >= 128) return 1;
  if (gray >= 64) return 2;
  return 3;
}

function tileIndices(image: RawImage, tile: number, flipX: boolean, flipY: boolean): Uint8Array {
  const key = (flipX ? 1 : 0) | (flipY ? 2 : 0);
  let byTile = indexCache.get(image);
  if (!byTile) { byTile = new Map(); indexCache.set(image, byTile); }
  const id = tile * 4 + key;
  const cached = byTile.get(id);
  if (cached) return cached;
  const across = image.width >> 3;
  const column = tile % across;
  const row = Math.floor(tile / across);
  const indices = new Uint8Array(64);
  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
    const sx = column * 8 + (flipX ? 7 - px : px);
    const sy = row * 8 + (flipY ? 7 - py : py);
    indices[py * 8 + px] = grayToColorIndex(image.data[(sy * image.width + sx) * 4]);
  }
  byTile.set(id, indices);
  return indices;
}

/** vFrontPic / vBackPic are column-major inside the 7-tile pic box. */
function pictureTile(image: RawImage, slot: BattlePicSlot): number {
  const column = Math.floor(slot.tile / 7);
  const row = slot.tile % 7;
  return row * (image.width >> 3) + column;
}

function sheet(tiles: BattleRenderTiles, slot: BattleHudSlot): RawImage {
  if (slot.sheet === 'extra') return tiles.extra;
  if (slot.sheet === 'hud1') return tiles.hud1;
  if (slot.sheet === 'hud2') return tiles.hud2;
  return tiles.hud3;
}

function cellIndices(screen: BattleScreen, tiles: BattleRenderTiles, cell: BattleCell): Uint8Array | null {
  const id = typeof cell === 'number' ? cell : battleGlyphTile(cell);
  if (id >= 0x80) return tileIndices(tiles.font, id - 0x80, false, false);
  if (id <= 0x30) {
    const slot = screen.frontSlot(id);
    const image = slot && tiles.pictures.get(slot.picture);
    return image ? tileIndices(image, pictureTile(image, slot), false, false) : null;
  }
  if (id <= 0x61) {
    const slot = screen.backSlot(id);
    const image = slot && tiles.pictures.get(slot.picture);
    return image ? tileIndices(image, pictureTile(image, slot), false, false) : null;
  }
  const hud = screen.hudSlot(id);
  return hud ? tileIndices(sheet(tiles, hud), hud.tile, false, false) : null;
}

function writePixel(
  pixels: Uint8ClampedArray, shades: Uint8Array, x: number, y: number,
  raw: number, mapping: readonly number[], palette: readonly Rgb[],
): void {
  const shade = mapping[raw];
  const colour = palette[shade];
  const at = (y * WIDTH + x) * 4;
  pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2]; pixels[at + 3] = 255;
  shades[y * WIDTH + x] = raw;
}

function paintTile(
  pixels: Uint8ClampedArray, shades: Uint8Array, indices: Uint8Array | null,
  originX: number, originY: number, mapping: readonly number[], palette: readonly Rgb[],
): void {
  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
    const x = originX + px, y = originY + py;
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
    writePixel(pixels, shades, x, y, indices ? indices[py * 8 + px] : 0, mapping, palette);
  }
}

/** 160 × 144 RGBA. BGP maps the tile index, then the attribute slot picks the corrected palette. */
export function renderBattleScreen(screen: BattleScreen, tiles: BattleRenderTiles): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const shades = new Uint8Array(WIDTH * HEIGHT);
  const mapping = dmgShadeMapping(screen.bgp);
  const windowLeft = screen.wx - 7;
  const resolved = new Map<BattleCell, Uint8Array | null>();
  const indicesOf = (cell: BattleCell): Uint8Array | null => {
    const cached = resolved.get(cell);
    if (cached !== undefined) return cached;
    const indices = cellIndices(screen, tiles, cell);
    resolved.set(cell, indices);
    return indices;
  };
  for (let y = 0; y < HEIGHT; ) {
    const split = screen.scxSplit !== null && y >= 64 && y < 96;
    const scrollX = split ? screen.scxSplit! : screen.scx;
    const windowBand = y >= screen.wy;
    const aligned = (scrollX & 7) === 0 && (y + screen.scy) % 8 === 0
      && (!windowBand || ((windowLeft & 7) === 0 && (y - screen.wy) % 8 === 0));
    const bandStays = screen.scxSplit === null || y + 8 <= 64 || y >= 96 || (y >= 64 && y + 8 <= 96);
    // A band that starts above wy and crosses it cannot share one window decision.
    const crossesWindow = y < screen.wy && screen.wy < y + 8;
    if (aligned && bandStays && !crossesWindow && y <= HEIGHT - 8) {
      for (let column = 0; column < 20; column++) {
        const x = column * 8;
        const inWindow = windowBand && x >= windowLeft;
        let cell: BattleCell = ' ';
        let attrColumn = 0;
        let attrRow = 0;
        if (inWindow) {
          const localX = x - windowLeft, localY = y - screen.wy;
          attrColumn = localX >> 3; attrRow = localY >> 3;
          cell = screen.visibleAt(attrColumn, attrRow) ?? ' ';
        } else {
          const bgX = (x + scrollX) & 255;
          const bgY = (y + screen.scy) & 255;
          attrColumn = bgX >> 3; attrRow = bgY >> 3;
          cell = screen.bgAt(attrColumn, attrRow) ?? ' ';
        }
        const palette = screen.bgPalette(BATTLE_BG_ATTRIBUTES[attrRow * 32 + attrColumn] ?? 0);
        paintTile(pixels, shades, indicesOf(cell), x, y, mapping, palette);
      }
      y += 8;
      continue;
    }
    for (let x = 0; x < WIDTH; x++) {
      const inWindow = windowBand && x >= windowLeft;
      let cell: BattleCell = ' ';
      let column = 0;
      let row = 0;
      let px = 0;
      let py = 0;
      if (inWindow) {
        const localX = x - windowLeft, localY = y - screen.wy;
        column = localX >> 3; row = localY >> 3; px = localX & 7; py = localY & 7;
        if (column >= 0 && column < 20 && row >= 0 && row < 18) cell = screen.visibleAt(column, row) ?? ' ';
      } else {
        const bgX = (x + scrollX) & 255;
        const bgY = (y + screen.scy) & 255;
        column = bgX >> 3; row = bgY >> 3; px = bgX & 7; py = bgY & 7;
        cell = screen.bgAt(column, row) ?? ' ';
      }
      const indices = indicesOf(cell);
      const palette = screen.bgPalette(BATTLE_BG_ATTRIBUTES[row * 32 + column] ?? 0);
      writePixel(pixels, shades, x, y, indices ? indices[py * 8 + px] : 0, mapping, palette);
    }
    y++;
  }
  // CGB OBJ priority is OAM order: a lower index wins, so paint from the end.
  for (let index = 39; index >= 0; index--) {
    const sprite = screen.oam(index);
    const left = sprite.x - 8, top = sprite.y - 16;
    if (left <= -8 || top <= -8 || left >= WIDTH || top >= HEIGHT) continue;
    const indices = tileIndices(tiles.sprites, sprite.tile, (sprite.attributes & 0x20) !== 0, (sprite.attributes & 0x40) !== 0);
    const palette = screen.objPalette(sprite.attributes & 7);
    for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
      const x = left + px, y = top + py;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
      const raw = indices[py * 8 + px];
      if (raw === 0) continue;
      if ((sprite.attributes & 0x80) !== 0 && shades[y * WIDTH + x] !== 0) continue;
      const colour = palette[raw];
      const at = (y * WIDTH + x) * 4;
      pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2]; pixels[at + 3] = 255;
    }
  }
  return pixels;
}

/** Browser entry. It does not draw, scale or composite; the caller owns the clock. */
export function presentBattleScreen(screen: BattleScreen, tiles: BattleRenderTiles): void {
  const pixels = new Uint8ClampedArray(renderBattleScreen(screen, tiles));
  getCtx().putImageData(new ImageData(pixels, WIDTH, HEIGHT), 0, 0);
}
