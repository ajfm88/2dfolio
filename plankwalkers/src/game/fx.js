import { Z } from '../settings.js';

/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */

/**
 * A sprite clip that plays once where it was spawned, then is gone: treasure pickups,
 * Crabby's strike, projectile bursts and dust. It never flips — every clip that uses
 * it is symmetric (issue 7).
 */
export class OneShotFx {
  /**
   * @param {AtlasClip} clip
   * @param {number} x world px, sprite top-left
   * @param {number} y world px
   */
  constructor(clip, x, y) {
    this.clip = clip;
    this.x = x;
    this.y = y;
    this.z = Z.fx;
    this.frameIndex = 0;
    this.alive = true;
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    this.frameIndex += this.clip.fps * dt;
    if (this.frameIndex >= this.clip.n) this.alive = false;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    if (this.alive === false) return;
    const clip = this.clip;
    const frame = Math.floor(this.frameIndex);
    if (frame >= clip.n) return;
    const dx = Math.round(this.x - cam.x);
    const dy = Math.round(this.y - cam.y);
    ctx.drawImage(clip.image, frame * clip.fw, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
  }
}
