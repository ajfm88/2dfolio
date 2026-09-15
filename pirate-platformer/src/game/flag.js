import { TILE, Z } from '../settings.js';

/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */

const HITBOX_W = 16;
const HITBOX_H = 32;
// flag sprite 34×93, pole centered — sprite drawn 9px left and 61px above hitbox
const DRAW_OFFSET_X = -9;
const DRAW_OFFSET_Y = -61;

export class Flag {
  /**
   * @param {{ c: number, r: number }} cell
   * @param {AtlasClip} clip
   */
  constructor(cell, clip) {
    this.clip = clip;
    this.z = Z.main;
    this.frameIndex = 0;

    /** @type {import('../core/rect.js').Rect} */
    this.hitbox = {
      x: cell.c * TILE + (TILE - HITBOX_W) / 2,
      y: (cell.r + 1) * TILE - HITBOX_H,
      w: HITBOX_W,
      h: HITBOX_H,
    };
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.frameIndex += this.clip.fps * dt;
    if (this.frameIndex >= this.clip.n) {
      this.frameIndex -= this.clip.n * Math.floor(this.frameIndex / this.clip.n);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const frame = Math.floor(this.frameIndex) % clip.n;
    const dx = Math.round(this.hitbox.x + DRAW_OFFSET_X - cam.x);
    const dy = Math.round(this.hitbox.y + DRAW_OFFSET_Y - cam.y);
    ctx.drawImage(clip.image, frame * clip.fw, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
  }
}
