/**
 * @typedef {{ image: CanvasImageSource, fw: number, fh: number, n: number, fps: number }} AtlasClip
 */

/**
 * @param {AtlasClip} clip
 */
export function createSprite(clip) {
  let frameIndex = 0;
  const fps = clip.fps;
  const n = clip.n;

  return {
    /**
     * @param {number} dt always FIXED_DT
     */
    update(dt) {
      frameIndex += fps * dt;
      if (n > 0 && frameIndex >= n) {
        frameIndex -= n * Math.floor(frameIndex / n);
      }
    },
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }} cam
     * @param {number} x world px, sprite top-left
     * @param {number} y world px
     * @param {boolean} [flipX]
     */
    draw(ctx, cam, x, y, flipX) {
      const frame = n > 0 ? Math.floor(frameIndex) % n : 0;
      const fw = clip.fw;
      const fh = clip.fh;
      const sx = frame * fw;
      const dx = Math.round(x - cam.x);
      const dy = Math.round(y - cam.y);
      if (flipX) {
        ctx.save();
        ctx.translate(dx + fw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(clip.image, sx, 0, fw, fh, 0, 0, fw, fh);
        ctx.restore();
      } else {
        ctx.drawImage(clip.image, sx, 0, fw, fh, dx, dy, fw, fh);
      }
    },
  };
}
