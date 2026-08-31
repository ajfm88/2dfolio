import { SCREEN_WIDTH, HUD_HEIGHT } from '../core/constants.js';
import { drawItemSprite } from '../data/item-sprites.js';
import type { Renderer } from '../render/renderer.js';
import { BitmapFont } from './bitmap-font.js';
import { HeartMeter } from './heart-meter.js';

// Remove the baked-in sword graphic from hud.png. Scan the A-slot area and
// black out any pixel that isn't part of the blue box border or already black.
export function processHudImage(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  // Scan only the interior of the A-slot box (inside the blue border),
  // avoiding the "A" label above and the border itself.
  const sx = A_ITEM_X;
  const sy = A_ITEM_Y;
  const sw = 16;
  const sh = 16;
  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const isBlack = r < 20 && g < 20 && b < 20;
    const isBlue = b > 100 && r < 60 && g < 60;
    if (!isBlack && !isBlue) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
    }
  }

  ctx.putImageData(imageData, sx, sy);
  return canvas;
}

export interface HudState {
  readonly rupees: number;
  readonly keys: number;
  readonly bombs: number;
  readonly hasMagicKey: boolean;
  readonly health: number;
  readonly maxHealth: number;
  readonly bItem: number | null;
  readonly aItem: number | null;
  readonly mapRow: number;
  readonly mapCol: number;
  readonly isOverworld: boolean;
  readonly levelNumber: number;
  readonly dungeonRoomCol?: number;
  readonly dungeonRoomRow?: number;
  readonly dungeonVisitedRooms?: ReadonlySet<number>;
  readonly dungeonValidRooms?: readonly number[];
  readonly hasMap?: boolean;
  readonly hasCompass?: boolean;
  readonly triforceRoomId?: number;
}

// NES-accurate positions (from PPU nametable addresses in Z_01.asm)
const HEARTS_X = 176;
const HEARTS_Y = 40;
const RUPEE_X = 96;
const RUPEE_Y = 24;
const KEY_X = 96;
const KEY_Y = 40;
const BOMB_X = 96;
const BOMB_Y = 48;

// HUD item slot positions (NES: B at $7C,$1F = 124,31; A at $94,$1F = 148,31)
const B_ITEM_X = 124;
const B_ITEM_Y = 32;
const A_ITEM_X = 147;
const A_ITEM_Y = 32;

// Minimap dot (from UpdatePlayerPositionMarker in Z_01.asm)
const MAP_DOT_BASE_X = 17;
const MAP_DOT_BASE_Y = 24;
const MAP_DOT_STRIDE = 4;
const MAP_DOT_SIZE = 3;
const MAP_DOT_COLOR = '#83d313';

// Dungeon minimap area
const DMAP_BASE_X = 16;
const DMAP_BASE_Y = 22;
const DMAP_CELL_W = 8;
const DMAP_CELL_H = 4;
const DMAP_COLS = 8;
const DMAP_ROWS = 8;
const DMAP_ROOM_COLOR = '#5c94fc';
const DMAP_MAP_ROOM_COLOR = '#3c5a9c';
const DMAP_CURRENT_COLOR = '#83d313';
const DMAP_TRIFORCE_COLOR = '#ff0000';

// Level text position
const LEVEL_TEXT_X = 16;
const LEVEL_TEXT_Y = 16;

export class HudRenderer {
  private readonly font: BitmapFont;
  private readonly heartMeter: HeartMeter;
  private readonly hudImage: HTMLImageElement | HTMLCanvasElement;
  private readonly itemsImage: HTMLImageElement | HTMLCanvasElement | null;
  private _blinkTimer = 0;

  constructor(
    hudImage: HTMLImageElement | HTMLCanvasElement,
    fontImage: HTMLImageElement,
    treasuresImage: HTMLImageElement,
    itemsImage?: HTMLImageElement | HTMLCanvasElement,
  ) {
    this.hudImage = hudImage;
    this.font = new BitmapFont(fontImage);
    this.heartMeter = new HeartMeter(treasuresImage);
    this.itemsImage = itemsImage ?? null;
  }

