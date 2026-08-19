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

export function drawItemSprite(
  ctx: CanvasRenderingContext2D,
  itemsImage: HTMLImageElement,
  itemId: number,
  x: number,
  y: number,
  size = 16,
): boolean {
  const pos = getItemSpritePos(itemId);
  if (!pos) return false;

  const cellW = itemsImage.width / ITEMS_COLS;
  const cellH = itemsImage.height / ITEMS_ROWS;
  const sx = pos.col * cellW;
  const sy = pos.row * cellH;

  // Center the item sprite — actual item is ~16×16 centered in the 40×40 cell
  // Draw the full cell scaled to target size
  ctx.drawImage(itemsImage, sx, sy, cellW, cellH, x, y, size, size);
  return true;
}

// NES item ID → items.png grid position
// IDs from ITEM_NAMES in item-types.ts
const ITEM_SPRITE_MAP: Record<number, ItemSpritePos> = {
  0x00: { col: 5, row: 0 },  // Bomb
  0x01: { col: 1, row: 3 },  // WoodSword
  0x02: { col: 1, row: 3 },  // WhiteSword (same sprite, different palette on NES)
  0x03: { col: 1, row: 3 },  // MagicSword
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
  0x22: { col: 6, row: 3 },  // Heart
  0x23: { col: 4, row: 1 },  // Fairy
};
