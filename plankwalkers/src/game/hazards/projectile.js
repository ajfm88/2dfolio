import { TILE, Z } from '../../settings.js';
import { intersects } from '../../core/rect.js';
import { tuning } from '../../data/tuning.js';
import { checkSolid } from '../physics.js';

/** @typedef {import('../../core/rect.js').Rect} Rect */
/** @typedef {import('../../core/sprite.js').AtlasClip} AtlasClip */

/**
 * @typedef {{
 *   clip: string,
 *   hitboxW: number,
 *   hitboxH: number,
 *   drawOffsetX: number,
 *   drawOffsetY: number,
 *   speed: number,
 *   lifetime: number,
 *   hitFx: string,
 *   endFx: string,
 * }} ProjectileSpec
 */

/**
 * @typedef {{
 *   atlas: { get: (id: string) => AtlasClip },
 *   level: import('../../level/model.js').LevelModel,
 *   stats: import('../stats.js').Stats,
 *   player: { hitbox: Rect },
 *   playSfx: (id: string) => void,
 *   spawnFx: (clip: AtlasClip, x: number, y: number) => void,
 * }} WorldHandle
 */

/**
 * A shot in flight. Its position is a runtime value, like the player's — not an
 * authored placement — so it lives in world pixels rather than a cell (invariant
 * 4 governs authored placement and the grid-aligned AABB it collides against,
 * both of which this respects). One class serves both the pearl and the
 * cannonball; everything that differs comes from `spec`.
 */
export class Projectile {
  /**
   * @param {WorldHandle} world
   * @param {number} x muzzle point in world px (hitbox centre lands here)
   * @param {number} y muzzle point in world px
   * @param {number} dir 1 right, -1 left
   * @param {ProjectileSpec} spec
   */
  constructor(world, x, y, dir, spec) {
    this.world = world;
    this.spec = spec;
    this.clip = world.atlas.get(spec.clip);
    this.dir = dir;
    this.z = Z.main;
    this.alive = true;
    this.damages = true;
    this.life = spec.lifetime;
    this.frameIndex = 0;
    this.drawOffsetX = spec.drawOffsetX;
    this.drawOffsetY = spec.drawOffsetY;

    /** @type {Rect} centred on the muzzle */
    this.hitbox = {
      x: x - spec.hitboxW / 2,
      y: y - spec.hitboxH / 2,
      w: spec.hitboxW,
      h: spec.hitboxH,
    };
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    if (this.alive === false) return;

    // Straight line, no gravity: both barrels are drawn horizontal and the ball
    // sprite is a static sphere, so nothing in the art implies an arc.
    this.hitbox.x += this.dir * this.spec.speed * dt;

    this.frameIndex += this.clip.fps * dt;
    if (this.clip.n > 0 && this.frameIndex >= this.clip.n) {
      this.frameIndex -= this.clip.n * Math.floor(this.frameIndex / this.clip.n);
    }

    if (intersects(this.hitbox, this.world.player.hitbox)) {
      if (this.world.stats.hurt(tuning.hazardDamage)) {
        this.world.playSfx('damage');
      }
      this.die(this.spec.hitFx);
      return;
    }

    if (checkSolid(this.hitbox, this.world.level)) {
      this.die(this.spec.hitFx);
      return;
    }

    this.life -= dt;
    if (this.life <= 0) {
      this.die(this.spec.endFx);
      return;
    }

    const worldW = this.world.level.cols * TILE;
    if (this.hitbox.x + this.hitbox.w <= 0 || this.hitbox.x >= worldW) {
      this.die(this.spec.endFx);
    }
  }

  /**
   * @param {string} fxId
   */
  die(fxId) {
    this.alive = false;
    const clip = this.world.atlas.get(fxId);
    const cx = this.hitbox.x + this.hitbox.w / 2;
    const cy = this.hitbox.y + this.hitbox.h / 2;
    this.world.spawnFx(clip, cx - clip.fw / 2, cy - clip.fh / 2);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const frame = clip.n > 0 ? Math.floor(this.frameIndex) % clip.n : 0;
    const dx = Math.round(this.hitbox.x + this.drawOffsetX - cam.x);
    const dy = Math.round(this.hitbox.y + this.drawOffsetY - cam.y);
    ctx.drawImage(clip.image, frame * clip.fw, 0, clip.fw, clip.fh, dx, dy, clip.fw, clip.fh);
  }
}
