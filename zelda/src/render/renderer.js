import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  HUD_HEIGHT,
  PLAY_AREA_HEIGHT
} from '../core/constants.js';
import {
  computeCanvasLayout,
  reservedBottomFor,
  NO_INSETS

} from './canvas-layout.js';

function readInsets() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => {
    const parsed = parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    top: read('--safe-top'),
    right: read('--safe-right'),
    bottom: read('--safe-bottom'),
    left: read('--safe-left')
  };
}

export class Renderer {
   ctx;
   canvas;
   width = SCREEN_WIDTH;
   height = SCREEN_HEIGHT;

   _padReserve = 0;
   _resizePending = false;

  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    this.ctx.imageSmoothingEnabled = false;

    this.resize();

    const schedule = () => this.scheduleResize();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    // Samsung Internet collapses its toolbar without always firing a useful
    // window resize; the visual viewport reports the change reliably.
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
  }

  /** Height of the touch-pad band the canvas must sit above. Triggers a relayout. */
  setPadReserve(px) {
    this._padReserve = px;
    this.resize();
  }

   scheduleResize() {
    if (this._resizePending) return;
    this._resizePending = true;
    requestAnimationFrame(() => {
      this._resizePending = false;
      this.resize();
    });
  }

  resize() {
    const vv = window.visualViewport;
    const viewportW = vv?.width ?? window.innerWidth;
    const viewportH = vv?.height ?? window.innerHeight;

    const layout = computeCanvasLayout({
      viewportW,
      viewportH,
      dpr: window.devicePixelRatio || 1,
      reservedBottom: reservedBottomFor(viewportW, viewportH, this._padReserve),
      insets: typeof getComputedStyle === 'function' ? readInsets() : NO_INSETS
    });

    const style = this.canvas.style;
    style.position = 'absolute';
    style.width = `${layout.cssW}px`;
    style.height = `${layout.cssH}px`;
    style.left = `${layout.left}px`;
    style.top = `${layout.top}px`;
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  beginPlayArea() {
    this.ctx.save();
    this.ctx.translate(0, HUD_HEIGHT);
  }

  endPlayArea() {
    this.ctx.restore();
  }

  fillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh,
  ) {
    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  drawImageFlipped(
    image,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh,
    flipH,
    flipV,
  ) {
    if (!flipH && !flipV) {
      this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    this.ctx.save();
    this.ctx.translate(
      flipH ? dx + dw : dx,
      flipV ? dy + dh : dy,
    );
    this.ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    this.ctx.restore();
  }

  get playAreaWidth() {
    return SCREEN_WIDTH;
  }

  get playAreaHeight() {
    return PLAY_AREA_HEIGHT;
  }
}