  render(renderer: Renderer, state: HudState): void {
    renderer.drawImage(
      this.hudImage,
      0, 0, SCREEN_WIDTH, HUD_HEIGHT,
      0, 0, SCREEN_WIDTH, HUD_HEIGHT,
    );

    this.heartMeter.render(
      renderer, state.health, state.maxHealth, HEARTS_X, HEARTS_Y,
    );

    this.font.drawString(renderer, RUPEE_X, RUPEE_Y, formatCount(state.rupees));

    if (state.hasMagicKey) {
      this.font.drawString(renderer, KEY_X, KEY_Y, 'XA');
    } else {
      this.font.drawString(renderer, KEY_X, KEY_Y, formatCount(state.keys));
    }

    this.font.drawString(renderer, BOMB_X, BOMB_Y, formatCount(state.bombs));

    if (this.itemsImage) {
      if (state.bItem !== null) {
        drawItemSprite(renderer.ctx, this.itemsImage, state.bItem, B_ITEM_X, B_ITEM_Y);
      }
      if (state.aItem !== null) {
        drawItemSprite(renderer.ctx, this.itemsImage, state.aItem, A_ITEM_X, A_ITEM_Y);
      }
    }

    if (state.isOverworld) {
      this.renderOverworldDot(renderer, state.mapRow, state.mapCol);
    } else if (state.levelNumber > 0) {
      this._blinkTimer++;
      this.renderDungeonMinimap(renderer, state);
    }
  }

  private renderOverworldDot(
    renderer: Renderer, row: number, col: number,
  ): void {
    const x = MAP_DOT_BASE_X + col * MAP_DOT_STRIDE;
    const y = MAP_DOT_BASE_Y + row * MAP_DOT_STRIDE;
    renderer.fillRect(x, y, MAP_DOT_SIZE, MAP_DOT_SIZE, MAP_DOT_COLOR);
  }

  private renderDungeonMinimap(renderer: Renderer, state: HudState): void {
    const ctx = renderer.ctx;

    // "LEVEL-N" text
    this.font.drawString(renderer, LEVEL_TEXT_X, LEVEL_TEXT_Y, `LEVEL-${state.levelNumber}`);

    // If player has Map, show all valid rooms as dim squares
    if (state.hasMap && state.dungeonValidRooms) {
      for (const roomId of state.dungeonValidRooms) {
        const col = roomId % 16;
        const row = Math.floor(roomId / 16);
        if (col >= DMAP_COLS || row >= DMAP_ROWS) continue;
        const rx = DMAP_BASE_X + col * DMAP_CELL_W;
        const ry = DMAP_BASE_Y + row * DMAP_CELL_H;
        ctx.fillStyle = DMAP_MAP_ROOM_COLOR;
        ctx.fillRect(rx, ry, DMAP_CELL_W - 1, DMAP_CELL_H - 1);
      }
    }

    // Draw visited rooms as bright rectangles (on top of map rooms)
    const visited = state.dungeonVisitedRooms;
    if (visited) {
      for (const roomId of visited) {
        const col = roomId % 16;
        const row = Math.floor(roomId / 16);
        if (col >= DMAP_COLS || row >= DMAP_ROWS) continue;
        const rx = DMAP_BASE_X + col * DMAP_CELL_W;
        const ry = DMAP_BASE_Y + row * DMAP_CELL_H;
        ctx.fillStyle = DMAP_ROOM_COLOR;
        ctx.fillRect(rx, ry, DMAP_CELL_W - 1, DMAP_CELL_H - 1);
      }
    }

    // If player has Compass, blink triforce room in red
    if (state.hasCompass && state.triforceRoomId !== undefined) {
      const blink = (this._blinkTimer >> 4) & 1;
      if (blink) {
        const col = state.triforceRoomId % 16;
        const row = Math.floor(state.triforceRoomId / 16);
        if (col < DMAP_COLS && row < DMAP_ROWS) {
          const rx = DMAP_BASE_X + col * DMAP_CELL_W;
          const ry = DMAP_BASE_Y + row * DMAP_CELL_H;
          ctx.fillStyle = DMAP_TRIFORCE_COLOR;
          ctx.fillRect(rx, ry, DMAP_CELL_W - 1, DMAP_CELL_H - 1);
        }
      }
    }

    // Blink current room marker (green, on top of everything)
    if (state.dungeonRoomCol !== undefined && state.dungeonRoomRow !== undefined) {
      const blink = (this._blinkTimer >> 3) & 1;
      if (blink) {
        const cx = DMAP_BASE_X + state.dungeonRoomCol * DMAP_CELL_W;
        const cy = DMAP_BASE_Y + state.dungeonRoomRow * DMAP_CELL_H;
        ctx.fillStyle = DMAP_CURRENT_COLOR;
        ctx.fillRect(cx, cy, DMAP_CELL_W - 1, DMAP_CELL_H - 1);
      }
    }
  }
}

// NES FormatDecimalCountByte (Z_01.asm:2940): "X23" for <100, "123" for >=100
export function formatCount(value: number): string {
  if (value >= 100) return String(value);
  return `X${value}`;
}
