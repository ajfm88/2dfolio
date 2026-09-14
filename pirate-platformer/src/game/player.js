/**
 * Player entity.
 * Ported from Super-Pirate-World code_complete/player.py, adapted to
 * tile-grid collision and extended with coyote time, jump buffering,
 * variable jump height, and terminal velocity.
 */

import { TILE, Z } from '../settings.js';
import { copy } from '../core/rect.js';
import { tuning } from '../data/tuning.js';
import {
  resolveH,
  resolveV,
  resolveSemiSolid,
  checkFloor,
  checkWallLeft,
  checkWallRight,
} from './physics.js';

/** @typedef {import('../core/rect.js').Rect} Rect */
/** @typedef {import('../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../level/model.js').LevelModel} LevelModel */

const HITBOX_W = 18;
const HITBOX_H = 26;
const DRAW_OFFSET_X = -23;
const DRAW_OFFSET_Y = -6;

/**
 * @typedef {{
 *   left: import('../core/input.js').Button,
 *   right: import('../core/input.js').Button,
 *   up: import('../core/input.js').Button,
 *   down: import('../core/input.js').Button,
 *   jump: import('../core/input.js').Button,
 * }} Keys
 */

/**
 * @typedef {{
 *   idle: AtlasClip,
 *   run: AtlasClip,
 *   jump: AtlasClip,
 *   fall: AtlasClip,
 * }} PlayerClips
 */

export class Player {
  /**
   * @param {{ c: number, r: number }} cell
   * @param {LevelModel} level
   * @param {Keys} keys
   * @param {PlayerClips} clips
   */
  constructor(cell, level, keys, clips) {
    this.level = level;
    this.keys = keys;
    this.clips = clips;
    this.z = Z.main;

    /** @type {Rect} */
    this.hitbox = {
      x: cell.c * TILE + (TILE - HITBOX_W) / 2,
      y: (cell.r + 1) * TILE - HITBOX_H,
      w: HITBOX_W,
      h: HITBOX_H,
    };
    /** @type {Rect} */
    this.oldRect = { x: 0, y: 0, w: HITBOX_W, h: HITBOX_H };
    copy(this.hitbox, this.oldRect);

    this.vx = 0;
    this.vy = 0;
    this.facing = 1;

    this.onFloor = false;
    this.onWallLeft = false;
    this.onWallRight = false;
    this.wasOnFloor = false;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wallJumpLockTimer = 0;
    this.wallSlideBlockTimer = 0;
    this.dropTimer = 0;

    /** @type {string} */
    this.state = 'idle';
    this.clip = clips.idle;
    this.frameIndex = 0;

    /** @type {{ x: number, speed: number } | null} */
    this.platform = null;
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    copy(this.hitbox, this.oldRect);

    this.coyoteTimer -= dt;
    this.jumpBufferTimer -= dt;
    this.wallJumpLockTimer -= dt;
    this.wallSlideBlockTimer -= dt;
    this.dropTimer -= dt;

    this.handleInput(dt);

    // Horizontal move then resolve (ported order from SPW player.py move())
    this.hitbox.x += this.vx * tuning.runSpeed * dt;
    resolveH(this.hitbox, this.oldRect, this.level);

    // Gravity then vertical move then resolve
    this.applyGravity(dt);
    if (this.vy > tuning.maxFallSpeed) this.vy = tuning.maxFallSpeed;

    const vPushed = resolveV(this.hitbox, this.oldRect, this.level);
    if (vPushed) this.vy = 0;

    const semiLanded = resolveSemiSolid(
      this.hitbox,
      this.oldRect,
      this.level,
      this.dropTimer > 0,
    );
    if (semiLanded && this.vy > 0) this.vy = 0;

    if (this.platform) {
      this.hitbox.x += this.platform.x * this.platform.speed * dt;
    }

    this.wasOnFloor = this.onFloor;
    this.onFloor = checkFloor(this.hitbox, this.level);
    this.onWallLeft = checkWallLeft(this.hitbox, this.level);
    this.onWallRight = checkWallRight(this.hitbox, this.level);

    if (this.wasOnFloor && !this.onFloor && this.vy >= 0) {
      this.coyoteTimer = tuning.coyoteTime;
    }
    if (this.onFloor) {
      this.coyoteTimer = 0;
    }

    if (!this.wasOnFloor && this.onFloor && this.jumpBufferTimer > 0) {
      this.doJump();
    }

    this.updateState();
    this.animate(dt);
  }

