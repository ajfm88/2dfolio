// World-space dropped item entity with sprite, lifetime timer, and Link collision
import { drawItemSprite } from '../../data/item-sprites.js';
import type { Rect } from '../../core/types.js';

// NES: ObjItemLifetime set to $FF, decremented every 2 frames
const INITIAL_LIFETIME = 255;
const FLASH_THRESHOLD = 64;

export class ItemPickup {
  readonly itemId: number;
  readonly x: number;
  readonly y: number;
  private lifetime = INITIAL_LIFETIME;
  private frameToggle = false;
  private _collected = false;

  // Argument order matches `drawItemSprite(ctx, sheet, itemId, x, y)` and every
  // call site in main.ts. It used to be (x, y, itemId) while all four callers
  // passed (itemId, x, y), so `itemId` held a world Y coordinate — no grid entry
  // matched it and `drawItemSprite` bailed, which is why dropped items were
  // invisible and uncollectable.
  constructor(itemId: number, x: number, y: number) {
    this.itemId = itemId;
    this.x = x;
    this.y = y;
  }

  get isActive(): boolean {
    return !this._collected && this.lifetime > 0;
  }

  get isCollected(): boolean {
    return this._collected;
  }

  update(): void {
    if (!this.isActive) return;
    // NES: timer decrements every 2 frames
    this.frameToggle = !this.frameToggle;
    if (this.frameToggle) {
      this.lifetime--;
    }
  }

  checkCollision(linkRect: Rect): boolean {
    if (!this.isActive) return false;
    return linkRect.x < this.x + 16 &&
           linkRect.x + linkRect.width > this.x &&
           linkRect.y < this.y + 16 &&
           linkRect.y + linkRect.height > this.y;
  }

  collect(): void {
    this._collected = true;
  }

  render(ctx: CanvasRenderingContext2D, itemsImage: HTMLImageElement | HTMLCanvasElement): void {
    if (!this.isActive) return;
    // Flash during last ~64 ticks (blink every 4 frames)
    if (this.lifetime < FLASH_THRESHOLD && (this.lifetime & 0x04) === 0) return;
    // Dungeon room item ids carry flag bits in the top two bits (same mask as
    // cave-room.ts and handleDungeonItemPickup).
    drawItemSprite(ctx, itemsImage, this.itemId & 0x3f, this.x, this.y);
  }
}
