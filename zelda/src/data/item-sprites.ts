// Maps NES item IDs to grid positions in items.png (10 columns × 4 rows, 40×40 cells)
// Grid positions sourced from zelda-clone-master ItemSpriteFactory.cs + visual inspection

export interface ItemSpritePos {
  readonly col: number;
  readonly row: number;
}

const ITEMS_COLS = 10;
const ITEMS_ROWS = 4;
export const ITEM_CELL_SIZE = 40; // items.png uses 40×40 cells

export function getItemSpritePos(itemId: number): ItemSpritePos | null {
  return ITEM_SPRITE_MAP[itemId] ?? null;
}

// Process items.png to replace background color with transparency
let processedItemsCanvas: HTMLCanvasElement | null = null;

export function processItemsImage(image: HTMLImageElement): HTMLCanvasElement {
  if (processedItemsCanvas) return processedItemsCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Check if image already has transparency (alpha < 255 in top-left pixel)
  if (data[3]! < 255) {
    // Already has alpha — just copy as-is
    processedItemsCanvas = canvas;
    return canvas;
  }

  // Use top-left pixel as transparency key
  const keyR = data[0]!;
  const keyG = data[1]!;
  const keyB = data[2]!;
  const tolerance = 2;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i]! - keyR) <= tolerance &&
        Math.abs(data[i + 1]! - keyG) <= tolerance &&
        Math.abs(data[i + 2]! - keyB) <= tolerance) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  processedItemsCanvas = canvas;
  return canvas;
}

export function drawItemSprite(
  ctx: CanvasRenderingContext2D,
  itemsImage: HTMLImageElement | HTMLCanvasElement,
  itemId: number,
  x: number,
  y: number,
  w = 16,
  h?: number,
): boolean {
  const pos = getItemSpritePos(itemId);
  if (!pos) return false;

  const cellW = itemsImage.width / ITEMS_COLS;
  const cellH = itemsImage.height / ITEMS_ROWS;

  // Crop to center ~60% of each cell where the actual sprite lives
  // The 40×40 cells have ~12px padding around a ~16×16 sprite
  const inset = cellW * 0.3;
  const sx = pos.col * cellW + inset;
  const sy = pos.row * cellH + inset;
  const sw = cellW - inset * 2;
  const sh = cellH - inset * 2;

  ctx.drawImage(itemsImage, sx, sy, sw, sh, x, y, w, h ?? w);
  return true;
}

export function getProcessedItemsCanvas(): HTMLCanvasElement | null {
  return processedItemsCanvas;
}

// NES-resolution item strip (primaryItems.png): 24×48 cells in a horizontal strip.
// col2 = second cell for double-wide items (raft, ladder) rendered side by side.
const NES_STRIP_CELL_W = 24;
const NES_STRIP_CELL_H = 48;

interface StripEntry { col: number; col2?: number; }

const NES_STRIP_MAP: Record<number, StripEntry> = {
  0x00: { col: 10 },            // Bomb
  0x04: { col: 18 },            // Food/Bait (meat)
  0x05: { col: 20 },            // Flute/Recorder
  0x06: { col: 15 },            // Blue Candle
  0x07: { col: 14 },            // Red Candle
  0x08: { col: 12 },            // Wood Arrow
  0x09: { col: 13 },            // Silver Arrow
  0x0a: { col: 11 },            // Bow
  0x0b: { col: 28 },            // Magic Key (lion head)
  0x0c: { col: 21, col2: 22 },  // Raft (left + right halves)
  0x0d: { col: 23, col2: 24 },  // Ladder (left + right halves)
  0x10: { col: 25 },            // Wand/Magic Rod (blue staff)
  0x11: { col: 26 },            // Book of Magic (red book)
  0x12: { col: 17 },            // Blue Ring
  0x13: { col: 16 },            // Red Ring
  0x14: { col: 19 },            // Power Bracelet
  0x15: { col: 6 },             // Letter (red parchment)
  0x1c: { col: 3 },             // Magic Shield
  0x1d: { col: 8 },             // Wood Boomerang
  0x1e: { col: 9 },             // Magic Boomerang
  0x1f: { col: 5 },             // Blue Potion
  0x20: { col: 4 },             // Red Potion
};

