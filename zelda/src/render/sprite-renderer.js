import { TILE_SIZE, WALK_ANIM_COUNTER_RESET } from '../core/constants.js';

function processTransparencyKey(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const keyR = data[0];
  const keyG = data[1];
  const keyB = data[2];

  const tolerance = 2;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
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
   cellWidth;
   cellHeight;
   columns;
    source;
    spacingX;
    spacingY;

  constructor(config) {
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

  drawFrame(renderer, index, dx, dy) {
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
    renderer,
    index,
    dx,
    dy,
    flipH,
    flipV,
  ) {
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

  getFrameSourceRect(index) {
    const col = index % this.columns;
    const row = Math.floor(index / this.columns);
    return {
      sx: col * (this.cellWidth + this.spacingX),
      sy: row * (this.cellHeight + this.spacingY),
      sw: this.cellWidth,
      sh: this.cellHeight
    };
  }
}

const DIR_TO_SPRITE_COL = [2, 0, 1, 3];

export function directionToSpriteCol(dir) {
  return DIR_TO_SPRITE_COL[dir];
}

export class WalkAnimationController {
   step = 0;
   counter;
    counterReset;

  constructor(counterReset = WALK_ANIM_COUNTER_RESET) {
    this.counterReset = counterReset;
    this.counter = counterReset;
  }

  tick() {
    this.counter--;
    if (this.counter <= 0) {
      this.step = (this.step + 1) % 2;
      this.counter = this.counterReset;
    }
    return this.step;
  }

  reset() {
    this.step = 0;
    this.counter = this.counterReset;
  }

  get currentStep() {
    return this.step;
  }
}