  /**
   * @param {number} dt
   */
  handleInput(dt) {
    const keys = this.keys;

    if (this.wallJumpLockTimer <= 0) {
      this.vx = 0;
      if (keys.left.held) { this.vx = -1; this.facing = -1; }
      if (keys.right.held) { this.vx = 1; this.facing = 1; }
    }

    if (keys.down.pressed) {
      this.dropTimer = tuning.dropThrough;
    }

    const jumpPressed = keys.jump.pressed || keys.up.pressed;
    const jumpReleased = keys.jump.released || keys.up.released;

    if (jumpPressed) {
      if (this.onFloor || this.coyoteTimer > 0) {
        this.doJump();
      } else if (
        (this.onWallLeft || this.onWallRight) &&
        this.wallSlideBlockTimer <= 0
      ) {
        this.doWallJump();
      } else {
        this.jumpBufferTimer = tuning.jumpBuffer;
      }
    }

    if (jumpReleased && this.vy < 0) {
      this.vy *= 0.5;
    }
  }

  doJump() {
    this.vy = -tuning.jumpVelocity;
    this.wallSlideBlockTimer = tuning.wallSlideBlock;
    this.hitbox.y -= 1;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  doWallJump() {
    this.vy = -tuning.jumpVelocity;
    this.vx = this.onWallLeft ? 1 : -1;
    this.facing = this.vx;
    this.wallJumpLockTimer = tuning.wallJumpLock;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  /**
   * @param {number} dt
   */
  applyGravity(dt) {
    const wallSliding =
      !this.onFloor &&
      (this.onWallLeft || this.onWallRight) &&
      this.wallSlideBlockTimer <= 0 &&
      this.vy >= 0;

    if (wallSliding) {
      this.vy = 0;
      this.hitbox.y += tuning.wallSlideGravity * dt;
    } else {
      // velocity Verlet (ported from SPW player.py move())
      this.vy += tuning.gravity / 2 * dt;
      this.hitbox.y += this.vy * dt;
      this.vy += tuning.gravity / 2 * dt;
    }
  }

  updateState() {
    let next;
    if (this.onFloor) {
      next = this.vx === 0 ? 'idle' : 'run';
    } else if (
      (this.onWallLeft || this.onWallRight) &&
      this.wallSlideBlockTimer <= 0 &&
      this.vy >= 0
    ) {
      next = 'wall';
    } else {
      next = this.vy < 0 ? 'jump' : 'fall';
    }

    if (next !== this.state) {
      this.state = next;
      this.clip = next === 'wall' ? this.clips.fall : this.clips[next];
      this.frameIndex = 0;
    }
  }

  /**
   * @param {number} dt
   */
  animate(dt) {
    this.frameIndex += this.clip.fps * dt;
    if (this.clip.n > 0 && this.frameIndex >= this.clip.n) {
      this.frameIndex -= this.clip.n * Math.floor(this.frameIndex / this.clip.n);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} cam
   */
  draw(ctx, cam) {
    const clip = this.clip;
    const frame = clip.n > 0 ? Math.floor(this.frameIndex) % clip.n : 0;
    const fw = clip.fw;
    const fh = clip.fh;
    const sx = frame * fw;
    const dx = Math.round(this.hitbox.x + DRAW_OFFSET_X - cam.x);
    const dy = Math.round(this.hitbox.y + DRAW_OFFSET_Y - cam.y);

    if (this.facing < 0) {
      ctx.save();
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(clip.image, sx, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      ctx.drawImage(clip.image, sx, 0, fw, fh, dx, dy, fw, fh);
    }
  }
}
