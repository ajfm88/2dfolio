import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  HUD_HEIGHT,
  PLAY_AREA_HEIGHT,
} from '../core/constants.js';

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  readonly width = SCREEN_WIDTH;
  readonly height = SCREEN_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const scaleX = Math.floor(window.innerWidth / SCREEN_WIDTH);
    const scaleY = Math.floor(window.innerHeight / SCREEN_HEIGHT);
    const scale = Math.max(1, Math.min(scaleX, scaleY));
    this.canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    this.canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  }

  clear(color = '#000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  beginPlayArea(): void {
    this.ctx.save();
    this.ctx.translate(0, HUD_HEIGHT);
  }

  endPlayArea(): void {
    this.ctx.restore();
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  get playAreaWidth(): number {
    return SCREEN_WIDTH;
  }

  get playAreaHeight(): number {
    return PLAY_AREA_HEIGHT;
  }
}
