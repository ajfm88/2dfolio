import { TILE } from '../../settings.js';
import { intersects } from '../../core/rect.js';
import { tuning } from '../../data/tuning.js';

/** @typedef {import('../../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../../core/rect.js').Rect} Rect */

/**
 * @typedef {{
 *   atlas: { get: (id: string) => AtlasClip },
 *   stats: import('../stats.js').Stats,
 *   player: { hitbox: Rect },
 * }} WorldHandle
 */

/**
 * @typedef {{
 *   clip: string,
 *   spriteW: number,
 *   spriteH: number,
 *   hitboxW: number,
 *   hitboxH: number,
 *   drawOffsetX: number,
 *   drawOffsetY: number,
 *   z: number,
 * }} SpikesEntry
 */

export class Spikes {
  /**
   * @param {WorldHandle} world
   * @param {{ c: number, r: number }} cell
   * @param {SpikesEntry} entry
   */
  constructor(world, cell, entry) {
    this.world = world;
    this.clip = world.atlas.get(entry.clip);
    this.z = entry.z;
    this.damages = true;
    this.stompable = false;
    this.drawOffsetX = entry.drawOffsetX;
    this.drawOffsetY = entry.drawOffsetY;

    /** @type {Rect} */
    this.hitbox = {
      x: cell.c * TILE,
      y: (cell.r + 1) * TILE - entry.hitboxH,
      w: entry.hitboxW,
      h: entry.hitboxH,
    };
  }

  /**
   * @param {number} [_dt]
   */
  update(_dt) {
    if (intersects(this.hitbox, this.world.player.hitbox)) {
      this.world.stats.hurt(tuning.hazardDamage);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const dx = Math.round(this.hitbox.x + this.drawOffsetX - cam.x);
    const dy = Math.round(this.hitbox.y + this.drawOffsetY - cam.y);
    ctx.drawImage(clip.image, 0, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
  }
}
