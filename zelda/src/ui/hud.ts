import { SCREEN_WIDTH, HUD_HEIGHT } from '../core/constants.js';
import type { Renderer } from '../render/renderer.js';
import { BitmapFont } from './bitmap-font.js';
import { HeartMeter } from './heart-meter.js';

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

// Minimap dot (from UpdatePlayerPositionMarker in Z_01.asm)
const MAP_DOT_BASE_X = 17;
const MAP_DOT_BASE_Y = 24;
const MAP_DOT_STRIDE = 4;
const MAP_DOT_SIZE = 3;
const MAP_DOT_COLOR = '#83d313';

export class HudRenderer {
  private readonly font: BitmapFont;
  private readonly heartMeter: HeartMeter;
  private readonly hudImage: HTMLImageElement;

  constructor(
    hudImage: HTMLImageElement,
    fontImage: HTMLImageElement,
    treasuresImage: HTMLImageElement,
  ) {
    this.hudImage = hudImage;
    this.font = new BitmapFont(fontImage);
    this.heartMeter = new HeartMeter(treasuresImage);
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

    if (state.isOverworld) {
      this.renderOverworldDot(renderer, state.mapRow, state.mapCol);
    }
  }

  private renderOverworldDot(
    renderer: Renderer, row: number, col: number,
  ): void {
    const x = MAP_DOT_BASE_X + col * MAP_DOT_STRIDE;
    const y = MAP_DOT_BASE_Y + row * MAP_DOT_STRIDE;
    renderer.fillRect(x, y, MAP_DOT_SIZE, MAP_DOT_SIZE, MAP_DOT_COLOR);
  }
}

// NES FormatDecimalCountByte (Z_01.asm:2940): "X23" for <100, "123" for >=100
export function formatCount(value: number): string {
  if (value >= 100) return String(value);
  return `X${value}`;
}
