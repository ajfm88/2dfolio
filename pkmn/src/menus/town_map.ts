// Town Map — fullscreen Kanto region overview with blinking cursor + player sprite
// Matches assembly: engine/items/town_map.asm

import { TILE_SIZE } from '../core';
import { getCtx, getScale, loadTileset, loadSprite, fillRect } from '../renderer';
import { isPressed } from '../input';
import { drawText } from './menu_render';
import { playSFX } from '../audio';

interface TownMapLocation {
  x: number;
  y: number;
  name: string;
}

interface TownMapData {
  tilemap: number[];
  width: number;
  height: number;
  locations: Record<string, TownMapLocation>;
  order: string[];
  indoorMapParent: Record<string, string>;
}

type TownMapResult = 'open' | 'closed';

// Tileset layout: 32×32 PNG = 4 tiles wide × 4 tiles tall = 16 tiles
const TILESET_COLS = 4;

// Cursor blink: 25 frames visible, 25 frames hidden (town_map.asm:606)
const BLINK_PERIOD = 50;
const BLINK_ON = 25;

// Sprite sizes
const SPRITE_SIZE = 16;
const CURSOR_SIZE = 16;

export class TownMap {
  private data: TownMapData | null = null;
  private tileset: HTMLCanvasElement | null = null;
  private playerSprite: HTMLCanvasElement | null = null;
  private cursorSprite: HTMLCanvasElement | null = null;
  private loaded = false;
  private cursorIndex = 0;
  private playerLocationKey = '';
  private blinkTimer = 0;

  async show(currentMapName: string): Promise<void> {
    if (!this.loaded) {
      const [data, tileset, sprite, cursor] = await Promise.all([
        fetch('town_map.json').then(r => r.json()) as Promise<TownMapData>,
        loadTileset('/gfx/town_map/town_map.png', 'TOWNMAP'),
        loadSprite('/gfx/sprites/red.png', 'TOWNMAP'),
        loadSprite('/gfx/town_map/town_map_cursor.png', 'TOWNMAP'),
      ]);
      this.data = data;
      this.tileset = tileset;
      this.playerSprite = sprite;
      this.cursorSprite = cursor;
      this.loaded = true;
    }

    // Resolve indoor maps to their parent location
    const parentKey = this.data!.indoorMapParent[currentMapName];
    this.playerLocationKey = parentKey ?? currentMapName;

    // Set cursor to player's current location in the order list
    const orderIdx = this.data!.order.indexOf(this.playerLocationKey);
    this.cursorIndex = orderIdx >= 0 ? orderIdx : 0;
    this.blinkTimer = 0;
  }

  update(): TownMapResult {
    if (!this.data) return 'open'; // still loading

    this.blinkTimer = (this.blinkTimer + 1) % BLINK_PERIOD;

    if (isPressed('a') || isPressed('b')) {
      playSFX('press_ab');
      return 'closed';
    }

    const len = this.data.order.length;
    if (isPressed('up')) {
      this.cursorIndex = (this.cursorIndex + 1) % len;
    } else if (isPressed('down')) {
      this.cursorIndex = (this.cursorIndex - 1 + len) % len;
    }

    return 'open';
  }

  render(): void {
    if (!this.data || !this.tileset) return;

    const ctx = getCtx();
    const s = getScale();
    const { tilemap, width, height, locations, order } = this.data;

    // Draw the tilemap (full screen 20×18 tiles)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileIdx = tilemap[row * width + col];
        const srcX = (tileIdx % TILESET_COLS) * TILE_SIZE;
        const srcY = Math.floor(tileIdx / TILESET_COLS) * TILE_SIZE;
        ctx.drawImage(
          this.tileset,
          srcX, srcY, TILE_SIZE, TILE_SIZE,
          col * TILE_SIZE * s, row * TILE_SIZE * s, TILE_SIZE * s, TILE_SIZE * s,
        );
      }
    }

    // Current cursor location
    const cursorKey = order[this.cursorIndex];
    const cursorLoc = locations[cursorKey];
    if (!cursorLoc) return;

    // Draw location name at top-left (inside border, starting at tile 1)
    const name = cursorLoc.name;
    fillRect(TILE_SIZE, 0, name.length * TILE_SIZE, TILE_SIZE, 0);
    drawText(name, TILE_SIZE, 0);

    // Sprite screen position from OAM coordinates (town_map.asm:433-468):
    // OAM = (x*8+24, y*8+24), then -4,-4 centering, then OAM→screen offset (-8, -16)
    // Final sprite top-left: screen_x = x*8+12, screen_y = y*8+4

    // 1. Draw Red's sprite at player's current location (always visible)
    const playerLoc = locations[this.playerLocationKey];
    if (playerLoc && this.playerSprite) {
      const px = playerLoc.x * 8 + 12;
      const py = playerLoc.y * 8 + 4;
      ctx.drawImage(
        this.playerSprite,
        0, 0, SPRITE_SIZE, SPRITE_SIZE,
        px * s, py * s, SPRITE_SIZE * s, SPRITE_SIZE * s,
      );
    }

    // 2. Draw blinking cursor at the selected/browsed location
    if (this.blinkTimer < BLINK_ON && this.cursorSprite) {
      const cx = cursorLoc.x * 8 + 12;
      const cy = cursorLoc.y * 8 + 4;
      ctx.drawImage(
        this.cursorSprite,
        0, 0, CURSOR_SIZE, CURSOR_SIZE,
        cx * s, cy * s, CURSOR_SIZE * s, CURSOR_SIZE * s,
      );
    }
  }
}
