import { TILE } from '../../settings.js';
import { tuning } from '../../data/tuning.js';
import { playerNear, playerInFront } from '../sense.js';
import { Projectile } from './projectile.js';

/** @typedef {import('../../core/rect.js').Rect} Rect */
/** @typedef {import('../../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../../types.js').EntityRecord} EntityRecord */

/**
 * @typedef {{
 *   atlas: { get: (id: string) => AtlasClip },
 *   player: { hitbox: Rect },
 *   spawnEntity: (ent: unknown) => void,
 * }} WorldHandle
 */

/**
 * @typedef {{
 *   clips: string,
 *   senseRange: number,
 *   cooldown: number,
 *   fireFrame: number,
 *   artFacing: number,
 *   hitboxW: number,
 *   hitboxH: number,
 *   drawOffsetX: number,
 *   drawOffsetY: number,
 *   flipOffsetX?: number,
 *   muzzleX: number,
 *   muzzleY: number,
 *   fireFx?: string,
 *   fireFxAnchorX?: number,
 *   fireFxAnchorY?: number,
 *   projectile: import('./projectile.js').ProjectileSpec,
 *   z: number,
 * }} ShooterEntry
 */

/** Scratch muzzle point. Module level: neither update nor draw allocates. */
const muzzle = { x: 0, y: 0 };

/**
 * A stationary hazard that shoots. The Cannon and the Seashell share this one
 * class because the art gives them one verb — idle (n=1) → fire (n=6) → idle,
 * with frame 3 the shot in both — and only their ammunition differs. That is the
 * opposite call to the walker enemies, whose art forced three different verbs.
 *
 * The body never damages the player and is not solid: SPW puts Shell in
 * collision_sprites but not damage_sprites, so only the pearl hurts; we drop the
 * collision half because we have no entity-vs-player resolver and adding one
 * would push against invariant 4. Closing the distance therefore makes a shooter
 * completely harmless.
 *
 * Fire cycle ported from enemies.py Shell.update: fire on `int(frame_index) == 3`
 * guarded by a `has_fired` flag, because frame 3 spans six ticks at 60 Hz and an
 * unguarded check would launch six projectiles per trigger.
 */
export class Shooter {
  /**
   * @param {WorldHandle} world
   * @param {EntityRecord} rec
   * @param {ShooterEntry} entry
   */
  constructor(world, rec, entry) {
    this.world = world;
    this.entry = entry;
    this.z = entry.z;
    this.alive = true;
    this.damages = false;

    this.idleClip = world.atlas.get(`${entry.clips}/idle`);
    this.fireClip = world.atlas.get(`${entry.clips}/fire`);
    this.fireFx = entry.fireFx ? world.atlas.get(entry.fireFx) : null;

    // Bottom-aligned to the cell, horizontally centred, as Player / WalkerEnemy.
    /** @type {Rect} */
    this.hitbox = {
      x: rec.c * TILE + (TILE - entry.hitboxW) / 2,
      y: (rec.r + 1) * TILE - entry.hitboxH,
      w: entry.hitboxW,
      h: entry.hitboxH,
    };

    // SPW's `reverse` Tiled property, expressed the way walkers express facing.
    this.dir = rec.p && rec.p.dir === 1 ? 1 : -1;

    /** @type {'idle' | 'fire'} */
    this.state = 'idle';
    this.clip = this.idleClip;
    this.frameIndex = 0;
    this.cooldown = 0;
    this.hasFired = false;
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    if (this.state === 'idle') {
      this.cooldown -= dt;
      const p = this.world.player.hitbox;
      if (
        this.cooldown <= 0 &&
        playerNear(this.hitbox, p, this.entry.senseRange, tuning.enemySenseHeight) &&
        playerInFront(this.hitbox, p, this.dir)
      ) {
        this.state = 'fire';
        this.clip = this.fireClip;
        this.frameIndex = 0;
        this.hasFired = false;
        return; // the fire clip runs from the next tick
      }
      this.animate(dt);
      return;
    }

    // fire
    if (!this.hasFired && Math.floor(this.frameIndex) === this.entry.fireFrame) {
      this.spawnProjectile();
      this.hasFired = true;
    }

    this.animate(dt);

    if (this.frameIndex >= this.clip.n) {
      this.state = 'idle';
      this.clip = this.idleClip;
      this.frameIndex = 0;
      this.cooldown = this.entry.cooldown;
    }
  }

  spawnProjectile() {
    this.setMuzzle();
    this.world.spawnEntity(
      new Projectile(this.world, muzzle.x, muzzle.y, this.dir, this.entry.projectile),
    );
  }

  /**
   * Muzzle offsets are measured from the hitbox top-left with `dir === -1`;
   * facing right mirrors the horizontal offset about the body centre. Writes the
   * module scratch rather than allocating.
   */
  setMuzzle() {
    const e = this.entry;
    muzzle.x =
      this.dir < 0 ? this.hitbox.x + e.muzzleX : this.hitbox.x + this.hitbox.w - e.muzzleX;
    muzzle.y = this.hitbox.y + e.muzzleY;
  }

  /**
   * @param {number} dt
   */
  animate(dt) {
    this.frameIndex += this.clip.fps * dt;
    if (this.clip.n > 0 && this.frameIndex >= this.clip.n && this.state === 'idle') {
      this.frameIndex -= this.clip.n * Math.floor(this.frameIndex / this.clip.n);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const entry = this.entry;
    const frame = clip.n > 0 ? Math.floor(this.frameIndex) % clip.n : 0;
    const fw = clip.fw;
    const fh = clip.fh;
    const sx = frame * fw;
    const dy = Math.round(this.hitbox.y + entry.drawOffsetY - cam.y);
    const flipped = entry.artFacing !== 0 && this.dir !== entry.artFacing;

    if (flipped) {
      const offX = entry.flipOffsetX ?? entry.drawOffsetX;
      const dx = Math.round(this.hitbox.x + offX - cam.x);
      ctx.save();
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(clip.image, sx, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      const dx = Math.round(this.hitbox.x + entry.drawOffsetX - cam.x);
      ctx.drawImage(clip.image, sx, 0, fw, fh, dx, dy, fw, fh);
    }

    if (this.state === 'fire' && this.fireFx) this.drawFlash(ctx, cam, frame, flipped);
  }

  /**
   * The muzzle flash is drawn, not spawned: cannon/fire and cannon/fire-effect
   * are a matched 6-frame pair, so the effect shares the body's frameIndex and
   * flip. Its anchor column sits on the muzzle so the blast expands outward.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   * @param {number} frame
   * @param {boolean} flipped
   */
  drawFlash(ctx, cam, frame, flipped) {
    const clip = /** @type {AtlasClip} */ (this.fireFx);
    const entry = this.entry;
    const fw = clip.fw;
    const fh = clip.fh;
    const sx = (frame % clip.n) * fw;
    const anchorX = entry.fireFxAnchorX ?? 0;
    const anchorY = entry.fireFxAnchorY ?? 0;
    this.setMuzzle();
    const dy = Math.round(muzzle.y - anchorY - cam.y);

    if (flipped) {
      const dx = Math.round(muzzle.x - (fw - anchorX) - cam.x);
      ctx.save();
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(clip.image, sx, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      const dx = Math.round(muzzle.x - anchorX - cam.x);
      ctx.drawImage(clip.image, sx, 0, fw, fh, dx, dy, fw, fh);
    }
  }
}
