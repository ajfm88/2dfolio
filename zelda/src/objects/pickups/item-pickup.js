// World-space dropped item entity with sprite, lifetime timer, and Link collision
import { drawItemSprite } from '../../data/item-sprites.js';

// NES: ObjItemLifetime set to $FF, decremented every 2 frames
const INITIAL_LIFETIME = 255;
const FLASH_THRESHOLD = 64;

export class ItemPickup {
   itemId;
   x;
   y;
   persistent;
   lifetime = INITIAL_LIFETIME;
   frameToggle = false;
   _collected = false;

  constructor(itemId, x, y, persistent = false) {
    this.itemId = itemId;
    this.x = x;
    this.y = y;
    this.persistent = persistent;
  }

  get isActive() {
    return !this._collected && this.lifetime > 0;
  }

  get isCollected() {
    return this._collected;
  }

  update() {
    if (!this.isActive) return;
    if (this.persistent) return;
    // NES: timer decrements every 2 frames
    this.frameToggle = !this.frameToggle;
    if (this.frameToggle) {
      this.lifetime--;
    }
  }

  checkCollision(linkRect) {
    if (!this.isActive) return false;
    return linkRect.x < this.x + 16 &&
           linkRect.x + linkRect.width > this.x &&
           linkRect.y < this.y + 16 &&
           linkRect.y + linkRect.height > this.y;
  }

  collect() {
    this._collected = true;
  }

  render(ctx, itemsImage) {
    if (!this.isActive) return;
    // Flash during last ~64 ticks (blink every 4 frames)
    if (this.lifetime < FLASH_THRESHOLD && (this.lifetime & 0x04) === 0) return;
    // Dungeon room item ids carry flag bits in the top two bits (same mask as
    // cave-room.ts and handleDungeonItemPickup).
    drawItemSprite(ctx, itemsImage, this.itemId & 0x3f, this.x, this.y);
  }
}
