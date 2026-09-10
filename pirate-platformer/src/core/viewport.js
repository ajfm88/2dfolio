import { VIEW_H, VIEW_W_MIN, VIEW_W_MAX } from '../settings.js';

const scratch = { x: 0, y: 0 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ onResize?: (viewW: number, viewH: number) => void }} [opts]
 */
export function createViewport(canvas, ctx, opts = {}) {
  let viewW = VIEW_W_MIN;
  let pixelScale = 1;

  function resize() {
    const dw = window.innerWidth;
    const dh = window.innerHeight;
    const aspect = dw / dh;

    viewW = Math.max(VIEW_W_MIN, Math.min(VIEW_W_MAX, Math.round(VIEW_H * aspect)));
    pixelScale = Math.min(Math.floor(Math.min(dw / viewW, dh / VIEW_H)), 2);
    if (pixelScale < 1) pixelScale = 1;

    canvas.width = viewW * pixelScale;
    canvas.height = VIEW_H * pixelScale;
    ctx.imageSmoothingEnabled = false;

    if (opts.onResize) opts.onResize(viewW, VIEW_H);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    get viewW() {
      return viewW;
    },
    get viewH() {
      return VIEW_H;
    },
    get pixelScale() {
      return pixelScale;
    },
    /**
     * @param {CanvasRenderingContext2D} drawCtx
     */
    apply(drawCtx) {
      drawCtx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    },
    /**
     * Client pixels → virtual world-view pixels. Reuses one scratch point.
     * @param {number} clientX
     * @param {number} clientY
     */
    toVirtual(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      scratch.x = ((clientX - rect.left) / rect.width) * viewW;
      scratch.y = ((clientY - rect.top) / rect.height) * VIEW_H;
      return scratch;
    },
    resize,
  };
}
