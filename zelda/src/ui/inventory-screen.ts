// NES-accurate inventory subscreen renderer
// Layout from ZeldaJS InventoryState.ts + NES disassembly Z_05.asm DrawSubmenuItems
import { PLAY_AREA_HEIGHT, SCREEN_WIDTH } from '../core/constants.js';
import { drawItemSprite } from '../data/item-sprites.js';
import type { Inventory } from '../objects/player/inventory.js';
import { SELECTABLE_SLOT_COUNT } from '../objects/player/inventory.js';
import type { Renderer } from '../render/renderer.js';
import type { BitmapFont } from './bitmap-font.js';
import type { HudRenderer } from './hud.js';
import type { HudState } from './hud.js';

const BOX_COLOR = '#4040ef';
const TRIFORCE_COLOR = '#f0cac2';

// B-item box (left)
const B_BOX_X = 58;
const B_BOX_Y = 40;
const B_BOX_W = 28;
const B_BOX_H = 24;
const B_ITEM_X = 64;
const B_ITEM_Y = 44;

// Item grid box (right)
const GRID_BOX_X = 126;
const GRID_BOX_Y = 40;
const GRID_BOX_W = 98;
const GRID_BOX_H = 48;

// Non-selectable passive items row (top of grid)
const PASSIVE_Y = 44;
const PASSIVE_XS = [128, 144, 160, 176, 192, 208] as const;
// Order: raft, book, ring, ladder, magicKey, bracelet
const PASSIVE_CHECKS: ((inv: Inventory) => number)[] = [
  inv => inv.raft ? 0x0c : -1,
  inv => inv.book ? 0x11 : -1,
  inv => inv.ring >= 2 ? 0x13 : inv.ring >= 1 ? 0x12 : -1,
  inv => inv.ladder ? 0x0d : -1,
  inv => inv.magicKey ? 0x0b : -1,
  inv => inv.bracelet ? 0x14 : -1,
];

// Selectable item grid (2 rows × 4 columns)
const SELECT_ROW_0_Y = 56;
const SELECT_ROW_1_Y = 72;
const SELECT_COL_XS = [128, 152, 176, 200] as const;

// Slot → grid position: row 0 = slots 0-4 (skip bow=3), row 1 = slots 5-8
function slotToGridPos(slot: number): { x: number; y: number } | null {
  switch (slot) {
    case 0: return { x: SELECT_COL_XS[0], y: SELECT_ROW_0_Y };
    case 1: return { x: SELECT_COL_XS[1], y: SELECT_ROW_0_Y };
    case 2: return { x: SELECT_COL_XS[2], y: SELECT_ROW_0_Y };
    case 4: return { x: SELECT_COL_XS[3], y: SELECT_ROW_0_Y };
    case 5: return { x: SELECT_COL_XS[0], y: SELECT_ROW_1_Y };
    case 6: return { x: SELECT_COL_XS[1], y: SELECT_ROW_1_Y };
    case 7: return { x: SELECT_COL_XS[2], y: SELECT_ROW_1_Y };
    case 8: return { x: SELECT_COL_XS[3], y: SELECT_ROW_1_Y };
    default: return null;
  }
}

function getSelectableItemId(inv: Inventory, slot: number): number {
  switch (slot) {
    case 0: return inv.magicBoomerang ? 0x1e : inv.woodBoomerang ? 0x1d : -1;
    case 1: return 0x00; // bomb icon always shown if any bombs ever held
    case 2: return inv.arrow >= 2 ? 0x09 : inv.arrow >= 1 ? 0x08 : -1;
    case 4: return inv.candle >= 2 ? 0x07 : inv.candle >= 1 ? 0x06 : -1;
    case 5: return inv.flute ? 0x05 : -1;
    case 6: return inv.food ? 0x04 : -1;
    case 7:
      if (inv.potion > 0) return inv.potion >= 2 ? 0x20 : 0x1f;
      if (inv.letter >= 1) return 0x15;
      return -1;
    case 8: return inv.wand ? 0x10 : -1;
    default: return -1;
  }
}

// Cursor flash: 8-frame toggle (NES palette row cycling)
const CURSOR_FLASH_FRAMES = 8;

export class InventoryScreen {
  private cursorVisible = true;
  private cursorTimer = 0;

