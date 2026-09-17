/**
 * Shared base for the three walker enemies.
 *
 * Patrol movement and the ledge/wall turn are ported from
 * reference/super-pirate-world/code_complete/enemies.py Tooth.update, with its
 * random start direction replaced by the level record's `p.dir` so a level
 * replays identically. The proximity test is that file's
 * Shell.state_management (near + level, plus front where a subclass wants it).
 *
 * One state mechanism: every state but `patrol` carries a `stateTimer` and exits
 * when it reaches zero, and every clip wraps. That gives "plays exactly once"
 * for free when the timer is the clip's own length, and lets a longer state
 * (Pink Star's spin) simply loop its clip.
 */

import { TILE } from '../../settings.js';
import { copy, intersects } from '../../core/rect.js';
import { tuning } from '../../data/tuning.js';

import {
  resolveH,
  resolveV,
  resolveSemiSolid,
  checkFloor,
  checkWallLeft,
  checkWallRight,
} from '../physics.js';

/** @typedef {import('../../core/rect.js').Rect} Rect */
/** @typedef {import('../../core/sprite.js').AtlasClip} AtlasClip */
/** @typedef {import('../../level/model.js').LevelModel} LevelModel */
/** @typedef {import('../../types.js').EntityRecord} EntityRecord */
/** @typedef {'patrol' | 'anticipation' | 'attack' | 'recover' | 'dying'} WalkerState */

/**
 * @typedef {{
 *   atlas: { get: (id: string) => AtlasClip },
 *   level: LevelModel,
 *   stats: import('../stats.js').Stats,
 *   player: import('../player.js').Player,
 *   spawnFx: (clip: AtlasClip, x: number, y: number) => void,
 * }} WorldHandle
 */

/**
 * @typedef {{
 *   clips: string,
 *   speed: number,
 *   senseRange: number,
 *   cooldown: number,
 *   artFacing: number,
 *   hitboxW: number,
 *   hitboxH: number,
 *   drawOffsetX: number,
 *   drawOffsetY: number,
 *   flipOffsetX?: number,
 *   strikeW?: number,
 *   lungeSpeed?: number,
 *   spinTime?: number,
 *   z: number,
 * }} WalkerEntry
 */

/** Scratch rect for the ledge probe. Module level: update() allocates nothing. */
const probe = { x: 0, y: 0, w: 1, h: 0 };

/**
 * @param {AtlasClip} clip
 * @returns {number} seconds for one full play
 */
function clipTime(clip) {
  return clip.n / clip.fps;
}

export class WalkerEnemy {
  /**
   * @param {WorldHandle} world
   * @param {EntityRecord} rec
   * @param {WalkerEntry} entry
   */
  constructor(world, rec, entry) {
    this.world = world;
    this.entry = entry;
    this.z = entry.z;
    this.alive = true;
    this.damages = true;
    this.stompable = true;

    // Keyed by state name so `enter()` is a lookup, not a switch.
    this.clips = {
      patrol: world.atlas.get(`${entry.clips}/run`),
      anticipation: world.atlas.get(`${entry.clips}/anticipation`),
      attack: world.atlas.get(`${entry.clips}/attack`),
      recover: world.atlas.get(`${entry.clips}/idle`),
      dying: world.atlas.get(`${entry.clips}/dead-ground`),
    };

    // Hitbox bottom is the feet, as in Player — not Collectible's sprite-canvas
    // alignment, which would float art that has transparent padding below.
    /** @type {Rect} */
    this.hitbox = {
      x: rec.c * TILE + (TILE - entry.hitboxW) / 2,
      y: (rec.r + 1) * TILE - entry.hitboxH,
      w: entry.hitboxW,
      h: entry.hitboxH,
    };
    /** @type {Rect} */
    this.oldRect = { x: 0, y: 0, w: entry.hitboxW, h: entry.hitboxH };
    copy(this.hitbox, this.oldRect);

    /** Rect the player takes damage from. A subclass may widen it mid-attack. */
    this.damageBox = this.hitbox;

    // `p` is free-form on the level record: narrow it here, at the boundary.
    this.dir = rec.p && rec.p.dir === 1 ? 1 : -1;
    this.vy = 0;

    /** @type {WalkerState} */
    this.state = 'patrol';
    this.clip = this.clips.patrol;
    this.frameIndex = 0;
    this.stateTimer = 0;
    this.attackTime = 0;
    this.turnCooldown = 0;
  }

  /**
   * @param {WalkerState} next
   */
  enter(next) {
    this.state = next;
    this.clip = this.clips[next];
    this.frameIndex = 0;
    this.damageBox = this.hitbox;

    if (next === 'anticipation') {
      this.stateTimer = clipTime(this.clip);
    } else if (next === 'attack') {
      this.attackTime = clipTime(this.clip);
      this.onAttackStart();
      this.stateTimer = this.attackTime;
    } else if (next === 'recover') {
      this.onAttackEnd();
      this.stateTimer = this.entry.cooldown;
    } else if (next === 'dying') {
      this.damages = false;
      this.stompable = false;
      this.stateTimer = clipTime(this.clip);
    } else {
      this.stateTimer = 0;
    }
  }