let processedNESStrip: HTMLCanvasElement | null = null;

export function processNESItemStrip(image: HTMLImageElement): HTMLCanvasElement {
  if (processedNESStrip) return processedNESStrip;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  if (data[3]! < 255) {
    processedNESStrip = canvas;
    return canvas;
  }
  const keyR = data[0]!, keyG = data[1]!, keyB = data[2]!;
  const tolerance = 2;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i]! - keyR) <= tolerance &&
        Math.abs(data[i + 1]! - keyG) <= tolerance &&
        Math.abs(data[i + 2]! - keyB) <= tolerance) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  processedNESStrip = canvas;
  return canvas;
}

export function drawNESItemSprite(
  ctx: CanvasRenderingContext2D,
  stripImage: HTMLImageElement | HTMLCanvasElement,
  itemId: number,
  x: number,
  y: number,
  w = 8,
  h = 16,
): boolean {
  const entry = NES_STRIP_MAP[itemId];
  if (!entry) return false;
  if (entry.col2 !== undefined) {
    ctx.drawImage(
      stripImage,
      entry.col * NES_STRIP_CELL_W, 0, NES_STRIP_CELL_W, NES_STRIP_CELL_H,
      x, y, w, h,
    );
    ctx.drawImage(
      stripImage,
      entry.col2 * NES_STRIP_CELL_W, 0, NES_STRIP_CELL_W, NES_STRIP_CELL_H,
      x + w, y, w, h,
    );
  } else {
    ctx.drawImage(
      stripImage,
      entry.col * NES_STRIP_CELL_W, 0, NES_STRIP_CELL_W, NES_STRIP_CELL_H,
      x, y, w, h,
    );
  }
  return true;
}

// NES item ID → items.png grid position
// IDs from ITEM_NAMES in item-types.ts
const ITEM_SPRITE_MAP: Record<number, ItemSpritePos> = {
  0x00: { col: 5, row: 0 },  // Bomb
  0x01: { col: 7, row: 3 },  // WoodSword
  0x02: { col: 7, row: 3 },  // WhiteSword (same sprite, different palette on NES)
  0x03: { col: 7, row: 3 },  // MagicSword
  0x04: { col: 2, row: 3 },  // Bait
  0x05: { col: 3, row: 3 },  // Flute/Recorder
  0x06: { col: 3, row: 0 },  // BlueCandle
  0x07: { col: 4, row: 0 },  // RedCandle
  0x08: { col: 1, row: 1 },  // WoodArrow
  0x09: { col: 1, row: 1 },  // SilverArrow (same sprite)
  0x0a: { col: 8, row: 0 },  // Bow
  0x0b: { col: 7, row: 1 },  // MagicKey
  0x0c: { col: 0, row: 2 },  // Raft
  0x0d: { col: 1, row: 2 },  // Ladder
  0x0f: { col: 4, row: 3 },  // FiveRupees
  0x10: { col: 4, row: 2 },  // Wand/MagicRod
  0x11: { col: 5, row: 2 },  // Book
  0x12: { col: 6, row: 2 },  // BlueRing
  0x13: { col: 6, row: 2 },  // RedRing (same sprite, different color)
  0x14: { col: 7, row: 2 },  // PowerBracelet
  0x15: { col: 8, row: 2 },  // Letter
  0x16: { col: 2, row: 1 },  // Compass
  0x17: { col: 6, row: 2 },  // Map
  0x18: { col: 4, row: 3 },  // OneRupee
  0x19: { col: 7, row: 1 },  // Key
  0x1a: { col: 6, row: 1 },  // HeartContainer
  0x1b: { col: 8, row: 3 },  // TriforcePiece
  0x1c: { col: 2, row: 2 },  // MagicShield
  0x1d: { col: 7, row: 0 },  // WoodBoomerang
  0x1e: { col: 7, row: 0 },  // MagicBoomerang (same sprite)
  0x1f: { col: 9, row: 1 },  // BluePotionOrHeart
  0x20: { col: 9, row: 1 },  // RedPotionOrHeart
  0x21: { col: 9, row: 0 },  // Clock
  0x22: { col: 6, row: 3 },  // Heart
  0x23: { col: 4, row: 1 },  // Fairy
};
