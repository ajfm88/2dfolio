import type { Renderer } from '../render/renderer.js';
import { SpriteSheet } from '../render/sprite-renderer.js';

// ZeldaJS font.png: 9×7 pixel cells, 26 columns × 2 rows
// Characters render at 8px advance (the 9th pixel is built-in spacing)
const CELL_WIDTH = 9;
const CELL_HEIGHT = 7;
const CHAR_ADVANCE = 8;

export class BitmapFont {
  private readonly sheet: SpriteSheet;

  constructor(fontImage: HTMLImageElement | HTMLCanvasElement) {
    const columns = Math.floor(fontImage.width / CELL_WIDTH);
    this.sheet = new SpriteSheet({
      image: fontImage,
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      columns,
      autoDetectTransparency: fontImage instanceof HTMLImageElement,
    });
  }

  drawString(renderer: Renderer, x: number, y: number, text: string | number): void {
    const str = String(text);
    let dx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i]!;
      this.sheet.drawFrame(renderer, charToIndex(ch, this.sheet.columns), dx, y);
      dx += CHAR_ADVANCE;
    }
  }
}

/**
 * Maps a character to its font sprite sheet index.
 * Layout matches ZeldaJS: row 0 = digits + specials, row 1 = A–Z.
 */
export function charToIndex(ch: string, columns: number): number {
  const code = ch.charCodeAt(0);
  if (ch >= '0' && ch <= '9') return code - 0x30;
  if (ch >= 'A' && ch <= 'Z') return columns + (code - 0x41);
  switch (ch) {
    case '-': return 10;
    case '.': return 11;
    case '>': return 12;
    case '@': return 13;
    case '!': return 14;
    case "'": return 15;
    default: return 16;
  }
}