  /**
   * @param {number} dt always FIXED_DT
   */
  update(dt) {
    if (this.alive === false) return;

    if (this.state === 'dying') {
      this.stateTimer -= dt;
      this.animate(dt);
      if (this.stateTimer <= 0) this.alive = false;
      return;
    }

    copy(this.hitbox, this.oldRect);
    this.stateTimer -= dt;
    this.turnCooldown -= dt;

    this.step(dt);

    const level = this.world.level;

    this.hitbox.x += this.moveX() * dt;
    resolveH(this.hitbox, this.oldRect, level);

    // Same half-step integration as Player.applyGravity: one gravity in the game.
    this.vy += (tuning.gravity / 2) * dt;
    this.hitbox.y += this.vy * dt;
    this.vy += (tuning.gravity / 2) * dt;
    if (this.vy > tuning.maxFallSpeed) this.vy = tuning.maxFallSpeed;

    if (resolveV(this.hitbox, this.oldRect, level)) this.vy = 0;
    if (resolveSemiSolid(this.hitbox, this.oldRect, level, false) && this.vy > 0) {
      this.vy = 0;
    }

    if (this.state === 'patrol' && this.turnCooldown <= 0 && this.blockedAhead()) {
      this.dir = -this.dir;
      this.turnCooldown = tuning.enemyTurnCooldown;
    }

    // Placed in mid-air by the maker, or walked off the world: despawn quietly.
    if (this.hitbox.y > level.rows * TILE) {
      this.alive = false;
      return;
    }

    this.touchPlayer();
    this.animate(dt);
  }

  /**
   * State transitions only. Movement and collision run after this.
   * @param {number} dt
   */
  step(dt) {
    if (this.state === 'patrol') {
      if (this.shouldAttack()) this.enter('anticipation');
    } else if (this.state === 'anticipation') {
      if (this.stateTimer <= 0) this.enter('attack');
    } else if (this.state === 'attack') {
      this.onAttackStep(dt);
      if (this.stateTimer <= 0) this.enter('recover');
    } else if (this.state === 'recover') {
      if (this.stateTimer <= 0) this.enter('patrol');
    }
  }

  /**
   * @returns {number} horizontal velocity in px/s for the current state
   */
  moveX() {
    if (this.state === 'patrol') return this.dir * this.entry.speed;
    if (this.state === 'attack') return this.attackVx();
    return 0;
  }

  /**
   * True when a wall or a ledge lies in the direction of travel. The probe sits
   * at the leading bottom corner, as in SPW's floor_rect_left / floor_rect_right,
   * and `checkFloor` already accepts terrain or platform, so platform ledges
   * work without a second path.
   * @returns {boolean}
   */
  blockedAhead() {
    const level = this.world.level;
    const hb = this.hitbox;

    if (this.dir > 0 ? checkWallRight(hb, level) : checkWallLeft(hb, level)) return true;

    probe.x = this.dir > 0 ? hb.x + hb.w : hb.x - 1;
    probe.y = hb.y;
    probe.h = hb.h;
    return !checkFloor(probe, level);
  }

  /**
   * SPW Shell.state_management's `near` and `level` pair, without `front`.
   * @param {number} range px, horizontal centre to centre
   * @returns {boolean}
   */
  playerNear(range) {
    const p = this.world.player.hitbox;
    const hb = this.hitbox;
    const dx = p.x + p.w / 2 - (hb.x + hb.w / 2);
    const dy = p.y + p.h / 2 - (hb.y + hb.h / 2);
    return Math.abs(dx) <= range && Math.abs(dy) <= tuning.enemySenseHeight;
  }

  /**
   * SPW Shell.state_management's `front`.
   * @returns {boolean}
   */
  playerInFront() {
    const p = this.world.player.hitbox;
    const hb = this.hitbox;
    return (p.x + p.w / 2 - (hb.x + hb.w / 2)) * this.dir > 0;
  }

  /**
   * Stomp is tested against the body; damage against `damageBox`, which a
   * subclass may have widened. Both `oldRect`s are last frame's, so they are
   * comparable. Enemies are not solid — the player passes through, as in SPW.
   */
  touchPlayer() {
    const player = this.world.player;
    const fromAbove =
      player.vy > 0 && player.oldRect.y + player.oldRect.h <= this.oldRect.y;

    if (fromAbove && this.stompable && intersects(player.hitbox, this.hitbox)) {
      player.bounce();
      this.enter('dying');
      return;
    }

    if (this.damages && intersects(player.hitbox, this.damageBox)) {
      this.world.stats.hurt(tuning.hazardDamage);
      // A blocked stomp still bounces, so the player is knocked clear of a
      // spinning Pink Star instead of grinding on top of it.
      if (fromAbove) player.bounce();
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
    const entry = this.entry;
    const frame = clip.n > 0 ? Math.floor(this.frameIndex) % clip.n : 0;
    const fw = clip.fw;
    const fh = clip.fh;
    const sx = frame * fw;
    const dy = Math.round(this.hitbox.y + entry.drawOffsetY - cam.y);

    // artFacing 0 is art drawn face-on, which never flips and so never opens a
    // save/restore pair (4-code-standards.md § Rendering).
    if (entry.artFacing !== 0 && this.dir !== entry.artFacing) {
      // The flip mirrors about the sprite canvas, so art that is not centred on
      // that canvas needs its own offset or it jumps when the enemy turns.
      const offX = entry.flipOffsetX ?? entry.drawOffsetX;
      const dx = Math.round(this.hitbox.x + offX - cam.x);
      ctx.save();
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(clip.image, sx, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
      return;
    }

    const dx = Math.round(this.hitbox.x + entry.drawOffsetX - cam.x);
    ctx.drawImage(clip.image, sx, 0, fw, fh, dx, dy, fw, fh);
  }

  /* Subclass hooks. The base never attacks on its own. */

  /** @returns {boolean} */
  shouldAttack() {
    return false;
  }

  /** @returns {number} px/s while attacking; override to move during the attack */
  attackVx() {
    return 0;
  }

  onAttackStart() {}

  /**
   * @param {number} _dt
   */
  onAttackStep(_dt) {}

  onAttackEnd() {}
}
