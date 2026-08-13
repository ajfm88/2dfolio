import type { Renderer } from '../render/renderer.js';
import { SpriteSheet } from '../render/sprite-renderer.js';

const HEART_SIZE = 8;
const HEARTS_PER_ROW = 8;

const FULL_HEART = 0;
const HALF_HEART = 1;
const EMPTY_HEART = 2;

export class HeartMeter {
  private readonly sheet: SpriteSheet;

  constructor(treasuresImage: HTMLImageElement) {
    this.sheet = new SpriteSheet({
      image: treasuresImage,
      cellWidth: HEART_SIZE,
      cellHeight: HEART_SIZE,
      columns: Math.floor(treasuresImage.width / HEART_SIZE),
      autoDetectTransparency: true,
    });
  }

  render(
    renderer: Renderer,
    health: number,
    maxHealth: number,
    startX: number,
    startY: number,
  ): void {
    const { fullCount, hasHalf, emptyCount } = computeHearts(health, maxHealth);
    const containers = fullCount + (hasHalf ? 1 : 0) + emptyCount;

    for (let i = 0; i < containers; i++) {
      const col = i % HEARTS_PER_ROW;
      const row = Math.floor(i / HEARTS_PER_ROW);
      const dx = startX + col * HEART_SIZE;
      const dy = startY + row * HEART_SIZE;

      let frame: number;
      if (i < fullCount) {
        frame = FULL_HEART;
      } else if (i === fullCount && hasHalf) {
        frame = HALF_HEART;
      } else {
        frame = EMPTY_HEART;
      }

      this.sheet.drawFrame(renderer, frame, dx, dy);
    }
  }
}

// Z_01.asm FormatHeartsInTextBuf — half-heart granularity
export function computeHearts(
  health: number,
  maxHealth: number,
): { fullCount: number; hasHalf: boolean; emptyCount: number } {
  const containers = Math.floor(maxHealth / 2);
  const fullCount = Math.floor(health / 2);
  const hasHalf = health % 2 === 1;
  const filledSlots = fullCount + (hasHalf ? 1 : 0);
  const emptyCount = Math.max(0, containers - filledSlots);
  return { fullCount, hasHalf, emptyCount };
}
