import { TILE, Z } from '../settings.js';
import { intersects } from '../core/rect.js';

/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../core/rect.js').Rect} Rect */

/**
 * @typedef {{
 *   atlas: { get: (id: string) => AtlasClip },
 *   stats: import('./stats.js').Stats,
 *   player: { hitbox: Rect },
 *   playSfx: (id: string) => void,
 *   spawnFx: (clip: AtlasClip, x: number, y: number) => void,
 * }} WorldHandle
 */

/**
 * @typedef {{
 *   clip: string,
 *   fx: string,
 *   coins?: number,
 *   heal?: number,
 *   spriteW: number,
 *   spriteH: number,
 *   hitboxW: number,
 *   hitboxH: number,
 *   drawOffsetX: number,
 *   drawOffsetY: number,
 *   z: number,
 * }} CollectibleEntry
 */

export class Collectible {
  /**
   * @param {WorldHandle} world
   * @param {{ c: number, r: number }} cell
   * @param {CollectibleEntry} entry
   */
  constructor(world, cell, entry) {
    this.world = world;
    this.clip = world.atlas.get(entry.clip);
    this.fxId = entry.fx;
    this.coins = entry.coins ?? 0;
    this.heal = entry.heal ?? 0;
    this.z = entry.z;
    this.collectible = true;
    this.alive = true;
    this.frameIndex = 0;

    this.spriteW = entry.spriteW;
    this.spriteH = entry.spriteH;
    this.drawOffsetX = entry.drawOffsetX;
    this.drawOffsetY = entry.drawOffsetY;

    const spriteX = cell.c * TILE + (TILE - entry.spriteW) / 2;
    const spriteY = (cell.r + 1) * TILE - entry.spriteH;
    /** @type {Rect} */
    this.hitbox = {
      x: spriteX - entry.drawOffsetX,
      y: spriteY - entry.drawOffsetY,
      w: entry.hitboxW,
      h: entry.hitboxH,
    };
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    if (this.alive === false) return;

    this.frameIndex += this.clip.fps * dt;
    if (this.frameIndex >= this.clip.n) {
      this.frameIndex -= this.clip.n * Math.floor(this.frameIndex / this.clip.n);
    }

    if (intersects(this.hitbox, this.world.player.hitbox)) {
      if (this.coins) this.world.stats.coins += this.coins;
      if (this.heal) this.world.stats.health += this.heal;
      this.world.playSfx('coin');
      const fxClip = this.world.atlas.get(this.fxId);
      const cx = this.hitbox.x + this.drawOffsetX + this.spriteW / 2;
      const cy = this.hitbox.y + this.drawOffsetY + this.spriteH / 2;
      this.world.spawnFx(fxClip, cx - fxClip.fw / 2, cy - fxClip.fh / 2);
      this.alive = false;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const frame = Math.floor(this.frameIndex) % clip.n;
    const dx = Math.round(this.hitbox.x + this.drawOffsetX - cam.x);
    const dy = Math.round(this.hitbox.y + this.drawOffsetY - cam.y);
    ctx.drawImage(clip.image, frame * clip.fw, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
  }
}

export class PickupFx {
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