  update(): void {
    this.cursorTimer++;
    if (this.cursorTimer >= CURSOR_FLASH_FRAMES) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
    }
  }

  render(
    renderer: Renderer,
    inventory: Inventory,
    whiteFont: BitmapFont,
    redFont: BitmapFont,
    itemsImage: HTMLImageElement | HTMLCanvasElement,
    hudRenderer: HudRenderer,
    hudState: HudState,
  ): void {
    const ctx = renderer.ctx;

    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, PLAY_AREA_HEIGHT);

    // "INVENTORY" in red
    redFont.drawString(renderer, 32, 16, 'INVENTORY');

    // B-item box
    this.drawBox(ctx, B_BOX_X, B_BOX_Y, B_BOX_W, B_BOX_H);
    const bItemId = inventory.getEquippedBItemId();
    if (bItemId !== null) {
      drawItemSprite(ctx, itemsImage, bItemId, B_ITEM_X, B_ITEM_Y);
    }

    // Labels
    whiteFont.drawString(renderer, 14, 68, 'USE B BUTTON');
    whiteFont.drawString(renderer, 30, 78, 'FOR THIS');

    // Item grid box
    this.drawBox(ctx, GRID_BOX_X, GRID_BOX_Y, GRID_BOX_W, GRID_BOX_H);

    // Passive (non-selectable) items top row
    for (let i = 0; i < PASSIVE_CHECKS.length; i++) {
      const check = PASSIVE_CHECKS[i]!;
      const itemId = check(inventory);
      if (itemId >= 0) {
        drawItemSprite(ctx, itemsImage, itemId, PASSIVE_XS[i]!, PASSIVE_Y);
      }
    }

    // Selectable items grid
    const selectableSlots = [0, 1, 2, 4, 5, 6, 7, 8];
    for (const slot of selectableSlots) {
      const itemId = getSelectableItemId(inventory, slot);
      if (itemId < 0) continue;
      const pos = slotToGridPos(slot);
      if (!pos) continue;
      drawItemSprite(ctx, itemsImage, itemId, pos.x, pos.y);

      // Arrow+bow: draw bow next to arrow (NES renders both at slot 2 area)
      if (slot === 2 && inventory.bow) {
        drawItemSprite(ctx, itemsImage, 0x0a, pos.x + 8, pos.y);
      }
    }

    // Cursor around selected slot
    if (this.cursorVisible) {
      const pos = slotToGridPos(inventory.selectedBSlot);
      if (pos) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x - 2, pos.y - 2, 20, 20);
      }
    }

    // Triforce section
    this.drawTriforceOutline(ctx, 108);
    redFont.drawString(renderer, 94, 165, 'TRIFORCE');

    // Triforce pieces (bits 0-7)
    this.drawTriforcePieces(ctx, inventory.triforce, 108);

    // HUD bar at bottom of subscreen
    ctx.save();
    ctx.translate(0, PLAY_AREA_HEIGHT);
    hudRenderer.render(renderer, hudState);
    ctx.restore();
  }

  private drawBox(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    ctx.fillStyle = BOX_COLOR;
    ctx.fillRect(x + 1, y, w - 2, 2);
    ctx.fillRect(x + w - 2, y + 1, 2, h - 2);
    ctx.fillRect(x + 1, y + h - 2, w - 2, 2);
    ctx.fillRect(x, y + 1, 2, h - 2);
  }

  private drawTriforceOutline(
    ctx: CanvasRenderingContext2D, y: number,
  ): void {
    const midX = SCREEN_WIDTH / 2;
    ctx.strokeStyle = TRIFORCE_COLOR;
    ctx.lineWidth = 1.5;
    const yOff = y + 0.5;
    const ratio = 115 / 141;

    // Outer triangle
    ctx.beginPath();
    ctx.moveTo(midX, yOff);
    ctx.lineTo(midX + 60, yOff + 60 * ratio);
    ctx.lineTo(midX - 60, yOff + 60 * ratio);
    ctx.closePath();
    ctx.stroke();

    // Inner inverted triangle (cutout)
    const ratio2 = 162 / 195;
    ctx.beginPath();
    ctx.moveTo(midX, yOff + 8);
    ctx.lineTo(midX + 42, yOff + 50 * ratio2);
    ctx.lineTo(midX - 42, yOff + 50 * ratio2);
    ctx.closePath();
    ctx.stroke();
  }

  private drawTriforcePieces(
    ctx: CanvasRenderingContext2D, mask: number, _baseY: number,
  ): void {
    if (mask === 0) return;
    // Simple representation: draw filled golden triangles for collected pieces
    // 8 pieces arranged around the triforce outline
    ctx.fillStyle = '#f0c000';
    for (let i = 0; i < 8; i++) {
      if (!(mask & (1 << i))) continue;
      // Distribute pieces in two rows of 4 within the triforce area
      const row = i < 4 ? 0 : 1;
      const col = i % 4;
      const px = 96 + col * 20;
      const py = 126 + row * 16;
      ctx.fillRect(px, py, 8, 8);
    }
  }
}

// Z_05.asm FindAndSelectOccupiedItemSlot: cycle through occupied selectable slots
export function getNextOwnedSlot(
  inventory: Inventory,
  currentSlot: number,
  direction: 1 | -1,
): number {
  let slot = currentSlot;
  for (let attempts = 0; attempts < SELECTABLE_SLOT_COUNT; attempts++) {
    slot = ((slot + direction) % SELECTABLE_SLOT_COUNT + SELECTABLE_SLOT_COUNT) % SELECTABLE_SLOT_COUNT;
    if (slot === 3) continue; // bow always skipped
    if (inventory.hasSelectableItem(slot)) return slot;
  }
  return currentSlot;
}
