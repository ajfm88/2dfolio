import { PLAY_AREA_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../core/constants.js';

// NES "unfurl" effect: two black columns close from sides (or open from center).
// 16 tiles wide / 2 sides = 8 steps. ZeldaJS uses 70ms per step (~4.2 frames at 60fps).
// We use 4 frames per step for NES-accurate feel.
const FRAMES_PER_STEP = 4;
const TOTAL_STEPS = SCREEN_WIDTH / TILE_SIZE / 2; // 8

export class CurtainEffect {
   _step = 0;
   _frameCount = 0;
    _direction;

  constructor(direction) {
    this._direction = direction;
    this._step = direction === 'close' ? 0 : TOTAL_STEPS;
  }

  update() {
    this._frameCount++;
    if (this._frameCount >= FRAMES_PER_STEP) {
      this._frameCount = 0;
      if (this._direction === 'close') {
        this._step++;
      } else {
        this._step--;
      }
    }
  }

  get done() {
    if (this._direction === 'close') return this._step >= TOTAL_STEPS;
    return this._step <= 0;
  }

  render(renderer) {
    const coveredPixels = this._step * TILE_SIZE;
    if (coveredPixels <= 0) return;

    const ctx = renderer.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, coveredPixels, PLAY_AREA_HEIGHT);
    ctx.fillRect(SCREEN_WIDTH - coveredPixels, 0, coveredPixels, PLAY_AREA_HEIGHT);
  }
}
