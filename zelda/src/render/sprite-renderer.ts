import { TILE_SIZE, WALK_ANIM_COUNTER_RESET } from '../core/constants.js';
import { Direction } from '../core/types.js';
import type { Renderer } from './renderer.js';

export interface SpriteSheetConfig {
  readonly image: HTMLImageElement | HTMLCanvasElement;
  readonly cellWidth?: number;
  readonly cellHeight?: number;
  readonly columns: number;
  readonly spacingX?: number;
  readonly spacingY?: number;
  readonly autoDetectTransparency?: boolean;
}

function processTransparencyKey(image: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const keyR = data[0]!;
  const keyG = data[1]!;
  const keyB = data[2]!;

  const tolerance = 2;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (
      Math.abs(r - keyR) <= tolerance &&
      Math.abs(g - keyG) <= tolerance &&
      Math.abs(b - keyB) <= tolerance
    ) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export class SpriteSheet {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly columns: number;
  private readonly source: CanvasImageSource;
  private readonly spacingX: number;
  private readonly spacingY: number;

  constructor(config: SpriteSheetConfig) {
    this.cellWidth = config.cellWidth ?? TILE_SIZE;
    this.cellHeight = config.cellHeight ?? TILE_SIZE;
    this.columns = config.columns;
    this.spacingX = config.spacingX ?? 0;
    this.spacingY = config.spacingY ?? 0;

    if (config.autoDetectTransparency) {
      this.source = processTransparencyKey(config.image);
    } else {
      this.source = config.image;
    }
  }

  drawFrame(renderer: Renderer, index: number, dx: number, dy: number): void {
    const col = index % this.columns;
    const row = Math.floor(index / this.columns);
    const sx = col * (this.cellWidth + this.spacingX);
    const sy = row * (this.cellHeight + this.spacingY);
    renderer.drawImage(
      this.source,
      sx, sy, this.cellWidth, this.cellHeight,
      dx, dy, this.cellWidth, this.cellHeight,
    );
  }

  drawFrameFlipped(
    renderer: Renderer,
    index: number,
    dx: number,
    dy: number,
    flipH: boolean,
    flipV: boolean,
  ): void {
    if (!flipH && !flipV) {
      this.drawFrame(renderer, index, dx, dy);
      return;
    }
    const col = index % this.columns;
    const row = Math.floor(index / this.columns);
    const sx = col * (this.cellWidth + this.spacingX);
    const sy = row * (this.cellHeight + this.spacingY);
    renderer.drawImageFlipped(
      this.source,
      sx, sy, this.cellWidth, this.cellHeight,
      dx, dy, this.cellWidth, this.cellHeight,
      flipH, flipV,
    );
  }

  getFrameSourceRect(index: number): { sx: number; sy: number; sw: number; sh: number } {
    const col = index % this.columns;
    const row = Math.floor(index / this.columns);
    return {
      sx: col * (this.cellWidth + this.spacingX),
      sy: row * (this.cellHeight + this.spacingY),
      sw: this.cellWidth,
      sh: this.cellHeight,
    };
  }
}

const DIR_TO_SPRITE_COL = [2, 0, 1, 3] as const;

export function directionToSpriteCol(dir: Direction): number {
  return DIR_TO_SPRITE_COL[dir];
}

export class WalkAnimationController {
  private step = 0;
  private counter: number;
  private readonly counterReset: number;

  constructor(counterReset = WALK_ANIM_COUNTER_RESET) {
    this.counterReset = counterReset;
    this.counter = counterReset;
  }

  tick(): number {
    this.counter--;
    if (this.counter <= 0) {
      this.step = (this.step + 1) % 2;
      this.counter = this.counterReset;
    }
    return this.step;
  }

  reset(): void {
    this.step = 0;
    this.counter = this.counterReset;
  }

  get currentStep(): number {
    return this.step;
  }
}
