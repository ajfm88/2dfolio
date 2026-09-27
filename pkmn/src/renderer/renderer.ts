// Canvas tile/sprite rendering engine
// Game Boy: 160x144 pixels, tiles are 8x8, blocks are 4x4 tiles (32x32 px)

import { GB_WIDTH, GB_HEIGHT, TILE_SIZE } from "../core";
import { getPaletteColors, paletteToHex } from "./palettes";

type Rgb = [number, number, number];

// Current palette name (changed per map)
let currentPaletteName = "ROUTE";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scale = 1;

export function getCtx(): CanvasRenderingContext2D {
  return ctx;
}
export function getScale(): number {
  return scale;
}

/** Set the active color palette (call before loading map assets). */
export function setActivePalette(name: string): void {
  currentPaletteName = name;
}

export function getActivePalette(): string {
  return currentPaletteName;
}

export function initRenderer(): void {
  canvas = document.getElementById("screen") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  // Render at native Game Boy resolution; CSS handles the upscaling
  canvas.width = GB_WIDTH;
  canvas.height = GB_HEIGHT;
  scale = 1;
  ctx.imageSmoothingEnabled = false;

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

/** Maximum integer scale factor so the game doesn't become enormous on large screens. */
const MAX_SCALE = 3; // 3× = 480×432

/** Resize the canvas CSS dimensions to fill the viewport while keeping aspect ratio. */
export function resizeCanvas(): void {
  if (!canvas) return;
  // Account for debug panel if open
  const panelWidth = document.getElementById("debug-panel")?.offsetWidth ?? 0;
  const availW = window.innerWidth - panelWidth;
  const availH = window.innerHeight;
  const cssScale = Math.min(availW / GB_WIDTH, availH / GB_HEIGHT, MAX_SCALE);
  canvas.style.width = `${Math.floor(GB_WIDTH * cssScale)}px`;
  canvas.style.height = `${Math.floor(GB_HEIGHT * cssScale)}px`;
}

export function clear(): void {
  const hex = paletteToHex(currentPaletteName);
  ctx.fillStyle = hex[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Normalize a URL key so both '/gfx/foo.png' and 'gfx/foo.png' match. */
function normalizeUrl(url: string): string {
  return url.startsWith('/') ? url : '/' + url;
}

function loadImage(url: string): Promise<HTMLImageElement | HTMLCanvasElement> {
  // Check if ROM-extracted data exists in rawImageCache
  const key = normalizeUrl(url);
  const cached = rawImageCache.get(key) || rawImageCache.get(url);
  if (cached) {
    // Return a canvas (drawImage works with both Image and Canvas)
    const c = document.createElement("canvas");
    c.width = cached.width;
    c.height = cached.height;
    c.getContext("2d")!.putImageData(cached, 0, 0);
    return Promise.resolve(c);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function grayToColorIndex(gray: number): number {
  if (gray >= 192) return 0;
  if (gray >= 128) return 1;
  if (gray >= 64) return 2;
  return 3;
}

// DMG palette register shade mappings (from home/palettes.asm GBPalNormal)
// Each maps a gray shade index (0-3) to a CGB base palette color index.
// rBGP  = %11100100 → [0, 1, 2, 3] (identity)
// rOBP0 = %11010000 → [0, 0, 1, 3] (sprites: shade 1→white, shade 2→accent)
const OBP0_MAPPING = [0, 0, 1, 3];

/** Remap grayscale image data to the given RGB palette.
 *  colorMap optionally remaps shade indices to palette indices (for OBP0/OBP1). */
function remapToPalette(
  data: Uint8ClampedArray,
  rgbPalette: Rgb[],
  transparent0: boolean,
  colorMap?: number[]
): void {
  for (let i = 0; i < data.length; i += 4) {
    const shade = grayToColorIndex(data[i]);
    if (transparent0 && shade === 0) {
      data[i + 3] = 0;
    } else {
      const idx = colorMap ? colorMap[shade] : shade;
      const [r, g, b] = rgbPalette[idx];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
}

// Raw grayscale image cache (palette-independent)
const rawImageCache = new Map<string, ImageData>();

/** Pre-populate the raw image cache with ROM-decoded grayscale ImageData.
 *  Used by the ROM extraction system to bypass PNG loading. */
export function injectRawImage(url: string, data: ImageData): void {
  rawImageCache.set(normalizeUrl(url), data);
}

async function getRawImageData(url: string): Promise<ImageData> {
  const key = normalizeUrl(url);
  if (rawImageCache.has(key)) return rawImageCache.get(key)!;

  const img = await loadImage(url);
  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = img.height;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(img, 0, 0);
  const imageData = tctx.getImageData(0, 0, tmp.width, tmp.height);
  rawImageCache.set(url, imageData);
  return imageData;
}

/** Clone an ImageData so we can modify it without affecting the cache. */
function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

// Colorized asset cache: key = url + palette name
const colorizedCache = new Map<string, HTMLCanvasElement>();

function cacheKey(url: string, palette: string): string {
  return `${url}::${palette}`;
}

/** Load a tileset PNG and remap its grayscale pixels to the current palette. */
export async function loadTileset(
  url: string,
  palette?: string
): Promise<HTMLCanvasElement> {
  const pal = palette ?? currentPaletteName;
  const key = cacheKey(url, pal);
  if (colorizedCache.has(key)) return colorizedCache.get(key)!;

  const rawData = await getRawImageData(url);
  const colorized = cloneImageData(rawData);
  const rgbPalette = getPaletteColors(pal) as unknown as Rgb[];
  remapToPalette(colorized.data, rgbPalette, false);

  const tmp = document.createElement("canvas");
  tmp.width = rawData.width;
  tmp.height = rawData.height;
  const tctx = tmp.getContext("2d")!;
  tctx.putImageData(colorized, 0, 0);

  colorizedCache.set(key, tmp);
  return tmp;
}

/** Load a tileset PNG with color 0 (lightest) transparent.
 *  Used for BG-priority overlay (grass obscuring sprites). */
export async function loadTilesetTransparent(
  url: string,
  palette?: string
): Promise<HTMLCanvasElement> {
  const pal = palette ?? currentPaletteName;
  const key = cacheKey(url, pal) + "::bgtransparent";
  if (colorizedCache.has(key)) return colorizedCache.get(key)!;

  const rawData = await getRawImageData(url);
  const colorized = cloneImageData(rawData);
  const rgbPalette = getPaletteColors(pal) as unknown as Rgb[];
  remapToPalette(colorized.data, rgbPalette, true); // color 0 = transparent

  const tmp = document.createElement("canvas");
  tmp.width = rawData.width;
  tmp.height = rawData.height;
  const tctx = tmp.getContext("2d")!;
  tctx.putImageData(colorized, 0, 0);

  colorizedCache.set(key, tmp);
  return tmp;
}

/** Load a sprite PNG with transparency (lightest color = transparent).
 *  Uses OBP0 shade mapping so sprites appear white like the original game. */
export async function loadSprite(
  url: string,
  palette?: string
): Promise<HTMLCanvasElement> {
  const pal = palette ?? currentPaletteName;
  const key = cacheKey(url, pal);
  if (colorizedCache.has(key)) return colorizedCache.get(key)!;

  const rawData = await getRawImageData(url);
  const colorized = cloneImageData(rawData);
  const rgbPalette = getPaletteColors(pal) as unknown as Rgb[];
  remapToPalette(colorized.data, rgbPalette, true, OBP0_MAPPING);

  const tmp = document.createElement("canvas");
  tmp.width = rawData.width;
  tmp.height = rawData.height;
  const tctx = tmp.getContext("2d")!;
  tctx.putImageData(colorized, 0, 0);

  colorizedCache.set(key, tmp);
  return tmp;
}

/** Load a sprite PNG for battle display (shade 0 = transparent, shades 1-3 use identity mapping).
 *  Unlike loadSprite (which uses OBP0), this preserves all 3 visible shade levels. */
export async function loadBattleSprite(
  url: string,
  palette?: string
): Promise<HTMLCanvasElement> {
  const pal = palette ?? currentPaletteName;
  const key = cacheKey(url, pal) + "::battle";
  if (colorizedCache.has(key)) return colorizedCache.get(key)!;

  const rawData = await getRawImageData(url);
  const colorized = cloneImageData(rawData);
  const rgbPalette = getPaletteColors(pal) as unknown as Rgb[];
  // Identity mapping: shade 0→transparent, 1→color1, 2→color2, 3→color3
  remapToPalette(colorized.data, rgbPalette, true);

  const tmp = document.createElement("canvas");
  tmp.width = rawData.width;
  tmp.height = rawData.height;
  const tctx = tmp.getContext("2d")!;
  tctx.putImageData(colorized, 0, 0);

  colorizedCache.set(key, tmp);
  return tmp;
}

/** Draw a single 8x8 tile from the tileset canvas. */
export function drawTile(
  tileset: HTMLCanvasElement,
  tileId: number,
  destX: number,
  destY: number
): void {
  const tilesPerRow = Math.floor(tileset.width / TILE_SIZE);
  const srcX = (tileId % tilesPerRow) * TILE_SIZE;
  const srcY = Math.floor(tileId / tilesPerRow) * TILE_SIZE;

  ctx.drawImage(
    tileset,
    srcX,
    srcY,
    TILE_SIZE,
    TILE_SIZE,
    destX * scale,
    destY * scale,
    TILE_SIZE * scale,
    TILE_SIZE * scale
  );
}

/** Fill a rectangle with a palette color (0=lightest, 3=darkest). */
export function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  colorIndex: number
): void {
  const hex = paletteToHex(currentPaletteName);
  ctx.fillStyle = hex[colorIndex];
  ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
}

// Preloaded emote sprite (loaded on first use)
let emoteSprite: HTMLCanvasElement | null = null;
let emoteLoading = false;

/** Ensure the shock emote sprite is loaded. */
export async function loadEmoteSprite(): Promise<void> {
  if (emoteSprite || emoteLoading) return;
  emoteLoading = true;
  emoteSprite = await loadSprite("/gfx/emotes/shock.png");
}

/** Draw the "!" emote bubble above a sprite at (screenX, screenY). */
export function drawExclamationBubble(screenX: number, screenY: number): void {
  if (!emoteSprite) return;
  ctx.drawImage(
    emoteSprite,
    0,
    0,
    16,
    16,
    screenX * scale,
    (screenY - 16) * scale,
    16 * scale,
    16 * scale
  );
}

/** Draw a full-screen overlay for fade transitions. alpha 0=transparent, 1=opaque. */
export function drawFadeOverlay(alpha: number, color = "white"): void {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(alpha, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
}

/** Load a 1-bit font PNG (white=transparent, black=darkest palette color). */
export async function loadFont(url: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(url);
  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = img.height;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(img, 0, 0);
  const imageData = tctx.getImageData(0, 0, tmp.width, tmp.height);
  const data = imageData.data;

  // Font always uses near-black regardless of palette
  const r = 24,
    g = 24,
    b = 24; // #181818

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 128) {
      data[i + 3] = 0;
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  tctx.putImageData(imageData, 0, 0);
  return tmp;
}

/** Draw a 16x16 sprite frame from a sprite sheet. */
export function drawSprite(
  spriteSheet: HTMLCanvasElement,
  frameX: number,
  frameY: number,
  destX: number,
  destY: number,
  flipX = false
): void {
  ctx.save();
  if (flipX) {
    ctx.translate((destX + 16) * scale, destY * scale);
    ctx.scale(-1, 1);
    ctx.drawImage(
      spriteSheet,
      frameX,
      frameY,
      16,
      16,
      0,
      0,
      16 * scale,
      16 * scale
    );
  } else {
    ctx.drawImage(
      spriteSheet,
      frameX,
      frameY,
      16,
      16,
      destX * scale,
      destY * scale,
      16 * scale,
      16 * scale
    );
  }
  ctx.restore();
}
